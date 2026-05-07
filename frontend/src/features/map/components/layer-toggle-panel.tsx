import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import {
  useLayersStore,
  type LayerKey,
  type MapStyle,
  type ViewMode,
} from "@/stores/layers";

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

const VIEW_MODES: { key: ViewMode; label: string; hint: string }[] = [
  { key: "operator", label: "WITH SYSTEM", hint: "trust + fingerprint" },
  { key: "naive", label: "WITHOUT", hint: "raw map only" },
];

export const LayerTogglePanel = () => {
  const visible = useLayersStore((s) => s.visible);
  const toggle = useLayersStore((s) => s.toggle);
  const mapStyle = useLayersStore((s) => s.mapStyle);
  const setMapStyle = useLayersStore((s) => s.setMapStyle);
  const viewMode = useLayersStore((s) => s.viewMode);
  const setViewMode = useLayersStore((s) => s.setViewMode);

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
        <div className="border-t border-terminal-border/50 pt-1">
          <div className="mb-0.5 text-[8px] uppercase tracking-widest text-terminal-dim">
            view
          </div>
          <div className="grid grid-cols-2 gap-1">
            {VIEW_MODES.map(({ key, label }) => (
              <Toggle
                key={key}
                active={viewMode === key}
                onChange={() => setViewMode(key)}
              >
                {label}
              </Toggle>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
};
