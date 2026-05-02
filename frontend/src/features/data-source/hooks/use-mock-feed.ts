import { useEffect, useRef } from "react";
import { useDataSourceStore } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";
import {
  emitFromTrack,
  seedTracks,
  stepTrack,
  type MockTrack,
} from "@/mock/fake-cot";

const TICK_MS = 500;

export const useMockFeed = () => {
  const source = useDataSourceStore((s) => s.source);
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const tracksRef = useRef<MockTrack[]>([]);

  useEffect(() => {
    if (source !== "mock") {
      clear();
      tracksRef.current = [];
      return;
    }

    tracksRef.current = seedTracks();
    upsertMany(tracksRef.current.map(emitFromTrack));

    const id = window.setInterval(() => {
      tracksRef.current = tracksRef.current.map(stepTrack);
      upsertMany(tracksRef.current.map(emitFromTrack));
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [source, upsertMany, clear]);
};
