import { useEffect, useRef } from "react";
import { httpUrl } from "@/config/env";
import { useDataSourceStore } from "@/stores/data-source";
import { useViewportStore, type Bbox } from "@/stores/viewport";

const DEBOUNCE_MS = 400;

const sameBbox = (a: Bbox, b: Bbox): boolean =>
  a.south === b.south &&
  a.west === b.west &&
  a.north === b.north &&
  a.east === b.east;

export const useViewportSync = () => {
  const bbox = useViewportStore((s) => s.bbox);
  const source = useDataSourceStore((s) => s.source);
  const lastSentRef = useRef<Bbox | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (source !== "live") return;
    if (lastSentRef.current && sameBbox(lastSentRef.current, bbox)) return;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const target = { ...bbox };
      fetch(httpUrl("/viewport"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      })
        .then(() => {
          lastSentRef.current = target;
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bbox, source]);
};
