// FR-04 fingerprint surface: the detail panel chip, plus the
// per-link attribution badge on the map. The badge follows the
// transmitting ground unit's own track (via positionAt — no hardcoded
// coordinates) and uses the same confidence-keyed red gradient as the
// panel chip.
export { fingerprintTone } from "./lib/fingerprint-tone";
export type { FingerprintTone } from "./lib/fingerprint-tone";
export { buildAttributionLayer } from "./lib/build-attribution-layer";
