import { useEffect, useSyncExternalStore } from "react";
import { loadDataFile } from "../overviewLoader";
import { buildVariants, variantsErrorText, type VariantSet } from "../../shared/variantView";

// variants.json is loaded the first time a region view opens, never at start-up.
export type VariantsState = { status: "idle" | "loading" | "ready" | "error"; set: VariantSet | null; error: string | null };

const FILE = "variants.json";
let state: VariantsState = { status: "idle", set: null, error: null };
const subs = new Set<() => void>();
let requested = false;
let generation = 0;
export const variantsStats = { requests: 0 };

function set(s: VariantsState) {
  state = s;
  subs.forEach((f) => f());
}

export function requestVariants() {
  requested = true;
  if (state.status === "loading" || state.status === "ready") return;
  const gen = ++generation;
  variantsStats.requests++;
  set({ status: "loading", set: null, error: null });
  loadDataFile(FILE)
    .then((d) => { if (gen === generation) set({ status: "ready", set: buildVariants(d), error: null }); })
    .catch((e) => { if (gen === generation) set({ status: "error", set: null, error: variantsErrorText(e instanceof Error ? e.message : String(e)) }); });
}


export function useVariants(need: boolean): VariantsState {
  const s = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => state);
  useEffect(() => { if (need) requestVariants(); }, [need]);
  return s;
}
