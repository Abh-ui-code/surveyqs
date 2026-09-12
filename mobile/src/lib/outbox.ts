/**
 * The sync outbox — durable write-ahead queue for finished interviews.
 *
 * Review & Submit hands one interview here and the outbox owns it from
 * that point on: it never talks to the caller again except through
 * `list()` / `onOutboxChange()`. Each interview becomes a short, ordered
 * chain of items matching POST /api/sync/batch/ exactly (docs/api/
 * SYNC_API.md): an optional `respondent.create`, an optional
 * `consent.create` chained to it via `parent_ref`, and a `response.submit`
 * chained to whichever of those ran. Attachments follow, one at a time,
 * to POST /api/sync/attachments/ once the response they belong to has a
 * server id.
 *
 * Storage: one index (metadata + status, the source of truth for order and
 * UI state) plus one payload blob per interview, so a large answer map
 * is only ever read/written for the interview being touched.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingAttachment } from "@surveyqs/shared";
import type { SyncBatchItem, SyncBatchResponse } from "@surveyqs/shared";

import { getCurrentUserId } from "./auth-store";
import { isOnline, onConnectivityChange } from "./net";
import { api } from "./api";

const INDEX_KEY = "surveyqs.outbox.index.v1";
const ITEM_KEY_PREFIX = "surveyqs.outbox.item.";

export type OutboxStatus = "pending" | "in_flight" | "done" | "failed" | "conflict";

export interface OutboxConflict {
  itemRef: string;
  code: string;
  detail: string;
  existing?: { id: string; full_name: string; phone: string; created_at: string };
  resolutions: string[];
}

export interface OutboxIndexEntry {
  id: string;
  status: OutboxStatus;
  userId: string | null;
  label: string; // "Farming Survey · Ramesh Patil"
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
  conflict?: OutboxConflict;
}

export interface OutboxInterview {
  id: string;
  userId: string | null;
  label: string;
  items: SyncBatchItem[];
  attachments: PendingAttachment[];
  enqueuedAt: string;
}

// ------------------------------------------------------------------
// Mutex — one JS-runtime-wide lock around every write, same reasoning as
// the reference implementation this is adapted from: JS is single
// threaded, so this only guards interleaved awaits within this module.
// ------------------------------------------------------------------
let chain: Promise<unknown> = Promise.resolve();
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a bad listener must not break the writer */
    }
  });
}

