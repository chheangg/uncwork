/**
 * Three-step red gradient keyed off the FR-04 classifier confidence.
 * Used by both the link detail panel chip and the map-side attribution
 * badge so the operator's mental mapping (deeper red = more sure) stays
 * consistent across surfaces.
 */
export type FingerprintTone = {
  /** CSS hex for SVG fill / text. */
  hex: string;
  /** Same color as RGB triple for deck.gl layers. */
  rgb: [number, number, number];
  /** "HIGH" | "MED" | "LOW" — short label for the chip. */
  label: "HIGH" | "MED" | "LOW";
  /** Whether this confidence level should pulse in the map view. */
  pulse: boolean;
};

const HIGH: FingerprintTone = {
  hex: "#ff1a1a",
  rgb: [255, 26, 26],
  label: "HIGH",
  pulse: true,
};
const MED: FingerprintTone = {
  hex: "#cc3333",
  rgb: [204, 51, 51],
  label: "MED",
  pulse: false,
};
const LOW: FingerprintTone = {
  hex: "#992222",
  rgb: [153, 34, 34],
  label: "LOW",
  pulse: false,
};

export const fingerprintTone = (confidence: number): FingerprintTone => {
  if (confidence >= 0.75) return HIGH;
  if (confidence >= 0.5) return MED;
  return LOW;
};
