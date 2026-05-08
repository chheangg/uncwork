import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useDataSourceStore, type DataSource } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";
import { useSelectionStore } from "@/stores/selection";

const SOURCES: { key: DataSource; label: string }[] = [
  { key: "live", label: "LIVE" },
  { key: "battle", label: "BATTLE" },
  { key: "off", label: "OFF" },
];

export const DataSourceToggle = () => {
  const source = useDataSourceStore((s) => s.source);
  const setSource = useDataSourceStore((s) => s.setSource);
  const clearEvents = useEventStore((s) => s.clear);
  const count = useEventStore((s) => Object.keys(s.events).length);

  // Switching modes hard-resets the events store. Without this,
  // live-feed teardown leaves UAV/maneuver tracks behind and the
  // battle feed seeds on top of them — a screen full of mixed
  // friendlies from two different feeds.
  const switchTo = (key: DataSource) => {
    if (key === source) return;
    useSelectionStore.getState().deselect();
    clearEvents();
    setSource(key);
  };

  return (
    <Panel title="SRC" hint={`${count}`}>
      <div className="flex gap-1">
        {SOURCES.map(({ key, label }) => (
          <Toggle
            key={key}
            active={source === key}
            onChange={() => switchTo(key)}
            className="flex-1"
          >
            {label}
          </Toggle>
        ))}
      </div>
    </Panel>
  );
};
