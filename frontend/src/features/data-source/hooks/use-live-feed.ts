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
const UPSERT_FLUSH_MS = 33;

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
    staleAt: m.stale ?? new Date(Date.now() + 60_000).toISOString(),
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
        let data: WireMessage;
        try {
          data = JSON.parse(event.data) as WireMessage;
        } catch {
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
  }, [source, upsertMany, clear]);
};
