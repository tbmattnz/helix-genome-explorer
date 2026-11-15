// Content checks for named data files. Returns plain-language problems (empty list = fine). Never throws.
import { VARIANTS_NAME, checkVariants } from "./variants";
import { TOURS_NAME, checkTours } from "./tours";

export const GENE_COLUMNS = ["name", "fullName", "startBp", "endBp", "strand", "exons", "aminoAcids"];
export const CHROMOSOME_NAMES = [...Array.from({ length: 22 }, (_, i) => String(i + 1)), "X", "Y"];
const REGION_FIELDS = ["id", "title", "summary", "focusGene", "chromosome", "startBp", "endBp", "genes", "letters"];
const MAX_LISTED = 6;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function capped(problems: string[]): string[] {
  return problems.length > MAX_LISTED ? [...problems.slice(0, MAX_LISTED), `and ${problems.length - MAX_LISTED} more problems`] : problems;
}

/** genes.json: chromosomes[].genes holds rows of 7 values in meta.columns order. */
export function checkGenes(data: unknown, file = "genes.json"): string[] {
  const p: string[] = [];
  if (!isObj(data)) return [`${file} must contain a JSON object at the top level.`];
  const cols = isObj(data.meta) ? data.meta.columns : undefined;
  if (!Array.isArray(cols)) p.push(`${file} has no meta.columns list`);
  else if (cols.length !== GENE_COLUMNS.length || cols.some((c, i) => c !== GENE_COLUMNS[i])) {
    p.push(`${file} meta.columns must be exactly ${GENE_COLUMNS.join(", ")} (found ${cols.map(String).join(", ") || "an empty list"})`);
  }
  let rows = 0;
  if (!Array.isArray(data.chromosomes)) p.push(`${file} has no chromosomes list`);
  else {
    const chrs = data.chromosomes;
    if (chrs.length !== 24) p.push(`${file} chromosomes has ${chrs.length} entries; it needs 24 (1 to 22, X and Y)`);
    const names = chrs.map((c) => (isObj(c) && typeof c.name === "string" ? c.name : null));
    const missing = CHROMOSOME_NAMES.filter((n) => !names.includes(n));
    const extra = names.filter((n) => n === null || !CHROMOSOME_NAMES.includes(n));
    const dupes = names.filter((n, i) => n !== null && names.indexOf(n) !== i);
    if (missing.length) p.push(`${file} chromosomes is missing ${missing.join(", ")}`);
    if (extra.length) p.push(`${file} chromosomes has entries not named 1 to 22, X or Y: ${extra.map((n) => n ?? "(no name)").join(", ")}`);
    if (dupes.length) p.push(`${file} chromosomes names ${[...new Set(dupes)].join(", ")} more than once`);
    const bad: string[] = [];
    chrs.forEach((c, i) => {
      const label = names[i] ? `chromosome ${names[i]}` : `chromosomes[${i}]`;
      const genes = isObj(c) ? c.genes : undefined;
      if (!Array.isArray(genes)) { p.push(`${file}: ${label} has no genes list`); return; }
      genes.forEach((row, j) => {
        rows++;
        if (!Array.isArray(row)) bad.push(`${label} gene row ${j + 1} is not a list`);
        else if (row.length !== GENE_COLUMNS.length) bad.push(`${label} gene row ${j + 1} has ${row.length} values, not 7`);
      });
    });
    if (bad.length) p.push(...bad.slice(0, 3), ...(bad.length > 3 ? [`${bad.length} gene rows in all do not have 7 values`] : []));
  }
  const total = isObj(data.totals) ? data.totals.genes : undefined;
  if (!isInt(total)) p.push(`${file} has no totals.genes number`);
  else if (Array.isArray(data.chromosomes) && total !== rows) p.push(`${file} totals.genes is ${total}, but the file has ${rows} gene rows`);
  return capped(p);
}

/** gene-regions.json: regions[] each with a stretch of letters and the genes it covers. */
export function checkGeneRegions(data: unknown, file = "gene-regions.json"): string[] {
  const p: string[] = [];
  if (!isObj(data)) return [`${file} must contain a JSON object at the top level.`];
  if (!Array.isArray(data.regions)) return [`${file} has no regions list`];
  if (data.regions.length === 0) return [`${file} regions is empty; it needs at least one region`];
  data.regions.forEach((r, i) => {
    if (!isObj(r)) { p.push(`${file}: regions[${i}] is not an object`); return; }
    const label = typeof r.id === "string" && r.id ? `region ${r.id}` : `regions[${i}]`;
    const missing = REGION_FIELDS.filter((f) => r[f] === undefined || r[f] === null);
    if (missing.length) { p.push(`${file}: ${label} has no ${missing.join(", ")}`); }
    if (r.startBp !== undefined && !isInt(r.startBp)) p.push(`${file}: ${label} startBp is not a whole number`);
    if (r.endBp !== undefined && !isInt(r.endBp)) p.push(`${file}: ${label} endBp is not a whole number`);
    if (r.genes !== undefined && !Array.isArray(r.genes)) p.push(`${file}: ${label} genes is not a list`);
    if (r.letters !== undefined && typeof r.letters !== "string") p.push(`${file}: ${label} letters is not text`);
    if (isInt(r.startBp) && isInt(r.endBp) && typeof r.letters === "string") {
      const want = r.endBp - r.startBp;
      if (want <= 0) p.push(`${file}: ${label} endBp must be greater than startBp`);
      else if (r.letters.length !== want) p.push(`${file}: ${label} letters has ${r.letters.length} characters; endBp minus startBp is ${want}`);
    }
    if (r.focusGene !== undefined && Array.isArray(r.genes)) {
      const names = r.genes.map((g) => (typeof g === "string" ? g : isObj(g) ? g.name : undefined));
      if (!names.includes(r.focusGene)) p.push(`${file}: ${label} focus gene ${String(r.focusGene)} is not in its genes list`);
    }
  });
  return capped(p);
}

/** The content check for a stored name, or null when the name has no extra rules. */
export function contentCheckFor(name: string): ((data: unknown, file?: string) => string[]) | null {
  if (name === "genes.json") return checkGenes;
  if (name === "gene-regions.json") return checkGeneRegions;
  if (name === VARIANTS_NAME) return checkVariants;
  if (name === TOURS_NAME) return checkTours;
  return null;
}

/** One message for an upload row. */
export function contentError(name: string, data: unknown, displayName = name): string | null {
  const check = contentCheckFor(name);
  if (!check) return null;
  const problems = check(data, displayName);
  return problems.length ? `${displayName} was not stored. ${problems.join(". ")}.` : null;
}
