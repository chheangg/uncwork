import { Panel } from "@/components/ui/panel";
import { previewSvg } from "@/features/links";
import type { Dimension } from "@/types/cot";

type LegendItem = {
  key: string;
  cotType: string;
  dimension: Dimension;
  label: string;
  hint: string;
};

// Mirror exactly what the current scripted scenario emits:
// friendly ground teams (TEAM-1/2/3), hostile military UAVs
// (UNKNOWN-1/2), and a friendly missile (MSL-1).
const ITEMS: LegendItem[] = [
  { key: "gnd-friend", cotType: "a-f-G-U-C", dimension: "ground", label: "GND", hint: "friendly team" },
  { key: "uav-hostile", cotType: "a-h-A-M-F-Q", dimension: "air", label: "UAV", hint: "hostile drone" },
  { key: "msl-friend", cotType: "a-f-A-M-F-M", dimension: "air", label: "MSL", hint: "friendly missile" },
];

export const TypeLegend = () => (
  <Panel title="TYP" hint="sta·trail">
    <ul className="space-y-1">
      {ITEMS.map((item) => (
        <LegendRow key={item.key} item={item} />
      ))}
    </ul>
  </Panel>
);

const LegendRow = ({ item }: { item: LegendItem }) => (
  <li className="flex items-center gap-1.5 min-w-0">
    <div
      className="block h-5 w-5 shrink-0"
      dangerouslySetInnerHTML={{
        __html: previewSvg(item.dimension, "healthy", false, false, item.cotType),
      }}
    />
    <div className="leading-none min-w-0 flex-1">
      <span className="text-[9px] uppercase tracking-widest text-terminal-fg font-bold">
        {item.label}
      </span>
      <span className="text-[8px] text-terminal-dim ml-1">{item.hint}</span>
    </div>
  </li>
);
