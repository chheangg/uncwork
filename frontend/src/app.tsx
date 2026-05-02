import { useEffect, useMemo, useState } from "react";
import type { Layer } from "@deck.gl/core";
import { LayerTogglePanel, MapView } from "@/features/map";
import { DataSourceToggle, useMockFeed } from "@/features/data-source";
import { buildLinkLayers } from "@/features/links";
import { buildHeatmapLayer } from "@/features/heatmap";
import { useEventStore, selectEventList } from "@/stores/events";
import { useLayersStore } from "@/stores/layers";

export const App = () => {
  useMockFeed();
  const events = useEventStore(selectEventList);
  const visible = useLayersStore((s) => s.visible);
  const crt = useLayersStore((s) => s.crt);

  const layers = useMemo<Layer[]>(() => {
    const result: Layer[] = [];
    if (visible.heatmap) result.push(buildHeatmapLayer(events));
    if (visible.links) result.push(...buildLinkLayers(events));
    return result;
  }, [events, visible.heatmap, visible.links]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-terminal-bg text-terminal-fg">
      <MapView layers={layers} />
      {crt && <div className="crt-overlay" />}
      <Hud />
    </div>
  );
};

const Hud = () => (
  <>
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3">
      <div className="pointer-events-auto panel px-3 py-1.5 flex items-baseline gap-3">
        <span className="text-terminal-accent font-bold tracking-[0.3em]">
          UNCWORK
        </span>
        <span className="label">// C2 OPS CONSOLE</span>
      </div>
      <Clock />
    </header>
    <aside className="pointer-events-auto absolute top-16 left-3 z-10 flex w-72 flex-col gap-3">
      <DataSourceToggle />
      <LayerTogglePanel />
      <Legend />
    </aside>
    <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex justify-between p-3">
      <span className="label panel pointer-events-auto px-2 py-1">
        © OpenFreeMap · OpenMapTiles · OpenStreetMap
      </span>
      <span className="label panel pointer-events-auto px-2 py-1">
        WGS84 · 3D · OPS-CENTER
      </span>
    </footer>
  </>
);

const Clock = () => {
  const [now, setNow] = useState(() => formatUtc(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(formatUtc(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="pointer-events-auto panel px-3 py-1.5">
      <span className="label mr-2">UTC</span>
      <span className="text-terminal-fg">{now}</span>
    </div>
  );
};

const formatUtc = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;

const pad = (n: number) => n.toString().padStart(2, "0");

const LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: "Healthy", color: "bg-terminal-accent" },
  { label: "Degraded", color: "bg-terminal-yellow" },
  { label: "Critical", color: "bg-terminal-red" },
  { label: "Stale", color: "bg-terminal-amber" },
  { label: "Offline", color: "bg-terminal-dim" },
];

const Legend = () => (
  <div className="panel p-3 text-xs">
    <div className="label text-terminal-accent mb-2">Status</div>
    <ul className="space-y-1">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          <span className="text-terminal-dim">{item.label}</span>
        </li>
      ))}
    </ul>
  </div>
);
