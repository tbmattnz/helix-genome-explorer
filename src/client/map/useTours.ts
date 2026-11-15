import { useEffect, useSyncExternalStore } from "react";
import { loadDataFile } from "../overviewLoader";
import { buildTours, type TourSet } from "../../shared/tourPlay";

// tours.json is loaded the first time the Guided tours list opens, never at start-up.
export type ToursState = { status: "idle" | "loading" | "ready" | "error"; set: TourSet | null; error: string | null };

const FILE = "tours.json";
let state: ToursState = { status: "idle", set: null, error: null };
const subs = new Set<() => void>();
let requested = false;
let generation = 0;
export const toursStats = { requests: 0 };

function set(s: ToursState) {
  state = s;
  subs.forEach((f) => f());
}

export function requestTours() {
  requested = true;
  if (state.status === "loading" || state.status === "ready") return;
  const gen = ++generation;
  toursStats.requests++;
  set({ status: "loading", set: null, error: null });
  loadDataFile(FILE)
    .then((d) => { if (gen === generation) set({ status: "ready", set: buildTours(d), error: null }); })
    .catch((e) => {
      if (gen !== generation) return;
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", set: null, error: /not stored|not found|404/i.test(msg) ? "tours.json is unavailable in this release." : msg });
    });
}


export function useTours(need: boolean): ToursState {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  useEffect(() => { if (need) requestTours(); }, [need]);
  return s;
}
