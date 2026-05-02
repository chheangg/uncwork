import { useEffect, useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import { sensorFullName } from "@/lib/sensor";
import type { TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "@/features/trails";
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
    <aside className="pointer-events-auto absolute top-16 right-3 z-30 flex w-80 flex-col">
      <div className="panel-hot relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-terminal-accent/80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-terminal-accent/40" />
        <div className="absolute left-0 top-0 h-3 w-3 border-l border-t border-terminal-accent" />
        <div className="absolute right-0 top-0 h-3 w-3 border-r border-t border-terminal-accent" />
        <div className="absolute left-0 bottom-0 h-3 w-3 border-l border-b border-terminal-accent" />
        <div className="absolute right-0 bottom-0 h-3 w-3 border-r border-b border-terminal-accent" />
        <Scanline />

        <header className="flex items-center justify-between border-b border-terminal-accent/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="block h-2 w-2 animate-pulse rounded-full bg-terminal-accent" />
            <span className="label text-terminal-accent">TELEMETRY</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-terminal-dim hover:text-terminal-accent"
            aria-label="Close detail panel"
          >
            [X]
          </button>
        </header>

        <div className="space-y-3 px-3 py-2.5 text-[11px]">
          <div>
            <div className="label">Callsign / UID</div>
            <div className="stat text-[13px] tracking-wider">
              {e.callsign ?? "—"}
            </div>
            <div className="text-terminal-dim text-[10px] truncate">{e.uid}</div>
          </div>

          <Row label="Status">
            <span className={`stat ${STATUS_TEXT[statusKey]} uppercase`}>
              {statusKey}
            </span>
            {e.recentlyAffected && (
              <span className="ml-2 text-terminal-green">[recovered]</span>
            )}
          </Row>

          <Row label="Delivery">
            {e.stale ? (
              <span className="stat text-terminal-amber animate-blink">
                STALE / DELAYED
              </span>
            ) : (
              <span className="stat text-terminal-green">ON-TIME</span>
            )}
            <span className="ml-2 text-terminal-dim">
              stale@ {new Date(e.staleAt).toLocaleTimeString()}
            </span>
          </Row>

          <Confidence value={e.confInt} />

          <Row label="Position">
            <div className="stat tabular-nums">{fmtCoord(e.lat, "lat")}</div>
            <div className="stat tabular-nums">{fmtCoord(e.lon, "lon")}</div>
            {e.hae !== undefined && (
              <div className="text-terminal-dim">
                alt {e.hae.toFixed(0)} m HAE
              </div>
            )}
          </Row>

          <div className="grid grid-cols-2 gap-2">
            <Row label="CE">
              <span className="stat tabular-nums">
                {e.ce !== undefined ? `${e.ce.toFixed(0)} m` : "—"}
              </span>
            </Row>
            <Row label="LE">
              <span className="stat tabular-nums">
                {e.le !== undefined ? `${e.le.toFixed(0)} m` : "—"}
              </span>
            </Row>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Row label="Sensor">
              <span className="stat">{sensorFullName(e.sensorType)}</span>
            </Row>
            <Row label="Domain">
              <span className="stat">
                {DIMENSION_LABEL[e.dimension] ?? e.dimension}
              </span>
            </Row>
          </div>

          <Row label="Last Update">
            <span className="stat">
              {fmtSecondsAgo(Date.parse(e.time))}
            </span>
            <span className="ml-2 text-terminal-dim">
              {new Date(e.time).toLocaleTimeString()}
            </span>
          </Row>

          <StatusWindow track={track} />

          {stats && (
            <div className="grid grid-cols-3 gap-2 border-t border-terminal-border/60 pt-2">
              <Stat label="Points" value={stats.points.toString()} />
              <Stat
                label="Distance"
                value={
                  stats.distanceM < 1000
                    ? `${stats.distanceM.toFixed(0)}m`
                    : `${(stats.distanceM / 1000).toFixed(2)}km`
                }
              />
              <Stat
                label="Δ Status"
                value={stats.statusChanges.toString()}
              />
            </div>
          )}

          {e.remarks && (
            <Row label="Remarks">
              <span className="stat text-terminal-fg/80 leading-snug block">
                {e.remarks}
              </span>
            </Row>
          )}

          <div className="text-terminal-dim text-[10px] flex items-center justify-between border-t border-terminal-border/60 pt-1.5">
            <span>WINDOW {TRAIL_FADE_S}s</span>
            <span className="animate-blink">▮</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="label">{label}</div>
    <div>{children}</div>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="label">{label}</div>
    <div className="stat tabular-nums">{value}</div>
  </div>
);

const statusForConf = (c: number): LinkStatus => {
  if (c >= 0.6) return "healthy";
  if (c >= 0.3) return "degraded";
  if (c >= 0.08) return "critical";
  return "offline";
};

const Confidence = ({ value }: { value: number }) => {
  const pct = Math.round(value * 100);
  const [r, g, b] = statusColor(statusForConf(value));
  return (
    <div>
      <div className="label flex justify-between">
        <span>Confidence</span>
        <span className="stat tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 bg-terminal-border/60 relative overflow-hidden">
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
    const n = track.timestamps.length;
    if (n === 0) return [];
    const now = Date.now() / 1000;
    const windowStart = now - TRAIL_FADE_S;
    const span = TRAIL_FADE_S;
    const pctOf = (t: number) =>
      ((Math.max(windowStart, Math.min(now, t)) - windowStart) / span) * 100;
    const out: { leftPct: number; widthPct: number; status: LinkStatus }[] = [];
    for (let i = 0; i < n - 1; i++) {
      const left = pctOf(track.timestamps[i]!);
      const right = pctOf(track.timestamps[i + 1]!);
      const width = right - left;
      if (width <= 0) continue;
      out.push({
        leftPct: left,
        widthPct: width,
        status: track.statuses[i] ?? track.latest.status,
      });
    }
    const lastLeft = pctOf(track.timestamps[n - 1]!);
    out.push({
      leftPct: lastLeft,
      widthPct: Math.max(0, 100 - lastLeft),
      status: track.statuses[n - 1] ?? track.latest.status,
    });
    return out;
  }, [track]);

  return (
    <div>
      <div className="label flex justify-between">
        <span>Status Window</span>
        <span className="text-terminal-dim">
          {track.timestamps.length} samples
        </span>
      </div>
      <div className="relative mt-1 h-6 bg-terminal-border/40 overflow-hidden">
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
      <div className="text-terminal-dim text-[10px] flex justify-between mt-0.5 tabular-nums">
        <span>-{TRAIL_FADE_S}s</span>
        <span>now</span>
      </div>
    </div>
  );
};

const Scanline = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 overflow-hidden"
  >
    <div
      className="absolute inset-x-0 h-8 animate-scan"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,58,58,0) 0%, rgba(255,58,58,0.08) 50%, rgba(255,58,58,0) 100%)",
      }}
    />
  </div>
);
