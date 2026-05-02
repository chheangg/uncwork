import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLogStore,
  selectLogEntries,
  type LogEntry,
  type LogEntryKind,
} from "@/stores/log";
import { useSelectionStore } from "@/stores/selection";

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
  status: "STA",
  delivery: "DEL",
  track: "TRK",
  operator: "OPS",
  recommendation: "AI",
  "recommendation-action": "AI",
  system: "SYS",
};

type KindGroup = { key: string; label: string; kinds: LogEntryKind[] };

const KIND_GROUPS: KindGroup[] = [
  { key: "status", label: "STA", kinds: ["status"] },
  { key: "delivery", label: "DEL", kinds: ["delivery"] },
  { key: "track", label: "TRK", kinds: ["track"] },
  { key: "ops", label: "OPS", kinds: ["operator", "recommendation-action"] },
  { key: "ai", label: "AI", kinds: ["recommendation"] },
  { key: "system", label: "SYS", kinds: ["system"] },
];

const fmtTs = (ms: number): string => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

type DropdownKey = "kind" | "track" | null;

export const EventTerminal = () => {
  const entries = useLogStore(selectLogEntries);
  const select = useSelectionStore((s) => s.select);
  const [open, setOpen] = useState(false);
  const [activeKindKeys, setActiveKindKeys] = useState<Set<string>>(
    () => new Set(KIND_GROUPS.map((g) => g.key)),
  );
  const [excludedUids, setExcludedUids] = useState<Set<string>>(new Set());
  const [dropdown, setDropdown] = useState<DropdownKey>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef(true);

  const allowedKinds = useMemo(() => {
    const set = new Set<LogEntryKind>();
    for (const g of KIND_GROUPS) {
      if (activeKindKeys.has(g.key)) {
        for (const k of g.kinds) set.add(k);
      }
    }
    return set;
  }, [activeKindKeys]);

  // Per-uid count is filtered by the active KIND set, so flipping a
  // kind off narrows the TRACK dropdown to only uids that have
  // matching entries left -- you can't pick a "ghost" track that's
  // been filtered to zero.
  const uidCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      if (!e.uid) continue;
      if (!allowedKinds.has(e.kind)) continue;
      m.set(e.uid, (m.get(e.uid) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries, allowedKinds]);

  const visible = useMemo<LogEntry[]>(
    () =>
      entries.filter(
        (e) =>
          allowedKinds.has(e.kind) &&
          (!e.uid || !excludedUids.has(e.uid)),
      ),
    [entries, allowedKinds, excludedUids],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dropdown) setDropdown(null);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dropdown]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickyRef.current && open) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, open, dropdown]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    stickyRef.current = atBottom;
  };

  const toggleKind = (key: string) =>
    setActiveKindKeys((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleUid = (uid: string) =>
    setExcludedUids((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });

  const totalKinds = KIND_GROUPS.length;
  const activeKindCount = activeKindKeys.size;
  const totalUids = uidCounts.length;
  const includedUids = totalUids - excludedUids.size;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto fixed bottom-7 right-3 z-30 panel px-2.5 py-1 text-[10px] tracking-widest text-terminal-accent hover:bg-terminal-accent/10 hover:border-terminal-accent"
        title="Open event log"
      >
        ▸ EVENT LOG
        <span className="ml-1.5 text-terminal-dim tabular-nums">
          {entries.length}
        </span>
      </button>
    );
  }

  return (
    <aside className="pointer-events-auto fixed bottom-7 right-3 z-30 flex w-[560px] flex-col">
      <div className="panel">
        <header className="flex items-center justify-between gap-2 border-b border-terminal-border px-2 py-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="label text-terminal-accent hover:text-terminal-fg"
          >
            ▾ EVENT LOG
          </button>
          <span className="label text-terminal-dim tabular-nums">
            {visible.length}/{entries.length}
          </span>
          <div className="flex flex-1 justify-end gap-1.5">
            <FilterButton
              label="KIND"
              count={`${activeKindCount}/${totalKinds}`}
              active={activeKindCount < totalKinds}
              open={dropdown === "kind"}
              onClick={() =>
                setDropdown((d) => (d === "kind" ? null : "kind"))
              }
            />
            <FilterButton
              label="TRACK"
              count={`${includedUids}/${totalUids}`}
              active={excludedUids.size > 0}
              open={dropdown === "track"}
              onClick={() =>
                setDropdown((d) => (d === "track" ? null : "track"))
              }
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-terminal-dim hover:text-terminal-accent text-[9px] tracking-widest"
          >
            ESC
          </button>
        </header>

        {dropdown === "kind" && (
          <DropdownPanel
            title="Filter by kind"
            actions={[
              {
                label: "ALL",
                onClick: () =>
                  setActiveKindKeys(new Set(KIND_GROUPS.map((g) => g.key))),
              },
              {
                label: "NONE",
                onClick: () => setActiveKindKeys(new Set()),
              },
            ]}
          >
            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
              {KIND_GROUPS.map((g) => {
                const on = activeKindKeys.has(g.key);
                return (
                  <label
                    key={g.key}
                    className="flex cursor-pointer items-center gap-1.5 text-[10px] hover:text-terminal-fg"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleKind(g.key)}
                      className="accent-terminal-accent"
                    />
                    <span
                      className={`tracking-widest ${
                        on ? KIND_TONE[g.kinds[0]!] : "text-terminal-dim line-through"
                      }`}
                    >
                      {g.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </DropdownPanel>
        )}

        {dropdown === "track" && (
          <DropdownPanel
            title={`Filter by track (${totalUids} known)`}
            actions={[
              {
                label: "ALL",
                onClick: () => setExcludedUids(new Set()),
              },
              {
                label: "NONE",
                onClick: () =>
                  setExcludedUids(new Set(uidCounts.map(([u]) => u))),
              },
            ]}
          >
            {uidCounts.length === 0 ? (
              <div className="text-terminal-dim text-[10px] italic">
                no tracks in log
              </div>
            ) : (
              <div className="grid max-h-[150px] grid-cols-3 gap-x-2 gap-y-0.5 overflow-y-auto pr-1">
                {uidCounts.map(([uid, n]) => {
                  const included = !excludedUids.has(uid);
                  return (
                    <label
                      key={uid}
                      className="flex cursor-pointer items-center gap-1 text-[10px] hover:text-terminal-fg"
                    >
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleUid(uid)}
                        className="accent-terminal-accent"
                      />
                      <span
                        className={`flex-1 truncate font-mono ${
                          included
                            ? "text-terminal-fg/90"
                            : "text-terminal-dim line-through"
                        }`}
                      >
                        {uid}
                      </span>
                      <span className="text-terminal-dim tabular-nums">
                        {n}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </DropdownPanel>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-[220px] overflow-y-auto px-2 py-1 font-mono text-[10px] leading-snug"
        >
          {visible.length === 0 ? (
            <div className="text-terminal-dim italic">no events</div>
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
                    className={`w-9 shrink-0 tracking-widest ${KIND_TONE[e.kind]}`}
                  >
                    {KIND_LABEL[e.kind]}
                  </span>
                  <span className="w-24 shrink-0 truncate text-terminal-fg/80">
                    {e.uid ?? ""}
                  </span>
                  <span className="truncate text-terminal-fg/95">
                    {e.summary}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};

const FilterButton = ({
  label,
  count,
  active,
  open,
  onClick,
}: {
  label: string;
  count: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-1.5 py-0.5 text-[9px] tracking-widest border transition ${
      open
        ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
        : active
          ? "border-terminal-accent text-terminal-accent bg-terminal-accent/5"
          : "border-terminal-border text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg/70"
    }`}
  >
    {label}{" "}
    <span className="tabular-nums opacity-80">{count}</span>{" "}
    {open ? "▴" : "▾"}
  </button>
);

const DropdownPanel = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions: { label: string; onClick: () => void }[];
  children: React.ReactNode;
}) => (
  <div className="border-b border-terminal-border bg-terminal-panel2/40 px-2 py-1.5">
    <div className="mb-1 flex items-center justify-between">
      <span className="label text-terminal-dim">{title}</span>
      <div className="flex gap-1">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className="border border-terminal-border px-1.5 py-0.5 text-[9px] tracking-widest text-terminal-dim hover:border-terminal-fg/40 hover:text-terminal-fg"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
    {children}
  </div>
);
