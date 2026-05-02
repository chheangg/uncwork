import { Panel } from "@/components/ui/panel";
import { previewSvg } from "@/features/links";
import type { Dimension } from "@/types/cot";

type LegendItem = {
  dimension: Dimension;
  label: string;
  hint: string;
};

const ITEMS: LegendItem[] = [
  { dimension: "sensor", label: "Sensor", hint: "fixed array / radar" },
  { dimension: "ground", label: "Ground", hint: "armor / vehicle" },
  { dimension: "air", label: "Air", hint: "fixed / rotor / uav" },
  { dimension: "sea_surface", label: "Surface", hint: "warship / vessel" },
  { dimension: "sea_subsurface", label: "Subsurface", hint: "submersible" },
  { dimension: "space", label: "Space", hint: "satellite asset" },
  { dimension: "sof", label: "SOF", hint: "special ops" },
];

export const TypeLegend = () => (
  <Panel title="Link Types" hint="status on pole · trail">
    <ul className="grid grid-cols-2 gap-x-2 gap-y-2">
      {ITEMS.map((item) => (
        <LegendRow key={item.dimension} item={item} />
      ))}
    </ul>
  </Panel>
);

const LegendRow = ({ item }: { item: LegendItem }) => (
  <li className="flex items-center gap-2 min-w-0">
    <div
      className="block h-7 w-7 shrink-0"
      dangerouslySetInnerHTML={{ __html: previewSvg(item.dimension) }}
    />
    <div className="leading-tight min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-wider text-terminal-fg truncate">
        {item.label}
      </div>
      <div className="text-[9px] text-terminal-dim truncate">{item.hint}</div>
    </div>
  </li>
);
