import { XIcon } from "lucide-react";
import { fmt } from "../../shared/genome";
import type { Region } from "../../shared/regions";
import { aaInfo, type Codon } from "../../shared/protein";
import type { GeneReading } from "./LettersTrack";

/** Details for one amino acid: full name, position in the protein, its three letters and where they are. */
export function AminoPanel({ region, reading, codon, big, onClose }: { region: Region; reading: GeneReading; codon: Codon; big: boolean; onClose: () => void }) {
  const g = reading.gene;
  const total = g.protein ? g.protein.length : Math.max(0, reading.codons.length - 1);
  const minus = g.strand === "-";
  const info = codon.aa ? aaInfo(codon.aa) : null;
  const title = !info ? `Amino acid ${codon.index} of ${fmt(total)}` : codon.stop ? "Stop signal" : `${info.full}, ${fmt(codon.index)} of ${fmt(total)}`;
  const where = codon.parts.map(([a, b]) => (b - a === 1 ? fmt(a) : `${fmt(a)} to ${fmt(b - 1)}`));
  const rows: [string, string][] = [];
  if (info && !codon.stop) rows.push(["Short names", `${info.three}, ${info.one}`]);
  if (codon.stop) rows.push(["What it means", `The protein ends here, after amino acid ${fmt(total)}.`]);
  rows.push(["Protein", `${g.name}${g.fullName ? `, ${g.fullName}` : ""}`]);
  if (codon.bases) {
    rows.push(["Letters read", minus ? `${codon.bases} (the forward letters ${codon.forward}, read right to left and swapped A with T, C with G)` : codon.bases]);
  } else {
    rows.push(["Letters read", "Some of these letters lie outside the region, so this amino acid cannot be read here."]);
  }
  rows.push([
    "Position",
    codon.parts.length > 1
      ? `Split by an intron: ${codon.parts.map((p, k) => `${p[1] - p[0]} letter${p[1] - p[0] === 1 ? "" : "s"} at ${where[k]}`).join(", then ")}. The group of three continues in the next exon.`
      : `${where[0]} on chromosome ${region.chromosome}`,
  ]);
  return (
    <section aria-live="polite" aria-labelledby="amino-title" data-testid="amino-panel" className={`mt-3 max-w-2xl rounded-lg border border-divider-strong bg-surface p-4 ${big ? "text-lg" : "text-sm"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Amino acid in {g.name}</p>
          <h3 id="amino-title" className={`mt-1 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`} data-testid="amino-title">{title}</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text" aria-label="Close amino acid details">
          <XIcon size={18} />
        </button>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-text-muted">{k}</dt>
            <dd className="break-words text-text">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
