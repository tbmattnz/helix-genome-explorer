// Pure genome model: validation of genome-overview.json and view maths. Every genome number comes from the file.

export type Band = { name: string; startBp: number; endBp: number; stain: string };
export type Chromosome = {
  name: string;
  lengthBp: number;
  centromere: { startBp: number; midBp: number; endBp: number };
  proteinCodingGenes: number;
  geneDensity: number[];
  bands: Band[];
};
export type Source = { name: string; provider: string; usedFor: string; file: string; url: string; terms: string };
export type Genome = {
  title: string;
  assembly: string | null;
  binSizeBp: number;
  stains: Record<string, string>;
  chromosomes: Chromosome[];
  totals: { lengthBp: number | null; proteinCodingGenes: number | null };
  meta: Record<string, unknown>;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Check everything the map needs. Problems name the exact field. Never throws. */
export function parseGenome(data: unknown, file = "genome-overview.json"): { ok: true; genome: Genome } | { ok: false; problems: string[] } {
  const p: string[] = [];
  if (!isObj(data)) return { ok: false, problems: [`${file} must contain a JSON object at the top level.`] };
  const meta = isObj(data.meta) ? data.meta : {};
  const bin = meta.binSizeBp;
  if (!isNum(bin) || bin <= 0) p.push(`${file} has no meta.binSizeBp (a positive number)`);
  const stains = isObj(meta.stains) ? (meta.stains as Record<string, unknown>) : null;
  if (!stains) p.push(`${file} has no meta.stains key`);
  const list = Array.isArray(data.chromosomes) ? data.chromosomes : [];
  const chromosomes: Chromosome[] = [];
  list.forEach((raw, i) => {
    if (!isObj(raw)) { p.push(`${file}: chromosomes[${i}] is not an object`); return; }
    const label = typeof raw.name === "string" && raw.name ? `chromosome ${raw.name}` : `chromosomes[${i}]`;
    if (typeof raw.name !== "string" || !raw.name) p.push(`${file}: chromosomes[${i}] has no name`);
    if (!isNum(raw.lengthBp) || raw.lengthBp <= 0) p.push(`${file}: ${label} has no lengthBp`);
    const cen = raw.centromere;
    if (!isObj(cen) || !isNum(cen.startBp) || !isNum(cen.midBp) || !isNum(cen.endBp)) p.push(`${file}: ${label} has no centromere with startBp, midBp and endBp`);
    if (!isNum(raw.proteinCodingGenes)) p.push(`${file}: ${label} has no proteinCodingGenes`);
    if (!Array.isArray(raw.geneDensity) || !raw.geneDensity.every(isNum)) p.push(`${file}: ${label} has no geneDensity list of numbers`);
    const bands = Array.isArray(raw.bands) ? raw.bands : null;
    if (!bands) p.push(`${file}: ${label} has no bands list`);
    else bands.forEach((b, j) => {
      if (!isObj(b) || typeof b.name !== "string" || !isNum(b.startBp) || !isNum(b.endBp) || typeof b.stain !== "string") {
        p.push(`${file}: ${label} band ${j + 1} needs name, startBp, endBp and stain`);
      }
    });
    chromosomes.push(raw as unknown as Chromosome);
  });
  if (p.length) return { ok: false, problems: p.slice(0, 8).concat(p.length > 8 ? [`and ${p.length - 8} more problems`] : []) };
  const totals = isObj(data.totals) ? data.totals : {};
  return {
    ok: true,
    genome: {
      title: String((meta as { title?: unknown }).title ?? ""),
      assembly: typeof meta.assembly === "string" ? meta.assembly : null,
      binSizeBp: bin as number,
      stains: Object.fromEntries(Object.entries(stains!).map(([k, v]) => [k, String(v)])),
      chromosomes,
      totals: {
        lengthBp: isNum(totals.lengthBp) ? totals.lengthBp : null,
        proteinCodingGenes: isNum(totals.proteinCodingGenes) ? totals.proteinCodingGenes : null,
      },
      meta,
    },
  };
}

// ---- Gene density levels (thresholds come from the data) ----

export type DensityScale = { thresholds: number[]; max: number; ranges: { level: number; label: string }[] };

/** Level 0 is an empty block; levels 1-5 split the non-empty blocks of the whole genome into fifths. */
export function densityScale(g: Genome): DensityScale {
  const vals = g.chromosomes.flatMap((c) => c.geneDensity).filter((v) => v > 0).sort((a, b) => a - b);
  const max = vals.length ? vals[vals.length - 1] : 0;
  const q = (f: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(f * vals.length))] : 0);
  const raw = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const thresholds: number[] = [];
  for (const t of raw) thresholds.push(Math.max(t, (thresholds[thresholds.length - 1] ?? 0) + 1));
  // Level n covers (prev, thresholds[n-1]]; last level up to max.
  const bounds = [0, ...thresholds, Math.max(max, (thresholds[3] ?? 0) + 1)];
  const ranges = [{ level: 0, label: "0" }];
  for (let l = 1; l <= 5; l++) {
    const lo = Math.floor(bounds[l - 1]) + 1;
    const hi = Math.floor(bounds[l]);
    ranges.push({ level: l, label: lo >= hi ? `${hi}` : `${lo} to ${hi}` });
  }
  return { thresholds, max, ranges };
}

