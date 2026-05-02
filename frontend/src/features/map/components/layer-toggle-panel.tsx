import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useLayersStore, type LayerKey, type MapStyle } from "@/stores/layers";

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "links", label: "LNK" },
  { key: "trails", label: "TRL" },
  { key: "heatmap", label: "HTM" },
  { key: "buildings", label: "BLD" },
];

const MAP_STYLES: { key: MapStyle; label: string }[] = [
  { key: "dark", label: "DRK" },
  { key: "satellite", label: "SAT" },
];

export const LayerTogglePanel = () => {
  const visible = useLayersStore((s) => s.visible);
  const toggle = useLayersStore((s) => s.toggle);
  const crt = useLayersStore((s) => s.crt);
  const toggleCrt = useLayersStore((s) => s.toggleCrt);
  const mapStyle = useLayersStore((s) => s.mapStyle);
  const setMapStyle = useLayersStore((s) => s.setMapStyle);

  return (
    <Panel title="LYR" hint="[R]">
      <div className="space-y-1">
        <div className="grid grid-cols-2 gap-1">
          {LAYERS.map(({ key, label }) => (
            <Toggle
              key={key}
              active={visible[key]}
              onChange={() => toggle(key)}
            >
              {label}
            </Toggle>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {MAP_STYLES.map(({ key, label }) => (
            <Toggle
              key={key}
              active={mapStyle === key}
              onChange={() => setMapStyle(key)}
            >
              {label}
            </Toggle>
          ))}
        </div>
        <Toggle active={crt} onChange={toggleCrt} className="w-full">
          CRT
        </Toggle>
      </div>
    </Panel>
  );
};
