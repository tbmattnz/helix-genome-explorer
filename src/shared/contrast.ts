// Copy of the palette in styles.css, used only by the automated contrast test.
const C = {
  bg: "#f6f8f9", surface: "#ffffff", surfaceMuted: "#eef2f4", text: "#14212b", textMuted: "#4a5a66",
  dividerStrong: "#5f6d78", accent: "#0b6e72", accentStrong: "#08575a", accentSoft: "#e2f1f1", onAccent: "#ffffff",
  danger: "#b42318", dangerStrong: "#8f1c13", success: "#1d6b3a", focus: "#1a4fd6", disabled: "#e4e8eb", onDisabled: "#4f5d68",
  gene: "#2f5d8a", geneSelected: "#8a3b00", exonCoding: "#1f4f7a", intron: "#4a5a66",
  baseA: "#1d6b3a", baseC: "#1a4fd6", baseG: "#7a5200", baseT: "#b0185f", baseN: "#4a5a66", stop: "#b42318", variantMark: "#6b2fa0",
};

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const PALETTE_PAIRS = [
  { label: "text on page", fg: C.text, bg: C.bg, min: 4.5 },
  { label: "muted text on page", fg: C.textMuted, bg: C.bg, min: 4.5 },
  { label: "muted text on muted surface", fg: C.textMuted, bg: C.surfaceMuted, min: 4.5 },
  { label: "accent text on surface", fg: C.accentStrong, bg: C.surface, min: 4.5 },
  { label: "button text on accent", fg: C.onAccent, bg: C.accent, min: 4.5 },
  { label: "button text on danger", fg: C.onAccent, bg: C.danger, min: 4.5 },
  { label: "error text on surface", fg: C.danger, bg: C.surface, min: 4.5 },
  { label: "error text on muted surface", fg: C.danger, bg: C.surfaceMuted, min: 4.5 },
  { label: "success text on surface", fg: C.success, bg: C.surface, min: 4.5 },
  { label: "disabled text on disabled", fg: C.onDisabled, bg: C.disabled, min: 4.5 },
  { label: "focus ring on surface", fg: C.focus, bg: C.surface, min: 4.5 },
  { label: "focus ring on page", fg: C.focus, bg: C.bg, min: 4.5 },
  { label: "focus ring on accent button", fg: C.focus, bg: C.accentSoft, min: 4.5 },
  { label: "control border on surface", fg: C.dividerStrong, bg: C.surface, min: 4.5 },
  { label: "switch on: accent against page", fg: C.accentStrong, bg: C.surface, min: 4.5 },
  { label: "link text on surface", fg: C.accentStrong, bg: C.surface, min: 4.5 },
  { label: "error text on page", fg: C.danger, bg: C.bg, min: 4.5 },
  { label: "control border on page", fg: C.dividerStrong, bg: C.bg, min: 4.5 },
  { label: "control border on muted surface", fg: C.dividerStrong, bg: C.surfaceMuted, min: 4.5 },
  { label: "muted text on surface", fg: C.textMuted, bg: C.surface, min: 4.5 },
  { label: "text on muted surface (hovered chromosome)", fg: C.text, bg: C.surfaceMuted, min: 4.5 },
  { label: "gene bar on page", fg: C.gene, bg: C.bg, min: 4.5 },
  { label: "coding exon on page", fg: C.exonCoding, bg: C.bg, min: 4.5 },
  { label: "untranslated end outline on page", fg: C.exonCoding, bg: C.bg, min: 4.5 },
  { label: "intron line on page", fg: C.intron, bg: C.bg, min: 4.5 },
  { label: "selected gene on page", fg: C.geneSelected, bg: C.bg, min: 4.5 },
  ...([["A", C.baseA], ["C", C.baseC], ["G", C.baseG], ["T", C.baseT], ["N", C.baseN]] as const).flatMap(([n, col]) => [
    { label: `letter ${n} on page`, fg: col, bg: C.bg, min: 4.5 },
    { label: `letter ${n} on coding shading`, fg: col, bg: C.surfaceMuted, min: 4.5 },
  ]),
  { label: "stop signal on surface", fg: C.stop, bg: C.surface, min: 4.5 },
  { label: "variant marker on page", fg: C.variantMark, bg: C.bg, min: 4.5 },
  { label: "variant marker on coding shading", fg: C.variantMark, bg: C.surfaceMuted, min: 4.5 },
  { label: "variant marker on surface", fg: C.variantMark, bg: C.surface, min: 4.5 },
  { label: "amino acid text on selected box", fg: C.text, bg: C.accentSoft, min: 4.5 },
  { label: "text on highlighted search match", fg: C.text, bg: C.accentSoft, min: 4.5 },
  { label: "muted text on highlighted search match", fg: C.textMuted, bg: C.accentSoft, min: 4.5 },
];
