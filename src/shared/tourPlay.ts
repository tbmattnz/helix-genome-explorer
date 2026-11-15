// Playing tours.json: typed tours, question text, and where each step's target leads.
// Pure: no React. The explorer applies the result through its own navigation functions.
import { checkTours } from "./tours";
import type { GeneIndex, Gene } from "./genes";
import type { RegionSet } from "./regions";
import type { VariantSet } from "./variantView";

export type TourTarget = Record<string, unknown> & { view: string };
export type TourStep = { title: string; text: string; question: unknown; target: TourTarget };
export type Tour = { id: string; title: string; summary: string; steps: TourStep[] };
export type TourSet = { tours: Tour[]; byId: Record<string, Tour> };

export function buildTours(data: unknown): TourSet {
  const problems = checkTours(data);
  if (problems.length) throw new Error(`tours.json cannot be used: ${problems[0]}`);
  const d = data as { tours: Record<string, unknown>[] };
  const tours: Tour[] = d.tours.map((t) => ({
    id: String(t.id), title: String(t.title), summary: String(t.summary),
    steps: (t.steps as Record<string, unknown>[]).map((s) => ({
      title: String(s.title), text: String(s.text), question: s.question ?? null, target: s.target as TourTarget,
    })),
  }));
  return { tours, byId: Object.fromEntries(tours.map((t) => [t.id, t])) };
}

/** A question as readable text, whatever its shape. Never raw JSON. Null when there is nothing to show. */
export function questionText(q: unknown): string | null {
  const read = (v: unknown, depth: number): string => {
    if (v === null || v === undefined || depth > 4) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map((x) => read(x, depth + 1)).filter(Boolean).join(" ");
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      for (const k of ["text", "question", "prompt"]) if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
      return Object.values(o).map((x) => read(x, depth + 1)).filter(Boolean).join(" ");
    }
    return "";
  };
  const s = read(q, 0);
  return s ? s : null;
}

/** Which data files a target needs before it can be shown. */
export function targetNeeds(t: TourTarget): { genes: boolean; regions: boolean; variants: boolean } {
  return { genes: t.view === "gene", regions: t.view === "region" || t.view === "variant", variants: t.view === "variant" };
}

export type Avail<T> = { status: "ready"; value: T } | { status: "loading" } | { status: "error"; error: string };
export type Resolved =
  | { view: "map" }
  | { view: "chromosome"; index: number }
  | { view: "gene"; gene: Gene }
  | { view: "region"; region: string; codingStartGene: string | null }
  | { view: "variant"; region: string; variant: string; on: boolean }
  | { view: "notice"; text: string }
  | { view: "wait" };

type Sources = { chromosomes: string[]; genes: Avail<GeneIndex>; regions: Avail<RegionSet>; variants: Avail<VariantSet> };
const str = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));

/** Where a step leads, or a one-line notice when its file is missing or its id is not found. */
export function resolveTarget(t: TourTarget, src: Sources): Resolved {
  const need = <T,>(a: Avail<T>, file: string): T | Resolved => {
    if (a.status === "loading") return { view: "wait" };
    if (a.status === "error") return { view: "notice", text: `This step's view cannot be shown: ${a.error.includes(file) ? a.error : `${file} is not available. ${a.error}`}` };
    return a.value;
  };
  const isRes = (x: unknown): x is Resolved => !!x && typeof x === "object" && "view" in (x as object) && typeof (x as { view: unknown }).view === "string";
  switch (t.view) {
    case "map": return { view: "map" };
    case "chromosome": {
      const i = src.chromosomes.indexOf(str(t.chromosome));
      return i >= 0 ? { view: "chromosome", index: i } : { view: "notice", text: `This step points to chromosome ${str(t.chromosome)}, which is not in genome-overview.json.` };
    }
    case "gene": {
      const idx = need(src.genes, "genes.json");
      if (isRes(idx)) return idx;
      const g = idx.byChr[str(t.chromosome)]?.genes.find((x) => x.name === str(t.gene));
      return g ? { view: "gene", gene: g } : { view: "notice", text: `This step points to gene ${str(t.gene)} on chromosome ${str(t.chromosome)}, which is not in genes.json.` };
    }
    case "region": {
      const rs = need(src.regions, "gene-regions.json");
      if (isRes(rs)) return rs;
      const r = rs.byId[str(t.region)];
      if (!r) return { view: "notice", text: `This step points to region ${str(t.region)}, which is not in gene-regions.json.` };
      const gene = t.jump === "codingStart" && typeof t.gene === "string" ? t.gene : null;
      if (gene && !r.genes.some((g) => g.name === gene)) return { view: "notice", text: `This step points to gene ${gene}, which is not in region ${r.id}.` };
      return { view: "region", region: r.id, codingStartGene: gene };
    }
    case "variant": {
      const rs = need(src.regions, "gene-regions.json");
      if (isRes(rs)) return rs;
      const r = rs.byId[str(t.region)];
      if (!r) return { view: "notice", text: `This step points to region ${str(t.region)}, which is not in gene-regions.json.` };
      const vs = need(src.variants, "variants.json");
      if (isRes(vs)) return vs;
      const v = vs.variants.find((x) => x.id === str(t.variant));
      if (!v) return { view: "notice", text: `This step points to variant ${str(t.variant)}, which is not in variants.json.` };
      if (v.region !== r.id) return { view: "notice", text: `This step points to variant ${v.id}, which belongs to region ${v.region}, not ${r.id}.` };
      return { view: "variant", region: r.id, variant: v.id, on: t.showVariantVersion === true };
    }
  }
  return { view: "notice", text: `This step has a view HELIX does not know: ${str(t.view)}.` };
}
