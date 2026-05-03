import { useMemo } from "react";
import type { CotEvent } from "@/types/cot";
import type { Attribution } from "../lib/attribution";
import { deriveAttributions } from "../lib/attribution";

/**
 * Derive per-unit fingerprint attributions from the live event stream.
 * `nowMs` is the wall-clock anchor against which the TTL window is
 * applied — pass `Date.now()` rebased off the same animated clock the
 * map layers use so the badge fade tracks the rest of the UI.
 */
export const useFingerprintAttribution = (
  events: CotEvent[],
  nowMs: number,
): Attribution[] =>
  useMemo(() => deriveAttributions(events, nowMs), [events, nowMs]);
