// Pure gene model for genes.json. Coordinates follow its meta.coordinates: startBp inclusive from 0,
// endBp exclusive, length = endBp - startBp. A gene is in view if any part of it is in the window.
import { checkGenes } from "./dataChecks";
import { GENE_TRACK_MAX_BP, type Win } from "./genome";

export type Gene = {
  name: string;
  fullName: string | null;
  startBp: number;
  endBp: number;
  strand: string | null;
  exons: number | null;
  aminoAcids: number | null;
  chr: string;
};
export type ChrGenes = { genes: Gene[]; maxLen: number };
export type GeneIndex = { byChr: Record<string, ChrGenes>; all: Gene[]; lower: { n: string; f: string }[]; chrOrder: string[] };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export function buildGeneIndex(data: unknown): GeneIndex {
  const problems = checkGenes(data);
  if (problems.length) throw new Error(`genes.json cannot be used: ${problems[0]}`);
  const d = data as { chromosomes: { name: string; genes: unknown[][] }[] };
  const byChr: Record<string, ChrGenes> = {};
  const all: Gene[] = [];
  for (const c of d.chromosomes) {
    const genes: Gene[] = [];
    for (const r of c.genes) {
      const start = num(r[2]), end = num(r[3]);
      if (start === null || end === null || end <= start || !text(r[0])) continue;
      genes.push({ name: String(r[0]), fullName: text(r[1]), startBp: start, endBp: end, strand: text(r[4]), exons: num(r[5]), aminoAcids: num(r[6]), chr: c.name });
    }
    genes.sort((a, b) => a.startBp - b.startBp);
    byChr[c.name] = { genes, maxLen: genes.reduce((m, g) => Math.max(m, g.endBp - g.startBp), 0) };
    all.push(...genes);
  }
  return { byChr, all, lower: all.map((g) => ({ n: g.name.toLowerCase(), f: (g.fullName ?? "").toLowerCase() })), chrOrder: d.chromosomes.map((c) => c.name) };
}

export const overlaps = (g: { startBp: number; endBp: number }, w: Win) => g.startBp < w.endBp && g.endBp > w.startBp;

/** Genes with any part in the window, in start order. Binary search, then a short scan. */
export function genesInWindow(cg: ChrGenes | undefined, w: Win): Gene[] {
  if (!cg) return [];
  const { genes, maxLen } = cg;
  const from = w.startBp - maxLen;
  let lo = 0, hi = genes.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (genes[m].startBp < from) lo = m + 1; else hi = m; }
  const out: Gene[] = [];
  for (let i = lo; i < genes.length && genes[i].startBp < w.endBp; i++) if (genes[i].endBp > w.startBp) out.push(genes[i]);
  return out;
}

/** Up to `limit` genes matching name or full name, best first. */
export function searchGenes(index: GeneIndex, query: string, limit = 10): { matches: Gene[]; total: number } {
  const s = query.trim().toLowerCase();
  if (!s) return { matches: [], total: 0 };
  const scored: [number, number][] = [];
  index.lower.forEach(({ n, f }, i) => {
    const sc = n === s ? 0 : n.startsWith(s) ? 1 : f.startsWith(s) ? 2 : n.includes(s) ? 3 : ` ${f}`.includes(` ${s}`) ? 4 : f.includes(s) ? 5 : -1;
    if (sc >= 0) scored.push([sc, i]);
  });
  const order = (g: Gene) => index.chrOrder.indexOf(g.chr);
  scored.sort((a, b) => {
    const ga = index.all[a[1]], gb = index.all[b[1]];
    return a[0] - b[0] || ga.name.length - gb.name.length || ga.name.localeCompare(gb.name) || order(ga) - order(gb);
  });
  return { matches: scored.slice(0, limit).map(([, i]) => index.all[i]), total: scored.length };
}

/** A window that fits the whole gene with a margin, never wider than the gene-track limit. */
export function fitWindowFor(g: Gene): { startBp: number; widthBp: number } {
  const len = g.endBp - g.startBp;
  const width = Math.min(GENE_TRACK_MAX_BP, Math.max(len * 1.3, 2000));
  return { startBp: (g.startBp + g.endBp) / 2 - width / 2, widthBp: width };
}

export function directionText(strand: string | null): string | null {
  if (strand === "+") return "Read left to right along the chromosome (+ strand)";
  if (strand === "-") return "Read right to left along the chromosome (- strand)";
  return strand;
}

/** Gene card rows. Any value that is null is left out. */
export function cardRows(g: Gene): { label: string; value: string }[] {
  const f = (n: number) => n.toLocaleString("en");
  const rows: { label: string; value: string | null }[] = [
    { label: "Name", value: g.name },
    { label: "Full name", value: g.fullName },
    { label: "Length", value: `${f(g.endBp - g.startBp)} letters` },
    { label: "Direction", value: directionText(g.strand) },
    { label: "Exons", value: g.exons === null ? null : f(g.exons) },
    { label: "Protein length", value: g.aminoAcids === null ? null : `${f(g.aminoAcids)} amino acids` },
  ];
  return rows.filter((r): r is { label: string; value: string } => r.value !== null);
}
