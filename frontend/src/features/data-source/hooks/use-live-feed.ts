import { useEffect, useRef } from "react";
import { wsUrl } from "@/config/env";
import { enrichCot } from "@/lib/cot";
import type { SensorType } from "@/types/cot";
import { useDataSourceStore } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";

type WireMessage = {
  uid?: string | null;
  time?: string | null;
  start?: string | null;
  stale?: string | null;
  lat?: string | null;
  lon?: string | null;
  hae?: string | null;
  flight_number?: string | null;
  remarks?: string | null;
  source?: string | null;
};

const RECONNECT_DELAY_MS = 1500;
const PRUNE_INTERVAL_MS = 5_000;
const STALE_TRACK_MS = 30_000;

const num = (v: string | null | undefined): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const ADSB_SENSOR: SensorType = "adsb";
const FRIENDLY_AIR_COT = "a-f-A-C-F";

// Sender emits uids in the form "unit_<x>-ICAO-<6 hex>". Anything
// that doesn't fit the exact pattern was corrupted in flight by the
// chaos pipeline (e.g. byte flip turning "ICAO-" into "IXAO-") and
// would otherwise become a phantom track. Drop it.
const UID_PATTERN = /^unit_[a-z0-9]+-ICAO-[a-fA-F0-9]{6}$/;
const CANONICAL_PREFIX = /^unit_[a-z0-9]+-/;

const canonicalUid = (raw: string): string | null => {
  if (!UID_PATTERN.test(raw)) return null;
  return raw.replace(CANONICAL_PREFIX, "");
};

const cleanCallsign = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toCotEvent = (m: WireMessage) => {
  if (!m.uid) return null;
  const canon = canonicalUid(m.uid);
  if (!canon) return null;
  const lat = num(m.lat);
  const lon = num(m.lon);
  if (lat === undefined || lon === undefined) return null;
  const now = new Date().toISOString();
  return enrichCot({
    uid: canon,
    cotType: FRIENDLY_AIR_COT,
    sensorType: ADSB_SENSOR,
    time: m.time ?? now,
    start: m.start ?? now,
    stale: m.stale ?? new Date(Date.now() + 60_000).toISOString(),
    lat,
    lon,
    hae: num(m.hae),
    callsign: cleanCallsign(m.flight_number),
    remarks: m.remarks ?? undefined,
  });
};

export const useLiveFeed = () => {
  const source = useDataSourceStore((s) => s.source);
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const pruneOlderThan = useEventStore((s) => s.pruneOlderThan);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const pruneRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
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
      if (pruneRef.current !== null) {
        window.clearInterval(pruneRef.current);
        pruneRef.current = null;
      }
    };

    if (source !== "live") {
      teardown();
      clear();
      return;
    }

    cancelRef.current = false;

    const connect = () => {
      if (cancelRef.current) return;
      const url = wsUrl("/ws");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data) as WireMessage;
          const cot = toCotEvent(data);
          if (cot) upsertMany([cot]);
        } catch {
          // drop malformed
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

    pruneRef.current = window.setInterval(() => {
      pruneOlderThan(Date.now() - STALE_TRACK_MS);
    }, PRUNE_INTERVAL_MS);

    connect();

    return teardown;
  }, [source, upsertMany, clear, pruneOlderThan]);
};
