/**
 * Local CRUD for an in-progress interview — the "editable, updatable"
 * surface of the app. A draft lives entirely on-device until Review &
 * Submit hands it to the outbox (outbox.ts); nothing here ever talks to
 * the network.
 *
 * One draft covers the whole interview: respondent, consent, every
 * section's answers, and where the agent currently is. Autosaved on every
 * change (see useDraft's debounced write in hooks/use-drafts.ts) so a
 * force-stop or a dead battery loses nothing, per
 * docs/guides/AGENT_MOBILE_GUIDE.md's "saved automatically after every
 * question" promise.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AnswerMap, GeoPoint, PendingAttachment } from "@surveyqs/shared";

import { getCurrentUserId } from "./auth-store";

const STORAGE_KEY = "surveyqs.drafts.v1";

export type ConsentMethod = "verbal_confirmed" | "signature" | "photo";

export interface DraftRespondent {
  /** Set once the agent picks an existing match from the dedupe lookup —
   * everything after that is read-only/prefilled. */
  existingId?: string;
  phone: string;
  full_name: string;
  /** Same field set the web app's respondent form captures
   * (RespondentStep in collect/_components) — kept identical so a
   * respondent created from either client looks the same record. */
  email?: string;
  gender?: string;
  address?: string;
  geography_node?: string;
}

export interface DraftConsent {
  notice_id: string;
  language: string;
  method: ConsentMethod;
  granted_at: string;
  signature_local_uri?: string;
}

export interface InterviewDraft {
  id: string;
  userId: string | null;
  surveyId: string;
  surveyTitle: string;
  /** Absent for a resubmission draft — a rejected response's original
   * assignment isn't exposed by the read API, and the server accepts a
   * submission without one (apps/responses/services.py only reads it via
   * `.get`). */
  assignmentId?: string;
  versionId: string;
  schemaHash?: string;
  startedAt: string;
  currentSectionIndex: number;
  respondent: DraftRespondent | null;
  consent: DraftConsent | null;
  answers: AnswerMap;
  gps?: GeoPoint;
  attachments: PendingAttachment[];
  /** Set when this draft is an edit of a response the office rejected —
   * resubmitting reuses this id server-side instead of creating a new one. */
  resubmitOfResponseId?: string;
  updatedAt: string;
}

async function readAll(): Promise<InterviewDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InterviewDraft[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(drafts: InterviewDraft[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

function newId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateDraftInput {
  surveyId: string;
  surveyTitle: string;
  assignmentId?: string;
  versionId: string;
  schemaHash?: string;
  resubmitOfResponseId?: string;
  initialAnswers?: AnswerMap;
}

/** Create — a fresh interview, or a rejected response reopened for edit. */
export async function createDraft(input: CreateDraftInput): Promise<InterviewDraft> {
  const draft: InterviewDraft = {
    id: newId(),
    userId: getCurrentUserId(),
    surveyId: input.surveyId,
    surveyTitle: input.surveyTitle,
    assignmentId: input.assignmentId,
    versionId: input.versionId,
    schemaHash: input.schemaHash,
    startedAt: new Date().toISOString(),
    currentSectionIndex: 0,
    respondent: null,
    consent: null,
    answers: input.initialAnswers ?? {},
    attachments: [],
    resubmitOfResponseId: input.resubmitOfResponseId,
    updatedAt: new Date().toISOString(),
  };
  const all = await readAll();
  all.push(draft);
  await writeAll(all);
  return draft;
}

/** Read (one). */
export async function getDraft(id: string): Promise<InterviewDraft | null> {
  const all = await readAll();
  return all.find((d) => d.id === id) ?? null;
}

/** Read (list) — scoped to the signed-in agent; a shared phone must never
 * show one agent's in-progress interview to another. */
export async function listDrafts(): Promise<InterviewDraft[]> {
  const userId = getCurrentUserId();
  const all = await readAll();
  return all
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Update — merges a partial patch and bumps `updatedAt`. Used for every
 * answer change, section navigation, respondent pick and consent capture. */
export async function updateDraft(id: string, patch: Partial<Omit<InterviewDraft, "id" | "userId">>): Promise<InterviewDraft | null> {
  const all = await readAll();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const next: InterviewDraft = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  all[i] = next;
  await writeAll(all);
  return next;
}

/** Delete — discarding a draft, or removing it once the outbox has taken
 * ownership of the finished interview. */
export async function deleteDraft(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((d) => d.id !== id));
}
