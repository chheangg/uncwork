import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLogStore,
  selectLogEntries,
  type LogEntry,
  type LogEntryKind,
} from "@/stores/log";
import { useSelectionStore } from "@/stores/selection";
import { useEventStore, selectEventList } from "@/stores/events";
import type { Dimension, SensorType } from "@/types/cot";
import { Filter, X, ChevronDown, ChevronRight } from "lucide-react";

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
  sonar: "SONAR",
  eo_ir: "EO/IR",
  sigint: "SIGINT",
  acoustic: "ACOUSTIC",
  seismic: "SEISMIC",
  ais: "AIS",
  lidar: "LIDAR",
  ew: "EW",
  adsb: "ADS-B",
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
  const events = useEventStore(selectEventList);
  const select = useSelectionStore((s) => s.select);
  const [activeKinds, setActiveKinds] = useState<Set<string>>(
    () => new Set(FILTER_GROUPS.map((g) => g.key)),
  );
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<Dimension | null>(null);
  const [expandedSensor, setExpandedSensor] = useState<SensorType | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef(true);

  // Group events by dimension and sensor
  const eventsByDimension = useMemo(() => {
    const map = new Map<Dimension, typeof events>();
    for (const e of events) {
      const list = map.get(e.dimension) ?? [];
      list.push(e);
      map.set(e.dimension, list);
    }
    return map;
  }, [events]);

  const eventsBySensor = useMemo(() => {
    const map = new Map<SensorType, typeof events>();
    for (const e of events) {
      const list = map.get(e.sensorType) ?? [];
      list.push(e);
      map.set(e.sensorType, list);
    }
    return map;
  }, [events]);

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

    // Apply UID filter if any selected
    if (selectedUids.size > 0) {
      filtered = filtered.filter((e) => e.uid && selectedUids.has(e.uid));
    }

    return filtered;
  }, [entries, allowedKinds, selectedUids]);

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

  const toggleUid = (uid: string) =>
    setSelectedUids((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const selectAllInDimension = (dim: Dimension) => {
    const uids = eventsByDimension.get(dim)?.map((e) => e.uid) ?? [];
    setSelectedUids((s) => {
      const next = new Set(s);
      for (const uid of uids) next.add(uid);
      return next;
    });
  };

  const deselectAllInDimension = (dim: Dimension) => {
    const uids = new Set(eventsByDimension.get(dim)?.map((e) => e.uid) ?? []);
    setSelectedUids((s) => {
      const next = new Set(s);
      for (const uid of uids) next.delete(uid);
      return next;
    });
  };

  const selectAllInSensor = (sensor: SensorType) => {
    const uids = eventsBySensor.get(sensor)?.map((e) => e.uid) ?? [];
    setSelectedUids((s) => {
      const next = new Set(s);
      for (const uid of uids) next.add(uid);
      return next;
    });
  };

  const deselectAllInSensor = (sensor: SensorType) => {
    const uids = new Set(eventsBySensor.get(sensor)?.map((e) => e.uid) ?? []);
    setSelectedUids((s) => {
      const next = new Set(s);
      for (const uid of uids) next.delete(uid);
      return next;
    });
  };

  const selectAllKinds = () => {
    setActiveKinds(new Set(FILTER_GROUPS.map((g) => g.key)));
  };

  const clearAllKinds = () => {
    setActiveKinds(new Set());
  };

  const clearAllFilters = () => {
    selectAllKinds();
    setSelectedUids(new Set());
  };

  const allKindsSelected = activeKinds.size === FILTER_GROUPS.length;
  const hasFilters = activeKinds.size < FILTER_GROUPS.length || selectedUids.size > 0;

  return (
    <aside className="pointer-events-auto absolute bottom-9 right-3 z-20 flex w-[600px] flex-col">
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
            {selectedUids.size > 0 && (
              <span className="px-1.5 py-0.5 text-[8px] tracking-widest bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/30">
                {selectedUids.size} SELECTED
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-widest border transition ${
              showAdvanced
                ? "border-terminal-accent text-terminal-accent bg-terminal-accent/5"
                : "border-terminal-border text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70"
            }`}
            title="Toggle advanced filters"
          >
            <Filter size={10} />
            FILTERS
          </button>
        </header>

        {showAdvanced && !collapsed && (
          <div className="border-b border-terminal-border px-2 py-2 space-y-3 max-h-[300px] overflow-y-auto">
            {/* Event Type Filters */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label text-terminal-fg">EVENT TYPE</span>
                <div className="flex gap-1">
                  {!allKindsSelected && (
                    <button
                      onClick={selectAllKinds}
                      className="text-[8px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                    >
                      ALL
                    </button>
                  )}
                  {activeKinds.size > 0 && (
                    <button
                      onClick={clearAllKinds}
                      className="text-[8px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                    >
                      NONE
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTER_GROUPS.map((g) => {
                  const on = activeKinds.has(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => toggleKindFilter(g.key)}
                      className={`relative px-2 py-1 text-[9px] font-bold tracking-widest border transition-all ${
                        on
                          ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10 shadow-sm"
                          : "border-terminal-border/50 text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70 hover:bg-terminal-fg/5"
                      }`}
                    >
                      {on && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-terminal-accent rounded-full" />
                      )}
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimension Filters */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label text-terminal-fg">BY DIMENSION</span>
                {selectedUids.size > 0 && (
                  <button
                    onClick={() => setSelectedUids(new Set())}
                    className="flex items-center gap-0.5 text-[8px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                  >
                    <X size={10} />
                    CLEAR
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {(Object.keys(DIMENSION_LABELS) as Dimension[])
                  .filter((dim) => eventsByDimension.has(dim))
                  .map((dim) => {
                    const eventsInDim = eventsByDimension.get(dim)!;
                    const expanded = expandedDimension === dim;
                    const selectedCount = eventsInDim.filter((e) =>
                      selectedUids.has(e.uid),
                    ).length;
                    return (
                      <div key={dim} className="border border-terminal-border/30">
                        <button
                          onClick={() =>
                            setExpandedDimension(expanded ? null : dim)
                          }
                          className="w-full flex items-center justify-between px-2 py-1 hover:bg-terminal-fg/5 transition"
                        >
                          <div className="flex items-center gap-2">
                            {expanded ? (
                              <ChevronDown size={12} className="text-terminal-dim" />
                            ) : (
                              <ChevronRight size={12} className="text-terminal-dim" />
                            )}
                            <span className="text-[9px] font-bold tracking-widest text-terminal-fg">
                              {DIMENSION_LABELS[dim]}
                            </span>
                            <span className="text-[8px] text-terminal-dim">
                              ({eventsInDim.length})
                            </span>
                          </div>
                          {selectedCount > 0 && (
                            <span className="text-[8px] text-terminal-accent">
                              {selectedCount} selected
                            </span>
                          )}
                        </button>
                        {expanded && (
                          <div className="border-t border-terminal-border/30 px-2 py-1 bg-terminal-bg/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[7px] text-terminal-dim tracking-widest">
                                SELECT TRACKS
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => selectAllInDimension(dim)}
                                  className="text-[7px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                                >
                                  ALL
                                </button>
                                <button
                                  onClick={() => deselectAllInDimension(dim)}
                                  className="text-[7px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                                >
                                  NONE
                                </button>
                              </div>
                            </div>
                            <div className="space-y-0.5 max-h-32 overflow-y-auto">
                              {eventsInDim.map((e) => {
                                const selected = selectedUids.has(e.uid);
                                return (
                                  <button
                                    key={e.uid}
                                    onClick={() => toggleUid(e.uid)}
                                    className={`w-full text-left px-1.5 py-0.5 text-[8px] font-mono transition ${
                                      selected
                                        ? "bg-terminal-accent/10 text-terminal-accent"
                                        : "text-terminal-fg/70 hover:bg-terminal-fg/5"
                                    }`}
                                  >
                                    {e.callsign || e.uid}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Sensor Type Filters */}
            <div>
              <span className="label text-terminal-fg block mb-1.5">BY SENSOR TYPE</span>
              <div className="space-y-1">
                {(Object.keys(SENSOR_LABELS) as SensorType[])
                  .filter((sensor) => eventsBySensor.has(sensor))
                  .map((sensor) => {
                    const eventsInSensor = eventsBySensor.get(sensor)!;
                    const expanded = expandedSensor === sensor;
                    const selectedCount = eventsInSensor.filter((e) =>
                      selectedUids.has(e.uid),
                    ).length;
                    return (
                      <div key={sensor} className="border border-terminal-border/30">
                        <button
                          onClick={() =>
                            setExpandedSensor(expanded ? null : sensor)
                          }
                          className="w-full flex items-center justify-between px-2 py-1 hover:bg-terminal-fg/5 transition"
                        >
                          <div className="flex items-center gap-2">
                            {expanded ? (
                              <ChevronDown size={12} className="text-terminal-dim" />
                            ) : (
                              <ChevronRight size={12} className="text-terminal-dim" />
                            )}
                            <span className="text-[9px] font-bold tracking-widest text-terminal-fg">
                              {SENSOR_LABELS[sensor]}
                            </span>
                            <span className="text-[8px] text-terminal-dim">
                              ({eventsInSensor.length})
                            </span>
                          </div>
                          {selectedCount > 0 && (
                            <span className="text-[8px] text-terminal-accent">
                              {selectedCount} selected
                            </span>
                          )}
                        </button>
                        {expanded && (
                          <div className="border-t border-terminal-border/30 px-2 py-1 bg-terminal-bg/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[7px] text-terminal-dim tracking-widest">
                                SELECT TRACKS
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => selectAllInSensor(sensor)}
                                  className="text-[7px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                                >
                                  ALL
                                </button>
                                <button
                                  onClick={() => deselectAllInSensor(sensor)}
                                  className="text-[7px] text-terminal-dim hover:text-terminal-accent tracking-widest"
                                >
                                  NONE
                                </button>
                              </div>
                            </div>
                            <div className="space-y-0.5 max-h-32 overflow-y-auto">
                              {eventsInSensor.map((e) => {
                                const selected = selectedUids.has(e.uid);
                                return (
                                  <button
                                    key={e.uid}
                                    onClick={() => toggleUid(e.uid)}
                                    className={`w-full text-left px-1.5 py-0.5 text-[8px] font-mono transition ${
                                      selected
                                        ? "bg-terminal-accent/10 text-terminal-accent"
                                        : "text-terminal-fg/70 hover:bg-terminal-fg/5"
                                    }`}
                                  >
                                    {e.callsign || e.uid}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Reset All Button */}
            {hasFilters && (
              <div className="pt-1 border-t border-terminal-border/50">
                <button
                  onClick={clearAllFilters}
                  className="w-full px-2 py-1 text-[9px] font-bold tracking-widest border border-terminal-border/50 text-terminal-dim hover:border-terminal-accent hover:text-terminal-accent hover:bg-terminal-accent/5 transition-all"
                >
                  RESET ALL FILTERS
                </button>
              </div>
            )}
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
                {hasFilters ? "no events match filters" : "no events"}
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
                      <span className="px-1 py-0.5 text-[7px] tracking-wider bg-terminal-fg/5 text-terminal-dim border border-terminal-border/30">
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
