import { useMemo } from "react";
import type { CotEvent } from "@/types/cot";
import { useReplayStore } from "@/stores/replay";

// Filters events based on replay mode and playhead
export const useReplayEvents = <E extends CotEvent>(events: E[]): E[] => {
  const mode = useReplayStore((s) => s.mode);
  const playhead = useReplayStore((s) => s.playhead);

  return useMemo(() => {
    if (mode === "live") return events;

    // In replay mode, only show events up to the playhead
    const filtered = events.filter((e) => {
      const eventTime = new Date(e.time).getTime() / 1000;
      return eventTime <= playhead;
    });

    // Debug: log what we're filtering
    if (events.length > 0 && filtered.length === 0) {
      console.log("Replay filter issue:", {
        totalEvents: events.length,
        playhead,
        firstEventTime: new Date(events[0]!.time).getTime() / 1000,
        lastEventTime: new Date(events[events.length - 1]!.time).getTime() / 1000,
      });
    }

    return filtered;
  }, [events, mode, playhead]);
};
