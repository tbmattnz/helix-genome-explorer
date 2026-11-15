// Reading variants.json for the region view: build typed variants, put the effect and the frequency into words.
// Positions and letters are on the forward strand, with the same rules as gene-regions.json.
import { checkVariants } from "./variants";
import { codonsFor, gapOnly, letterAt, type Codon } from "./protein";
import type { Region, RegionGene } from "./regions";

export type VariantKind = "one letter changed" | "letters missing";
export type Variant = {
  id: string; region: string; gene: string; title: string; summary: string; chromosome: string; kind: VariantKind;
  startBp: number; endBp: number; referenceLetters: string; variantLetters: string;
  effect: Record<string, unknown> | null; frequency: Record<string, unknown> | null;
};
export type VariantSet = { variants: Variant[]; byRegion: Record<string, Variant[]>; notes: string[]; allNotes: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const n = (v: number) => v.toLocaleString("en");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function buildVariants(data: unknown): VariantSet {
  const problems = checkVariants(data);
  if (problems.length) throw new Error(`variants.json cannot be used: ${problems[0]}`);
  const d = data as { meta?: { notes?: unknown }; variants: Record<string, unknown>[] };
  const variants: Variant[] = d.variants.map((v) => ({
    id: String(v.id), region: String(v.region), gene: String(v.gene), title: String(v.title), summary: String(v.summary),
    chromosome: String(v.chromosome), kind: v.kind as VariantKind, startBp: Number(v.startBp), endBp: Number(v.endBp),
    referenceLetters: String(v.referenceLetters), variantLetters: String(v.variantLetters ?? ""),
    effect: isObj(v.effect) ? v.effect : null, frequency: isObj(v.frequency) ? v.frequency : null,
  }));
  const byRegion: Record<string, Variant[]> = {};
  for (const v of variants) (byRegion[v.region] ??= []).push(v);
  for (const list of Object.values(byRegion)) list.sort((a, b) => a.startBp - b.startBp);
  const raw = d.meta?.notes;
  const notes = Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string") : [];
  return { variants, byRegion, notes: notes.slice(-2), allNotes: notes };
}

export const variantsForRegion = (set: VariantSet | null, regionId: string): Variant[] => set?.byRegion[regionId] ?? [];

/** The effect in words, from the effect record. Null when the record is missing a field it needs. */
export function effectText(e: unknown): string | null {
  if (!isObj(e)) return null;
  const pos = num(e.position), from = str(e.from);
  switch (e.type) {
    case "amino acid changed": {
      const to = str(e.to);
      return pos !== null && from && to ? `Amino acid ${n(pos)} changes from ${from} to ${to}` : null;
    }
    case "early stop": {
      if (pos === null || !from) return null;
      const made = num(e.aminoAcidsMade), full = num(e.aminoAcidsInFullProtein);
      return `Amino acid ${n(pos)} (${from}) becomes a stop signal${made !== null && full !== null ? `, so the protein ends after ${n(made)} of its ${n(full)} amino acids` : ""}`;
    }
    case "amino acid left out":
      return pos !== null && from ? `Amino acid ${n(pos)} (${from}) is left out of the protein` : null;
    case "no protein change": {
      const lies = str(e.liesIn);
      const b = isObj(e.lettersBeforeCodingStartOf) ? e.lettersBeforeCodingStartOf : null;
      const bg = b ? str(b.gene) : null, bl = b ? num(b.letters) : null;
      return `No amino acid changes${lies ? `: it lies in ${lies}` : ""}${bg && bl !== null ? `, ${n(bl)} letters before the start of coding of ${bg}` : ""}`;
    }
  }
  return null;
}

export function frequencyShare(f: unknown): number | null {
  if (!isObj(f)) return null;
  const s = num(f.share);
  if (s !== null && s >= 0 && s <= 1) return s;
  const a = num(f.copiesWithVariant), b = num(f.copiesCounted);
  return a !== null && b ? a / b : null;
}

/** "about 1 in N gene copies" for rare variants (N to two figures); a percentage from 1% up, where it reads better. */
export function formatFrequency(f: unknown): string | null {
  const s = frequencyShare(f);
  if (s === null) return null;
  if (s === 0) {
    const b = isObj(f) ? num(f.copiesCounted) : null;
    return `None of the ${b ? `${n(b)} ` : ""}gene copies counted in gnomAD`;
  }
  if (s >= 0.01) return `${Math.round(s * 1000) / 10}% of gene copies among people in gnomAD`;
  const N = 1 / s;
  const d = 10 ** (Math.floor(Math.log10(N)) - 1);
  return `about 1 in ${n(Math.round(N / d) * d)} gene copies among people in gnomAD`;
}

export function frequencyCounts(f: unknown): string | null {
  if (!isObj(f)) return null;
  const a = num(f.copiesWithVariant), b = num(f.copiesCounted);
  return a !== null && b !== null ? `${n(a)} of the ${n(b)} gene copies counted have it` : null;
}

const SWAP: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };
/** For a "-" strand gene the change reads as complementary letters in the gene's own direction (meta.notes). */
export function geneDirection(ref: string, alt: string, strand: string | null): { ref: string; alt: string } | null {
  if (strand !== "-") return null;
  const rc = (s: string) => [...s.toUpperCase()].reverse().map((c) => SWAP[c] ?? c).join("");
  return { ref: rc(ref), alt: rc(alt) };
}

