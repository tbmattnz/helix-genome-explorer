// Pure model for gene-regions.json. Coordinates follow its meta.coordinates: startBp inclusive from 0,
// endBp exclusive; the letter at chromosome position p is letters[p - region.startBp].
import { checkGeneRegions } from "./dataChecks";
import type { Win } from "./genome";

export type Span = [number, number];
export type RegionGene = {
  name: string;
  fullName: string | null;
  strand: string | null;
  startBp: number;
  endBp: number;
  whollyInRegion: boolean;
  transcript: string | null;
  exons: Span[];
  coding: Span[];
  protein: string | null;
};
export type Region = {
  id: string;
  title: string;
  summary: string;
  focusGene: string;
  chromosome: string;
  startBp: number;
  endBp: number;
  genes: RegionGene[];
  letters: string;
};
export type RegionSet = { regions: Region[]; byId: Record<string, Region> };

/** Smallest view in the region view, in letters (a display rule, not data). */
export const REGION_MIN_BP = 100;

const isSpan = (v: unknown): v is Span =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n)) && (v[1] as number) > (v[0] as number);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

/** Build typed regions. Problems name the region and gene. Throws one plain message. */
export function buildRegions(data: unknown): RegionSet {
  const problems = checkGeneRegions(data);
  if (problems.length) throw new Error(`gene-regions.json cannot be used: ${problems[0]}`);
  const raw = (data as { regions: Record<string, unknown>[] }).regions;
  const regions: Region[] = raw.map((r) => {
    const id = String(r.id);
    const genes = (r.genes as Record<string, unknown>[]).map((g, j) => {
      const name = text(g.name) ?? `gene ${j + 1}`;
      const where = `region ${id} gene ${name}`;
      if (!Array.isArray(g.exons) || !g.exons.every(isSpan)) throw new Error(`gene-regions.json cannot be used: ${where} exons must be a list of [startBp, endBp] pairs`);
      if (!Array.isArray(g.coding) || !g.coding.every(isSpan)) throw new Error(`gene-regions.json cannot be used: ${where} coding must be a list of [startBp, endBp] pairs`);
      const sort = (a: Span[]) => [...a].sort((x, y) => x[0] - y[0]);
      return {
        name,
        fullName: text(g.fullName),
        strand: text(g.strand),
        startBp: Number(g.startBp),
        endBp: Number(g.endBp),
        whollyInRegion: g.whollyInRegion !== false,
        transcript: text(g.transcript),
        exons: sort(g.exons as Span[]),
        coding: sort(g.coding as Span[]),
        protein: text(g.protein),
      };
    });
    return {
      id,
      title: String(r.title),
      summary: String(r.summary),
      focusGene: String(r.focusGene),
      chromosome: String(r.chromosome),
      startBp: Number(r.startBp),
      endBp: Number(r.endBp),
      genes,
      letters: String(r.letters),
    };
  });
  return { regions, byId: Object.fromEntries(regions.map((r) => [r.id, r])) };
}

export const clip = (s: Span, lo: number, hi: number): Span | null => {
  const a = Math.max(s[0], lo), b = Math.min(s[1], hi);
  return b > a ? [a, b] : null;
};

/** Region views: any width from REGION_MIN_BP to the whole region, kept inside it. */
export function makeRegionWindow(r: Region, startBp: number, widthBp: number): Win {
  const len = r.endBp - r.startBp;
  const w = Math.round(Math.max(Math.min(REGION_MIN_BP, len), Math.min(len, widthBp)));
  const s = Math.round(Math.max(r.startBp, Math.min(r.endBp - w, startBp)));
  return { startBp: s, endBp: s + w };
}

export function regionZoomLevels(r: Region): number[] {
  const len = r.endBp - r.startBp;
  const steps = [200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  return [len, ...steps.filter((w) => w < len && w >= REGION_MIN_BP)];
}

/** Merge overlapping spans (sorted). */
export function union(spans: Span[]): Span[] {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

/** Letters in the window that are coding in any gene of the region (counted once even where genes overlap). */
export function codingLettersInView(r: Region, w: Win): number {
  const lo = Math.max(w.startBp, r.startBp), hi = Math.min(w.endBp, r.endBp);
  const parts = r.genes.flatMap((g) => g.coding.map((s) => clip(s, lo, hi)).filter((s): s is Span => !!s));
  return union(parts).reduce((n, [a, b]) => n + (b - a), 0);
}

/** Exon pieces for drawing: coding parts tall, untranslated parts short. */
export function exonPieces(g: RegionGene, exon: Span): { span: Span; coding: boolean }[] {
  const out: { span: Span; coding: boolean }[] = [];
  let at = exon[0];
  for (const c of g.coding) {
    const x = clip(c, exon[0], exon[1]);
    if (!x) continue;
    if (x[0] > at) out.push({ span: [at, x[0]], coding: false });
    out.push({ span: x, coding: true });
    at = x[1];
  }
  if (at < exon[1]) out.push({ span: [at, exon[1]], coding: false });
  return out;
}

/** Exons are numbered in the direction the gene is read: on the "-" strand, exon 1 is the rightmost. */
export const exonNumber = (g: RegionGene, i: number) => (g.strand === "-" ? g.exons.length - i : i + 1);

export type ExonFacts = { number: number; of: number; lengthBp: number; codingBp: number; kind: "coding" | "partly" | "untranslated"; outsideBp: number };

export function exonFacts(r: Region, g: RegionGene, i: number): ExonFacts {
  const e = g.exons[i];
  const len = e[1] - e[0];
  const codingBp = exonPieces(g, e).filter((p) => p.coding).reduce((n, p) => n + p.span[1] - p.span[0], 0);
  const inside = clip(e, r.startBp, r.endBp);
  return {
    number: exonNumber(g, i),
    of: g.exons.length,
    lengthBp: len,
    codingBp,
    kind: codingBp === len ? "coding" : codingBp === 0 ? "untranslated" : "partly",
    outsideBp: len - (inside ? inside[1] - inside[0] : 0),
  };
}

export function exonDescription(f: ExonFacts): string {
  const n = (v: number) => v.toLocaleString("en");
  if (f.kind === "coding") return "Coding: all of it codes for the protein";
  if (f.kind === "untranslated") return "Not coding: an untranslated end";
  return `Partly coding: ${n(f.codingBp)} coding letters and ${n(f.lengthBp - f.codingBp)} untranslated letters`;
}

/** The region whose focus gene this is, if any. */
export function regionForGene(set: RegionSet | null, name: string, chr: string): Region | null {
  return set?.regions.find((r) => r.focusGene === name && r.chromosome === chr) ?? null;
}
