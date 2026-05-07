import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useScenarios } from "../hooks/use-scenarios";

const LABELS: Record<string, string> = {
  uav: "UAV",
  maneuver: "MANEUVER",
};

const labelFor = (name: string): string =>
  LABELS[name] ?? name.toUpperCase();

const SPEED_STEP = 0.05;

export const ScenarioSwitcher = () => {
  const { list, setActive, setSpeed, pending, error } = useScenarios();
  if (!list) {
    return (
      <Panel title="SCENARIO" hint={error ? "ERR" : "…"}>
        <div className="text-[9px] text-terminal-dim">
          {error ? `offline · ${error}` : "loading scenarios…"}
        </div>
      </Panel>
    );
  }
  const buttons = list.available.length > 0 ? list.available : [list.active];
  const speed = list.speed;
  return (
    <Panel title="SCENARIO" hint={error ? "ERR" : undefined}>
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
                setActive(name);
              }}
            >
              {isPending ? "…" : labelFor(name)}
            </Toggle>
          );
        })}
      </div>
      <div className="mt-1.5 border-t border-terminal-border/50 pt-1">
        <div className="flex items-baseline justify-between text-[9px]">
          <span className="label text-terminal-dim">SPEED</span>
          <span className="stat tabular-nums text-terminal-fg">
            {speed.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min={list.speed_min}
          max={list.speed_max}
          step={SPEED_STEP}
          value={speed}
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
