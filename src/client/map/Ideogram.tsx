import type { Chromosome } from "../../shared/genome";
import { mb } from "../../shared/genome";

// Literal class names so Tailwind generates them. Colours live in styles.css.
export const STAIN_CLASS: Record<string, string> = {
  gneg: "fill-band-gneg",
  gpos25: "fill-band-gpos25",
  gpos50: "fill-band-gpos50",
  gpos75: "fill-band-gpos75",
  gpos100: "fill-band-gpos100",
  acen: "fill-band-acen",
  gvar: "fill-band-gvar",
  stalk: "fill-band-stalk",
};
export const stainClass = (s: string) => STAIN_CLASS[s] ?? "fill-band-unknown";

export const DENSITY_CLASS = ["fill-density-0", "fill-density-1", "fill-density-2", "fill-density-3", "fill-density-4", "fill-density-5"];

/** Shared pattern for variable regions (hatching, so it does not rely on colour). Render once per page. */
export function PatternDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <pattern id="helix-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" className="fill-band-gvar" />
          <line x1="0" y1="0" x2="0" y2="5" strokeWidth="2" className="stroke-band-hatch" />
        </pattern>
      </defs>
    </svg>
  );
}

type Props = {
  c: Chromosome;
  stains: Record<string, string>;
  /** Letter position to pixel along the chromosome. */
  along: (bp: number) => number;
  cross: number;
  thickness: number;
  vertical: boolean;
  id: string;
  titles?: boolean;
};

/** Bands, centromere pinch and outline of one chromosome, drawn vertically (map) or horizontally (zoom). */
export function Ideogram({ c, stains, along, cross, thickness: t, vertical, id, titles }: Props) {
  const box = (a0: number, a1: number, c0 = cross, c1 = cross + t) => {
    const lo = Math.min(a0, a1), len = Math.max(0.5, Math.abs(a1 - a0));
    return vertical ? { x: c0, y: lo, width: c1 - c0, height: len } : { x: lo, y: c0, width: len, height: c1 - c0 };
  };
  const pt = (a: number, cc: number) => (vertical ? `${cc},${a}` : `${a},${cc}`);
  const cen = c.centromere;
  const [p0, p1, q0, q1] = [along(0), along(cen.startBp), along(cen.endBp), along(c.lengthBp)];
  const mid = along(cen.midBp);
  const r = t / 2;
  const rp = Math.min(r, Math.abs(p1 - p0) / 2);
  const rq = Math.min(r, Math.abs(q1 - q0) / 2);
  const centre = cross + r;
  const pinch = `${pt(p1, cross)} ${pt(p1, cross + t)} ${pt(mid, centre + 0.6)} ${pt(q0, cross + t)} ${pt(q0, cross)} ${pt(mid, centre - 0.6)}`;
  const shapes = (cls: string) => (
    <>
      <rect {...box(p0, p1)} rx={rp} ry={rp} className={cls} />
      <rect {...box(q0, q1)} rx={rq} ry={rq} className={cls} />
      <polygon points={pinch} className={cls} />
    </>
  );
  const clip = `clip-${id}`;
  return (
    <g>
      <clipPath id={clip}>{shapes("")}</clipPath>
      <g clipPath={`url(#${clip})`}>
        {c.bands.map((b) => {
          const narrow = b.stain === "stalk";
          const props = narrow ? box(along(b.startBp), along(b.endBp), cross + t * 0.3, cross + t * 0.7) : box(along(b.startBp), along(b.endBp));
          return (
            <rect key={b.name + b.startBp} {...props} className={b.stain === "gvar" ? "" : stainClass(b.stain)} fill={b.stain === "gvar" ? "url(#helix-hatch)" : undefined}>
              {titles ? <title>{`Band ${c.name}${b.name}: ${stains[b.stain] ?? b.stain}, ${mb(b.startBp)} to ${mb(b.endBp)} million letters`}</title> : null}
            </rect>
          );
        })}
      </g>
      <g className="fill-none stroke-band-outline" strokeWidth={1}>{shapes("fill-none stroke-band-outline")}</g>
    </g>
  );
}
