import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { fmt } from "../../shared/genome";
import type { Variant } from "../../shared/variantView";
import type { VariantsState } from "./useVariants";

type Props = { state: VariantsState; variants: Variant[]; big: boolean; selected: string | null; onJump: (v: Variant) => void };

/** "Variants in this region": each variant is a button that jumps to its letters and opens its card. */
export function VariantList({ state, variants, big, selected, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const txt = big ? "text-lg" : "text-sm";
  const count = state.status === "ready" ? ` (${variants.length})` : "";
  return (
    <section aria-labelledby="variants-h" className="mt-4 border-y border-divider py-2" data-testid="variant-list">
      <h2 id="variants-h" className="m-0">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="variants-body"
          data-testid="variants-toggle"
          className={`inline-flex min-h-11 items-center gap-2 rounded-md pr-2 font-semibold text-text ${big ? "text-xl" : "text-base"}`}
        >
          {open ? <ChevronDownIcon size={20} /> : <ChevronRightIcon size={20} />} Variants in this region{count}
        </button>
      </h2>
      {open ? (
        <div id="variants-body" className="mt-2 pb-2" aria-live="polite">
          {state.status === "error" ? (
            <p role="alert" className={`text-danger ${txt}`} data-testid="variants-unavailable">Variants are not available: {state.error}</p>
          ) : state.status !== "ready" ? (
            <p role="status" className={`animate-pulse text-text-muted ${txt}`}>Loading variants</p>
          ) : variants.length === 0 ? (
            <p className={`text-text-muted ${txt}`} data-testid="variants-empty">No variants in this region.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {variants.map((v) => (
                <li key={v.id}>
                  <button
                    data-testid={`vl-${v.id}`}
                    aria-current={selected === v.id ? "true" : undefined}
                    onClick={() => onJump(v)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-lg bg-surface px-4 py-3 text-left hover:bg-surface-muted ${selected === v.id ? "border-2 border-gene-selected" : "border border-divider-strong"} ${txt}`}
                  >
                    <span><span className="font-semibold text-text">{v.title}</span> <span className="text-text-muted">({v.id})</span></span>
                    <span className="text-text-muted">
                      {v.kind === "letters missing" ? `${v.endBp - v.startBp} letters missing` : "One letter changed"} in {v.gene}, at {fmt(v.startBp)}. Go to its letters.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
