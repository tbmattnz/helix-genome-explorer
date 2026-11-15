import { ChevronDownIcon, ChevronRightIcon, RefreshCw } from "lucide-react";
import { requestRegions, useRegions } from "./useRegions";
import { btnSecondary } from "../ui";

/** "Gene regions" on the map. The file loads when the list is first opened. */
export function RegionList({ big, open, onToggle, onOpen }: { big: boolean; open: boolean; onToggle: () => void; onOpen: (id: string) => void }) {
  const st = useRegions(open);
  const txt = big ? "text-lg" : "text-sm";
  return (
    <section aria-labelledby="regions-h" className="border-t border-divider pt-5" data-testid="region-list">
      <h2 id="regions-h" className="m-0">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="regions-body"
          data-testid="regions-toggle"
          className={`inline-flex items-center gap-2 rounded-md py-1 pr-2 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronRightIcon size={20} />} Gene regions
        </button>
      </h2>
      <p className={`mt-1 text-text-muted ${txt}`}>Short stretches of DNA around well-known genes. Each region shows its genes' exons, the DNA letters, and the protein those letters spell. {open ? "" : "Open the list to see them."}</p>
      {open ? (
        <div id="regions-body" className="mt-4" aria-live="polite">
          {st.status === "ready" && st.set ? (
            st.set.regions.length === 0 ? (
              <p className={`text-text-muted ${txt}`}>gene-regions.json lists no regions.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {st.set.regions.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => onOpen(r.id)}
                      data-testid={`region-${r.id}`}
                      className={`flex h-full w-full flex-col items-start gap-1 rounded-lg border border-divider-strong bg-surface p-4 text-left hover:bg-surface-muted ${txt}`}
                    >
                      <span className="font-semibold text-text">{r.title}</span>
                      <span className="text-text-muted">{r.summary}</span>
                      <span className="mt-auto pt-2 text-xs font-medium uppercase tracking-wider text-text-muted">Chromosome {r.chromosome}, focus gene {r.focusGene}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : st.status === "error" ? (
            <div role="alert" className={`flex flex-wrap items-center gap-3 text-danger ${txt}`}>
              The gene regions could not be loaded: {st.error}
              <button className={btnSecondary} onClick={requestRegions}><RefreshCw size={16} /> Retry</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" data-testid="regions-loading">
              <p className="sr-only" role="status">Loading gene regions</p>
              {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-skeleton" />)}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
