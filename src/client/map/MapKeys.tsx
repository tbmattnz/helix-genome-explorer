import type { DensityScale, Genome } from "../../shared/genome";
import { fmt } from "../../shared/genome";
import { stainClass, DENSITY_CLASS } from "./Ideogram";

/** Keys for band stains (labels from meta.stains) and gene-density shading (ranges from the data). */
export function MapKeys({ genome, scale, big }: { genome: Genome; scale: DensityScale; big: boolean }) {
  const txt = big ? "text-base" : "text-sm";
  const used = new Set(genome.chromosomes.flatMap((c) => c.bands.map((b) => b.stain)));
  const stains = Object.entries(genome.stains).filter(([k]) => used.has(k));
  return (
    <div className={`grid gap-6 border-t border-divider pt-5 md:grid-cols-2 ${txt}`} data-testid="map-keys">
      <section aria-labelledby="key-bands">
        <h3 id="key-bands" className="mb-2 font-semibold text-text">Bands</h3>
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {stains.map(([k, label]) => (
            <li key={k} className="flex items-center gap-2 text-text-muted">
              <svg width="26" height="14" aria-hidden="true" focusable="false" className="shrink-0">
                {k === "acen" ? (
                  <polygon points="1,1 13,7 1,13 25,13 13,7 25,1" className="fill-band-acen stroke-band-outline" strokeWidth={1} />
                ) : k === "stalk" ? (
                  <rect x="1" y="4" width="24" height="6" className="fill-band-stalk stroke-band-outline" strokeWidth={1} />
                ) : (
                  <rect x="1" y="1" width="24" height="12" rx="2" className={`${k === "gvar" ? "" : stainClass(k)} stroke-band-outline`} fill={k === "gvar" ? "url(#helix-hatch)" : undefined} strokeWidth={1} />
                )}
              </svg>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-text-muted">The pinched waist on each chromosome is its centromere.</p>
      </section>
      <section aria-labelledby="key-density">
        <h3 id="key-density" className="mb-2 font-semibold text-text">Gene density</h3>
        <p className="mb-2 text-text-muted">Protein-coding genes per block of {fmt(genome.binSizeBp)} letters. Longer, darker bars mean more genes.</p>
        <ul className="space-y-1">
          {scale.ranges.map((r) => (
            <li key={r.level} className="flex items-center gap-2 text-text-muted">
              <svg width="60" height="12" aria-hidden="true" focusable="false" className="shrink-0">
                <rect x="0" y="5.5" width="60" height="1" className="fill-divider" />
                {r.level > 0 ? <rect x="0" y="1" width={r.level * 12} height="10" className={DENSITY_CLASS[r.level]} /> : null}
              </svg>
              <span className="tabular-nums">{r.level === 0 ? "No genes" : `${r.label} genes`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
