import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useDataSourceStore, type DataSource } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";

const SOURCES: { key: DataSource; label: string; hint: string }[] = [
  { key: "mock", label: "Mock", hint: "fake feed" },
  { key: "live", label: "Live", hint: "ads-b ws" },
  { key: "off", label: "Off", hint: "no data" },
];

export const DataSourceToggle = () => {
  const source = useDataSourceStore((s) => s.source);
  const setSource = useDataSourceStore((s) => s.setSource);
  const count = useEventStore((s) => Object.keys(s.events).length);

  return (
    <Panel title="Data Source" hint={`${count} tracks`}>
      <div className="flex gap-1.5">
        {SOURCES.map(({ key, label, hint }) => (
          <Toggle
            key={key}
            active={source === key}
            onChange={() => setSource(key)}
            className="flex-1"
          >
            <div className="flex flex-col items-center leading-tight">
              <span>{label}</span>
              <span className="text-[9px] normal-case tracking-normal opacity-60">
                {hint}
              </span>
            </div>
          </Toggle>
        ))}
      </div>
    </Panel>
  );
};
