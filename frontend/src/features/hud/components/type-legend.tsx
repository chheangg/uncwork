import { Panel } from "@/components/ui/panel";
import { previewSvg } from "@/features/links";
import type { Dimension } from "@/types/cot";

type LegendItem = {
  dimension: Dimension;
  label: string;
  hint: string;
};

const ITEMS: LegendItem[] = [
  { dimension: "sensor", label: "SNS", hint: "radar/array" },
  { dimension: "ground", label: "GND", hint: "armor/veh" },
  { dimension: "air", label: "AIR", hint: "fixed/uav" },
  { dimension: "sea_surface", label: "SUR", hint: "warship" },
  { dimension: "sea_subsurface", label: "SUB", hint: "submersible" },
  { dimension: "space", label: "SPC", hint: "satellite" },
  { dimension: "sof", label: "SOF", hint: "spec ops" },
];

export const TypeLegend = () => (
  <Panel title="TYP" hint="sta·trail">
    <ul className="space-y-1">
      {ITEMS.map((item) => (
        <LegendRow key={item.dimension} item={item} />
      ))}
    </ul>
  </Panel>
);

const LegendRow = ({ item }: { item: LegendItem }) => (
  <li className="flex items-center gap-1.5 min-w-0">
    <div
      className="block h-5 w-5 shrink-0"
      dangerouslySetInnerHTML={{ __html: previewSvg(item.dimension) }}
    />
    <div className="leading-none min-w-0 flex-1">
      <span className="text-[9px] uppercase tracking-widest text-terminal-fg font-bold">
        {item.label}
      </span>
      <span className="text-[8px] text-terminal-dim ml-1">{item.hint}</span>
    </div>
  </li>
);
