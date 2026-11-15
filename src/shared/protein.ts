// Reading genes from the region letters, following gene-regions.json meta.notes:
// letters are the forward strand, the letter at chromosome position p is letters[p - region.startBp].
// "+" strand: join coding letters left to right. "-" strand: join, reverse, swap A with T and C with G.
// Read in threes, the result spells the protein and then a stop signal.
// The notes give no codon table, so the standard genetic code is used; checkProtein proves it per gene.
import { clip, makeRegionWindow, type Region, type RegionGene, type Span } from "./regions";
import type { Win } from "./genome";

/** Letters are shown at this many letters in view or fewer (a display rule, not data). */
export const LETTERS_MAX_BP = 200;
export const lettersVisible = (spanBp: number) => spanBp <= LETTERS_MAX_BP;

const BASES = "TCAG";
const TABLE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const SWAP: Record<string, string> = { A: "T", T: "A", C: "G", G: "C", N: "N" };

const NAMES: Record<string, [string, string]> = {
  A: ["Ala", "Alanine"], R: ["Arg", "Arginine"], N: ["Asn", "Asparagine"], D: ["Asp", "Aspartic acid"], C: ["Cys", "Cysteine"],
  Q: ["Gln", "Glutamine"], E: ["Glu", "Glutamic acid"], G: ["Gly", "Glycine"], H: ["His", "Histidine"], I: ["Ile", "Isoleucine"],
  L: ["Leu", "Leucine"], K: ["Lys", "Lysine"], M: ["Met", "Methionine"], F: ["Phe", "Phenylalanine"], P: ["Pro", "Proline"],
  S: ["Ser", "Serine"], T: ["Thr", "Threonine"], W: ["Trp", "Tryptophan"], Y: ["Tyr", "Tyrosine"], V: ["Val", "Valine"],
  U: ["Sec", "Selenocysteine"], "*": ["Stop", "Stop signal"],
};
export const aaInfo = (aa: string) => ({ one: aa, three: NAMES[aa]?.[0] ?? aa, full: NAMES[aa]?.[1] ?? `Unknown (${aa})` });

export function translateCodon(bases: string): string | null {
  if (bases.length !== 3) return null;
  const i = [...bases].map((b) => BASES.indexOf(b));
  if (i.some((v) => v < 0)) return null;
  return TABLE[i[0] * 16 + i[1] * 4 + i[2]];
}

export function letterAt(r: Region, p: number): string | null {
  if (p < r.startBp || p >= r.endBp) return null;
  return r.letters[p - r.startBp]?.toUpperCase() ?? null;
}

/** Every coding position of the gene, in the order the gene is read. */
export function codingPositions(g: RegionGene): number[] {
  const spans = [...g.coding].sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  if (g.strand === "-") {
    for (let s = spans.length - 1; s >= 0; s--) for (let p = spans[s][1] - 1; p >= spans[s][0]; p--) out.push(p);
  } else {
    for (const [a, b] of spans) for (let p = a; p < b; p++) out.push(p);
  }
  return out;
}

export type Codon = {
  index: number; // 1-based position in the protein (the stop signal comes after the last amino acid)
  positions: number[]; // in reading order
  bases: string | null; // in reading order, already swapped for "-" genes; null if a letter lies outside the region
  forward: string | null; // the same letters as they appear on the forward strand, left to right
  aa: string | null;
  stop: boolean;
  parts: Span[]; // contiguous pieces in reading order (two when an intron splits the three)
  main: number; // index of the larger part, where the amino acid is shown
  // Set only in a variant version (shared/variantView.ts applyVariant):
  changed?: boolean; // differs from the reference amino acid at this place
  joined?: boolean; // its letters sit either side of missing letters
  notMade?: boolean; // after an early stop: in the reference protein, not made by the variant
};

export type CodonOptions = { letter?: (p: number) => string | null; skip?: Set<number> };