export function densityLevel(s: DensityScale, v: number): number {
  if (v <= 0) return 0;
  for (let i = 0; i < s.thresholds.length; i++) if (v <= s.thresholds[i]) return i + 1;
  return 5;
}

// ---- Zoom window (always on block boundaries, so gene counts in view are exact) ----

export type Win = { startBp: number; endBp: number };

export const blockCount = (c: Chromosome, bin: number) => Math.ceil(c.lengthBp / bin);

export function zoomWidths(c: Chromosome, bin: number): number[] {
  const n = blockCount(c, bin);
  return [n, ...[200, 100, 50, 20, 10, 5].filter((w) => w < n)];
}

export function makeWindow(c: Chromosome, bin: number, startBlock: number, widthBlocks: number): Win {
  const n = blockCount(c, bin);
  const w = Math.max(1, Math.min(n, widthBlocks));
  const s = Math.max(0, Math.min(n - w, Math.round(startBlock)));
  return { startBp: s * bin, endBp: Math.min(c.lengthBp, (s + w) * bin) };
}

export function windowBlocks(w: Win, bin: number) {
  const start = Math.round(w.startBp / bin);
  return { start, width: Math.ceil(w.endBp / bin) - start };
}

/** Protein-coding genes whose midpoint is in view: the sum of the blocks in the window. */
export function genesInView(c: Chromosome, bin: number, w: Win): number {
  let sum = 0;
  const { start, width } = windowBlocks(w, bin);
  for (let i = start; i < start + width && i < c.geneDensity.length; i++) sum += c.geneDensity[i];
  return sum;
}

/** At or below this many letters in view, the zoom shows individual genes (a display rule, not genome data). */
export const GENE_TRACK_MAX_BP = 5_000_000;

/** Zoom levels in letters, widest first: the whole chromosome, then round widths. */
export function zoomLevelsBp(c: Chromosome): number[] {
  const steps = [200e6, 100e6, 50e6, 20e6, 10e6, 5e6, 2e6, 1e6, 5e5, 2e5, 1e5, 5e4, 2e4, 1e4];
  return [c.lengthBp, ...steps.filter((w) => w < c.lengthBp)];
}

/**
 * A window of about widthBp letters starting near startBp, kept inside the chromosome.
 * Wider than the gene-track limit it snaps to whole blocks, so block gene counts stay exact.
 */
export function makeWindowBp(c: Chromosome, bin: number, startBp: number, widthBp: number): Win {
  const len = c.lengthBp;
  const w = Math.max(1, Math.min(len, Math.round(widthBp)));
  if (w > GENE_TRACK_MAX_BP) {
    const n = Math.ceil(len / bin);
    const wB = Math.min(n, Math.ceil(w / bin));
    const sB = Math.max(0, Math.min(n - wB, Math.round(startBp / bin)));
    return { startBp: sB * bin, endBp: Math.min(len, (sB + wB) * bin) };
  }
  const s = Math.max(0, Math.min(len - w, Math.round(startBp)));
  return { startBp: s, endBp: s + w };
}

export const isBlockWindow = (c: Chromosome, bin: number, w: Win) =>
  w.startBp % bin === 0 && (w.endBp % bin === 0 || w.endBp === c.lengthBp);

/** Ruler tick step in letters: a round number giving about 5-10 ticks. */
export function tickStep(spanBp: number, target = 8): number {
  const steps: number[] = [25e6];
  for (let e = 1; e <= 8; e++) for (const m of [1, 2, 5]) steps.push(m * 10 ** e);
  steps.sort((a, b) => a - b);
  return steps.find((s) => spanBp / s <= target) ?? 1e8;
}

/** Ruler label in millions of letters, with enough decimals for the step. */
export function rulerLabel(bp: number, step: number): string {
  if (step >= 1e6) return mb(bp);
  return (bp / 1e6).toFixed(Math.min(6, Math.ceil(-Math.log10(step / 1e6))));
}

export const fmt = (n: number) => n.toLocaleString("en");
export const mb = (bp: number) => {
  const v = bp / 1_000_000;
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1).replace(/\.0$/, "") : v.toFixed(2).replace(/\.?0+$/, "");
};
