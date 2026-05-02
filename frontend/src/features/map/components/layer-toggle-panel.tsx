import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { useLayersStore, type LayerKey } from "@/stores/layers";

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: "links", label: "Links" },
  { key: "trails", label: "Trails" },
  { key: "heatmap", label: "Heatmap" },
  { key: "buildings", label: "Buildings" },
];

export const LayerTogglePanel = () => {
  const visible = useLayersStore((s) => s.visible);
  const toggle = useLayersStore((s) => s.toggle);
  const crt = useLayersStore((s) => s.crt);
  const toggleCrt = useLayersStore((s) => s.toggleCrt);

  return (
    <Panel title="Layers" hint="press r to reset view">
      <div className="grid grid-cols-2 gap-1.5 mb-2">
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
      <Toggle active={crt} onChange={toggleCrt} className="w-full">
        CRT Mode
      </Toggle>
    </Panel>
  );
};
