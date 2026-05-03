import { Panel } from "@/components/ui/panel";
import { previewSvg } from "@/features/links";

type LegendItem = {
  cotType: string;
  label: string;
  hint: string;
};

// Keyed by cotType so the symbol carries the function code (combat
// infantry, HQ, EW jammer, etc.) -- not just the dimension.
const ITEMS: LegendItem[] = [
  { cotType: "a-f-G-U-C-I", label: "INF-F", hint: "friendly infantry" },
  { cotType: "a-f-G-U-H",   label: "C2",    hint: "friendly HQ" },
  { cotType: "a-h-G-U-C",   label: "HOS",   hint: "hostile position" },
  { cotType: "a-h-G-E-W-J", label: "EW",    hint: "hostile jammer" },
];

export const TypeLegend = () => (
  <Panel title="TYP" hint="sta·trail">
    <ul className="space-y-1">
      {ITEMS.map((item) => (
        <LegendRow key={item.cotType} item={item} />
      ))}
    </ul>
  </Panel>
);

const LegendRow = ({ item }: { item: LegendItem }) => (
  <li className="flex items-center gap-1.5 min-w-0">
    <div
      className="block h-5 w-5 shrink-0"
      dangerouslySetInnerHTML={{ __html: previewSvg(item.cotType) }}
    />
    <div className="leading-none min-w-0 flex-1">
      <span className="text-[9px] uppercase tracking-widest text-terminal-fg font-bold">
        {item.label}
      </span>
      <span className="text-[8px] text-terminal-dim ml-1">{item.hint}</span>
    </div>
  </li>
);
