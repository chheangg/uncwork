import { useEffect, useRef } from "react";
import { useReplayStore } from "@/stores/replay";

// Advances the playhead when in replay mode and playing
export const usePlaybackTick = () => {
  const mode = useReplayStore((s) => s.mode);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speed);
  const playhead = useReplayStore((s) => s.playhead);
  const endTime = useReplayStore((s) => s.endTime);
  const setPlayhead = useReplayStore((s) => s.setPlayhead);
  const pause = useReplayStore((s) => s.pause);

  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (mode !== "replay" || !playing) {
      lastTickRef.current = Date.now();
      return;
    }

    const id = window.requestAnimationFrame(() => {
      const now = Date.now();
      const deltaMs = now - lastTickRef.current;
      lastTickRef.current = now;

      const deltaSec = (deltaMs / 1000) * speed;
      const newPlayhead = playhead + deltaSec;

      if (endTime !== null && newPlayhead >= endTime) {
        setPlayhead(endTime);
        pause();
      } else {
        setPlayhead(newPlayhead);
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, [mode, playing, speed, playhead, endTime, setPlayhead, pause]);
};