async function readIndex(): Promise<OutboxIndexEntry[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxIndexEntry[]) : [];
  } catch {
    return [];
  }
}
async function writeIndex(entries: OutboxIndexEntry[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}
function itemKey(id: string) {
  return `${ITEM_KEY_PREFIX}${id}`;
}
async function readItem(id: string): Promise<OutboxInterview | null> {
  const raw = await AsyncStorage.getItem(itemKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OutboxInterview;
  } catch {
    return null;
  }
}
async function writeItem(item: OutboxInterview): Promise<void> {
  await AsyncStorage.setItem(itemKey(item.id), JSON.stringify(item));
}
async function deleteItem(id: string): Promise<void> {
  await AsyncStorage.removeItem(itemKey(id));
}

function newId(): string {
  return `ob_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Enqueue a finished interview. Caller builds the item chain (see
 * hooks/use-submit-interview.ts) — the outbox only owns delivery. */
export async function enqueueInterview(args: {
  label: string;
  items: SyncBatchItem[];
  attachments: PendingAttachment[];
}): Promise<OutboxIndexEntry> {
  return withLock(async () => {
    const id = newId();
    const now = new Date().toISOString();
    const userId = getCurrentUserId();
    await writeItem({ id, userId, label: args.label, items: args.items, attachments: args.attachments, enqueuedAt: now });
    const index = await readIndex();
    const entry: OutboxIndexEntry = { id, status: "pending", userId, label: args.label, enqueuedAt: now, attempts: 0 };
    index.push(entry);
    await writeIndex(index);
    emit();
    return entry;
  });
}

export async function list(): Promise<OutboxIndexEntry[]> {
  const userId = getCurrentUserId();
  const all = await withLock(() => readIndex());
  return all.filter((e) => e.userId === userId);
}

async function patchEntry(id: string, patch: Partial<OutboxIndexEntry>): Promise<void> {
  await withLock(async () => {
    const index = await readIndex();
    const i = index.findIndex((e) => e.id === id);
    if (i < 0) return;
    index[i] = { ...index[i], ...patch };
    await writeIndex(index);
  });
  emit();
}

export async function remove(id: string): Promise<void> {
  await withLock(async () => {
    const index = await readIndex();
    await writeIndex(index.filter((e) => e.id !== id));
    await deleteItem(id);
  });
  emit();
}

/** Sync Review's Merge / Keep both / Discard actions. Patches the
 * conflicting item's payload with the server's chosen resolution and
 * re-queues the interview for another flush. */
export async function resolveConflict(
  id: string,
  resolution: "merge" | "keep_both" | "discard",
  mergeInto?: string,
): Promise<void> {
  if (resolution === "discard") {
    await remove(id);
    return;
  }
  const item = await withLock(() => readItem(id));
  if (!item) return;
  const patched = item.items.map((it) =>
    it.kind === "respondent.create" ? { ...it, resolution, merge_into: mergeInto } : it,
  );
  await withLock(() => writeItem({ ...item, items: patched }));
  await patchEntry(id, { status: "pending", conflict: undefined, lastError: undefined });
  void flush();
}

// ------------------------------------------------------------------
// Flush — the replayer.
// ------------------------------------------------------------------
let flushing = false;

// After this many failed attempts, an item stops auto-retrying and sits as
// "failed" until the agent taps Retry (or Delete) in the Sync tab. Without
// a cap, a permanently broken item (bad data that will 500 forever, not a
// transient network blip) retries silently every flush cycle forever,
// with no visible sign anything is wrong beyond an endless spinner.
const MAX_AUTO_RETRIES = 3;

export async function flush(): Promise<void> {
  if (flushing || !isOnline()) return;
  flushing = true;
  try {
    const pending = (await withLock(() => readIndex())).filter((e) => e.status === "pending");
    for (const entry of pending) {
      await flushOne(entry.id);
    }
  } finally {
    flushing = false;
  }
}

/** Sync tab's "Retry" button on a failed item — explicit, single-item,
 * resets the attempt counter's auto-retry eligibility for one more try. */
export async function retryItem(id: string): Promise<void> {
  await patchEntry(id, { status: "pending", lastError: undefined });
  void flush();
}

async function flushOne(id: string): Promise<void> {
  const item = await withLock(() => readItem(id));
  if (!item) return;
  await patchEntry(id, { status: "in_flight" });

  try {
    const res = await api.post<SyncBatchResponse>("/sync/batch/", { items: item.items });
    const byRef = new Map(res.results.map((r) => [r.ref, r]));

    const conflict = res.results.find((r) => r.status === "conflict");
    if (conflict) {
      await patchEntry(id, {
        status: "conflict",
        conflict: {
          itemRef: conflict.ref,
          code: conflict.code ?? "conflict",
          detail: conflict.detail ?? "This needs a decision.",
          existing: conflict.existing,
          resolutions: conflict.resolutions ?? ["discard"],
        },
      });
      return;
    }

    const rejected = res.results.find((r) => r.status === "rejected");
    if (rejected) {
      await patchEntry(id, {
        status: "failed",
        attempts: (await currentAttempts(id)) + 1,
        lastError: rejected.detail ?? "The office rejected this interview.",
      });
      return;
    }

    // All items landed. Upload attachments against the response's server id.
    const submitResult = item.items.find((it) => it.kind === "response.submit");
    const responseServerId = submitResult ? byRef.get(submitResult.ref)?.id : undefined;
    if (responseServerId && item.attachments.length > 0) {
      for (const att of item.attachments) {
        await uploadAttachment(responseServerId, att);
      }
    }

    await patchEntry(id, { status: "done" });
    await withLock(() => deleteItem(id));
  } catch (err) {
    // Network error, timeout, or 5xx. A 401 is handled transparently by
    // the API client's own refresh; if refresh itself fails,
    // onUnauthorized fires and the app signs out, which is the correct
    // outcome here too.
    //
    // Genuinely transient errors (a dropped connection, a momentary 500)
    // deserve automatic retry — but a payload that is simply broken looks
    // identical from here (also a 500), and would otherwise retry
    // silently forever. After MAX_AUTO_RETRIES, stop auto-retrying and
    // surface it as failed so the agent can see it and retry or discard.
    const attempts = (await currentAttempts(id)) + 1;
    await patchEntry(id, {
      status: attempts >= MAX_AUTO_RETRIES ? "failed" : "pending",
      attempts,
      lastError: describeNetworkError(err, attempts >= MAX_AUTO_RETRIES),
    });
  }
}

async function currentAttempts(id: string): Promise<number> {
  const index = await withLock(() => readIndex());
  return index.find((e) => e.id === id)?.attempts ?? 0;
}

function describeNetworkError(err: unknown, gaveUp: boolean): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const retrySuffix = gaveUp ? "Tap Retry to try again." : "Will retry automatically.";
  if (!status) return `No connection — ${retrySuffix}`;
  if (status >= 500) return `The office server had a problem — ${retrySuffix}`;
  return `Unexpected error (${status}) — ${retrySuffix}`;
}

async function uploadAttachment(responseServerId: string, att: PendingAttachment): Promise<void> {
  const form = new FormData();
  form.append("response_id", responseServerId);
  form.append("client_ref_id", att.ref);
  form.append("question_code", att.question_code);
  form.append("kind", att.kind);
  form.append("checksum", att.checksum);
  form.append("captured_at", att.captured_at);
  // RN's FormData accepts a {uri, name, type} object in place of a Blob.
  form.append("file", { uri: att.local_uri, name: att.filename, type: mimeFor(att.kind) } as unknown as Blob);
  await api.postMultipart("/sync/attachments/", form);
}

function mimeFor(kind: PendingAttachment["kind"]): string {
  switch (kind) {
    case "image":
      return "image/jpeg";
    case "signature":
      return "image/png";
    case "audio":
      return "audio/m4a";
    case "video":
      return "video/mp4";
    default:
      return "application/octet-stream";
  }
}

let monitorStarted = false;
/** Call once at app start: flushes on every reconnect and every 60s while
 * online, so a queue never waits on the agent remembering to tap Sync now. */
export function startOutboxMonitor(): void {
  if (monitorStarted) return;
  monitorStarted = true;
  onConnectivityChange((online) => {
    if (online) void flush();
  });
  setInterval(() => void flush(), 60_000);
  void flush();
}
