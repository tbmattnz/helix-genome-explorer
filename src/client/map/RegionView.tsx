import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { LETTERS_MAX_BP, checkProtein, codingStartBp, codonsFor, jumpWindow, nextExon } from "../../shared/protein";
import { LettersTrack, letterCell, type GeneReading } from "./LettersTrack";
import type { Jumps } from "./RegionCard";
import type { VariantsState } from "./useVariants";
import { applyVariant, countingNote, findNote, METHIONINE_NOTE, REFERENCE_NOTE, variantsForRegion, type Variant } from "../../shared/variantView";
import { VariantList } from "./VariantList";
import { VariantCard } from "./VariantCard";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, MinusIcon, Maximize } from "./icons";
import type { Win } from "../../shared/genome";
import { fmt, tickStep } from "../../shared/genome";
import { REGION_MIN_BP, makeRegionWindow, regionZoomLevels, type Region } from "../../shared/regions";
import { RegionGenes, type RegionPick } from "./RegionGenes";
import { RegionCard } from "./RegionCard";
import { useWidth } from "./useWidth";
import { btnSecondary } from "../ui";

type Props = {
  region: Region;
  win: Win;
  big: boolean;
  backLabel: string;
  onWin: (w: Win) => void;
  onBack: () => void;
  pick: RegionPick;
  onPick: (p: RegionPick) => void;
  variantsState: VariantsState;
  vPick: string | null;
  onVPick: (id: string | null) => void;
  onCloseVariant: () => void;
  /** A guided-tour step: run "Go to start of coding" for a gene, or open a variant with the version switch set. Applied once per key. */
  command?: { key: number; codingStartGene: string | null; variant: string | null; variantOn: boolean } | null;
};

