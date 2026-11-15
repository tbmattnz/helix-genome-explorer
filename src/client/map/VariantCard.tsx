import { XIcon } from "lucide-react";
import { fmt } from "../../shared/genome";
import type { Region } from "../../shared/regions";
import { effectText, formatFrequency, frequencyCounts, geneDirection, type Variant } from "../../shared/variantView";

/** Details for one variant. Values that are missing are left out. */
type Props = {
  v: Variant; region: Region; notes: string[]; big: boolean; onClose: () => void;
  methionineNote: string | null; referenceNote: string | null; on: boolean; onToggle: () => void;
};

export function VariantCard({ v, region, notes, big, onClose, methionineNote, referenceNote, on, onToggle }: Props) {
  const g = region.genes.find((x) => x.name === v.gene) ?? null;
  const missing = v.kind === "letters missing";
  const len = v.endBp - v.startBp;
  const dir = geneDirection(v.referenceLetters, v.variantLetters, g?.strand ?? null);
  const rows: [string, string | null][] = [
    ["Gene", g?.fullName ? `${v.gene}, ${g.fullName}` : v.gene],
    ["Kind of change", missing ? `Letters missing: ${len} letter${len === 1 ? "" : "s"}` : "One letter changed"],
    ["Position", len === 1 ? `${fmt(v.startBp)} on chromosome ${v.chromosome}` : `${fmt(v.startBp)} to ${fmt(v.endBp - 1)} on chromosome ${v.chromosome}`],
    ["Reference letters", v.referenceLetters || null],
    ["Variant letters", v.variantLetters || (missing ? "None: these letters are missing" : null)],
    ["In the gene's direction", dir ? `${dir.ref} to ${dir.alt || "missing"}, because ${v.gene} is read right to left with A and T, C and G swapped` : null],
    ["Effect", effectText(v.effect)],
  ];
  const freq = formatFrequency(v.frequency);
  const counts = frequencyCounts(v.frequency);
  const txt = big ? "text-lg" : "text-sm";
  return (
    <section aria-live="polite" aria-labelledby="variant-title" data-testid="variant-card" className={`mt-4 w-full max-w-2xl rounded-lg border-2 border-variant-mark bg-surface p-5 ${txt}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Variant {v.id}</p>
          <h3 id="variant-title" className={`mt-1 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`} data-testid="variant-title">{v.title}</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text" aria-label="Close variant details" data-testid="variant-close">
          <XIcon size={18} />
        </button>
      </div>
      <p className="mt-2 text-text" data-testid="variant-summary">{v.summary}</p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="vv-label"
          onClick={onToggle}
          data-testid="variant-switch"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 ${on ? "border-variant-mark bg-variant-mark" : "border-divider-strong bg-surface-muted"}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full border border-divider-strong bg-surface transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        <span id="vv-label" className="font-medium text-text">Show variant version</span>
        <span className="font-semibold text-text-muted" aria-hidden="true">{on ? "On" : "Off"}</span>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
        {rows.filter((r): r is [string, string] => r[1] !== null).map(([k, val]) => (
          <div key={k} className="contents" data-testid={`variant-row-${k}`}>
            <dt className="font-medium text-text-muted">{k}</dt>
            <dd className="break-words text-text">
              <span className={k.endsWith("letters") ? "font-mono font-semibold" : ""}>{val}</span>
              {k === "Reference letters" && referenceNote ? <span className="mt-1 block text-text-muted" data-testid="variant-reference-note">{referenceNote}</span> : null}
              {k === "Effect" && methionineNote ? <span className="mt-1 block text-text-muted" data-testid="variant-methionine-note">{methionineNote}</span> : null}
            </dd>
          </div>
        ))}
        {freq ? (
          <div className="contents">
            <dt className="font-medium text-text-muted">How common</dt>
            <dd className="text-text">
              <span data-testid="variant-frequency">{freq.charAt(0).toUpperCase() + freq.slice(1)}</span>
              {counts ? <span className="block text-text-muted">{counts}.</span> : null}
              {notes.map((t, i) => (
                <span key={i} className="mt-2 block border-l-2 border-divider-strong pl-3 text-text-muted" data-testid="variant-note">{t}</span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
