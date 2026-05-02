import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLogStore,
  selectLogEntries,
  type LogEntry,
  type LogEntryKind,
} from "@/stores/log";
import { useSelectionStore } from "@/stores/selection";
import type { Dimension, SensorType } from "@/types/cot";
import { Filter } from "lucide-react";

const KIND_TONE: Record<LogEntryKind, string> = {
  status: "text-terminal-yellow",
  delivery: "text-terminal-amber",
  track: "text-terminal-green",
  operator: "text-terminal-blue",
  recommendation: "text-terminal-accent",
  "recommendation-action": "text-terminal-accent",
  system: "text-terminal-dim",
};

const KIND_LABEL: Record<LogEntryKind, string> = {
  status: "STATUS",
  delivery: "DELIVERY",
  track: "TRACK",
  operator: "OPS",
  recommendation: "AI",
  "recommendation-action": "AI",
  system: "SYS",
};

type FilterGroup = {
  key: string;
  label: string;
  kinds: LogEntryKind[];
};

const FILTER_GROUPS: FilterGroup[] = [
  { key: "status", label: "STATUS", kinds: ["status"] },
  { key: "delivery", label: "DELIVERY", kinds: ["delivery"] },
  { key: "track", label: "TRACK", kinds: ["track"] },
  { key: "ops", label: "OPS", kinds: ["operator", "recommendation-action"] },
  { key: "ai", label: "AI", kinds: ["recommendation"] },
  { key: "system", label: "SYS", kinds: ["system"] },
];

const DIMENSION_LABELS: Record<Dimension, string> = {
  air: "AIR",
  space: "SPACE",
  ground: "GROUND",
  sea_surface: "SEA",
  sea_subsurface: "SUB",
  sof: "SOF",
  sensor: "SENSOR",
  other: "OTHER",
};

const SENSOR_LABELS: Record<SensorType, string> = {
  radar: "RADAR",
  eo: "EO/IR",
  sigint: "SIGINT",
  acoustic: "ACOUSTIC",
  seismic: "SEISMIC",
  adsb: "ADS-B",
  other: "OTHER",
};

