import { useEffect, useSyncExternalStore } from "react";
import { loadDataFile } from "../overviewLoader";
import { buildGeneIndex, type GeneIndex } from "../../shared/genes";

// genes.json is loaded the first time a screen needs it (gene track or gene search), never at start-up.
export type GenesState = { status: "idle" | "loading" | "ready" | "error"; index: GeneIndex | null; error: string | null };

let state: GenesState = { status: "idle", index: null, error: null };
const subs = new Set<() => void>();
let requested = false;
let generation = 0;
export const genesStats = { requests: 0 };

function set(s: GenesState) {
  state = s;
  subs.forEach((f) => f());
}

function friendly(msg: string) {
  return /not stored/i.test(msg) ? "genes.json is missing from this release." : msg;
}

export function requestGenes() {
  requested = true;
  if (state.status === "loading" || state.status === "ready") return;
  const gen = ++generation;
  genesStats.requests++;
  set({ status: "loading", index: null, error: null });
  loadDataFile("genes.json")
    .then((d) => { if (gen === generation) set({ status: "ready", index: buildGeneIndex(d), error: null }); })
    .catch((e) => { if (gen === generation) set({ status: "error", index: null, error: friendly(e instanceof Error ? e.message : String(e)) }); });
}


export function useGenes(need: boolean): GenesState {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  useEffect(() => { if (need) requestGenes(); }, [need]);
  return s;
}
