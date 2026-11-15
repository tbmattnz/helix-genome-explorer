import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";
import { cardRows, type Gene } from "../../shared/genes";
import type { Region } from "../../shared/regions";
import { btnPrimary } from "../ui";

/** Facts for one gene. Null values are left out. Escape or Close hides it. */
type CardProps = { gene: Gene; big: boolean; focusKey: number; onClose: () => void; region?: Region | null; onOpenRegion?: (id: string) => void };

export function GeneCard({ gene, big, focusKey, onClose, region, onOpenRegion }: CardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusKey) heading.current?.focus(); }, [focusKey]);
  const rows = cardRows(gene).filter((r) => r.label !== "Name");
  return (
    <section aria-live="polite" aria-labelledby="gene-card-title" data-testid="gene-card" className={`mt-4 max-w-2xl rounded-lg border border-divider-strong bg-surface p-5 ${big ? "text-lg" : "text-sm"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Gene on chromosome {gene.chr}</p>
          <h3 id="gene-card-title" ref={heading} tabIndex={-1} className={`mt-1 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`} data-testid="gene-card-name">{gene.name}</h3>
        </div>
        <button onClick={onClose} className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text" aria-label="Close gene card" data-testid="gene-card-close">
          <XIcon size={18} />
        </button>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[9rem_1fr]">
        {rows.map((r) => (
          <div key={r.label} className="contents" data-testid={`gene-row-${r.label}`}>
            <dt className="font-medium text-text-muted">{r.label}</dt>
            <dd className="break-words text-text">{r.value}</dd>
          </div>
        ))}
      </dl>
      {region && onOpenRegion ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-divider pt-4">
          <button className={btnPrimary} onClick={() => onOpenRegion(region.id)} data-testid="open-region">Open region</button>
          <span className="text-text-muted">{region.title}: see its exons up close.</span>
        </div>
      ) : null}
    </section>
  );
}
