import { useEffect, useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "@/features/trails";
import { useLogStore } from "@/stores/log";
import { statusColor } from "../lib/link-style";
import type { AugmentedEvent } from "../hooks/use-affected-augment";

type Props = {
  track: TrackPath<AugmentedEvent> | null;
  onClose: () => void;
};

const DIMENSION_LABEL: Record<string, string> = {
  air: "Air",
  ground: "Ground",
  sea_surface: "Surface",
  sea_subsurface: "Subsurface",
  space: "Space",
  sof: "SOF",
  sensor: "Sensor",
  other: "Other",
};

const STATUS_TEXT: Record<LinkStatus, string> = {
  healthy: "text-terminal-green",
  degraded: "text-terminal-yellow",
  critical: "text-terminal-hot",
  offline: "text-terminal-gray",
};

const haversineMeters = (
  a: [number, number],
  b: [number, number],
): number => {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

const fmtCoord = (n: number, axis: "lat" | "lon"): string => {
  const hemi =
    axis === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${Math.abs(n).toFixed(5)}° ${hemi}`;
};

const fmtSecondsAgo = (ts: number): string => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ${s % 60}s ago`;
};

export const LinkDetailPanel = ({ track, onClose }: Props) => {
  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [track, onClose]);

  const stats = useMemo(() => {
    if (!track) return null;
    let distance = 0;
    for (let i = 1; i < track.path.length; i++) {
      distance += haversineMeters(track.path[i - 1]!, track.path[i]!);
    }
    let statusChanges = 0;
    for (let i = 1; i < track.statuses.length; i++) {
      if (track.statuses[i] !== track.statuses[i - 1]) statusChanges += 1;
    }
    return {
      points: track.path.length,
      distanceM: distance,
      statusChanges,
      windowS:
        track.timestamps.length > 0
          ? (track.timestamps[track.timestamps.length - 1]! -
              track.timestamps[0]!)
          : 0,
    };
  }, [track]);

  if (!track) return null;

  const e: AugmentedEvent = track.latest;
  const statusKey = e.status;

  return (
    <aside className="pointer-events-auto absolute top-8 right-2 z-30 flex w-45 flex-col">
      <div className="panel-hot relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-terminal-accent/80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-terminal-accent/40" />

        <header className="flex items-center justify-between border-b border-terminal-accent/40 px-2 py-1 h-6">
          <div className="flex items-center gap-1.5">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-terminal-accent" />
            <span className="label text-terminal-accent text-[9px]">TEL</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-terminal-dim hover:text-terminal-accent text-[9px]"
            aria-label="Close detail panel"
          >
            [X]
          </button>
        </header>

        <div className="space-y-1.5 px-2 py-1.5 text-[9px]">
          <div>
            <div className="stat text-[10px] tracking-wider font-bold">
              {e.callsign ?? "—"}
            </div>
            <div className="text-terminal-dim text-[8px] truncate font-mono">{e.uid.slice(0, 16)}</div>
          </div>

          <CompactRow label="STA">
            <span className={`stat ${STATUS_TEXT[statusKey]} uppercase font-bold`}>
              {statusKey.slice(0, 3).toUpperCase()}
            </span>
            {e.recentlyAffected && (
              <span className="ml-1 text-terminal-green text-[8px]">[RCV]</span>
            )}
          </CompactRow>

          <CompactRow label="DEL">
            {e.stale ? (
              <span className="stat text-terminal-amber animate-blink font-bold">
                STALE
              </span>
            ) : (
              <span className="stat text-terminal-green font-bold">OK</span>
            )}
          </CompactRow>

          <TrustScore value={e.trustScore} />

          <CompactRow label="POS">
            <div className="stat tabular-nums text-[8px]">{fmtCoord(e.lat, "lat")}</div>
            <div className="stat tabular-nums text-[8px]">{fmtCoord(e.lon, "lon")}</div>
          </CompactRow>

          <div className="grid grid-cols-2 gap-1">
            <CompactRow label="ALT">
              <span className="stat tabular-nums text-[8px]">
                {e.hae !== undefined ? `${e.hae.toFixed(0)}m` : "—"}
              </span>
            </CompactRow>
            <CompactRow label="CE">
              <span className="stat tabular-nums text-[8px]">
                {e.ce !== undefined ? `${e.ce.toFixed(0)}m` : "—"}
              </span>
            </CompactRow>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <CompactRow label="SNS">
              <span className="stat text-[8px] uppercase">{e.sensorType.slice(0, 3)}</span>
            </CompactRow>
            <CompactRow label="DIM">
              <span className="stat text-[8px] uppercase">
                {DIMENSION_LABEL[e.dimension]?.slice(0, 3) ?? e.dimension.slice(0, 3)}
              </span>
            </CompactRow>
          </div>

          <CompactRow label="UPD">
            <span className="stat text-[8px]">
              {fmtSecondsAgo(Date.parse(e.time))}
            </span>
          </CompactRow>

          <StatusWindow track={track} />

          {stats && (
            <div className="grid grid-cols-3 gap-1 border-t border-terminal-border/60 pt-1">
              <CompactStat label="PTS" value={stats.points.toString()} />
              <CompactStat
                label="DST"
                value={
                  stats.distanceM < 1000
                    ? `${stats.distanceM.toFixed(0)}m`
                    : `${(stats.distanceM / 1000).toFixed(1)}km`
                }
              />
              <CompactStat
                label="ΔS"
                value={stats.statusChanges.toString()}
              />
            </div>
          )}

          <ActionRow uid={e.uid} status={statusKey} stale={e.stale} />
        </div>
      </div>
    </aside>
  );
};

const ActionRow = ({
  uid,
  status,
  stale,
}: {
  uid: string;
  status: LinkStatus;
  stale: boolean;
}) => {
  const append = useLogStore((s) => s.append);
  return (
    <div className="grid grid-cols-2 gap-1 border-t border-terminal-border/60 pt-1">
      <button
        type="button"
        onClick={() =>
          append({
            kind: "operator",
            uid,
            summary: "Operator ACKNOWLEDGED",
            payload: { status, stale },
          })
        }
        className="border border-terminal-border bg-terminal-panel/80 px-1 py-1 text-[9px] tracking-widest text-terminal-fg hover:border-terminal-fg/50 hover:bg-terminal-fg/10 font-bold"
      >
        [ACK]
      </button>
      <button
        type="button"
        onClick={() =>
          append({
            kind: "operator",
            uid,
            summary: "Operator ESCALATED",
            payload: { status, stale, severity: "critical" },
          })
        }
        className="border border-terminal-accent/70 bg-terminal-panel/80 px-1 py-1 text-[9px] tracking-widest text-terminal-accent hover:bg-terminal-accent/15 font-bold"
      >
        [ESC]
      </button>
    </div>
  );
};

const CompactRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline gap-1">
    <span className="text-[8px] uppercase tracking-widest text-terminal-dim w-8">{label}:</span>
    <div className="flex-1">{children}</div>
  </div>
);

