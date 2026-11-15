import { useEffect, useSyncExternalStore } from "react";
import { loadDataFile } from "../overviewLoader";
import { buildRegions, type RegionSet } from "../../shared/regions";

// gene-regions.json is loaded the first time a screen needs it (the regions list is opened, a gene card
// checks for a region, or a region view opens), never at start-up.
export type RegionsState = { status: "idle" | "loading" | "ready" | "error"; set: RegionSet | null; error: string | null };

const FILE = "gene-regions.json";
let state: RegionsState = { status: "idle", set: null, error: null };
const subs = new Set<() => void>();
let requested = false;
let generation = 0;
export const regionsStats = { requests: 0 };

function set(s: RegionsState) {
  state = s;
  subs.forEach((f) => f());
}

export function requestRegions() {
  requested = true;
  if (state.status === "loading" || state.status === "ready") return;
  const gen = ++generation;
  regionsStats.requests++;
  set({ status: "loading", set: null, error: null });
  loadDataFile(FILE)
    .then((d) => { if (gen === generation) set({ status: "ready", set: buildRegions(d), error: null }); })
    .catch((e) => {
      if (gen !== generation) return;
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", set: null, error: /not stored/i.test(msg) ? `${FILE} is missing from this release.` : msg });
    });
}


export function useRegions(need: boolean): RegionsState {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  useEffect(() => { if (need) requestRegions(); }, [need]);
  return s;
}
