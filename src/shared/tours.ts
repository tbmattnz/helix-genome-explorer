// Content checks for tours.json. Returns plain-language problems (empty list = fine). Never throws.

export const TOURS_NAME = "tours.json";
export const TOUR_VIEWS = ["map", "chromosome", "gene", "region", "variant"];
const MAX_LISTED = 20;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const text = (v: unknown) => typeof v === "string" && v.trim() !== "";
const has = (o: Record<string, unknown>, k: string) => o[k] !== undefined && o[k] !== null;

export function capTourProblems(p: string[]): string[] {
  return p.length > MAX_LISTED ? [...p.slice(0, MAX_LISTED), `and ${p.length - MAX_LISTED} more`] : p;
}

const tourLabel = (t: unknown, i: number) => (isObj(t) && text(t.id) ? `tour ${t.id}` : `tours[${i}]`);

/** Problems with one step's target (the view and the fields that view needs). */
function targetProblems(target: unknown, where: string): string[] {
  if (!isObj(target)) return [`${where} target is not an object`];
  const view = target.view;
  if (!has(target, "view")) return [`${where} target has no view`];
  if (typeof view !== "string" || !TOUR_VIEWS.includes(view)) {
    return [`${where} target view is "${String(view)}"; it must be one of ${TOUR_VIEWS.join(", ")}`];
  }
  const p: string[] = [];
  const need = (fields: string[]) => {
    const missing = fields.filter((f) => !text(target[f]));
    if (missing.length) p.push(`${where} target view "${view}" needs ${missing.join(" and ")}`);
  };
  if (view === "map") {
    const extra = Object.keys(target).filter((k) => k !== "view");
    if (extra.length) p.push(`${where} target view "map" takes no other fields (found ${extra.join(", ")})`);
  } else if (view === "chromosome") need(["chromosome"]);
  else if (view === "gene") need(["chromosome", "gene"]);
  else if (view === "region") {
    need(["region"]);
    const g = has(target, "gene"), j = has(target, "jump");
    if (g !== j) p.push(`${where} target view "region" has ${g ? "gene without jump" : "jump without gene"}; give both or neither`);
    if (g && !text(target.gene)) p.push(`${where} target gene is not text`);
    if (j && target.jump !== "codingStart") p.push(`${where} target jump is "${String(target.jump)}"; it must be "codingStart"`);
  } else if (view === "variant") {
    need(["region", "variant"]);
    if (typeof target.showVariantVersion !== "boolean") {
      p.push(`${where} target view "variant" needs showVariantVersion set to true or false`);
    }
  }
  return p;
}

/** Rules that need only tours.json itself. */
export function checkTours(data: unknown, file = TOURS_NAME): string[] {
  if (!isObj(data)) return [`${file} must contain a JSON object at the top level.`];
  if (!Array.isArray(data.tours)) return [`${file} has no tours list`];
  if (data.tours.length === 0) return [`${file} tours is empty; it needs at least one tour`];
  const p: string[] = [];
  const seen = new Map<string, number>();
  let steps = 0;
  data.tours.forEach((t, i) => {
    if (!isObj(t)) { p.push(`${file}: tours[${i}] is not an object`); return; }
    const label = tourLabel(t, i);
    const missing = ["id", "title", "summary"].filter((f) => !text(t[f]));
    if (!Array.isArray(t.steps)) missing.push("steps");
    if (missing.length) p.push(`${file}: ${label} has no ${missing.join(", ")}`);
    if (text(t.id)) {
      const id = t.id as string;
      if (seen.has(id)) p.push(`${file}: tour id ${id} is used more than once (tours ${seen.get(id)! + 1} and ${i + 1})`);
      else seen.set(id, i);
    }
    if (!Array.isArray(t.steps)) return;
    if (t.steps.length === 0) p.push(`${file}: ${label} steps is empty; it needs at least one step`);
    t.steps.forEach((s, k) => {
      steps++;
      const where = `${file}: ${label} step ${k + 1}`;
      if (!isObj(s)) { p.push(`${where} is not an object`); return; }
      const miss = ["title", "text"].filter((f) => !text(s[f]));
      if (!has(s, "target")) miss.push("target");
      if (miss.length) p.push(`${where} has no ${miss.join(", ")}`);
      if (has(s, "target")) p.push(...targetProblems(s.target, where));
    });
  });
  const totals = isObj(data.totals) ? data.totals : {};
  if (!isInt(totals.tours)) p.push(`${file} has no totals.tours number`);
  else if (totals.tours !== data.tours.length) p.push(`${file} totals.tours is ${totals.tours}, but the file has ${data.tours.length} tours`);
  if (!isInt(totals.steps)) p.push(`${file} has no totals.steps number`);
  else if (totals.steps !== steps) p.push(`${file} totals.steps is ${totals.steps}, but the file has ${steps} steps`);
  return capTourProblems(p);
}