const CompactStat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[8px] uppercase tracking-widest text-terminal-dim">{label}</div>
    <div className="stat tabular-nums text-[8px]">{value}</div>
  </div>
);

const statusForConf = (c: number): LinkStatus => {
  if (c >= 0.6) return "healthy";
  if (c >= 0.3) return "degraded";
  if (c >= 0.08) return "critical";
  return "offline";
};

const TrustScore = ({ value }: { value: number }) => {
  const pct = Math.round(value * 100);
  const [r, g, b] = statusColor(statusForConf(value));
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-[8px] uppercase tracking-widest text-terminal-dim w-8">TRS:</span>
        <span className="stat tabular-nums text-[8px] flex-1">{pct}%</span>
      </div>
      <div className="mt-0.5 h-1 bg-terminal-border/60 relative overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: `rgba(${r}, ${g}, ${b}, 0.95)`,
          }}
        />
      </div>
    </div>
  );
};

const StatusWindow = ({
  track,
}: {
  track: TrackPath<CotEvent>;
}) => {
  const segments = useMemo(() => {
    const n = track.samples.length;
    if (n === 0) return [];
    const now = Date.now() / 1000;
    const windowStart = now - TRAIL_FADE_S;
    const span = TRAIL_FADE_S;
    const pctOf = (t: number) =>
      ((Math.max(windowStart, Math.min(now, t)) - windowStart) / span) * 100;
    const out: { leftPct: number; widthPct: number; status: LinkStatus }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const left = pctOf(track.samples[i]!.t);
      const right = pctOf(track.samples[i + 1]!.t);
      const width = right - left;
      if (width <= 0) continue;
      out.push({
        leftPct: left,
        widthPct: width,
        status: track.samples[i]!.status,
      });
    }
    const lastLeft = pctOf(track.samples[n - 1]!.t);
    out.push({
      leftPct: lastLeft,
      widthPct: Math.max(0, 100 - lastLeft),
      status: track.samples[n - 1]!.status,
    });
    return out;
  }, [track]);

  return (
    <div>
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-[8px] uppercase tracking-widest text-terminal-dim w-8">WIN:</span>
        <span className="text-terminal-dim text-[8px] flex-1">
          {track.samples.length} samples
        </span>
      </div>
      <div className="relative h-4 bg-terminal-border/40 overflow-hidden">
        {segments.map((s, i) => {
          const [r, g, b] = statusColor(s.status);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: `${s.leftPct}%`,
                width: `${s.widthPct}%`,
                background: `rgba(${r}, ${g}, ${b}, 0.92)`,
              }}
            />
          );
        })}
        <div
          aria-hidden
          className="absolute right-0 top-0 bottom-0 w-px bg-terminal-fg/70"
        />
      </div>
      <div className="text-terminal-dim text-[8px] flex justify-between mt-0.5 tabular-nums">
        <span>-{TRAIL_FADE_S}s</span>
        <span>now</span>
      </div>
    </div>
  );
};