export function variantAria(v: Variant): string {
  const len = v.endBp - v.startBp;
  const where = v.kind === "letters missing"
    ? `${len} letter${len === 1 ? "" : "s"} missing from ${n(v.startBp)} to ${n(v.endBp - 1)}`
    : `one letter changed at ${n(v.startBp)}`;
  return `Variant ${v.id}, ${v.title}: ${where}, in ${v.gene}`;
}

export type VariantReading = {
  codons: Codon[]; // made codons in reading order (ending at the stop), then any not-made reference codons
  madeLength: number; // amino acids made, the stop not counted
  refLength: number;
  earlyStopAt: number | null; // 1-based index of the new stop, when it comes before the reference stop
  leftOut: number; // amino acids fewer than the reference (missing letters)
  same: boolean; // protein identical to the reference
};

/**
 * The gene read with the variant applied. Positions stay at their reference places so the drawing lines up.
 * One letter changed: the variant letter replaces it. Letters missing: those positions are skipped, so the
 * threes after the gap are read from the letters that remain. Reading stops at the first stop signal.
 */
export function applyVariant(r: Region, g: RegionGene, v: Variant): VariantReading {
  const ref = codonsFor(r, g);
  const missing = v.kind === "letters missing";
  const skip = new Set<number>();
  if (missing) for (let p = v.startBp; p < v.endBp; p++) skip.add(p);
  const letter = (p: number) => {
    if (!missing && p >= v.startBp && p < v.endBp) return v.variantLetters[p - v.startBp]?.toUpperCase() ?? null;
    return letterAt(r, p);
  };
  const all = codonsFor(r, g, { letter, skip });
  const refStop = ref.findIndex((c) => c.stop);
  const stop = all.findIndex((c) => c.stop);
  const made = stop >= 0 ? all.slice(0, stop + 1) : all;
  const inCoding = ref.some((c) => c.positions.some((p) => skip.has(p)));
  const leftOut = missing && inCoding && skip.size % 3 === 0 ? skip.size / 3 : 0;
  const gapAt = ref.findIndex((x) => x.positions.some((p) => skip.has(p)));
  const marked = made.map((c, i) => {
    const joined = missing && c.positions.some((p, k) => k > 0 && gapOnly(c.positions[k - 1], p, skip));
    // After missing letters the protein is shorter, so compare with the reference shifted by the amino acids left out.
    const refC = leftOut && gapAt >= 0 && i >= gapAt ? ref[i + leftOut] : ref[i];
    const changed = joined || !refC || refC.aa !== c.aa;
    return { ...c, changed, joined };
  });
  const earlyStopAt = stop >= 0 && refStop >= 0 && stop < refStop - leftOut ? stop + 1 : null;
  const notMade = earlyStopAt ? ref.slice(stop + 1).map((c) => ({ ...c, notMade: true, changed: false })) : [];
  const same = !missing || !inCoding ? marked.every((c) => !c.changed) && made.length === ref.slice(0, refStop + 1).length : false;
  return {
    codons: [...marked, ...notMade],
    madeLength: Math.max(0, stop >= 0 ? stop : made.length),
    refLength: refStop >= 0 ? refStop : ref.length,
    earlyStopAt, leftOut, same,
  };
}

/** The variant letter shown at a forward-strand position: a letter, "gap" for missing letters, or null when unchanged. */
export function variantLetterAt(v: Variant, p: number): string | null {
  if (p < v.startBp || p >= v.endBp) return null;
  if (v.kind === "letters missing") return "gap";
  return v.variantLetters[p - v.startBp]?.toUpperCase() ?? null;
}

/** A note line from meta.notes, found by what it is about (quoted from the data, never written in code). */
export function findNote(notes: string[], test: RegExp): string | null {
  return notes.find((n) => test.test(n)) ?? null;
}
export const METHIONINE_NOTE = /methionine/i;

/**
 * For learners: only the counting part of the methionine note, from the sentence that says how positions count.
 * "position counts ..." becomes "Positions count ...". The words otherwise stay as the data gives them.
 */
export function countingNote(note: string | null): string | null {
  if (!note) return null;
  const at = note.search(/\bpositions? counts? amino acids/i);
  if (at < 0) return null;
  return note.slice(at).replace(/^positions? counts?/i, "Positions count").trim();
}
export const REFERENCE_NOTE = /reference genome (is|was) (one|a single|built)|one example|not (a |the )?(normal|perfect|ideal)/i;

export function variantsErrorText(msg: string): string {
  return /not stored|not found|404|no such/i.test(msg) ? "variants.json is unavailable in this release." : msg;
}
