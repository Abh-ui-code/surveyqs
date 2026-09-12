/**
 * Small external store mirroring the fix applied to the web app's logout
 * flash: every query gated on "am I signed in" reads from one flag that
 * flips synchronously at the start of sign-out, before anything is
 * cleared — so nothing can race a stale, unauthenticated refetch. Also
 * carries the current user id, which the drafts store and outbox use to
 * scope local data per agent (a shared field phone must not mix one
 * agent's drafts into another's).
 */
import { useSyncExternalStore } from "react";

interface AuthState {
  active: boolean;
  userId: string | null;
}

let state: AuthState = { active: false, userId: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setAuthActive(active: boolean, userId: string | null = null): void {
  state = { active, userId: active ? userId : null };
  emit();
}

export function getCurrentUserId(): string | null {
  return state.userId;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useIsAuthActive(): boolean {
  return useSyncExternalStore(subscribe, () => state.active, () => state.active);
}

export function useCurrentUserId(): string | null {
  return useSyncExternalStore(subscribe, () => state.userId, () => state.userId);
}
