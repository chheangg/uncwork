import { useEffect, useRef } from "react";
import { useEventStore } from "@/stores/events";
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

export const useDerivedLog = (): void => {
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const append = useLogStore.getState().append;
    let prevEvents = useEventStore.getState().events;

    const unsubEvents = useEventStore.subscribe((state) => {
      const curr = state.events;
      const prev = prevEvents;
      prevEvents = curr;
      diffEmit(prev, curr, append);
    });

    return () => {
      unsubEvents();
      startedRef.current = false;
    };
  }, []);
};
