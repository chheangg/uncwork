import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useDataSourceStore, type DataSource } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";

const SOURCES: { key: DataSource; label: string }[] = [
  { key: "mock", label: "MOCK" },
  { key: "live", label: "LIVE" },
  { key: "off", label: "OFF" },
];

export const DataSourceToggle = () => {
  const source = useDataSourceStore((s) => s.source);
  const setSource = useDataSourceStore((s) => s.setSource);
  const count = useEventStore((s) => Object.keys(s.events).length);

  return (
    <Panel title="SRC" hint={`${count}`}>
      <div className="flex gap-1">
        {SOURCES.map(({ key, label }) => (
          <Toggle
            key={key}
            active={source === key}
            onChange={() => setSource(key)}
            className="flex-1"
          >
            {label}
          </Toggle>
        ))}
      </div>
    </Panel>
  );
};
