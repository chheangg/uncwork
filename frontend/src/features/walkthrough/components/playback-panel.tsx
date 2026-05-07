import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useScenarios } from "@/features/scenarios";
import { useWalkthroughStore } from "../store";
import { scriptFor } from "../lib/scripts";

const SCENARIO_LABELS: Record<string, string> = {
  uav: "UAV",
  maneuver: "MANEUVER",
};

const labelFor = (name: string): string =>
  SCENARIO_LABELS[name] ?? name.toUpperCase();

const SPEED_STEP = 0.05;

/**
 * Unified playback control. Replaces the old SCENARIO panel.
 *
 * Rows:
 *   1. Scenario picker (UAV / MANEUVER)
 *   2. Mode picker  (FULL / WALKTHROUGH)
 *   3. Transport    (▶/⏸ + RESTART)
 *   4. Speed slider
 */
export const PlaybackPanel = () => {
  const { list, setActive, setSpeed, setPaused, restart, pending, error } =
    useScenarios();
  const mode = useWalkthroughStore((s) => s.mode);
  const setMode = useWalkthroughStore((s) => s.setMode);
  const resetForScenario = useWalkthroughStore((s) => s.resetForScenario);

  if (!list) {
    return (
      <Panel title="PLAYBACK" hint={error ? "ERR" : "…"}>
        <div className="text-[9px] text-terminal-dim">
          {error ? `offline · ${error}` : "loading…"}
        </div>
      </Panel>
    );
  }

  const buttons = list.available.length > 0 ? list.available : [list.active];
  const totalStops = scriptFor(list.active).length;

  return (
    <Panel title="PLAYBACK" hint={error ? "ERR" : undefined}>
      <div className="grid grid-cols-2 gap-1">
        {buttons.map((name) => {
          const active = name === list.active;
          const isPending = pending === name;
          return (
            <Toggle
              key={name}
              active={active}
              onChange={() => {
                if (active || isPending) return;
                // Unpause first so the sender thread is awake when
                // it sees the scenario change on its next poll —
                // otherwise the new scenario starts silently paused
                // because the prior walkthrough stop left it that way.
                setPaused(false);
                resetForScenario();
                setActive(name);
              }}
            >
              {isPending ? "…" : labelFor(name)}
            </Toggle>
          );
        })}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-terminal-border/50 pt-1">
        <Toggle
          active={mode === "full"}
          onChange={() => {
            setMode("full");
            setPaused(false);
          }}
        >
          FULL
        </Toggle>
        <Toggle
          active={mode === "walkthrough"}
          onChange={() => {
            setMode("walkthrough");
            resetForScenario();
            setPaused(false);
            restart();
          }}
        >
          WALK · {totalStops}
        </Toggle>
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-terminal-border/50 pt-1">
        <Toggle
          active={!list.paused}
          onChange={() => setPaused(!list.paused)}
        >
          {list.paused ? "▶ PLAY" : "⏸ PAUSE"}
        </Toggle>
        <Toggle
          active={false}
          onChange={() => {
            resetForScenario();
            setPaused(false);
            restart();
          }}
        >
          ⟲ RESTART
        </Toggle>
      </div>

      <div className="mt-1.5 border-t border-terminal-border/50 pt-1">
        <div className="flex items-baseline justify-between text-[9px]">
          <span className="label text-terminal-dim">SPEED</span>
          <span className="stat tabular-nums text-terminal-fg">
            {list.speed.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min={list.speed_min}
          max={list.speed_max}
          step={SPEED_STEP}
          value={list.speed}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            if (Number.isFinite(next)) setSpeed(next);
          }}
          className="mt-0.5 w-full accent-terminal-accent"
          aria-label="Scenario playback speed"
        />
        <div className="flex justify-between text-[8px] text-terminal-dim tabular-nums">
          <span>{list.speed_min.toFixed(2)}x</span>
          <span>1.00x</span>
          <span>{list.speed_max.toFixed(2)}x</span>
        </div>
      </div>

      {error && (
        <div className="mt-1 text-[8px] text-terminal-hot truncate">
          {error}
        </div>
      )}
    </Panel>
  );
};