export function codonsFor(r: Region, g: RegionGene, opts: CodonOptions = {}): Codon[] {
  const skip = opts.skip;
  const pos = skip?.size ? codingPositions(g).filter((p) => !skip.has(p)) : codingPositions(g);
  const letterOf = opts.letter ?? ((p: number) => letterAt(r, p));
  const out: Codon[] = [];
  const minus = g.strand === "-";
  for (let i = 0; i < pos.length; i += 3) {
    const ps = pos.slice(i, i + 3);
    const raw = ps.map((p) => letterOf(p));
    const known = raw.every((x): x is string => x !== null);
    const bases = known ? raw.map((b) => (minus ? SWAP[b] ?? b : b)).join("") : null;
    const forward = known ? [...ps].map((p, k) => [p, raw[k] as string] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join("") : null;
    const parts: Span[] = [];
    let run: number[] = [ps[0]];
    for (let k = 1; k <= ps.length; k++) {
      if (k < ps.length && Math.abs(ps[k] - ps[k - 1]) === 1) run.push(ps[k]);
      else {
        parts.push([Math.min(...run), Math.max(...run) + 1]);
        if (k < ps.length) run = [ps[k]];
      }
    }
    let main = 0;
    parts.forEach((p, k) => { if (p[1] - p[0] > parts[main][1] - parts[main][0]) main = k; });
    const aa = bases ? translateCodon(bases) : null;
    out.push({ index: i / 3 + 1, positions: ps, bases, forward, aa, stop: aa === "*", parts, main });
  }
  return out;
}

/** True when every letter between a and b is a skipped (missing) letter: the two sides join up. */
export function gapOnly(a: number, b: number, skip: Set<number>) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (hi - lo < 2) return false;
  for (let p = lo + 1; p < hi; p++) if (!skip.has(p)) return false;
  return true;
}

export const codonInWindow = (c: Codon, w: Win) => c.positions.some((p) => p >= w.startBp && p < w.endBp);

export type ProteinCheck =
  | { status: "match"; length: number }
  | { status: "mismatch"; at: number; fromLetters: string; fromFile: string; length: number }
  | { status: "partial" }
  | { status: "none" };

/** For a gene wholly in the region, the protein read from the letters must equal the file's protein, then a stop. */
export function checkProtein(r: Region, g: RegionGene, codons = codonsFor(r, g)): ProteinCheck {
  if (!g.whollyInRegion) return { status: "partial" };
  if (!g.protein) return { status: "none" };
  const derived = codons.map((c) => c.aa ?? "?").join("");
  const expected = `${g.protein}*`;
  const n = Math.max(derived.length, expected.length);
  for (let i = 0; i < n; i++) {
    if (derived[i] !== expected[i]) {
      return { status: "mismatch", at: i + 1, fromLetters: derived[i] ?? "nothing", fromFile: expected[i] ?? "nothing", length: g.protein.length };
    }
  }
  return { status: "match", length: g.protein.length };
}

/** Where coding starts, in the direction the gene is read (first coding letter). */
export function codingStartBp(g: RegionGene): number | null {
  if (!g.coding.length) return null;
  return g.strand === "-" ? Math.max(...g.coding.map((c) => c[1])) - 1 : Math.min(...g.coding.map((c) => c[0]));
}

/** Exon indexes in reading order. */
export const exonOrder = (g: RegionGene) => {
  const idx = g.exons.map((_, i) => i);
  return g.strand === "-" ? idx.reverse() : idx;
};

/** The first letter of an exon in reading direction. */
export const exonStartBp = (g: RegionGene, i: number) => (g.strand === "-" ? g.exons[i][1] - 1 : g.exons[i][0]);

export type NextExon = { ok: true; index: number; target: number } | { ok: false; reason: string };

/**
 * The next exon in reading direction: after the given exon, or after the centre of the view when none is chosen.
 * Exons that lie wholly outside the region are skipped (they have no letters here).
 */
export function nextExon(r: Region, g: RegionGene, fromExon: number | null, centreBp: number): NextExon {
  const order = exonOrder(g);
  const minus = g.strand === "-";
  let k: number;
  if (fromExon !== null) k = order.indexOf(fromExon) + 1;
  else {
    k = order.findIndex((i) => (minus ? exonStartBp(g, i) < centreBp : exonStartBp(g, i) > centreBp));
    if (k < 0) k = order.length;
  }
  for (; k < order.length; k++) {
    const i = order[k];
    if (clip(g.exons[i], r.startBp, r.endBp)) {
      const t = exonStartBp(g, i);
      return { ok: true, index: i, target: Math.max(r.startBp, Math.min(r.endBp - 1, t)) };
    }
    return { ok: false, reason: "The next exon lies outside this region, so it has no letters here." };
  }
  if (fromExon !== null) {
    const n = order.indexOf(fromExon) + 1;
    return { ok: false, reason: `Exon ${n} is the last exon of ${g.name}.` };
  }
  return { ok: false, reason: `There is no exon of ${g.name} after this view.` };
}

/** A window of `width` letters centred on the target, inside the region. */
export const jumpWindow = (r: Region, target: number, width: number) => makeRegionWindow(r, target + 0.5 - width / 2, width);
