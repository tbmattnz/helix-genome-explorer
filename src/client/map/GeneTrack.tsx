import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Win } from "../../shared/genome";
import { fmt } from "../../shared/genome";
import { directionText, type Gene } from "../../shared/genes";

type Props = { genes: Gene[]; win: Win; W: number; pad: number; big: boolean; selected: Gene | null; onSelect: (g: Gene) => void };
const MAX_LANES = 10;
const same = (a: Gene | null, b: Gene) => !!a && a.name === b.name && a.chr === b.chr && a.startBp === b.startBp;

/** One bar per gene, packed into rows. Tab reaches the track; arrows move between genes; Enter opens the card. */
export function GeneTrack({ genes, win, W, pad, big, selected, onSelect }: Props) {
  const span = win.endBp - win.startBp;
  // Label sizes follow the real font size (Class display scales the root font), so labels never overlap.
  const rem = typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fontPx = (big ? 1 : 0.75) * rem;
  const charW = fontPx * 0.66; // generous, so bold labels of a selected gene never run into the next bar
  const barH = Math.round(fontPx * 0.7);
  const laneH = Math.round(barH + fontPx * 1.9);
  const fontCls = big ? "text-base" : "text-xs";

  const layout = useMemo(() => {
    const along = (bp: number) => pad + ((bp - win.startBp) / span) * (W - 2 * pad);
    const ends: number[] = [];
    return genes.map((g) => {
      const x0 = Math.max(pad, along(g.startBp));
      const x1 = Math.max(x0 + 2, Math.min(W - pad, along(g.endBp)));
      const lw = g.name.length * charW;
      const lx = Math.max(pad, Math.min(x0, W - pad - lw));
      const withLabel = Math.max(x1 + 8, lx + lw + 8);
      let label = true;
      let lane = ends.findIndex((e) => e <= Math.min(x0, lx));
      if (lane === -1 && ends.length < MAX_LANES) lane = ends.length;
      if (lane === -1) { label = false; lane = ends.findIndex((e) => e <= x0); }
      if (lane === -1) { label = false; lane = ends.indexOf(Math.min(...ends)); }
      ends[lane] = Math.max(ends[lane] ?? 0, label ? withLabel : x1 + 8);
      return { g, x0, x1, lane, label, lx, lw };
    });
  }, [genes, win.startBp, span, W, pad, charW, big]);

  const lanes = Math.max(1, ...layout.map((l) => l.lane + 1));
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const i = genes.findIndex((g) => same(selected, g));
    setActive((a) => (i >= 0 ? i : Math.min(a, Math.max(0, genes.length - 1))));
  }, [genes, selected]);

  const move = (i: number) => { setActive(i); refs.current[i]?.focus(); };
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown") move(Math.min(genes.length - 1, i + 1));
    else if (k === "ArrowLeft" || k === "ArrowUp") move(Math.max(0, i - 1));
    else if (k === "Home") move(0);
    else if (k === "End") move(genes.length - 1);
    else if (k === "Enter" || k === " ") onSelect(genes[i]);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  if (!genes.length) return <p className={`mt-3 text-text-muted ${fontCls}`} data-testid="gene-track-empty">No protein-coding genes have any part in this view.</p>;

  return (
    <div className="mt-3" data-testid="gene-track">
      <p className={`mb-1 text-text-muted ${fontCls}`}>
        Genes: {fmt(genes.length)} with any part in view. The arrowhead shows the direction each is read. Tab to the genes, use the arrow keys to move between them, and Enter to show a gene's card.
      </p>
      <div role="group" aria-label={`Genes in view, ${genes.length}. Use the arrow keys to move between genes and Enter to show a gene's card.`}>
        <svg width={W} height={lanes * laneH + 6} className="block overflow-visible">
          {layout.map(({ g, x0, x1, lane, label, lx, lw }, i) => {
            const y = 4 + lane * laneH;
            const sel = same(selected, g);
            const plus = g.strand === "+";
            const minus = g.strand === "-";
            const mid = y + barH / 2;
            const arrow = plus
              ? `${x1},${y - 2} ${x1 + 6},${mid} ${x1},${y + barH + 2}`
              : minus ? `${x0},${y - 2} ${x0 - 6},${mid} ${x0},${y + barH + 2}` : null;
            const dir = directionText(g.strand);
            const right = Math.max(x1 + 7, label ? lx + lw : 0);
            return (
              <g
                key={`${g.name}-${g.startBp}`}
                ref={(el) => { refs.current[i] = el; }}
                tabIndex={i === active ? 0 : -1}
                role="button"
                aria-pressed={sel}
                aria-label={`${g.name}${g.fullName ? `, ${g.fullName}` : ""}. ${fmt(g.endBp - g.startBp)} letters.${dir ? ` ${dir}.` : ""}`}
                data-testid={`gene-${g.name}`}
                onClick={() => { setActive(i); onSelect(g); }}
                onKeyDown={(e) => onKey(e, i)}
                onFocus={() => { setActive(i); setFocused(i); }}
                onBlur={() => setFocused(null)}
                className="cursor-pointer outline-none"
              >
                <rect x={Math.min(x0, lx) - 8} y={y - 4} width={right - Math.min(x0, lx) + 16} height={laneH - 2} className="fill-transparent" />
                {sel ? <rect x={x0 - 3} y={y - 3} width={x1 - x0 + 6} height={barH + 6} rx={2} className="fill-none stroke-gene-selected" strokeWidth={2} /> : null}
                <rect x={x0} y={y} width={x1 - x0} height={barH} rx={1.5} className={sel ? "fill-gene-selected" : "fill-gene"} />
                {arrow ? <polygon points={arrow} className={sel ? "fill-gene-selected" : "fill-gene"} /> : null}
                {label ? (
                  <text x={lx} y={y + barH + fontPx * 1.15} className={`${sel ? "font-bold" : ""} fill-text ${fontCls}`}>{g.name}</text>
                ) : null}
                {focused === i ? (
                  <rect x={Math.min(x0, lx) - 6} y={y - 5} width={right - Math.min(x0, lx) + 12} height={laneH - 1} rx={3} className="fill-none stroke-focus" strokeWidth={3} />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
