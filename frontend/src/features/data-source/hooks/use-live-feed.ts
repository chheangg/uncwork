import { useEffect, useRef } from "react";
import { wsUrl } from "@/config/env";
import { enrichCot } from "@/lib/cot";
import type { SensorType } from "@/types/cot";
import { useEventStore } from "@/stores/events";

type WireMessage = {
  uid?: string | null;
  cot_type?: string | null;
  time?: string | null;
  start?: string | null;
  stale?: string | null;
  lat?: string | null;
  lon?: string | null;
  hae?: string | null;
  flight_number?: string | null;
  remarks?: string | null;
  source?: string | null;
  trust_score?: number | null;
  sensor_lat?: number | null;
  sensor_lon?: number | null;
};

const RECONNECT_DELAY_MS = 1500;
const UPSERT_FLUSH_MS = 33;

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

const toCotEvent = (m: WireMessage) => {
  if (!m.uid) return null;
  const uid = m.uid.trim();
  if (!uid) return null;
  const lat = num(m.lat);
  const lon = num(m.lon);
  if (lat === undefined || lon === undefined) return null;
  const now = new Date().toISOString();
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
    callsign: cleanString(m.flight_number),
    remarks: cleanString(m.remarks),
  });
};

export const useLiveFeed = () => {
  const upsertMany = useEventStore((s) => s.upsertMany);
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
  }, [upsertMany]);
};
