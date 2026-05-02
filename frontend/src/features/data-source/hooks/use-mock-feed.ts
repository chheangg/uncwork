import { useEffect, useRef } from "react";
import { useDataSourceStore } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";
import { useReplayStore } from "@/stores/replay";
import {
  emitFromTrack,
  seedTracks,
  stepTrack,
  type MockTrack,
} from "@/mock/fake-cot";

const TICK_MS = 500;

export const useMockFeed = () => {
  const source = useDataSourceStore((s) => s.source);
  const mode = useReplayStore((s) => s.mode);
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const tracksRef = useRef<MockTrack[]>([]);

  useEffect(() => {
    // Don't run mock feed in replay mode
    if (mode === "replay") return;

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
  }, [source, mode, upsertMany, clear]);
};
