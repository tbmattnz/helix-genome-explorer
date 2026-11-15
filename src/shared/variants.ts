// Content checks for variants.json. Returns plain-language problems (empty list = fine). Never throws.

export const VARIANTS_NAME = "variants.json";
export const VARIANT_FIELDS = [
  "id", "region", "gene", "title", "summary", "chromosome", "kind", "startBp", "endBp",
  "referenceLetters", "variantLetters", "effect", "frequency",
];
export const VARIANT_KINDS = ["one letter changed", "letters missing"];
export const REGION_CHECK_SKIPPED = "Region check skipped: gene-regions.json is unavailable in this release.";
const MAX_LISTED = 20;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export function capVariantProblems(p: string[]): string[] {
  return p.length > MAX_LISTED ? [...p.slice(0, MAX_LISTED), `and ${p.length - MAX_LISTED} more`] : p;
}

const labelOf = (v: unknown, i: number) => (isObj(v) && typeof v.id === "string" && v.id ? `variant ${v.id}` : `variants[${i}]`);

/** Rules that need only variants.json itself. */
export function checkVariants(data: unknown, file = VARIANTS_NAME): string[] {
  if (!isObj(data)) return [`${file} must contain a JSON object at the top level.`];
  if (!Array.isArray(data.variants)) return [`${file} has no variants list`];
  if (data.variants.length === 0) return [`${file} variants is empty; it needs at least one variant`];
  const p: string[] = [];
  const seen = new Map<string, number>();
  data.variants.forEach((v, i) => {
    if (!isObj(v)) { p.push(`${file}: variants[${i}] is not an object`); return; }
    const label = labelOf(v, i);
    const missing = VARIANT_FIELDS.filter((f) => v[f] === undefined || v[f] === null);
    if (missing.length) p.push(`${file}: ${label} has no ${missing.join(", ")}`);
    if (typeof v.id === "string" && v.id) {
      if (seen.has(v.id)) p.push(`${file}: variant id ${v.id} is used more than once (entries ${seen.get(v.id)! + 1} and ${i + 1})`);
      else seen.set(v.id, i);
    }
    if (v.kind !== undefined && v.kind !== null && !VARIANT_KINDS.includes(v.kind as string)) {
      p.push(`${file}: ${label} kind is "${String(v.kind)}"; it must be "one letter changed" or "letters missing"`);
    }
    if (v.startBp !== undefined && v.startBp !== null && !isInt(v.startBp)) p.push(`${file}: ${label} startBp is not a whole number`);
    if (v.endBp !== undefined && v.endBp !== null && !isInt(v.endBp)) p.push(`${file}: ${label} endBp is not a whole number`);
    if (v.referenceLetters !== undefined && v.referenceLetters !== null && typeof v.referenceLetters !== "string") p.push(`${file}: ${label} referenceLetters is not text`);
    if (isInt(v.startBp) && isInt(v.endBp) && typeof v.referenceLetters === "string") {
      const want = v.endBp - v.startBp;
      if (want !== v.referenceLetters.length) {
        p.push(`${file}: ${label} endBp minus startBp is ${want}, but referenceLetters has ${v.referenceLetters.length} letter${v.referenceLetters.length === 1 ? "" : "s"}`);
      }
    }
  });
  const total = isObj(data.totals) ? data.totals.variants : undefined;
  if (!isInt(total)) p.push(`${file} has no totals.variants number`);
  else if (total !== data.variants.length) p.push(`${file} totals.variants is ${total}, but the file has ${data.variants.length} variants`);
  return capVariantProblems(p);
}

/** Cross-check against gene-regions.json: region id exists, positions inside it, letters match. */
export function crossCheckVariants(data: unknown, regionsData: unknown, file = VARIANTS_NAME): string[] {
  if (!isObj(data) || !Array.isArray(data.variants)) return [];
  const regions = isObj(regionsData) && Array.isArray(regionsData.regions) ? regionsData.regions.filter(isObj) : [];
  const byId = new Map(regions.filter((r) => typeof r.id === "string").map((r) => [r.id as string, r]));
  const p: string[] = [];
  data.variants.forEach((v, i) => {
    if (!isObj(v)) return;
    const label = labelOf(v, i);
    if (typeof v.region !== "string") return;
    const r = byId.get(v.region);
    if (!r) { p.push(`${file}: ${label} region "${v.region}" is not a region id in gene-regions.json`); return; }
    if (!isInt(v.startBp) || !isInt(v.endBp) || typeof v.referenceLetters !== "string") return;
    if (!isInt(r.startBp) || !isInt(r.endBp) || typeof r.letters !== "string") return;
    if (v.startBp < r.startBp || v.endBp > r.endBp) {
      p.push(`${file}: ${label} runs from ${v.startBp} to ${v.endBp}, outside region ${v.region} (${r.startBp} to ${r.endBp})`);
      return;
    }
    const there = r.letters.slice(v.startBp - r.startBp, v.endBp - r.startBp);
    if (there.toUpperCase() !== v.referenceLetters.toUpperCase()) {
      p.push(`${file}: ${label} referenceLetters are ${v.referenceLetters}, but region ${v.region} has ${there || "no letters"} at ${v.startBp}`);
    }
  });
  return capVariantProblems(p);
}
