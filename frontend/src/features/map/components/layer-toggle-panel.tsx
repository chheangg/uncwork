import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useLayersStore, type LayerKey, type MapStyle } from "@/stores/layers";

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "links", label: "LINKS" },
  { key: "trails", label: "TRAILS" },
  { key: "heatmap", label: "HEATMAP" },
  { key: "buildings", label: "BLDGS" },
];

const MAP_STYLES: { key: MapStyle; label: string }[] = [
  { key: "topo", label: "TOPO" },
  { key: "satellite", label: "SATELLITE" },
];

export const LayerTogglePanel = () => {
  const visible = useLayersStore((s) => s.visible);
  const toggle = useLayersStore((s) => s.toggle);
  const mapStyle = useLayersStore((s) => s.mapStyle);
  const setMapStyle = useLayersStore((s) => s.setMapStyle);

  return (
    <Panel title="LAYERS" hint="[R]">
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
      </div>
    </Panel>
  );
};
