import { useCallback } from "react";
import { useReplayStore } from "@/stores/replay";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Film,
  X,
} from "lucide-react";
import { useEventStore } from "@/stores/events";
import { useViewStateStore } from "@/stores/view-state";
import { PRESET_BBOX } from "@/config/constants";
import { generateMockScenario } from "../lib/mock-scenario";

const formatTime = (seconds: number): string => {
  const date = new Date(seconds * 1000);
  const h = date.getUTCHours().toString().padStart(2, "0");
  const m = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const ReplayControls = () => {
  const mode = useReplayStore((s) => s.mode);
  const playing = useReplayStore((s) => s.playing);
  const speed = useReplayStore((s) => s.speed);
  const playhead = useReplayStore((s) => s.playhead);
  const startTime = useReplayStore((s) => s.startTime);
  const endTime = useReplayStore((s) => s.endTime);

  const setMode = useReplayStore((s) => s.setMode);
  const togglePlay = useReplayStore((s) => s.togglePlay);
  const setSpeed = useReplayStore((s) => s.setSpeed);
  const jumpTo = useReplayStore((s) => s.jumpTo);
  const setPlayhead = useReplayStore((s) => s.setPlayhead);
  const setTimeRange = useReplayStore((s) => s.setTimeRange);

  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const setViewState = useViewStateStore((s) => s.set);
  const currentViewState = useViewStateStore((s) => s.viewState);

  const loadMockScenario = useCallback(() => {
    const events = generateMockScenario();

    console.log("Generated scenario events:", events.length);

    if (events.length === 0) {
      alert("No events generated");
      return;
    }

    // Find time range
    const times = events.map((e) => new Date(e.time).getTime() / 1000);
    const start = Math.min(...times);
    const end = Math.max(...times);

    console.log("Scenario time range:", {
      start: new Date(start * 1000).toISOString(),
      end: new Date(end * 1000).toISOString(),
      duration: end - start,
    });

    // Calculate center of the scenario area
    const centerLon = (PRESET_BBOX.west + PRESET_BBOX.east) / 2;
    const centerLat = (PRESET_BBOX.south + PRESET_BBOX.north) / 2;

    clear();
    upsertMany(events);
    setTimeRange(start, end);
    setPlayhead(start);
    setMode("replay");

    console.log("Replay mode activated, playhead at:", start);

    // Zoom to the scenario area
    setViewState({
      ...currentViewState,
      longitude: centerLon,
      latitude: centerLat,
      zoom: 12.5,
    });
  }, [clear, upsertMany, setTimeRange, setPlayhead, setMode, setViewState, currentViewState]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (startTime !== null && endTime !== null) {
        const time = startTime + (endTime - startTime) * value;
        jumpTo(time);
      }
    },
    [startTime, endTime, jumpTo],
  );

  const handleSkipBack = useCallback(() => {
    if (startTime !== null) {
      jumpTo(Math.max(startTime, playhead - 10));
    }
  }, [startTime, playhead, jumpTo]);

  const handleSkipForward = useCallback(() => {
    if (endTime !== null) {
      jumpTo(Math.min(endTime, playhead + 10));
    }
  }, [endTime, playhead, jumpTo]);

  const cycleSpeed = useCallback(() => {
    const speeds: typeof speed[] = [1, 10, 100];
    const idx = speeds.indexOf(speed);
    setSpeed(speeds[(idx + 1) % speeds.length]!);
  }, [speed, setSpeed]);

  const exitReplay = useCallback(() => {
    clear();
    setMode("live");
  }, [clear, setMode]);

  if (mode === "live") {
    return (
      <div className="pointer-events-auto fixed bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-terminal-fg/20 bg-terminal-bg/95 px-4 py-2 backdrop-blur-sm">
        <button
          onClick={loadMockScenario}
          className="flex items-center gap-2 rounded bg-terminal-accent/20 px-3 py-1.5 text-sm font-medium text-terminal-fg transition-colors hover:bg-terminal-accent/30"
        >
          <Film size={16} />
          Load Replay Scenario
        </button>
      </div>
    );
  }

  const progress =
    startTime !== null && endTime !== null
      ? (playhead - startTime) / (endTime - startTime)
      : 0;

  const duration =
    startTime !== null && endTime !== null ? endTime - startTime : 0;

  return (
    <div className="pointer-events-auto fixed bottom-3 left-1/2 z-20 flex w-[600px] -translate-x-1/2 flex-col gap-2 rounded-lg border border-terminal-fg/20 bg-terminal-bg/95 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs font-mono text-terminal-fg/70">
        <span>{formatTime(playhead)}</span>
        <span className="text-terminal-fg">REPLAY MODE</span>
        <span>{endTime !== null ? formatTime(endTime) : "--:--:--"}</span>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={progress}
        onChange={handleScrub}
        className="replay-scrubber w-full"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSkipBack}
            className="rounded p-1.5 text-terminal-fg transition-colors hover:bg-terminal-fg/10"
            title="Skip back 10s"
          >
            <SkipBack size={18} />
          </button>
          <button
            onClick={togglePlay}
            className="rounded bg-terminal-fg/10 p-2 text-terminal-fg transition-colors hover:bg-terminal-fg/20"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={handleSkipForward}
            className="rounded p-1.5 text-terminal-fg transition-colors hover:bg-terminal-fg/10"
            title="Skip forward 10s"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-terminal-fg/70">
          <span>{formatDuration(playhead - (startTime ?? 0))} / {formatDuration(duration)}</span>
          <button
            onClick={cycleSpeed}
            className="rounded bg-terminal-fg/10 px-2 py-1 font-bold text-terminal-fg transition-colors hover:bg-terminal-fg/20"
          >
            {speed}x
          </button>
        </div>

        <button
          onClick={exitReplay}
          className="rounded p-1.5 text-terminal-fg/70 transition-colors hover:bg-terminal-fg/10 hover:text-terminal-fg"
          title="Exit replay mode"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
