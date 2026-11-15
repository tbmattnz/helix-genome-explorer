import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { questionText, type Tour } from "../../shared/tourPlay";
import { btnSecondary } from "../ui";

type Props = {
  tour: Tour; step: number; notice: string | null; waiting: boolean; big: boolean; focusKey: number;
  onBack: () => void; onNext: () => void; onEnd: () => void;
};

/**
 * The tour panel. Fixed on screen while the app moves to each step's target: on the right on wide
 * screens, along the top of the page on narrow ones. Escape inside it does nothing (it never ends the tour).
 */
export function TourPanel({ tour, step, notice, waiting, big, focusKey, onBack, onNext, onEnd }: Props) {
  const s = tour.steps[step];
  const n = tour.steps.length;
  const last = step === n - 1;
  const title = useRef<HTMLHeadingElement>(null);
  // Focus the step title once the step's view is in place (after the views' own focus moves).
  useEffect(() => {
    if (waiting) return;
    const t = window.setTimeout(() => title.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(t);
  }, [focusKey, waiting]);
  const q = questionText(s.question);
  const txt = big ? "text-lg" : "text-sm";
  return (
    <aside
      aria-label="Guided tour"
      data-testid="tour-panel"
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); } }}
      className={`tour-panel z-20 flex flex-col gap-3 border-divider-strong bg-surface p-5 shadow-lg ${txt}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Guided tour: {tour.title}</p>
      </div>
      <p className="font-semibold text-accent-strong" aria-live="polite" data-testid="tour-step-count">Step {step + 1} of {n}</p>
      <h2 ref={title} tabIndex={-1} data-testid="tour-step-title" className={`font-semibold text-text ${big ? "text-2xl" : "text-lg"}`}>{s.title}</h2>
      <div className="tour-body flex flex-col gap-3 overflow-auto">
        <p className="whitespace-pre-line text-text" data-testid="tour-step-text">{s.text}</p>
        {notice ? <p role="status" className="border-l-2 border-danger pl-3 text-danger" data-testid="tour-notice">{notice}</p> : null}
        {waiting ? <p role="status" className="animate-pulse text-text-muted" data-testid="tour-waiting">Loading this step's view</p> : null}
        {q ? (
          <section aria-labelledby="ask-h" className="rounded-md border border-divider-strong bg-surface-muted p-3" data-testid="tour-question">
            <h3 id="ask-h" className="text-xs font-semibold uppercase tracking-wider text-text-muted">Ask the class</h3>
            <p className="mt-1 text-text">{q}</p>
          </section>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-divider pt-3">
        <button className={btnSecondary} onClick={onBack} disabled={step === 0} data-testid="tour-back" aria-label="Back to the previous step"><ChevronLeftIcon size={18} /> Back</button>
        <button className={btnSecondary} onClick={onNext} data-testid="tour-next" aria-label={last ? "Finish the tour" : "Next step"}>{last ? "Finish" : "Next"} <ChevronRightIcon size={18} /></button>
        <button className={`${btnSecondary} ml-auto`} onClick={onEnd} data-testid="tour-end"><XIcon size={18} /> End tour</button>
      </div>
    </aside>
  );
}
