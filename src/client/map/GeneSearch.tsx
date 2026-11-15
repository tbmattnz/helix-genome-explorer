import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "lucide-react";
import { searchGenes, type Gene } from "../../shared/genes";
import { requestGenes, type GenesState } from "./useGenes";

/** Find a gene by name or full name. Loads genes.json the first time it is used. */
export function GeneSearch({ genes, onPick, big }: { genes: GenesState; onPick: (g: Gene) => void; big: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const { matches, total } = useMemo(() => (genes.index ? searchGenes(genes.index, q, 10) : { matches: [], total: 0 }), [genes.index, q]);
  const show = open && q.trim().length > 0;

  const pick = (g: Gene) => { setOpen(false); setQ(g.name); onPick(g); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { setOpen(true); setActive((a) => Math.min(matches.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") { if (show && matches[active]) pick(matches[active]); }
    else if (e.key === "Escape") { if (!show) return; setOpen(false); }
    else return;
    e.preventDefault();
  };

  const status = !q.trim() ? ""
    : genes.status === "error" ? genes.error ?? "The gene list could not be loaded."
    : genes.status !== "ready" ? "Loading the gene list"
    : total === 0 ? `No genes match "${q.trim()}".`
    : total > 10 ? `${total.toLocaleString("en")} matches; showing the first 10.` : `${total} match${total === 1 ? "" : "es"}.`;

  const txt = big ? "text-lg" : "text-sm";
  return (
    <div className={`relative w-full max-w-md ${txt}`} data-testid="gene-search">
      <label htmlFor={`${id}-input`} className="mb-1 block font-medium text-text">Find a gene</label>
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          id={`${id}-input`}
          data-testid="gene-search-input"
          role="combobox"
          aria-expanded={show && matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={show && matches[active] ? `${id}-opt-${active}` : undefined}
          aria-describedby={`${id}-status`}
          autoComplete="off"
          value={q}
          placeholder="Name or full name, for example BRCA1 or insulin"
          onFocus={() => requestGenes()}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); requestGenes(); }}
          onKeyDown={onKey}
          onBlur={() => setOpen(false)}
          className="min-h-11 w-full rounded-md border border-divider-strong bg-surface py-2 pl-10 pr-3 text-text placeholder:text-text-muted"
        />
      </div>
      <p id={`${id}-status`} className="mt-1 min-h-5 text-text-muted" aria-live="polite" data-testid="gene-search-status">{status}</p>
      {show && matches.length > 0 ? (
        <ul id={`${id}-list`} role="listbox" aria-label="Matching genes" className="absolute left-0 right-0 top-full z-20 -mt-5 max-h-96 overflow-y-auto rounded-md border border-divider-strong bg-surface shadow-lg">
          {matches.map((g, i) => (
            <li
              key={`${g.chr}-${g.name}-${g.startBp}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              data-testid="gene-option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(g)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 border-b border-divider px-3 py-2 last:border-b-0 ${i === active ? "bg-accent-soft" : ""}`}
            >
              <span className="min-w-0">
                <span className={`font-semibold text-text ${i === active ? "underline underline-offset-2" : ""}`}>{g.name}</span>
                {g.fullName ? <span className="ml-2 text-text-muted">{g.fullName}</span> : null}
              </span>
              <span className="shrink-0 text-text-muted">Chromosome {g.chr}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
