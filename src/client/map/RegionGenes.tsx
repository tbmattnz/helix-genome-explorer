import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Win } from "../../shared/genome";
import { directionText } from "../../shared/genes";
import { clip, exonNumber, exonPieces, type Region, type RegionGene } from "../../shared/regions";
import { variantAria, type Variant } from "../../shared/variantView";

export type RegionPick = { gene: string; exon: number | null } | null;
type Item = { gene: RegionGene; exon: number | null; x0: number; x1: number; y0: number; y1: number };
type Props = {
  region: Region; win: Win; W: number; pad: number; big: boolean; picked: RegionPick; onPick: (p: RegionPick) => void;
  variants: Variant[]; variantPick: string | null; onVariant: (id: string) => void;
};
type Placed = { v: Variant; a: number; b: number; x0: number; x1: number; cx: number; lx: number; lw: number; row: number; missing: boolean };

/**
 * Every gene in the region: exons as boxes (coding tall, untranslated ends short), introns as a thin line,
 * arrowheads for direction. Only the part inside the region is drawn; a dashed stub marks where a gene continues.
 * Variant markers sit above the genes: a diamond for one letter changed, a bracket over missing letters, each
 * labelled with its id and joined by a dashed line to an outlined spot on its gene.
 */
export function RegionGenes({ region, win, W, pad, big, picked, onPick, variants, variantPick, onVariant }: Props) {
  const rem = typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fontPx = (big ? 1 : 0.8125) * rem;
  const fontCls = big ? "text-base" : "text-[0.8125rem]";
  const codH = Math.round(fontPx * 1.5);
  const utrH = Math.round(codH * 0.45);
  const labelH = Math.round(fontPx * 1.6);
  const laneH = labelH + codH + Math.round(fontPx * 1.1);
  const span = win.endBp - win.startBp;
  const along = (bp: number) => pad + ((bp - win.startBp) / span) * (W - 2 * pad);
  const lo = Math.max(win.startBp, region.startBp);
  const hi = Math.min(win.endBp, region.endBp);

  // Variant markers, packed into rows so labels never overlap.
  const s = Math.max(5, Math.round(fontPx * 0.5));
  const vRowH = Math.round(2 * s + fontPx * 1.7);
  const charW = fontPx * 0.62;
  const placed: Placed[] = useMemo(() => {
    const ends: number[] = [];
    return variants
      .filter((v) => v.endBp > lo && v.startBp < hi)
      .sort((p, q) => p.startBp - q.startBp)
      .map((v) => {
        const a = along(Math.max(v.startBp, lo)), b = along(Math.min(v.endBp, hi));
        const missing = v.kind === "letters missing";
        const mid = (a + b) / 2;
        const x0 = missing ? Math.min(a, mid - s) : mid - s;
        const x1 = missing ? Math.max(b, mid + s) : mid + s;
        const cx = (x0 + x1) / 2;
        const lw = v.id.length * charW;
        const lx = Math.max(pad, Math.min(cx - lw / 2, W - pad - lw));
        const left = Math.min(x0, lx) - 6, right = Math.max(x1, lx + lw) + 6;
        let row = ends.findIndex((e) => e <= left);
        if (row === -1) row = ends.length < 4 ? ends.length : ends.indexOf(Math.min(...ends));
        ends[row] = Math.max(ends[row] ?? 0, right);
        return { v, a, b, x0, x1, cx, lx, lw, row, missing };
      });
  }, [variants, lo, hi, win.startBp, span, W, pad, s, charW]); // eslint-disable-line react-hooks/exhaustive-deps
  const vRows = placed.length ? Math.max(...placed.map((p) => p.row + 1)) : 0;
  const top = vRows ? vRows * vRowH + 8 : 0;
  const laneY = (gi: number) => 4 + top + gi * laneH;

  const items = useMemo(() => {
    const out: Item[] = [];
    region.genes.forEach((g, gi) => {
      const y0 = laneY(gi);
      const mid = y0 + labelH + codH / 2;
      const drawn = clip([g.startBp, g.endBp], lo, hi);
      if (!drawn) return;
      out.push({ gene: g, exon: null, x0: along(drawn[0]), x1: along(drawn[1]), y0, y1: y0 + laneH - 4 });
      g.exons.forEach((e, i) => {
        const c = clip(e, lo, hi);
        if (!c) return;
        const x0 = along(c[0]);
        const x1 = Math.max(x0 + 1.5, along(c[1]));
        out.push({ gene: g, exon: i, x0, x1, y0: mid - codH / 2, y1: mid + codH / 2 });
      });
    });
    return out;
  }, [region, lo, hi, laneH, labelH, codH, top, win.startBp, span, W, pad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Genes and exons: one roving focus group.
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const refs = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const i = items.findIndex((it) => picked && it.gene.name === picked.gene && it.exon === picked.exon);
    setActive((a) => (i >= 0 ? i : Math.min(a, Math.max(0, items.length - 1))));
  }, [items, picked]);

  // Variant markers: their own roving focus group.
  const [vActive, setVActive] = useState(0);
  const [vFocused, setVFocused] = useState<number | null>(null);
  const vRefs = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const i = placed.findIndex((p) => p.v.id === variantPick);
    setVActive((a) => (i >= 0 ? i : Math.min(a, Math.max(0, placed.length - 1))));
  }, [placed, variantPick]);

  const move = (i: number) => { setActive(i); refs.current[i]?.focus(); };
  const vMove = (i: number) => { setVActive(i); vRefs.current[i]?.focus(); };
  const nextGene = (i: number, dir: 1 | -1) => {
    for (let k = i + dir; k >= 0 && k < items.length; k += dir) if (items[k].exon === null) return k;
    return i;
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight") move(Math.min(items.length - 1, i + 1));
    else if (k === "ArrowLeft") move(Math.max(0, i - 1));
    else if (k === "ArrowDown") move(nextGene(i, 1));
    else if (k === "ArrowUp") move(items[i].exon === null ? nextGene(i, -1) : nextGene(i + 1, -1));
    else if (k === "Home") move(0);
    else if (k === "End") move(items.length - 1);
    else if (k === "Enter" || k === " ") onPick({ gene: items[i].gene.name, exon: items[i].exon });
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onVKey = (e: KeyboardEvent, i: number) => {
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown") vMove(Math.min(placed.length - 1, i + 1));
    else if (k === "ArrowLeft" || k === "ArrowUp") vMove(Math.max(0, i - 1));
    else if (k === "Home") vMove(0);
    else if (k === "End") vMove(placed.length - 1);
    else if (k === "Enter" || k === " ") onVariant(placed[i].v.id);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const height = 8 + top + region.genes.length * laneH;
  const isPicked = (it: Item) => !!picked && picked.gene === it.gene.name && picked.exon === it.exon;

  return (
    <div className="mt-4" data-testid="region-genes">
      <p className={`mb-2 text-text-muted ${fontCls}`}>
        Tall boxes are coding parts of exons, short boxes are untranslated ends, and the thin line is an intron. Arrowheads show the direction a gene is read. Tab to the genes, use the arrow keys to move through each gene and its exons, and Enter to show details.
        {placed.length ? " Above the genes, a diamond marks one changed letter and a bracket marks missing letters; each is labelled with its variant name. Tab to a marker and press Enter to see the variant." : ""}
      </p>
      <div role="group" aria-label={`Genes in this region, ${region.genes.length}. Left and Right move through genes and exons, Up and Down jump between genes, Enter shows details.`}>
        <svg width={W} height={height} className="block overflow-visible">
          {placed.length ? (
            <g role="group" aria-label={`Variants in view, ${placed.length}. Left and Right move between variants, Enter shows details.`} data-testid="variant-markers">
              {placed.map((p, i) => {
                const y = 4 + p.row * vRowH;
                const sel = variantPick === p.v.id;
                const gi = region.genes.findIndex((g) => g.name === p.v.gene);
                const laneMid = gi >= 0 && clip([region.genes[gi].startBp, region.genes[gi].endBp], lo, hi) ? laneY(gi) + labelH + codH / 2 : null;
                const hx0 = Math.min(p.x0, p.lx) - 4, hx1 = Math.max(p.x1, p.lx + p.lw) + 4;
                const hh = 2 * s + fontPx * 1.45;
                return (
                  <g
                    key={p.v.id}
                    ref={(el) => { vRefs.current[i] = el; }}
                    tabIndex={i === vActive ? 0 : -1}
                    role="button"
                    aria-pressed={sel}
                    aria-label={variantAria(p.v)}
                    data-testid={`vm-${p.v.id}`}
                    onClick={(e) => { e.stopPropagation(); setVActive(i); onVariant(p.v.id); }}
                    onKeyDown={(e) => onVKey(e, i)}
                    onFocus={() => { setVActive(i); setVFocused(i); }}
                    onBlur={() => setVFocused(null)}
                    className="cursor-pointer outline-none"
                  >
                    {laneMid !== null ? <rect x={p.cx - 6} y={y + hh} width={12} height={Math.max(0, laneMid - codH / 2 - 4 - (y + hh))} className="fill-transparent" /> : null}
                    {laneMid !== null ? (
                      <line x1={p.cx} x2={p.cx} y1={y + hh} y2={laneMid - codH / 2 - 4} className="stroke-variant-mark" strokeWidth={1.25} strokeDasharray="2 3" />
                    ) : null}
                    <rect x={hx0} y={y - 3} width={hx1 - hx0} height={hh + 4} className="fill-transparent" />
                    {p.missing ? (
                      <path d={`M${p.x0},${y + 2 * s} V${y} H${p.x1} V${y + 2 * s}`} className="fill-none stroke-variant-mark" strokeWidth={sel ? 4 : 2.5} />
                    ) : (
                      <polygon points={`${p.cx},${y} ${p.cx + s},${y + s} ${p.cx},${y + 2 * s} ${p.cx - s},${y + s}`} className="fill-variant-mark stroke-gene-selected" strokeWidth={sel ? 2.5 : 0} />
                    )}
                    <text x={p.lx} y={y + 2 * s + fontPx * 1.1} paintOrder="stroke" strokeWidth={5} strokeLinejoin="round" className={`fill-variant-mark stroke-bg ${sel ? "font-bold underline" : "font-semibold"} ${fontCls}`}>{p.v.id}</text>
                    {sel ? <rect x={hx0 - 1} y={y - 4} width={hx1 - hx0 + 2} height={hh + 6} rx={3} className="fill-none stroke-gene-selected" strokeWidth={2} /> : null}
                    {vFocused === i ? <rect x={hx0 - 3} y={y - 6} width={hx1 - hx0 + 6} height={hh + 10} rx={4} className="fill-none stroke-focus" strokeWidth={3} /> : null}
                  </g>
                );
              })}
            </g>
          ) : null}

          {region.genes.map((g, gi) => {
            const y0 = laneY(gi);
            const mid = y0 + labelH + codH / 2;
            const drawn = clip([g.startBp, g.endBp], lo, hi);
            const contLeft = g.startBp < region.startBp;
            const contRight = g.endBp > region.endBp;
            const cont = contLeft || contRight;
            const plus = g.strand === "+";
            const minus = g.strand === "-";
            // Label: full wording when it fits, a shorter one on narrow screens; never past the right edge.
            const side = contLeft && contRight ? "left and right" : contLeft ? "left" : "right";
            const long = `${g.name} ${plus ? "(+, read left to right)" : minus ? "(-, read right to left)" : ""}${cont ? `, continues beyond the region to the ${side}` : ""}${drawn ? "" : ", not in this view"}`;
            const short = `${g.name} ${g.strand ? `(${g.strand})` : ""}${cont ? `, continues ${side}` : ""}${drawn ? "" : ", not in view"}`;
            const est = (t: string) => t.length * fontPx * 0.56;
            const labelText = est(long) <= W - 2 * pad ? long : short;
            const lx = Math.max(pad, Math.min(drawn ? along(drawn[0]) : pad, W - pad - est(labelText)));
            const rest = labelText.slice(g.name.length);
            return (
              <g key={g.name} data-testid={`rg-lane-${g.name}`}>
                <text x={lx} y={y0 + fontPx} className={`fill-text ${fontCls}`}>
                  <tspan className="font-semibold">{g.name}</tspan>
                  <tspan className="fill-text-muted">{rest}</tspan>
                </text>
                {drawn ? (
                  <>
                    <line x1={along(drawn[0])} x2={along(drawn[1])} y1={mid} y2={mid} className="stroke-intron" strokeWidth={1.5} />
                    {chevrons(along(drawn[0]), along(drawn[1]), mid, plus ? 1 : minus ? -1 : 0)}
                    {contLeft && lo <= region.startBp ? <line x1={along(region.startBp) - 16} x2={along(region.startBp)} y1={mid} y2={mid} className="stroke-intron" strokeWidth={1.5} strokeDasharray="3 3" data-testid={`cont-left-${g.name}`} /> : null}
                    {contRight && hi >= region.endBp ? <line x1={along(region.endBp)} x2={along(region.endBp) + 16} y1={mid} y2={mid} className="stroke-intron" strokeWidth={1.5} strokeDasharray="3 3" data-testid={`cont-right-${g.name}`} /> : null}
                    {g.exons.map((e, i) => {
                      const c = clip(e, lo, hi);
                      if (!c) return null;
                      return exonPieces(g, c).map((p) => {
                        const h = p.coding ? codH : utrH;
                        const x0 = along(p.span[0]);
                        return <rect key={`${i}-${p.span[0]}`} x={x0} y={mid - h / 2} width={Math.max(1.5, along(p.span[1]) - x0)} height={h} className={p.coding ? "fill-exon-coding" : "fill-exon-utr stroke-exon-coding"} strokeWidth={p.coding ? 0 : 1} />;
                      });
                    })}
                    {plus && g.endBp <= hi ? <polygon points={`${along(g.endBp) + 1},${mid - 6} ${along(g.endBp) + 9},${mid} ${along(g.endBp) + 1},${mid + 6}`} className="fill-exon-coding" /> : null}
                    {minus && g.startBp >= lo ? <polygon points={`${along(g.startBp) - 1},${mid - 6} ${along(g.startBp) - 9},${mid} ${along(g.startBp) - 1},${mid + 6}`} className="fill-exon-coding" /> : null}
                    {placed.filter((p) => p.v.gene === g.name).map((p) => (
                      <rect key={`vt-${p.v.id}`} x={p.a - 1.5} y={mid - codH / 2 - 3} width={Math.max(3, p.b - p.a + 3)} height={codH + 6} rx={1.5}
                        className="fill-none stroke-variant-mark" strokeWidth={1.75} data-testid={`vtick-${p.v.id}`} />
                    ))}
                  </>
                ) : null}
              </g>
            );
          })}

          {items.map((it, i) => {
            const sel = isPicked(it);
            const label = it.exon === null
              ? `${it.gene.name} gene${it.gene.fullName ? `, ${it.gene.fullName}` : ""}. ${it.gene.exons.length} exons. ${directionText(it.gene.strand) ?? ""}`
              : `${it.gene.name} exon ${exonNumber(it.gene, it.exon)} of ${it.gene.exons.length}`;
            const ring = (pad2: number, cls: string, sw: number) => (
              <rect x={it.x0 - pad2} y={it.y0 - pad2} width={it.x1 - it.x0 + pad2 * 2} height={it.y1 - it.y0 + pad2 * 2} rx={3} className={`fill-none ${cls}`} strokeWidth={sw} />
            );
            return (
              <g
                key={`${it.gene.name}-${it.exon ?? "g"}`}
                ref={(el) => { refs.current[i] = el; }}
                tabIndex={i === active ? 0 : -1}
                role="button"
                aria-pressed={sel}
                aria-label={label}
                data-testid={it.exon === null ? `rg-gene-${it.gene.name}` : `rg-exon-${it.gene.name}-${exonNumber(it.gene, it.exon)}`}
                onClick={(e) => { e.stopPropagation(); setActive(i); onPick({ gene: it.gene.name, exon: it.exon }); }}
                onKeyDown={(e) => onKey(e, i)}
                onFocus={() => { setActive(i); setFocused(i); }}
                onBlur={() => setFocused(null)}
                className="cursor-pointer outline-none"
              >
                <rect x={it.x0 - (it.exon === null ? 0 : 3)} y={it.y0} width={Math.max(it.exon === null ? 1 : 7, it.x1 - it.x0 + (it.exon === null ? 0 : 6))} height={it.y1 - it.y0} className="fill-transparent" />
                {sel ? ring(it.exon === null ? 1 : 3, "stroke-gene-selected", 2.5) : null}
                {focused === i ? ring(it.exon === null ? 3 : 5, "stroke-focus", 3) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Small direction chevrons along the intron line, every 70 px. */
function chevrons(x0: number, x1: number, y: number, dir: number) {
  if (!dir) return null;
  const out = [];
  for (let x = x0 + 35; x < x1 - 20; x += 70) {
    out.push(<polyline key={x} points={`${x - 3 * dir},${y - 4} ${x + 2 * dir},${y} ${x - 3 * dir},${y + 4}`} className="fill-none stroke-intron" strokeWidth={1.5} />);
  }
  return out;
}
