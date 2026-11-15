import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Win } from "../../shared/genome";
import { fmt } from "../../shared/genome";
import type { Region, RegionGene } from "../../shared/regions";
import { LETTERS_MAX_BP, aaInfo, codonInWindow, letterAt, lettersVisible, type Codon, type ProteinCheck } from "../../shared/protein";
import { AminoPanel } from "./AminoPanel";
import { variantLetterAt, type Variant, type VariantReading } from "../../shared/variantView";

export type GeneReading = { gene: RegionGene; codons: Codon[]; check: ProteinCheck; variant?: VariantReading };
export type VersionShown = { variant: Variant; on: boolean; same: boolean } | null;
type Props = { region: Region; win: Win; W: number; pad: number; big: boolean; readings: GeneReading[]; focusKey: number; variants?: Variant[]; version?: VersionShown };
export type AminoPick = { gene: string; index: number } | null;

const BASE_CLASS: Record<string, string> = { A: "fill-base-a", C: "fill-base-c", G: "fill-base-g", T: "fill-base-t" };

/** Cell width in px for one letter: the scale of the ruler, but never narrower than one character. */
export function letterCell(W: number, pad: number, span: number, fontPx: number) {
  return Math.max((W - 2 * pad) / span, fontPx * 0.85);
}

/** DNA letters (forward strand) and, under coding letters, one protein row per gene. */
export function LettersTrack({ region, win, W, pad, big, readings, focusKey, variants = [], version = null }: Props) {
  const applied = version?.on ? version.variant : null;
  const rem = typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fontPx = (big ? 1.05 : 0.8125) * rem;
  const span = win.endBp - win.startBp;
  const show = lettersVisible(span);
  const cell = letterCell(W, pad, span, fontPx);
  const innerW = Math.max(W, 2 * pad + cell * span);
  const x = (bp: number) => pad + (bp - win.startBp) * cell;
  const fontCls = big ? "text-base" : "text-xs";

  const [pick, setPick] = useState<AminoPick>(null);
  useEffect(() => setPick(null), [region.id]);

  const rows = useMemo(
    () => readings.map((r) => ({ ...r, inView: r.codons.filter((c) => codonInWindow(c, win)) })).filter((r) => r.inView.length > 0),
    [readings, win],
  );

  // Letters: roving focus. After a jump, focus goes to the first letter in view.
  const positions = useMemo(() => Array.from({ length: show ? span : 0 }, (_, i) => win.startBp + i), [show, span, win.startBp]);
  const [active, setActive] = useState(0);
  const letterRefs = useRef<(SVGGElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, positions.length - 1))); }, [positions.length]);
  useEffect(() => {
    if (!focusKey || !show) return;
    setActive(0);
    if (scroller.current) scroller.current.scrollLeft = 0;
    requestAnimationFrame(() => letterRefs.current[0]?.focus());
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const codingAt = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const r of rows) for (const c of r.inView) for (const p of c.positions) m.set(p, [...(m.get(p) ?? []), r.gene.name]);
    return m;
  }, [rows]);

  // Letters where a variant is: outlined (dashed for missing letters) and underlined, never colour alone.
  const vAt = useMemo(() => {
    const m = new Map<number, Variant[]>();
    for (const v of variants) for (let p = Math.max(v.startBp, win.startBp); p < Math.min(v.endBp, win.endBp); p++) m.set(p, [...(m.get(p) ?? []), v]);
    return m;
  }, [variants, win.startBp, win.endBp]);

  const moveLetter = (i: number) => { setActive(i); letterRefs.current[i]?.focus(); };
  const onLetterKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight") moveLetter(Math.min(positions.length - 1, i + 1));
    else if (k === "ArrowLeft") moveLetter(Math.max(0, i - 1));
    else if (k === "Home") moveLetter(0);
    else if (k === "End") moveLetter(positions.length - 1);
    else if (k === "ArrowUp" || k === "ArrowDown") { /* keep zoom keys from firing while reading letters */ }
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    (window as unknown as { __letters?: unknown }).__letters = {
      shown: show, span, cell, active,
      rows: rows.map((r) => ({ gene: r.gene.name, codons: r.inView.map((c) => ({ index: c.index, aa: c.aa, stop: c.stop, split: c.parts.length > 1 })) })),
      checks: readings.map((r) => ({ gene: r.gene.name, ...r.check })),
      version: applied ? "variant" : "reference",
      changedLetters: applied ? positions.filter((p) => variantLetterAt(applied, p) !== null).map((p) => [p, variantLetterAt(applied, p)]) : [],
      marks: rows.map((r) => ({ gene: r.gene.name, changed: r.inView.filter((c) => c.changed).map((c) => c.index), notMade: r.inView.filter((c) => c.notMade).length, stops: r.inView.filter((c) => c.stop && !c.notMade).map((c) => c.index) })),
      pick,
    };
  });

  const versionText = version
    ? version.on
      ? `Showing: variant version (${version.variant.id}, ${version.variant.title}). Changed letters and amino acids have a thick outline and a mark underneath.${version.same ? " The protein is the same as the reference." : ""}`
      : "Showing: reference version (the letters of the reference genome)."
    : null;
  const versionLine = versionText ? (
    <p aria-live="polite" data-testid="version-label" className={`mb-1 font-semibold ${version?.on ? "text-variant-mark" : "text-text"} ${big ? "text-lg" : "text-sm"}`}>{versionText}</p>
  ) : null;

  if (!show) {
    return (
      <>
      {versionLine}
      <p className={`mt-3 rounded-md border border-divider px-3 py-2 text-text-muted ${big ? "text-lg" : "text-sm"}`} data-testid="letters-hint">
        Zoom in to see letters ({fmt(LETTERS_MAX_BP)} letters or fewer in view). Now in view: {fmt(span)} letters.
      </p>
      </>
    );
  }

  const letterH = Math.round(fontPx * 1.7);
  const tickH = Math.round(fontPx * 1.4);
  const labelStep = [10, 20, 50, 100].find((s) => s * cell >= fontPx * 7) ?? 100;
  const ticks = positions.filter((p) => p % labelStep === 0);
  const geneLabelH = Math.round(fontPx * 1.5);
  const boxH = Math.round(fontPx * 1.6);
  const noteH = Math.round(fontPx * 1.3);
  const rowH = geneLabelH + boxH + noteH + 6;
  const lettersTop = tickH;
  const rowsTop = lettersTop + letterH + 8;
  const height = rowsTop + rows.length * rowH + 4;
  const picked = pick ? readings.find((r) => r.gene.name === pick.gene) : null;
  const pickedCodon = picked && pick ? picked.codons[pick.index - 1] ?? null : null;

  return (
    <div className="mt-3" data-testid="letters-track">
      {versionLine}
      <p className={`mb-1 text-text-muted ${fontCls}`}>
        DNA letters on the forward strand, read left to right. A, C, G and T each have their own colour, and the letter is always shown.
        {rows.length ? " Under coding letters, each group of three is read in the gene's direction and gives one amino acid." : " No coding letters in this view."}
        {applied ? (applied.kind === "letters missing" ? " In the variant version, a dashed box with a line through it is a gap where letters are missing." : " In the variant version, the changed letter has a thick outline and a triangle underneath.") : ""}
        {vAt.size && !applied ? " Outlined, underlined letters are where a variant is (a dashed outline means the letters are missing in the variant)." : ""}
        {cell * span > W - 2 * pad + 1 ? " Scroll sideways to see every letter." : ""}
      </p>
      <div ref={scroller} className="overflow-x-auto" data-testid="letters-scroller">
        <svg width={innerW} height={height} className="block">
          {ticks.map((p) => (
            <g key={p} aria-hidden="true">
              <line x1={x(p)} x2={x(p)} y1={tickH - 4} y2={tickH + 2} className="stroke-text-muted" strokeWidth={1} />
              <text x={x(p) + 2} y={tickH - 6} className={`fill-text-muted tabular-nums ${fontCls}`}>{fmt(p)}</text>
            </g>
          ))}
          <g role="group" aria-label={`Letters ${fmt(win.startBp)} to ${fmt(win.endBp - 1)}. Left and Right move one letter.`}>
            {positions.map((p, i) => {
              const refL = letterAt(region, p) ?? "?";
              const alt = applied ? variantLetterAt(applied, p) : null;
              const gap = alt === "gap";
              const L = alt && !gap ? alt : refL;
              const coding = codingAt.get(p);
              const vs = vAt.get(p);
              const changeText = gap ? `, missing in the variant (reference letter ${refL})` : alt ? `, changed: ${refL} to ${alt}` : "";
              return (
                <g
                  key={p}
                  ref={(el) => { letterRefs.current[i] = el; }}
                  tabIndex={i === active ? 0 : -1}
                  role="img"
                  aria-label={`${gap ? "Gap" : L}, position ${fmt(p)}${coding ? `, coding in ${coding.join(" and ")}` : ""}${vs ? `, variant ${vs.map((v) => v.id).join(" and ")}` : ""}${changeText}`}
                  data-letter={gap ? "gap" : L}
                  data-variant={vs ? vs.map((v) => v.id).join(" ") : undefined}
                  data-testid={i === 0 ? "letter-first" : undefined}
                  onFocus={() => setActive(i)}
                  onKeyDown={(e) => onLetterKey(e, i)}
                  className="outline-none [&:focus>rect.ring]:stroke-focus"
                >
                  <rect x={x(p)} y={lettersTop} width={cell} height={letterH} className={coding ? "fill-surface-muted" : "fill-transparent"} />
                  {alt ? (
                    <>
                      <rect x={x(p) + 1.5} y={lettersTop + 1.5} width={cell - 3} height={letterH - 3} rx={2} className={gap ? "fill-surface stroke-variant-mark" : "fill-none stroke-variant-mark"} strokeWidth={3}
                        strokeDasharray={gap ? "3 2" : undefined} />
                      {gap ? (
                        <line x1={x(p) + 3} x2={x(p) + cell - 3} y1={lettersTop + letterH / 2} y2={lettersTop + letterH / 2} className="stroke-variant-mark" strokeWidth={2} />
                      ) : (
                        <polygon points={`${x(p) + cell / 2},${lettersTop + letterH - 6} ${x(p) + cell / 2 + 3.5},${lettersTop + letterH + 1} ${x(p) + cell / 2 - 3.5},${lettersTop + letterH + 1}`} className="fill-variant-mark" />
                      )}
                    </>
                  ) : vs ? (
                    <>
                      <rect x={x(p) + 1.5} y={lettersTop + 1.5} width={cell - 3} height={letterH - 3} rx={2} className="fill-none stroke-variant-mark" strokeWidth={2}
                        strokeDasharray={vs.some((v) => v.kind === "letters missing") ? "3 2" : undefined} />
                      <line x1={x(p) + 3} x2={x(p) + cell - 3} y1={lettersTop + letterH - 4} y2={lettersTop + letterH - 4} className="stroke-variant-mark" strokeWidth={2.5} />
                    </>
                  ) : null}
                  <rect x={x(p) + 1} y={lettersTop + 1} width={cell - 2} height={letterH - 2} rx={2} className="ring fill-none stroke-transparent" strokeWidth={3} />
                  {gap ? null : <text x={x(p) + cell / 2} y={lettersTop + letterH * 0.72} textAnchor="middle" className={`font-mono font-bold ${BASE_CLASS[L] ?? "fill-base-n"} ${fontCls}`}>{L}</text>}
                </g>
              );
            })}
          </g>
          {rows.map((r, ri) => (
            <ProteinRow
              key={r.gene.name} reading={r} codons={r.inView} y={rowsTop + ri * rowH} x={x} cell={cell} fontPx={fontPx} fontCls={fontCls}
              geneLabelH={geneLabelH} boxH={boxH} noteH={noteH} win={win} innerW={innerW} pad={pad}
              pick={pick} onPick={setPick}
            />
          ))}
        </svg>
      </div>
      {picked && pickedCodon ? <AminoPanel region={region} reading={picked} codon={pickedCodon} big={big} onClose={() => setPick(null)} /> : null}
    </div>
  );
}