const fmtTs = (ms: number): string => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms3 = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms3}`;
};

export const EventTerminal = () => {
  const entries = useLogStore(selectLogEntries);
  const select = useSelectionStore((s) => s.select);
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    () => new Set(FILTER_GROUPS.map((g) => g.key)),
  );
  const [activeDimensions, setActiveDimensions] = useState<Set<Dimension>>(
    () => new Set<Dimension>(),
  );
  const [activeSensors, setActiveSensors] = useState<Set<SensorType>>(
    () => new Set<SensorType>(),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef(true);

  const allowedKinds = useMemo(() => {
    const set = new Set<LogEntryKind>();
    for (const g of FILTER_GROUPS) {
      if (activeKinds.has(g.key)) {
        for (const k of g.kinds) set.add(k);
      }
    }
    return set;
  }, [activeKinds]);

  const visible = useMemo<LogEntry[]>(() => {
    let filtered = entries.filter((e) => allowedKinds.has(e.kind));

    // Apply dimension filter if any selected
    if (activeDimensions.size > 0) {
      filtered = filtered.filter(
        (e) => e.dimension && activeDimensions.has(e.dimension),
      );
    }

    // Apply sensor filter if any selected
    if (activeSensors.size > 0) {
      filtered = filtered.filter(
        (e) => e.sensorType && activeSensors.has(e.sensorType),
      );
    }

    return filtered;
  }, [entries, allowedKinds, activeDimensions, activeSensors]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickyRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, collapsed]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    stickyRef.current = atBottom;
  };

  const toggleKindFilter = (key: string) =>
    setActiveKinds((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleDimension = (dim: Dimension) =>
    setActiveDimensions((s) => {
      const next = new Set(s);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });

  const toggleSensor = (sensor: SensorType) =>
    setActiveSensors((s) => {
      const next = new Set(s);
      if (next.has(sensor)) next.delete(sensor);
      else next.add(sensor);
      return next;
    });

  const clearAdvancedFilters = () => {
    setActiveDimensions(new Set());
    setActiveSensors(new Set());
  };

  const hasAdvancedFilters = activeDimensions.size > 0 || activeSensors.size > 0;

  return (
    <aside className="pointer-events-auto absolute bottom-9 right-3 z-20 flex w-[540px] flex-col">
      <div className="panel">
        <header className="flex items-center justify-between gap-2 border-b border-terminal-border px-2 py-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="label text-terminal-accent hover:text-terminal-fg"
              aria-label={collapsed ? "Expand event terminal" : "Collapse event terminal"}
            >
              {collapsed ? "▸" : "▾"} EVENT TERMINAL
            </button>
            <span className="label text-terminal-dim tabular-nums">
              {visible.length}/{entries.length}
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className={`p-0.5 transition ${
                hasAdvancedFilters
                  ? "text-terminal-accent"
                  : "text-terminal-dim hover:text-terminal-fg"
              }`}
              title="Advanced filters"
            >
              <Filter size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTER_GROUPS.map((g) => {
              const on = activeKinds.has(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => toggleKindFilter(g.key)}
                  className={`px-1.5 py-0.5 text-[9px] tracking-widest border transition ${
                    on
                      ? "border-terminal-accent text-terminal-accent bg-terminal-accent/5"
                      : "border-terminal-border text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </header>

        {showAdvanced && !collapsed && (
          <div className="border-b border-terminal-border px-2 py-2 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="label text-terminal-dim">DIMENSION</span>
                {activeDimensions.size > 0 && (
                  <button
                    onClick={clearAdvancedFilters}
                    className="text-[8px] text-terminal-dim hover:text-terminal-fg"
                  >
                    CLEAR
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((dim) => {
                  const on = activeDimensions.has(dim);
                  return (
                    <button
                      key={dim}
                      type="button"
                      onClick={() => toggleDimension(dim)}
                      className={`px-1.5 py-0.5 text-[8px] tracking-widest border transition ${
                        on
                          ? "border-terminal-accent text-terminal-accent bg-terminal-accent/5"
                          : "border-terminal-border text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70"
                      }`}
                    >
                      {DIMENSION_LABELS[dim]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="label text-terminal-dim block mb-1">SENSOR TYPE</span>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(SENSOR_LABELS) as SensorType[]).map((sensor) => {
                  const on = activeSensors.has(sensor);
                  return (
                    <button
                      key={sensor}
                      type="button"
                      onClick={() => toggleSensor(sensor)}
                      className={`px-1.5 py-0.5 text-[8px] tracking-widest border transition ${
                        on
                          ? "border-terminal-accent text-terminal-accent bg-terminal-accent/5"
                          : "border-terminal-border text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70"
                      }`}
                    >
                      {SENSOR_LABELS[sensor]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!collapsed && (
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="h-[200px] overflow-y-auto px-2 py-1 font-mono text-[10px] leading-snug"
          >
            {visible.length === 0 ? (
              <div className="text-terminal-dim italic">
                {hasAdvancedFilters ? "no events match filters" : "no events"}
              </div>
            ) : (
              visible.map((e) => {
                const clickable = !!e.uid;
                return (
                  <div
                    key={e.id}
                    onClick={() => {
                      if (e.uid) select(e.uid);
                    }}
                    className={`flex items-baseline gap-2 ${
                      clickable
                        ? "cursor-pointer hover:bg-terminal-fg/5"
                        : ""
                    }`}
                    title={clickable ? "Click to select track" : undefined}
                  >
                    <span className="text-terminal-dim tabular-nums shrink-0">
                      {fmtTs(e.ts)}
                    </span>
                    <span
                      className={`w-12 shrink-0 tracking-widest ${KIND_TONE[e.kind]}`}
                    >
                      {KIND_LABEL[e.kind]}
                    </span>
                    <span className="w-24 shrink-0 truncate text-terminal-fg/80">
                      {e.uid ?? ""}
                    </span>
                    {e.dimension && (
                      <span className="w-12 shrink-0 text-[8px] text-terminal-dim">
                        {DIMENSION_LABELS[e.dimension]}
                      </span>
                    )}
                    <span className="truncate text-terminal-fg/95">
                      {e.summary}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
