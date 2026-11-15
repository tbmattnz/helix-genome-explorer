import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, MinusIcon, Maximize } from "./icons";
import type { Chromosome, DensityScale, Genome, Win } from "../../shared/genome";
import { GENE_TRACK_MAX_BP, densityLevel, fmt, makeWindowBp, mb, rulerLabel, tickStep, zoomLevelsBp } from "../../shared/genome";
import type { Gene } from "../../shared/genes";
import type { Region } from "../../shared/regions";
import type { GenesState } from "./useGenes";
import { Ideogram, DENSITY_CLASS } from "./Ideogram";
import { GeneTrack } from "./GeneTrack";
import { GeneCard } from "./GeneCard";
import { useWidth } from "./useWidth";
import { btnSecondary } from "../ui";

type Props = {
  genome: Genome;
  c: Chromosome;
  scale: DensityScale;
  win: Win;
  big: boolean;
  onWin: (w: Win) => void;
  onBack: () => void;
  genesState: GenesState;
  inView: Gene[];
  selected: Gene | null;
  onSelect: (g: Gene | null) => void;
  cardFocus: number;
  selectedRegion: Region | null;
  onOpenRegion: (id: string) => void;
};

export function ZoomView({ genome, c, scale, win, big, onWin, onBack, genesState, inView, selected, onSelect, cardFocus, selectedRegion, onOpenRegion }: Props) {
  const bin = genome.binSizeBp;
  const [ref, width] = useWidth<HTMLDivElement>();
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!cardFocus) region.current?.focus(); }, [c.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const W = Math.max(280, width || 960);
  const pad = 12;
  const span = win.endBp - win.startBp;
  const along = (bp: number) => pad + ((bp - win.startBp) / span) * (W - 2 * pad);
  const levels = zoomLevelsBp(c);
  const nominal = span > GENE_TRACK_MAX_BP ? Math.ceil(span / bin) * bin : span;
  const centre = win.startBp + span / 2;
  const setWidth = (w: number) => onWin(makeWindowBp(c, bin, centre - w / 2, w));
  const smaller = levels.find((l) => l < span * 0.99);
  const larger = levels.filter((l) => l > nominal * 1.01);
  const zoomIn = () => { if (smaller) setWidth(smaller); };
  const zoomOut = () => { if (larger.length) setWidth(larger[larger.length - 1]); };
  const whole = () => onWin(makeWindowBp(c, bin, 0, Infinity));
  const pan = (dir: number) => onWin(makeWindowBp(c, bin, win.startBp + dir * Math.max(1, nominal / 5), nominal));
  const canIn = !!smaller;
  const isWhole = win.startBp <= 0 && win.endBp >= c.lengthBp;
  const atStart = win.startBp <= 0;
  const atEnd = win.endBp >= c.lengthBp;
  const trackOn = span <= GENE_TRACK_MAX_BP;

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowLeft") pan(-1);
    else if (k === "ArrowRight") pan(1);
    else if (k === "ArrowUp" || k === "+" || k === "=") zoomIn();
    else if (k === "ArrowDown" || k === "-" || k === "_") zoomOut();
    else if (k === "Home") onWin(makeWindowBp(c, bin, 0, nominal));
    else if (k === "End") onWin(makeWindowBp(c, bin, Infinity, nominal));
    else if (k === "0") whole();
    else return;
    e.preventDefault();
  };

  const thumbAlong = (bp: number) => pad + (bp / c.lengthBp) * (W - 2 * pad);
  const onThumb = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const bp = ((e.clientX - r.left - pad) / (r.width - 2 * pad)) * c.lengthBp;
    onWin(makeWindowBp(c, bin, bp - nominal / 2, nominal));
  };

  const step = tickStep(span, W < 600 ? 5 : 9);
  const ticks: number[] = [];
  for (let p = Math.ceil(win.startBp / step) * step; p <= win.endBp; p += step) ticks.push(p);

  const T = big ? 52 : 40;
  const labelH = big ? 26 : 20;
  const ideoY = labelH + 4;
  const rulerY = ideoY + T + 10;
  const trackY = rulerY + (big ? 46 : 38);
  // When the gene track shows, the genes replace the density bars (at this zoom they merge into one block).
  const trackH = trackOn ? 0 : big ? 120 : 90;
  const totalH = trackY + trackH + 6;
  const blockW = (bin / span) * (W - 2 * pad);
  const fontCls = big ? "text-base" : "text-xs";
  const charW = big ? 9 : 7;

  const bars = [];
  const b0 = Math.floor(win.startBp / bin);
  const b1 = Math.min(c.geneDensity.length, Math.ceil(win.endBp / bin));
  for (let i = b0; i < (trackOn ? b0 : b1); i++) {
    const v = c.geneDensity[i];
    const x0 = along(i * bin) - pad;
    const x1 = along(Math.min(c.lengthBp, (i + 1) * bin)) - pad;
    const h = scale.max ? (v / scale.max) * trackH : 0;
    bars.push(
      <rect key={i} x={x0} y={trackY + trackH - h} width={Math.max(0.5, x1 - x0 - (blockW > 4 ? 1 : 0))} height={h} className={DENSITY_CLASS[densityLevel(scale, v)]}>
        <title>{`${mb(i * bin)} to ${mb(Math.min(c.lengthBp, (i + 1) * bin))} million letters: ${fmt(v)} protein-coding genes`}</title>
      </rect>,
    );
  }

  return (
    <div className="w-full" data-testid="zoom-view">
      <div className="flex flex-wrap items-center gap-3 border-b border-divider pb-4">
        <button className={btnSecondary} onClick={onBack} data-testid="back" aria-label="Back to the genome map">
          <ArrowLeftIcon size={18} /> Back to map
        </button>
        <h1 className={`font-semibold text-text ${big ? "text-3xl" : "text-xl"}`} data-testid="zoom-title">Chromosome {c.name}</h1>
        <div className="ml-auto flex flex-wrap gap-2" role="toolbar" aria-label="Zoom and move">
          <button className={btnSecondary} onClick={() => pan(-1)} disabled={atStart} aria-label="Move left" data-testid="pan-left"><ChevronLeftIcon size={18} /><span className="hidden sm:inline">Left</span></button>
          <button className={btnSecondary} onClick={() => pan(1)} disabled={atEnd} aria-label="Move right" data-testid="pan-right"><span className="hidden sm:inline">Right</span><ChevronRightIcon size={18} /></button>
          <button className={btnSecondary} onClick={zoomOut} disabled={isWhole} aria-label="Zoom out" data-testid="zoom-out"><MinusIcon size={18} /><span className="hidden sm:inline">Zoom out</span></button>
          <button className={btnSecondary} onClick={zoomIn} disabled={!canIn} aria-label="Zoom in" data-testid="zoom-in"><PlusIcon size={18} /><span className="hidden sm:inline">Zoom in</span></button>
          <button className={btnSecondary} onClick={whole} disabled={isWhole} aria-label="Show the whole chromosome" data-testid="zoom-all"><Maximize size={18} /><span className="hidden sm:inline">Whole</span></button>
        </div>
      </div>

      <div
        ref={region}
        tabIndex={0}
        role="group"
        data-testid="zoom-region"
        aria-label={`Chromosome ${c.name} view. Left and Right arrows move along it, Up and Down zoom in and out, Escape goes back to the map.`}
        onKeyDown={onKey}
        className="mt-4 rounded-lg"
      >
        <div ref={ref} className="w-full">
          <p className={`mb-1 text-text-muted ${fontCls}`}>Whole chromosome. The outlined box is the part shown below{W >= 600 ? "; click to move it" : ""}.</p>
          <svg width={W} height={big ? 34 : 26} onPointerDown={onThumb} className="block cursor-pointer" aria-hidden="true" focusable="false" data-testid="zoom-thumb">
            <Ideogram c={c} stains={genome.stains} along={thumbAlong} cross={5} thickness={big ? 22 : 14} vertical={false} id={`thumb-${c.name}`} />
            <rect x={thumbAlong(win.startBp) - 1} y={1} width={Math.max(3, thumbAlong(win.endBp) - thumbAlong(win.startBp) + 2)} height={(big ? 22 : 14) + 8} rx={3} className="fill-none stroke-view-box" strokeWidth={2.5} />
          </svg>

          <svg width={W} height={totalH} className="mt-4 block" role="img" aria-label={`Chromosome ${c.name} from ${fmt(win.startBp)} to ${fmt(win.endBp)} letters, with its bands, a ruler in millions of letters and a gene-density track.`}>
            {c.bands.map((b) => {
              const x0 = Math.max(pad, along(b.startBp));
              const x1 = Math.min(W - pad, along(b.endBp));
              const label = `${b.name}`;
              if (x1 - x0 < label.length * charW + 6) return null;
              return <text key={b.name + b.startBp} x={(x0 + x1) / 2} y={labelH - 4} textAnchor="middle" className={`fill-text-muted ${fontCls}`}>{label}</text>;
            })}
            <svg x={pad} y={0} width={W - 2 * pad} height={totalH} overflow="hidden">
              <Ideogram c={c} stains={genome.stains} along={(bp) => along(bp) - pad} cross={ideoY} thickness={T} vertical={false} id={`zoom-${c.name}`} titles />
              {bars}
            </svg>

            <line x1={pad} x2={W - pad} y1={rulerY} y2={rulerY} className="stroke-text-muted" strokeWidth={1} />
            {ticks.map((p) => (
              <g key={p}>
                <line x1={along(p)} x2={along(p)} y1={rulerY} y2={rulerY + 6} className="stroke-text-muted" strokeWidth={1} />
                <text x={along(p)} y={rulerY + (big ? 24 : 19)} textAnchor={along(p) < pad + 24 ? "start" : along(p) > W - pad - 24 ? "end" : "middle"} className={`fill-text tabular-nums ${fontCls}`}>{rulerLabel(p, step)}</text>
              </g>
            ))}

            {trackOn ? null : (
              <>
                <line x1={pad} x2={W - pad} y1={trackY + trackH} y2={trackY + trackH} className="stroke-divider-strong" strokeWidth={1} />
                <line x1={pad} x2={W - pad} y1={trackY} y2={trackY} className="stroke-divider" strokeWidth={1} strokeDasharray="3 3" />
              </>
            )}
          </svg>
          <div className={`mt-1 flex flex-wrap justify-between gap-2 text-text-muted ${fontCls}`}>
            <span>Ruler: position in millions of letters</span>
            {trackOn ? null : <span data-testid="density-caption">Bars: protein-coding genes per block of {fmt(bin)} letters (dashed line = {fmt(scale.max)}, the most in any block)</span>}
          </div>
        </div>
      </div>

      {trackOn ? (
        genesState.status === "ready" ? (
          <GeneTrack genes={inView} win={win} W={W} pad={pad} big={big} selected={selected} onSelect={onSelect} />
        ) : genesState.status === "error" ? (
          <p role="alert" className={`mt-3 text-danger ${fontCls}`} data-testid="gene-track-error">The genes cannot be shown: {genesState.error}</p>
        ) : (
          <p role="status" className={`mt-3 animate-pulse text-text-muted ${fontCls}`} data-testid="gene-track-loading">Loading genes</p>
        )
      ) : (
        <p className={`mt-3 rounded-md border border-divider px-3 py-2 text-text-muted ${big ? "text-lg" : "text-sm"}`} data-testid="gene-hint">
          Zoom in to {fmt(GENE_TRACK_MAX_BP)} letters or fewer to see individual genes. Now in view: {fmt(span)} letters.
        </p>
      )}
      {selected ? <GeneCard gene={selected} big={big} focusKey={cardFocus} onClose={() => onSelect(null)} region={selectedRegion} onOpenRegion={onOpenRegion} /> : null}
    </div>
  );
}
