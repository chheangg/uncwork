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

const num = (v: string | null | undefined): number | undefined => {
  if (v === null || v === undefined) return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const ADSB_SENSOR: SensorType = "adsb";
const FRIENDLY_AIR_COT = "a-f-A-C-F";

const toCotEvent = (m: WireMessage) => {
  const lat = num(m.lat);
  const lon = num(m.lon);
  if (lat === undefined || lon === undefined) return null;
  if (!m.uid) return null;
  const now = new Date().toISOString();
  return enrichCot({
    uid: m.uid,
    cotType: FRIENDLY_AIR_COT,
    sensorType: ADSB_SENSOR,
    time: m.time ?? now,
    start: m.start ?? now,
    stale: m.stale ?? new Date(Date.now() + 60_000).toISOString(),
    lat,
    lon,
    hae: num(m.hae),
    remarks:
      m.flight_number && m.flight_number.length > 0
        ? `${m.flight_number} ${m.remarks ?? ""}`.trim()
        : m.remarks ?? undefined,
  });
};

export const useLiveFeed = () => {
  const source = useDataSourceStore((s) => s.source);
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (source !== "live") {
      cancelRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
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

    connect();

    return () => {
      cancelRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current !== null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [source, upsertMany, clear]);
};