type RowProps = {
  reading: GeneReading; codons: Codon[]; y: number; x: (bp: number) => number; cell: number; fontPx: number; fontCls: string;
  geneLabelH: number; boxH: number; noteH: number; win: Win; innerW: number; pad: number; pick: AminoPick; onPick: (p: AminoPick) => void;
};

/** One gene's amino acids under its coding letters. Roving focus: Left/Right between amino acids, Enter shows details. */
function ProteinRow({ reading, codons, y, x, cell, fontPx, fontCls, geneLabelH, boxH, noteH, win, innerW, pad, pick, onPick }: RowProps) {
  const g = reading.gene;
  const minus = g.strand === "-";
  const [active, setActive] = useState(0);
  const refs = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, codons.length - 1))); }, [codons.length]);
  // Codons are kept in reading order; arrow keys follow the screen (Right is always to the right).
  const screen = minus ? [...codons].reverse() : codons;
  const move = (i: number) => { setActive(i); refs.current[i]?.focus(); };
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight") move(Math.min(screen.length - 1, i + 1));
    else if (k === "ArrowLeft") move(Math.max(0, i - 1));
    else if (k === "Home") move(0);
    else if (k === "End") move(screen.length - 1);
    else if (k === "Enter" || k === " ") onPick({ gene: g.name, index: screen[i].index });
    else if (k === "ArrowUp" || k === "ArrowDown") { /* no zoom while reading */ }
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const total = g.protein ? g.protein.length : Math.max(0, reading.codons.length - 1);
  const check = reading.check;
  const checkText = check.status === "match" ? `matches the file (${fmt(check.length)} amino acids)`
    : check.status === "mismatch" ? `differs from the file at amino acid ${fmt(check.at)}`
    : check.status === "partial" ? "only partly in this region, so not checked" : "no protein in the file to check";
  const vr = reading.variant;
  const variantText = !vr ? null
    : vr.same ? "variant version: the protein is the same"
    : vr.earlyStopAt ? `variant version: ends early at a stop after amino acid ${fmt(vr.madeLength)} of ${fmt(vr.refLength)}; dashed boxes are not made`
    : vr.leftOut ? `variant version: ${vr.leftOut} amino acid${vr.leftOut === 1 ? "" : "s"} left out, ${fmt(vr.madeLength)} instead of ${fmt(vr.refLength)}`
    : "variant version: changed amino acids have a thick outline and a mark underneath";
  const boxY = y + geneLabelH;
  const lo = win.startBp, hi = win.endBp;

  return (
    <g data-testid={`protein-row-${g.name}`}>
      <text x={pad} y={y + fontPx * 1.05} className={`fill-text ${fontCls}`}>
        <tspan className="font-semibold">{g.name} protein</tspan>
        {variantText ? (
          <tspan className="fill-variant-mark font-semibold" data-testid={`protein-version-${g.name}`}>{` (${minus ? "read right to left" : "read left to right"}; ${variantText})`}</tspan>
        ) : (
          <tspan className={check.status === "mismatch" ? "fill-danger" : "fill-text-muted"}>{` (${minus ? "read right to left, letters swapped A with T and C with G" : "read left to right"}; ${checkText})`}</tspan>
        )}
      </text>
      <g role="group" aria-label={`${g.name} amino acids in view, ${codons.length}. Left and Right move between them, Enter shows details.`}>
        {screen.map((c, i) => {
          const sel = !!pick && pick.gene === g.name && pick.index === c.index;
          const visible = c.parts.map((p) => clipSpan(p, lo, hi));
          const main = visible[c.main];
          const split = c.parts.length > 1;
          const first = visible[0];
          const second = visible[1] ?? null;
          // Text on the intron side: "+" genes read rightwards, "-" genes leftwards.
          const noteAt = c.joined && main ? { x: (x(main[0]) + x(main[1])) / 2, anchor: "middle", text: "joined across the gap" }
            : split && first ? { x: minus ? x(first[0]) - 2 : x(first[1]) + 2, anchor: minus ? "end" : "start", text: minus ? "continues in next exon \u2190" : "\u2192 continues in next exon" }
            : split && second ? { x: minus ? x(second[1]) + 2 : x(second[0]) - 2, anchor: minus ? "start" : "end", text: "continued from previous exon" }
            : null;
          const label = c.aa === null ? "?" : c.stop ? "Stop" : null;
          const partW = main ? (main[1] - main[0]) * cell : 0;
          const three = partW >= fontPx * 1.9;
          const name = c.aa && !c.stop ? (three ? threeOf(c.aa) : c.aa) : label;
          const shownTotal = vr && !c.notMade ? vr.madeLength : total;
          const aria0 = c.aa === null ? `Amino acid ${c.index} of ${shownTotal}: some letters lie outside the region`
            : c.stop ? `Stop signal, after amino acid ${fmt(c.index - 1)}` : `${fullOf(c.aa)}, ${c.index} of ${shownTotal}`;
          const aria = c.notMade ? `Not made in the variant: reference amino acid ${c.index} of ${total}, ${c.aa ? fullOf(c.aa) : "unknown"}`
            : `${aria0}${c.changed ? (c.joined ? ", changed: joined across the missing letters" : ", changed in the variant") : ""}`;
          const bounds = visible.filter((v): v is [number, number] => !!v);
          const minX = Math.min(...bounds.map((v) => x(v[0])));
          const maxX = Math.max(...bounds.map((v) => x(v[1])));
          return (
            <g
              key={c.index}
              ref={(el) => { refs.current[i] = el; }}
              tabIndex={i === active ? 0 : -1}
              role="button"
              aria-pressed={sel}
              aria-label={`${aria}${split ? ", split by an intron: continues in the next exon" : ""}`}
              data-testid={`aa-${g.name}-${c.index}`}
              onClick={() => { setActive(i); onPick({ gene: g.name, index: c.index }); }}
              onKeyDown={(e) => onKey(e, i)}
              onFocus={() => setActive(i)}
              className="cursor-pointer outline-none [&:focus>rect.ring]:stroke-focus"
            >
              {bounds.map((v, k) => (
                <rect key={k} x={x(v[0]) + 0.5} y={boxY} width={Math.max(1, x(v[1]) - x(v[0]) - 1)} height={boxH} rx={2}
                  className={c.notMade ? "fill-surface stroke-divider-strong" : c.changed ? "fill-surface stroke-variant-mark" : c.stop ? "fill-surface stroke-stop" : sel ? "fill-accent-soft stroke-gene-selected" : "fill-surface stroke-divider-strong"}
                  strokeWidth={c.changed ? 3 : c.stop || sel ? 2 : 1} strokeDasharray={c.notMade ? "4 3" : visible[k] && k !== c.main ? "2 2" : undefined} />
              ))}
              {c.changed && main ? (
                <polygon points={`${(x(main[0]) + x(main[1])) / 2},${boxY + boxH - 2} ${(x(main[0]) + x(main[1])) / 2 + 4},${boxY + boxH + 5} ${(x(main[0]) + x(main[1])) / 2 - 4},${boxY + boxH + 5}`} className="fill-variant-mark" data-testid={`aa-changed-${g.name}-${c.index}`} />
              ) : null}
              {main && name ? (
                <text x={(x(main[0]) + x(main[1])) / 2} y={boxY + boxH * 0.72} textAnchor="middle" className={`${c.notMade ? "fill-text-muted font-normal" : c.stop ? "fill-stop font-bold" : "fill-text font-semibold"} ${fontCls}`}>{name}</text>
              ) : null}
              {noteAt ? (
                <text
                  x={noteAt.x} y={boxY + boxH + noteH * 0.8}
                  textAnchor={noteAt.anchor as "start" | "end"} className={`fill-text-muted ${fontCls}`}
                  data-testid={c.joined ? `joined-${g.name}-${c.index}` : `split-${g.name}-${c.index}`}
                >
                  {noteAt.text}
                </text>
              ) : null}
              <rect x={minX - 2} y={boxY - 2} width={Math.min(innerW, maxX + 2) - (minX - 2)} height={boxH + 4} rx={3} className="ring fill-none stroke-transparent" strokeWidth={3} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

const clipSpan = (s: [number, number], lo: number, hi: number): [number, number] | null => {
  const a = Math.max(s[0], lo), b = Math.min(s[1], hi);
  return b > a ? [a, b] : null;
};
const threeOf = (aa: string) => aaInfo(aa).three;
const fullOf = (aa: string) => aaInfo(aa).full;
