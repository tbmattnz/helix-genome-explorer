import { XIcon } from "lucide-react";
import { fmt } from "../../shared/genome";
import { directionText } from "../../shared/genes";
import { exonDescription, exonFacts, type Region } from "../../shared/regions";
import type { RegionPick } from "./RegionGenes";
import type { NextExon, ProteinCheck } from "../../shared/protein";
import { btnSecondary } from "../ui";

export type Jumps = {
  codingStart: { ok: true } | { ok: false; reason: string };
  next: NextExon;
  check: ProteinCheck;
  onCodingStart: () => void;
  onNextExon: () => void;
};

function checkText(c: ProteinCheck): string {
  if (c.status === "match") return `The protein read from the letters matches the file: ${fmt(c.length)} amino acids, then a stop signal.`;
  if (c.status === "mismatch") return `Does not match: at amino acid ${fmt(c.at)} the letters give ${c.fromLetters} but the file gives ${c.fromFile}.`;
  if (c.status === "partial") return "Not checked: only part of this gene is in the region.";
  return "Not checked: the file gives no protein for this gene.";
}

/** Details for the selected gene or exon in the region view. Null values are left out. */
export function RegionCard({ region, pick, big, onClose, jumps }: { region: Region; pick: NonNullable<RegionPick>; big: boolean; onClose: () => void; jumps: Jumps }) {
  const g = region.genes.find((x) => x.name === pick.gene);
  // Focus stays on the gene or exon, so arrow keys keep working; the card is announced instead.
  if (!g) return null;
  const rows: [string, string | null][] = [];
  let title: string;
  let kicker: string;
  if (pick.exon === null) {
    kicker = `Gene in this region, chromosome ${region.chromosome}`;
    title = g.name;
    rows.push(
      ["Full name", g.fullName],
      ["Length", `${fmt(g.endBp - g.startBp)} letters, from ${fmt(g.startBp)} to ${fmt(g.endBp)}`],
      ["Direction", directionText(g.strand)],
      ["Exons", fmt(g.exons.length)],
      ["Coding letters", fmt(g.coding.reduce((n, [a, b]) => n + b - a, 0))],
      ["In this region", g.whollyInRegion ? "All of it" : "Only part of it; the rest lies outside the region and is not drawn"],
      ["Version shown", g.transcript],
      ["Protein check", checkText(jumps.check)],
    );
  } else {
    const f = exonFacts(region, g, pick.exon);
    const e = g.exons[pick.exon];
    kicker = `${g.name}, numbered in the direction the gene is read`;
    title = `Exon ${f.number} of ${f.of}`;
    rows.push(
      ["Length", `${fmt(f.lengthBp)} letters`],
      ["Coding", exonDescription(f)],
      ["Position", `${fmt(e[0])} to ${fmt(e[1])} on chromosome ${region.chromosome}`],
      ["Outside the region", f.outsideBp ? `${fmt(f.outsideBp)} of its letters lie outside the region` : null],
    );
  }
  return (
    <section aria-live="polite" aria-labelledby="region-card-title" data-testid="region-card" className={`mt-4 max-w-2xl rounded-lg border border-divider-strong bg-surface p-5 ${big ? "text-lg" : "text-sm"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{kicker}</p>
          <h3 id="region-card-title" className={`mt-1 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`} data-testid="region-card-title">{title}</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text" aria-label="Close details" data-testid="region-card-close">
          <XIcon size={18} />
        </button>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
        {rows.filter((r): r is [string, string] => r[1] !== null).map(([k, v]) => (
          <div key={k} className="contents" data-testid={`region-row-${k}`}>
            <dt className="font-medium text-text-muted">{k}</dt>
            <dd className="break-words text-text">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-divider pt-4" data-testid="jump-controls">
        <div className="flex flex-col gap-1">
          <button className={btnSecondary} onClick={jumps.onCodingStart} disabled={!jumps.codingStart.ok} aria-describedby={!jumps.codingStart.ok ? "jump-start-why" : undefined} data-testid="go-coding-start">
            Go to start of coding
          </button>
          {!jumps.codingStart.ok ? <span id="jump-start-why" className="max-w-xs text-text-muted">{jumps.codingStart.reason}</span> : null}
        </div>
        <div className="flex flex-col gap-1">
          <button className={btnSecondary} onClick={jumps.onNextExon} disabled={!jumps.next.ok} aria-describedby={!jumps.next.ok ? "jump-next-why" : undefined} data-testid="go-next-exon">
            Go to next exon
          </button>
          {!jumps.next.ok ? <span id="jump-next-why" className="max-w-xs text-text-muted" data-testid="next-exon-why">{jumps.next.reason}</span> : null}
        </div>
      </div>
      {jumps.check.status === "mismatch" ? (
        <p role="alert" className="mt-3 text-danger" data-testid="protein-mismatch">{g.name}: {checkText(jumps.check)}</p>
      ) : null}
    </section>
  );
}
