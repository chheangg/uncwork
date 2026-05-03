// FR-04 fingerprint surface lives entirely in the telemetry detail
// panel now (see features/links/components/link-detail-panel.tsx).
// The only thing left in this feature is the colour-tone helper that
// the panel re-uses to grade the catalog match by confidence.
export { fingerprintTone } from "./lib/fingerprint-tone";
export type { FingerprintTone } from "./lib/fingerprint-tone";
