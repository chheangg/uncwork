import { useEffect, useRef } from "react";
import { useEventStore, selectEventList } from "@/stores/events";
import { useLogStore } from "../lib/log-store";
import type { LogLine } from "../lib/log-store";

export const useDerivedLog = () => {
  const events = useEventStore(selectEventList);
  const append = useLogStore((s) => s.append);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const incoming: LogLine[] = [];
    for (const e of events) {
      const key = `${e.uid}:${e.time}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        incoming.push({
          id: key,
          ts: Date.parse(e.time),
          status: e.status,
          callsign: e.callsign ?? e.uid,
          lat: e.lat,
          lon: e.lon,
        });
      }
    }
    if (incoming.length > 0) append(incoming);
  }, [events, append]);
};
