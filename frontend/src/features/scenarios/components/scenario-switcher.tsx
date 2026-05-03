import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useScenarios } from "../hooks/use-scenarios";

const LABELS: Record<string, string> = {
  uav: "UAV",
  maneuver: "MANEUVER",
};

const labelFor = (name: string): string =>
  LABELS[name] ?? name.toUpperCase();

export const ScenarioSwitcher = () => {
  const { list, setActive, pending, error } = useScenarios();
  if (!list) return null;
  const buttons = list.available.length > 0 ? list.available : [list.active];
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
      {error && (
        <div className="mt-1 text-[8px] text-terminal-hot truncate">
          {error}
        </div>
      )}
    </Panel>
  );
};
