import { useEffect, useRef } from "react";
import { wsUrl } from "@/config/env";
import { enrichCot, parseSenderUnit } from "@/lib/cot";
import type { Detectors, FingerprintMatch, SensorType, SpatialClass } from "@/types/cot";
import { useEventStore } from "@/stores/events";

type WireFingerprint = {
  tag?: string;
  name?: string;
  confidence?: number;
  matched_signals?: string[];
  freq_band_mhz?: [number, number];
  gnss_overlap?: string;
  range_km?: number;
  sector_deg?: number | null;
  source?: string;
  primary_effect?: string;
};

type WireDetectors = {
  temporal_anomaly?: boolean;
  crc_pct_60s?: number;
  crc_breach?: boolean;
  spatial_class?: SpatialClass;
  fingerprint?: WireFingerprint | null;
};

type WireMessage = {
  uid?: string | null;
  cot_type?: string | null;
  time?: string | null;
  start?: string | null;
  stale?: string | null;
  lat?: string | null;
  lon?: string | null;
  hae?: string | null;
  ce?: string | null;
  le?: string | null;
  flight_number?: string | null;
  remarks?: string | null;
  source?: string | null;
  trust_score?: number | null;
  sensor_lat?: number | null;
  sensor_lon?: number | null;
  detectors?: WireDetectors | null;
};

const RECONNECT_DELAY_MS = 1500;
const UPSERT_FLUSH_MS = 33;
// Sentinel UID emitted by the sender when an .ndxml playback wraps
// or when the operator switches scenarios. The frontend treats it as
// "drop every track and link before the next loop's data starts
// arriving" rather than rendering it as a position.
const SCENARIO_RESET_UID = "__SCENARIO_LOOP_RESET__";

const num = (v: string | null | undefined): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const DEFAULT_SENSOR: SensorType = "adsb";
const DEFAULT_COT_TYPE = "a-f-A-C-F";

const cleanString = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isSpatialClass = (v: unknown): v is SpatialClass =>
  v === "clear" || v === "localized" || v === "blanket";

const toFingerprintMatch = (
  raw: WireFingerprint | null | undefined,
): FingerprintMatch | null => {
  if (!raw || !raw.tag || !raw.name) return null;
  const conf = typeof raw.confidence === "number" ? raw.confidence : 0;
  if (!Number.isFinite(conf)) return null;
  const band = raw.freq_band_mhz;
  return {
    tag: raw.tag,
    name: raw.name,
    confidence: conf,
    matchedSignals: Array.isArray(raw.matched_signals) ? raw.matched_signals : [],
    freqBandMhz: Array.isArray(band) && band.length === 2 ? band : [0, 0],
    gnssOverlap: raw.gnss_overlap ?? "",
    rangeKm: typeof raw.range_km === "number" ? raw.range_km : 0,
    sectorDeg: typeof raw.sector_deg === "number" ? raw.sector_deg : null,
    source: raw.source ?? "",
    primaryEffect: raw.primary_effect ?? "",
  };
};

const toDetectors = (raw: WireDetectors | null | undefined): Detectors | undefined => {
  if (!raw) return undefined;
  const spatial = isSpatialClass(raw.spatial_class) ? raw.spatial_class : "clear";
  const crcPct =
    typeof raw.crc_pct_60s === "number" && Number.isFinite(raw.crc_pct_60s)
      ? raw.crc_pct_60s
      : 0;
  return {
    temporalAnomaly: !!raw.temporal_anomaly,
    crcPct60s: crcPct,
    crcBreach: !!raw.crc_breach,
    spatialClass: spatial,
    fingerprint: toFingerprintMatch(raw.fingerprint),
  };
};

const toCotEvent = (m: WireMessage) => {
  if (!m.uid) return null;
  const uid = m.uid.trim();
  if (!uid) return null;
  const lat = num(m.lat);
  const lon = num(m.lon);
  if (lat === undefined || lon === undefined) return null;
  const now = new Date().toISOString();
  const remarks = cleanString(m.remarks);
  return enrichCot({
    uid,
    cotType: m.cot_type ?? DEFAULT_COT_TYPE,
    sensorType: DEFAULT_SENSOR,
    time: m.time ?? now,
    start: m.start ?? now,
    staleAt: m.stale ?? new Date(Date.now() + 60_000).toISOString(),
    lat,
    lon,
    hae: num(m.hae),
    ce: num(m.ce),
    le: num(m.le),
    callsign: cleanString(m.flight_number),
    remarks,
    trustScore: m.trust_score ?? 1,
    senderUnit: parseSenderUnit(remarks),
    sensorLat: typeof m.sensor_lat === "number" ? m.sensor_lat : undefined,
    sensorLon: typeof m.sensor_lon === "number" ? m.sensor_lon : undefined,
    detectors: toDetectors(m.detectors),
  });
};

export const useLiveFeed = () => {
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clearEvents = useEventStore((s) => s.clear);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const flushRef = useRef<number | null>(null);
  const pendingRef = useRef<ReturnType<typeof toCotEvent>[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    const flush = () => {
      flushRef.current = null;
      const batch = pendingRef.current.filter(
        (x): x is NonNullable<typeof x> => x !== null,
      );
      pendingRef.current = [];
      if (batch.length > 0) upsertMany(batch);
    };

    const teardown = () => {
      cancelRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (flushRef.current !== null) {
        window.clearTimeout(flushRef.current);
        flushRef.current = null;
      }
      pendingRef.current = [];
    };

    cancelRef.current = false;

    const connect = () => {
      if (cancelRef.current) return;
      const url = wsUrl("/ws");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener("message", (event) => {
        let data: WireMessage;
        try {
          data = JSON.parse(event.data) as WireMessage;
        } catch {
          return;
        }
        if (data.uid === SCENARIO_RESET_UID) {
          // Drop any frames queued for this flush -- they belong to
          // the loop we just left -- and clear every track from the
          // event store so trails, links, and panels reset.
          pendingRef.current = [];
          if (flushRef.current !== null) {
            window.clearTimeout(flushRef.current);
            flushRef.current = null;
          }
          clearEvents();
          return;
        }
        const cot = toCotEvent(data);
        if (!cot) return;
        pendingRef.current.push(cot);
        if (flushRef.current === null) {
          flushRef.current = window.setTimeout(flush, UPSERT_FLUSH_MS);
        }
      });

      ws.addEventListener("close", () => {
        wsRef.current = null;
        if (cancelRef.current) return;
        reconnectRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });
    };

    connect();

    return teardown;
  }, [upsertMany, clearEvents]);
};
