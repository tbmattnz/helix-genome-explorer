import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Genome, DensityScale } from "../../shared/genome";
import { densityLevel, fmt, mb } from "../../shared/genome";
import { Ideogram, DENSITY_CLASS } from "./Ideogram";
import { useWidth } from "./useWidth";

type Props = {
  genome: Genome;
  scale: DensityScale;
  big: boolean;
  focusIndex: number | null;
  onOpen: (i: number) => void;
  onHover: (i: number | null) => void;
};

/** All chromosomes side by side, heights to scale, each a button. Arrow keys move between them. */
export function GenomeMap({ genome, scale, big, focusIndex, onOpen, onHover }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const list = genome.chromosomes;
  const [active, setActive] = useState(focusIndex ?? 0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const maxLen = Math.max(...list.map((c) => c.lengthBp));
  const bin = genome.binSizeBp;

  useEffect(() => {
    if (focusIndex !== null) buttons.current[focusIndex]?.focus();
  }, [focusIndex]);

  const rows = width && width < 760 ? 2 : 1;
  const perRow = Math.ceil(list.length / rows);
  const colW = Math.max(28, Math.min(big ? 96 : 72, Math.floor((width || 960) / perRow)));
  const H = rows === 1 ? Math.max(240, Math.min(big ? 560 : 440, (width || 960) * 0.34)) : 210;
  const svgW = colW - 6;
  const t = Math.min(big ? 20 : 15, Math.round(svgW * 0.42));
  const barW = svgW - t - 5;

  const groups = useMemo(() => {
    const blockPx = (bin * H) / maxLen;
    const k = Math.max(1, Math.ceil(2 / blockPx));
    return list.map((c) => {
      const out: { i: number; mean: number }[] = [];
      for (let i = 0; i < c.geneDensity.length; i += k) {
        const part = c.geneDensity.slice(i, i + k);
        out.push({ i, mean: part.reduce((s, v) => s + v, 0) / part.length });
      }
      return { k, out };
    });
  }, [list, bin, H, maxLen]);
  const maxMean = Math.max(1, ...groups.flatMap((g) => g.out.map((o) => o.mean)));

  const onKey = (e: KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = Math.min(list.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = Math.max(0, i - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = list.length - 1;
    else return;
    e.preventDefault();
    setActive(n);
    buttons.current[n]?.focus();
  };

  return (
    <div ref={ref} className="w-full" data-testid="genome-map">
      <div role="group" aria-label="Chromosomes. Use the arrow keys to move between them and Enter to open one." className="flex flex-wrap items-start justify-center gap-y-6">
        {list.map((c, i) => {
          const h = Math.max(8, (c.lengthBp / maxLen) * H);
          const along = (bp: number) => 2 + (bp / c.lengthBp) * h;
          return (
            <button
              key={c.name}
              ref={(el) => { buttons.current[i] = el; }}
              tabIndex={i === active ? 0 : -1}
              data-testid={`chr-${c.name}`}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => onKey(e, i)}
              onFocus={() => { setActive(i); onHover(i); }}
              onBlur={() => onHover(null)}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              aria-label={`Chromosome ${c.name}: ${mb(c.lengthBp)} million letters, ${fmt(c.proteinCodingGenes)} protein-coding genes. Press Enter to open.`}
              className={`group flex flex-col items-center rounded-md px-0.5 pb-1 pt-0.5 hover:bg-surface-muted ${big ? "gap-2" : "gap-1"}`}
            >
              <span className={`font-semibold tabular-nums text-text ${big ? "text-lg" : "text-xs"}`}>{c.name}</span>
              <svg width={svgW} height={h + 4} aria-hidden="true" focusable="false">
                <Ideogram c={c} stains={genome.stains} along={along} cross={1} thickness={t} vertical id={`map-${c.name}`} />
                {groups[i].out.map((o) => {
                  const len = (o.mean / maxMean) * barW;
                  if (len <= 0) return null;
                  const y0 = along(o.i * bin);
                  const y1 = along(Math.min(c.lengthBp, (o.i + groups[i].k) * bin));
                  return <rect key={o.i} x={t + 4} y={y0} width={Math.max(0.8, len)} height={Math.max(0.6, y1 - y0)} className={DENSITY_CLASS[densityLevel(scale, o.mean)]} />;
                })}
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
