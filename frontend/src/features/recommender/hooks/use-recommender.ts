import { useEffect, useRef, useState } from "react";
import type { TrackPath } from "@/lib/track-path";
import type { AugmentedEvent } from "@/features/links";
import { useLogStore } from "@/stores/log";
import {
  ACTION_LABEL,
  startMockStream,
  type Recommendation,
} from "../lib/mock-stream";

// Drives a streaming recommendation for the currently selected
// track. Re-streams whenever the selected uid changes; a track that
// merely updates its position in place keeps the same rec.
export const useRecommender = (
  track: TrackPath<AugmentedEvent> | null,
): Recommendation | null => {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const trackRef = useRef(track);
  trackRef.current = track;
  const append = useLogStore((s) => s.append);

  useEffect(() => {
    if (!track) {
      setRec(null);
      return;
    }
    setRec(null);
    const ctrl = new AbortController();
    startMockStream(track, ctrl.signal, (next) => {
      if (ctrl.signal.aborted) return;
      setRec({ ...next });
      if (next.complete) {
        const top = next.options[0]!;
        append({
          kind: "recommendation",
          uid: next.uid,
          summary: `${ACTION_LABEL[top.action]} ${(top.probability * 100).toFixed(0)}%`,
          payload: {
            id: next.id,
            options: next.options,
          },
        });
      }
    });
    return () => {
      ctrl.abort();
    };
    // Re-run only when the selected track identity changes, not when
    // the track object refreshes (every animTime tick rebuilds it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.uid]);

  return rec;
};
