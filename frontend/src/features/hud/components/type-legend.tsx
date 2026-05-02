import { Panel } from "@/components/ui/panel";
import { previewSvg } from "@/features/links";
import type { Affiliation, Dimension } from "@/types/cot";

type LegendItem = {
  dimension: Dimension;
  affiliation: Affiliation;
  label: string;
  hint: string;
};

const ITEMS: LegendItem[] = [
  { dimension: "ground", affiliation: "friendly", label: "Ground", hint: "vehicle / unit" },
  { dimension: "air", affiliation: "friendly", label: "Air", hint: "uav / rotor" },
  { dimension: "sea_surface", affiliation: "friendly", label: "Surface", hint: "vessel" },
  { dimension: "sea_subsurface", affiliation: "friendly", label: "Subsurface", hint: "submersible" },
  { dimension: "space", affiliation: "friendly", label: "Space", hint: "satellite" },
  { dimension: "sof", affiliation: "friendly", label: "SOF", hint: "special ops" },
  { dimension: "ground", affiliation: "hostile", label: "Hostile GND", hint: "threat unit" },
  { dimension: "air", affiliation: "hostile", label: "Hostile Air", hint: "incoming" },
];

export const TypeLegend = () => (
  <Panel title="Link Types" hint="shape · affiliation">
    <ul className="grid grid-cols-2 gap-x-2 gap-y-2">
      {ITEMS.map((item) => (
        <LegendRow key={`${item.dimension}-${item.affiliation}`} item={item} />
      ))}
    </ul>
  </Panel>
);

const LegendRow = ({ item }: { item: LegendItem }) => (
  <li className="flex items-center gap-2 min-w-0">
    <div
      className="block h-7 w-7 shrink-0"
      dangerouslySetInnerHTML={{
        __html: previewSvg(item.dimension, item.affiliation),
      }}
    />
    <div className="leading-tight min-w-0 flex-1">
      <div className="text-[10px] uppercase tracking-wider text-terminal-fg truncate">
        {item.label}
      </div>
      <div className="text-[9px] text-terminal-dim truncate">{item.hint}</div>
    </div>
  </li>
);
