import { ChevronDownIcon, ChevronRightIcon, PlayIcon, RefreshCw } from "lucide-react";
import { requestTours, useTours } from "./useTours";
import { btnSecondary } from "../ui";

/** "Guided tours" on the map. tours.json loads when the list is first opened. */
export function TourList({ big, open, onToggle, onStart, active }: { big: boolean; open: boolean; onToggle: () => void; onStart: (id: string) => void; active: string | null }) {
  const st = useTours(open);
  const txt = big ? "text-lg" : "text-sm";
  return (
    <section aria-labelledby="tours-h" className="border-t border-divider pt-5" data-testid="tour-list">
      <h2 id="tours-h" className="m-0">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="tours-body"
          data-testid="tours-toggle"
          className={`inline-flex items-center gap-2 rounded-md py-1 pr-2 font-semibold text-text ${big ? "text-2xl" : "text-lg"}`}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronRightIcon size={20} />} Guided tours
        </button>
      </h2>
      <p className={`mt-1 text-text-muted ${txt}`}>Step-by-step walks through the genome to show a class. Each step takes the app to the right place. {open ? "" : "Open the list to see them."}</p>
      {open ? (
        <div id="tours-body" className="mt-4" aria-live="polite">
          {st.status === "ready" && st.set ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {st.set.tours.map((t) => (
                <li key={t.id} className={`flex h-full flex-col gap-1 rounded-lg bg-surface p-4 ${active === t.id ? "border-2 border-gene-selected" : "border border-divider-strong"} ${txt}`} data-testid={`tour-${t.id}`}>
                  <span className="font-semibold text-text">{t.title}</span>
                  <span className="text-text-muted">{t.summary}</span>
                  <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-text-muted" data-testid={`tour-steps-${t.id}`}>{t.steps.length} step{t.steps.length === 1 ? "" : "s"}</span>
                    <button className={btnSecondary} onClick={() => onStart(t.id)} data-testid={`tour-start-${t.id}`} aria-label={`Start tour: ${t.title}`}>
                      <PlayIcon size={16} /> {active === t.id ? "Restart" : "Start"}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : st.status === "error" ? (
            <div role="alert" className={`flex flex-wrap items-center gap-3 text-danger ${txt}`} data-testid="tours-error">
              Guided tours are not available: {st.error}
              <button className={btnSecondary} onClick={requestTours}><RefreshCw size={16} /> Retry</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" data-testid="tours-loading">
              <p className="sr-only" role="status">Loading guided tours</p>
              {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-skeleton" />)}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