export function RegionView({ region, win, big, backLabel, onWin, onBack, pick, onPick, variantsState, vPick, onVPick, onCloseVariant, command = null }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => { area.current?.focus(); }, [region.id]);

  const W = Math.max(280, width || 960);
  const pad = 16;
  const span = win.endBp - win.startBp;
  const len = region.endBp - region.startBp;
  const along = (bp: number) => pad + ((bp - win.startBp) / span) * (W - 2 * pad);
  const levels = regionZoomLevels(region);
  const centre = win.startBp + span / 2;
  const setWidth = (w: number) => onWin(makeRegionWindow(region, centre - w / 2, w));
  const smaller = levels.find((l) => l < span * 0.99);
  const larger = levels.filter((l) => l > span * 1.01);
  const zoomIn = () => { if (smaller) setWidth(smaller); };
  const zoomOut = () => { if (larger.length) setWidth(larger[larger.length - 1]); };
  const whole = () => onWin(makeRegionWindow(region, region.startBp, len));
  const pan = (dir: number) => onWin(makeRegionWindow(region, win.startBp + dir * Math.max(1, Math.round(span / 5)), span));
  const isWhole = span >= len;
  const atStart = win.startBp <= region.startBp;
  const atEnd = win.endBp >= region.endBp;

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowLeft") pan(-1);
    else if (k === "ArrowRight") pan(1);
    else if (k === "ArrowUp" || k === "+" || k === "=") zoomIn();
    else if (k === "ArrowDown" || k === "-" || k === "_") zoomOut();
    else if (k === "Home") onWin(makeRegionWindow(region, region.startBp, span));
    else if (k === "End") onWin(makeRegionWindow(region, region.endBp, span));
    else if (k === "0") whole();
    else return;
    e.preventDefault();
  };

  const thumbAlong = (bp: number) => pad + ((bp - region.startBp) / len) * (W - 2 * pad);
  const onThumb = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const bp = region.startBp + ((e.clientX - r.left - pad) / (r.width - 2 * pad)) * len;
    onWin(makeRegionWindow(region, bp - span / 2, span));
  };

  // Read every gene once per region: codons in reading order and the protein check.
  const readings: GeneReading[] = useMemo(() => region.genes.map((g) => {
    const codons = codonsFor(region, g);
    return { gene: g, codons, check: checkProtein(region, g, codons) };
  }), [region]);
  const mismatches = readings.filter((r) => r.check.status === "mismatch");
  const [focusKey, setFocusKey] = useState(0);

  // Jump window: as many letters as fit on screen without scrolling, between 100 and 200.
  const rem = typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fontPx = (big ? 1.05 : 0.8125) * rem;
  const fitLetters = Math.floor((W - 2 * pad) / letterCell(W, pad, LETTERS_MAX_BP * 100, fontPx));
  const jumpW = Math.max(REGION_MIN_BP, Math.min(LETTERS_MAX_BP, fitLetters));
  const pg = pick ? region.genes.find((g) => g.name === pick.gene) ?? null : null;
  const reading = pg ? readings.find((r) => r.gene === pg) ?? null : null;
  let jumps: Jumps | null = null;
  if (pg && reading && pick) {
    const cs = codingStartBp(pg);
    const csIn = cs !== null && cs >= region.startBp && cs < region.endBp;
    const nx = nextExon(region, pg, pick.exon, centre);
    jumps = {
      codingStart: cs === null ? { ok: false, reason: `${pg.name} has no coding part.` } : csIn ? { ok: true } : { ok: false, reason: "The start of coding lies outside this region, so it has no letters here." },
      next: nx,
      check: reading.check,
      onCodingStart: () => { if (cs === null || !csIn) return; onWin(jumpWindow(region, cs, jumpW)); setFocusKey((k) => k + 1); },
      onNextExon: () => { if (!nx.ok) return; onWin(jumpWindow(region, nx.target, jumpW)); onPick({ gene: pg.name, exon: nx.index }); setFocusKey((k) => k + 1); },
    };
  }

  // Variants of this region: list, markers, card. A jump fits the variant's letters on screen, then focuses its marker.
  const regionVariants = variantsForRegion(variantsState.set, region.id);
  const vSel = vPick ? regionVariants.find((v) => v.id === vPick) ?? null : null;
  // "Show variant version": off again whenever the card changes or closes, and when the region is left (unmount).
  const [vOn, setVOn] = useState(false);
  useEffect(() => { setVOn(false); }, [vPick, region.id]);
  const applied = vOn && vSel ? vSel : null;
  const vGene = applied ? region.genes.find((g) => g.name === applied.gene) ?? null : null;
  const vReading = useMemo(() => (applied && vGene ? applyVariant(region, vGene, applied) : null), [applied, vGene, region]);
  const shownReadings: GeneReading[] = useMemo(
    () => readings.map((r) => (vReading && r.gene === vGene ? { ...r, codons: vReading.codons, variant: vReading } : r)),
    [readings, vReading, vGene],
  );
  const allNotes = variantsState.set?.allNotes ?? [];
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFocus) return;
    const el = document.querySelector(`[data-testid="vm-${pendingFocus}"]`) as HTMLElement | null;
    if (el) { el.focus(); setPendingFocus(null); }
  });
  const jumpToVariant = (v: Variant) => {
    const width = Math.max(jumpW, Math.min(LETTERS_MAX_BP, v.endBp - v.startBp + 20));
    onWin(jumpWindow(region, Math.floor((v.startBp + v.endBp - 1) / 2), width));
    onVPick(v.id);
    setPendingFocus(v.id);
  };

  // Guided-tour command, after the switch reset above so the step's switch value wins.
  const doneKey = useRef(-1);
  useEffect(() => {
    if (!command || doneKey.current === command.key) return;
    if (command.variant) {
      const v = regionVariants.find((x) => x.id === command.variant);
      if (!v) { if (variantsState.status === "idle" || variantsState.status === "loading") return; doneKey.current = command.key; return; }
      doneKey.current = command.key;
      if (vPick !== v.id) onVPick(v.id);
      const width = Math.max(jumpW, Math.min(LETTERS_MAX_BP, v.endBp - v.startBp + 20));
      onWin(jumpWindow(region, Math.floor((v.startBp + v.endBp - 1) / 2), width));
      setVOn(command.variantOn);
      return;
    }
    doneKey.current = command.key;
    if (command.codingStartGene) {
      // The same as opening the gene's details and pressing "Go to start of coding".
      const g = region.genes.find((x) => x.name === command.codingStartGene);
      if (!g) return;
      onPick({ gene: g.name, exon: null });
      const cs = codingStartBp(g);
      if (cs !== null && cs >= region.startBp && cs < region.endBp) onWin(jumpWindow(region, cs, jumpW));
    }
  });

  const step = tickStep(span, W < 600 ? 3 : 7);
  const ticks: number[] = [];
  for (let p = Math.ceil(win.startBp / step) * step; p <= win.endBp; p += step) ticks.push(p);
  const fontCls = big ? "text-base" : "text-xs";
  const rulerH = big ? 34 : 28;

  return (
    <div className="w-full" data-testid="region-view">
      <div className="flex flex-wrap items-center gap-3 border-b border-divider pb-4">
        <button className={btnSecondary} onClick={onBack} data-testid="region-back" aria-label={backLabel}>
          <ArrowLeftIcon size={18} /> {backLabel}
        </button>
        <div className="ml-auto flex flex-wrap gap-2" role="toolbar" aria-label="Zoom and move">
          <button className={btnSecondary} onClick={() => pan(-1)} disabled={atStart} aria-label="Move left" data-testid="pan-left"><ChevronLeftIcon size={18} /><span className="hidden sm:inline">Left</span></button>
          <button className={btnSecondary} onClick={() => pan(1)} disabled={atEnd} aria-label="Move right" data-testid="pan-right"><span className="hidden sm:inline">Right</span><ChevronRightIcon size={18} /></button>
          <button className={btnSecondary} onClick={zoomOut} disabled={isWhole} aria-label="Zoom out" data-testid="zoom-out"><MinusIcon size={18} /><span className="hidden sm:inline">Zoom out</span></button>
          <button className={btnSecondary} onClick={zoomIn} disabled={!smaller} aria-label="Zoom in" data-testid="zoom-in"><PlusIcon size={18} /><span className="hidden sm:inline">Zoom in</span></button>
          <button className={btnSecondary} onClick={whole} disabled={isWhole} aria-label="Show the whole region" data-testid="zoom-all"><Maximize size={18} /><span className="hidden sm:inline">Whole</span></button>
        </div>
      </div>

      <header className="mt-4 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Gene region on chromosome {region.chromosome}</p>
        <h1 className={`mt-1 font-semibold text-text ${big ? "text-3xl" : "text-xl"}`} data-testid="region-title">{region.title}</h1>
        <p className={`mt-2 text-text-muted ${big ? "text-lg" : "text-sm"}`} data-testid="region-summary">{region.summary}</p>
      </header>
      <VariantList state={variantsState} variants={regionVariants} big={big} selected={vPick} onJump={jumpToVariant} />

      <div
        ref={area}
        tabIndex={0}
        role="group"
        data-testid="region-area"
        aria-label={`${region.title} view. Left and Right arrows move along it, Up and Down zoom in and out down to ${REGION_MIN_BP} letters, Escape goes back.`}
        onKeyDown={onKey}
        className="mt-4 rounded-lg"
      >
        <div ref={ref} className="w-full">
          <p className={`mb-1 text-text-muted ${fontCls}`}>Whole region, {fmt(len)} letters. The outlined box is the part shown below{W >= 600 ? "; click to move it" : ""}.</p>
          <svg width={W} height={big ? 30 : 24} onPointerDown={onThumb} className="block cursor-pointer" aria-hidden="true" focusable="false" data-testid="region-thumb">
            <rect x={pad} y={8} width={W - 2 * pad} height={big ? 14 : 8} rx={3} className="fill-surface-muted stroke-divider-strong" strokeWidth={1} />
            {region.genes.flatMap((g) => g.exons.map((e) => {
              const a = Math.max(e[0], region.startBp), b = Math.min(e[1], region.endBp);
              if (b <= a) return null;
              return <rect key={`${g.name}-${e[0]}`} x={thumbAlong(a)} y={8} width={Math.max(1, thumbAlong(b) - thumbAlong(a))} height={big ? 14 : 8} className="fill-exon-coding" />;
            }))}
            <rect x={thumbAlong(win.startBp) - 1} y={2} width={Math.max(3, thumbAlong(win.endBp) - thumbAlong(win.startBp) + 2)} height={(big ? 14 : 8) + 12} rx={3} className="fill-none stroke-view-box" strokeWidth={2.5} />
          </svg>

          <svg width={W} height={rulerH} className="mt-4 block" aria-hidden="true" focusable="false" data-testid="region-ruler">
            <line x1={pad} x2={W - pad} y1={4} y2={4} className="stroke-text-muted" strokeWidth={1} />
            {ticks.map((p) => (
              <g key={p}>
                <line x1={along(p)} x2={along(p)} y1={4} y2={10} className="stroke-text-muted" strokeWidth={1} />
                <text x={along(p)} y={big ? 28 : 23} textAnchor={along(p) < pad + 40 ? "start" : along(p) > W - pad - 40 ? "end" : "middle"} className={`fill-text tabular-nums ${fontCls}`}>{fmt(p)}</text>
              </g>
            ))}
          </svg>
          <p className={`mt-1 text-text-muted ${fontCls}`}>Ruler: position on chromosome {region.chromosome}, in letters. Now in view: {fmt(span)} letters.</p>
          {mismatches.map((m) => m.check.status === "mismatch" ? (
            <p key={m.gene.name} role="alert" className={`mt-2 text-danger ${fontCls}`} data-testid="region-mismatch">
              {m.gene.name}: the protein read from the letters differs from the file at amino acid {fmt(m.check.at)} (letters give {m.check.fromLetters}, file gives {m.check.fromFile}).
            </p>
          ) : null)}
          <LettersTrack region={region} win={win} W={W} pad={pad} big={big} readings={shownReadings} focusKey={focusKey} variants={regionVariants}
            version={vSel ? { variant: vSel, on: !!applied, same: vReading?.same ?? false } : null} />
        </div>
      </div>

      <RegionGenes region={region} win={win} W={W} pad={pad} big={big} picked={pick} onPick={onPick} variants={regionVariants} variantPick={vPick} onVariant={(id) => onVPick(id)} />
      <div className="flex flex-wrap items-start gap-x-4">
        {vSel ? <VariantCard v={vSel} region={region} notes={variantsState.set?.notes ?? []} big={big} onClose={onCloseVariant}
          methionineNote={countingNote(findNote(allNotes, METHIONINE_NOTE))} referenceNote={findNote(allNotes, REFERENCE_NOTE)}
          on={vOn} onToggle={() => setVOn((o) => !o)} /> : null}
        {pick && jumps ? <RegionCard region={region} pick={pick} big={big} onClose={() => onPick(null)} jumps={jumps} /> : null}
      </div>
    </div>
  );
}
