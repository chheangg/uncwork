import { useEffect, useRef } from "react";
import { useEventStore } from "@/stores/events";
import { useDataSourceStore } from "@/stores/data-source";
import { useLogStore } from "@/stores/log";
import type { CotEvent } from "@/types/cot";

const COALESCE_THRESHOLD = 5;

type EventMap = Record<string, CotEvent>;

const diffEmit = (
  prev: EventMap,
  curr: EventMap,
  append: ReturnType<typeof useLogStore.getState>["append"],
): void => {
  const prevUids = new Set(Object.keys(prev));
  const currUids = new Set(Object.keys(curr));

  const acquired: string[] = [];
  const lost: string[] = [];
  for (const uid of currUids) {
    if (!prevUids.has(uid)) acquired.push(uid);
  }
  for (const uid of prevUids) {
    if (!currUids.has(uid)) lost.push(uid);
  }

  if (acquired.length > COALESCE_THRESHOLD) {
    append({
      kind: "track",
      summary: `${acquired.length} tracks acquired`,
    });
  } else {
    for (const uid of acquired) {
      const event = curr[uid]!;
      append({
        kind: "track",
        uid,
        summary: `${uid} acquired`,
        dimension: event.dimension,
        sensorType: event.sensorType,
      });
    }
  }

  if (lost.length > COALESCE_THRESHOLD) {
    append({
      kind: "track",
      summary: `${lost.length} tracks released`,
    });
  } else {
    for (const uid of lost) {
      const event = prev[uid]!;
      append({
        kind: "track",
        uid,
        summary: `${uid} released`,
        dimension: event.dimension,
        sensorType: event.sensorType,
      });
    }
  }

  for (const uid of currUids) {
    const cur = curr[uid]!;
    const prv = prev[uid];
    if (!prv) continue;
    if (prv.status !== cur.status) {
      append({
        kind: "status",
        uid,
        summary: `${prv.status.toUpperCase()} → ${cur.status.toUpperCase()}`,
        payload: { from: prv.status, to: cur.status, confInt: cur.confInt },
        dimension: cur.dimension,
        sensorType: cur.sensorType,
      });
    }
    if (prv.stale !== cur.stale) {
      append({
        kind: "delivery",
        uid,
        summary: cur.stale ? "ON-TIME → STALE" : "STALE → ON-TIME",
        payload: { stale: cur.stale },
        dimension: cur.dimension,
        sensorType: cur.sensorType,
      });
    }
  }
};

// Subscribes (outside React render) to the event store + data
// source store and writes derived transition entries into the log
// store. Single source of truth: every line in the terminal traces
// back to a real change in the event stream.
export const useDerivedLog = (): void => {
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const append = useLogStore.getState().append;

    let prevEvents = useEventStore.getState().events;
    let prevSource = useDataSourceStore.getState().source;

    const unsubEvents = useEventStore.subscribe((state) => {
      const curr = state.events;
      const prev = prevEvents;
      prevEvents = curr;
      diffEmit(prev, curr, append);
    });

    const unsubSource = useDataSourceStore.subscribe((state) => {
      const curr = state.source;
      if (curr === prevSource) return;
      append({
        kind: "system",
        summary: `Data source: ${prevSource.toUpperCase()} → ${curr.toUpperCase()}`,
        payload: { from: prevSource, to: curr },
      });
      prevSource = curr;
    });

    return () => {
      unsubEvents();
      unsubSource();
      startedRef.current = false;
    };
  }, []);
};