export type TourSources = { overview: unknown | null; genes: unknown | null; regions: unknown | null; variants: unknown | null };
export const TOUR_SKIP_NOTES = {
  overview: "Chromosome check skipped: genome-overview.json is unavailable in this release.",
  genes: "Gene check skipped: genes.json is unavailable in this release.",
  regions: "Region check skipped: gene-regions.json is unavailable in this release.",
  variants: "Variant check skipped: variants.json is unavailable in this release.",
};
const PASS_NAMES = { overview: "genome-overview.json", genes: "genes.json", regions: "gene-regions.json", variants: "variants.json" };

/**
 * Cross-check every target against the other stored files. A file given as null is not stored: that check is
 * skipped and a note says so. Returns problems (upload refused when any) and notes for the upload row.
 */
export function crossCheckTours(data: unknown, src: TourSources, file = TOURS_NAME): { problems: string[]; notes: string[] } {
  const p: string[] = [];
  if (!isObj(data) || !Array.isArray(data.tours)) return { problems: [], notes: [] };
  const list = (o: unknown, k: string) => (isObj(o) && Array.isArray(o[k]) ? (o[k] as unknown[]).filter(isObj) : []);
  const chromosomes = new Set(list(src.overview, "chromosomes").map((c) => String(c.name)));
  const genesOn = new Map<string, Set<string>>();
  for (const c of list(src.genes, "chromosomes")) {
    const rows = Array.isArray(c.genes) ? c.genes : [];
    genesOn.set(String(c.name), new Set(rows.map((r) => (Array.isArray(r) ? String(r[0]) : ""))));
  }
  const regions = new Map(list(src.regions, "regions").map((r) => [String(r.id), r]));
  const regionGenes = (r: Record<string, unknown>) =>
    new Set((Array.isArray(r.genes) ? r.genes : []).map((g) => (typeof g === "string" ? g : isObj(g) ? String(g.name) : "")));
  const variants = new Map(list(src.variants, "variants").map((v) => [String(v.id), v]));
  const used = { overview: false, genes: false, regions: false, variants: false };

  data.tours.forEach((t, i) => {
    if (!isObj(t) || !Array.isArray(t.steps)) return;
    const label = tourLabel(t, i);
    t.steps.forEach((s, k) => {
      const g = isObj(s) && isObj(s.target) ? s.target : null;
      if (!g) return;
      const where = `${file}: ${label} step ${k + 1}`;
      const chr = text(g.chromosome) ? String(g.chromosome) : null;
      const gene = text(g.gene) ? String(g.gene) : null;
      const reg = text(g.region) ? String(g.region) : null;
      if ((g.view === "chromosome" || g.view === "gene") && chr) {
        used.overview = true;
        if (src.overview && !chromosomes.has(chr)) p.push(`${where} chromosome "${chr}" is not in genome-overview.json`);
      }
      if (g.view === "gene" && chr && gene) {
        used.genes = true;
        if (src.genes) {
          const on = genesOn.get(chr);
          if (!on) p.push(`${where} chromosome "${chr}" is not in genes.json`);
          else if (!on.has(gene)) {
            const elsewhere = [...genesOn].find(([, set]) => set.has(gene))?.[0];
            p.push(elsewhere ? `${where} gene ${gene} is on chromosome ${elsewhere} in genes.json, not chromosome ${chr}` : `${where} gene ${gene} is not in genes.json`);
          }
        }
      }
      if ((g.view === "region" || g.view === "variant") && reg) {
        used.regions = true;
        if (src.regions) {
          const r = regions.get(reg);
          if (!r) p.push(`${where} region "${reg}" is not a region id in gene-regions.json`);
          else if (g.view === "region" && gene && !regionGenes(r).has(gene)) p.push(`${where} gene ${gene} is not one of the genes in region ${reg}`);
        }
      }
      if (g.view === "variant" && text(g.variant)) {
        used.variants = true;
        if (src.variants) {
          const v = variants.get(String(g.variant));
          if (!v) p.push(`${where} variant "${String(g.variant)}" is not in variants.json`);
          else if (reg && String(v.region) !== reg) p.push(`${where} variant ${String(g.variant)} belongs to region ${String(v.region)} in variants.json, not ${reg}`);
        }
      }
    });
  });

  const notes: string[] = [];
  const passed: string[] = [];
  for (const k of ["overview", "genes", "regions", "variants"] as const) {
    if (!used[k]) continue;
    if (src[k] === null) notes.push(TOUR_SKIP_NOTES[k]);
    else passed.push(PASS_NAMES[k]);
  }
  if (passed.length && !p.length) notes.unshift(`Targets checked against ${passed.join(", ")}.`);
  return { problems: capTourProblems(p), notes };
}
