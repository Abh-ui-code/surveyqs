import * as Network from "expo-network";

let online = true;
const listeners = new Set<(online: boolean) => void>();

export function isOnline(): boolean {
  return online;
}

export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function poll() {
  try {
    const state = await Network.getNetworkStateAsync();
    const next = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (next !== online) {
      online = next;
      listeners.forEach((fn) => {
        try {
          fn(online);
        } catch {
          /* a bad listener must not break polling */
        }
      });
    }
  } catch {
    // Leave `online` as-is on a transient read failure.
  }
}

let started = false;
/** Call once at app start. Polls rather than subscribing to a native event
 * — expo-network has no change listener, and a 5s poll is cheap and exact
 * enough for a "should the outbox try to flush" decision. */
export function startConnectivityMonitor(): void {
  if (started) return;
  started = true;
  void poll();
  setInterval(poll, 5000);
}
