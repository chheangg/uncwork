import { useEffect, useMemo } from "react";
import type { CotEvent, Detectors, LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "@/features/trails";
import { useLogStore } from "@/stores/log";
import { statusColor } from "../lib/link-style";
import { fingerprintTone } from "@/features/attribution";
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

const STATUS_LABEL: Record<LinkStatus, string> = {
  healthy: "HEALTHY",
  degraded: "DEGRADED",
  critical: "CRITICAL",
  offline: "OFFLINE",
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
            <span className="label text-terminal-accent text-[9px]">TELEMETRY</span>
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

          <CompactRow label="STATUS">
            <span className={`stat ${STATUS_TEXT[statusKey]} uppercase font-bold`}>
              {STATUS_LABEL[statusKey]}
            </span>
            {e.recentlyAffected && (
              <span className="ml-1 text-terminal-green text-[8px]">[RECOVERED]</span>
            )}
          </CompactRow>

          <CompactRow label="DELIVERY">
            {e.stale ? (
              <span className="stat text-terminal-amber animate-blink font-bold">
                STALE
              </span>
            ) : (
              <span className="stat text-terminal-green font-bold">OK</span>
            )}
          </CompactRow>

          <TrustScore value={e.trustScore} />

          <CompactRow label="POSITION">
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

          <CompactRow label="SENSOR">
            <span className="stat text-[8px] uppercase">{e.sensorType}</span>
          </CompactRow>
          <CompactRow label="DOMAIN">
            <span className="stat text-[8px] uppercase">
              {DIMENSION_LABEL[e.dimension] ?? e.dimension}
            </span>
          </CompactRow>

          <CompactRow label="UPDATED">
            <span className="stat text-[8px]">
              {fmtSecondsAgo(Date.parse(e.time))}
            </span>
          </CompactRow>

          {e.detectors && <DetectorChips detectors={e.detectors} />}

          <StatusWindow track={track} />

          {stats && (
            <div className="grid grid-cols-3 gap-1 border-t border-terminal-border/60 pt-1">
              <CompactStat label="POINTS" value={stats.points.toString()} />
              <CompactStat
                label="DIST"
                value={
                  stats.distanceM < 1000
                    ? `${stats.distanceM.toFixed(0)}m`
                    : `${(stats.distanceM / 1000).toFixed(1)}km`
                }
              />
              <CompactStat
                label="ΔSTATE"
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
        [ESCALATE]
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
    <span className="text-[8px] uppercase tracking-widest text-terminal-dim shrink-0 w-[58px]">{label}:</span>
    <div className="flex-1">{children}</div>
  </div>
);

const CompactStat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[8px] uppercase tracking-widest text-terminal-dim">{label}</div>
    <div className="stat tabular-nums text-[8px]">{value}</div>
  </div>
);

/**
 * **FR-01..04 chips.** Renders each active detector as a labeled chip.
 * Status row at top (FR-01..03), then a fingerprint block (FR-04) with
 * the catalog match name, confidence percent, and source citation. The
 * "ATTRIBUTED" framing is intentional — the listener classifies wire
 * shape against the public catalog, it does not measure RF.
 */
const DetectorChips = ({ detectors }: { detectors: Detectors }) => {
  const { temporalAnomaly, crcPct60s, crcBreach, spatialClass, fingerprint } = detectors;
  const hasStatusChip =
    temporalAnomaly || crcBreach || spatialClass !== "clear";

  if (!hasStatusChip && !fingerprint) return null;

  return (
    <div className="border-t border-terminal-border/60 pt-1">
      <div className="text-[8px] uppercase tracking-widest text-terminal-dim mb-1">
        DETECTORS
      </div>
      {hasStatusChip && (
        <div className="flex flex-wrap gap-1 mb-1">
          {temporalAnomaly && (
            <Chip kind="warn" label="FR-01 ANOMALY" />
          )}
          {crcBreach && (
            <Chip kind="warn" label={`FR-02 CRC ${(crcPct60s * 100).toFixed(1)}%`} />
          )}
          {spatialClass === "localized" && (
            <Chip kind="warn" label="FR-03 LOCALIZED" />
          )}
          {spatialClass === "blanket" && (
            <Chip kind="hot" label="FR-03 BLANKET" />
          )}
        </div>
      )}
      {fingerprint && <FingerprintBlock fingerprint={fingerprint} />}
    </div>
  );
};

const Chip = ({
  kind,
  label,
}: {
  kind: "warn" | "hot";
  label: string;
}) => {
  const cls =
    kind === "hot"
      ? "border-terminal-hot/70 text-terminal-hot bg-terminal-hot/10"
      : "border-terminal-amber/70 text-terminal-amber bg-terminal-amber/10";
  return (
    <span
      className={`inline-block border px-1 py-px text-[8px] tracking-widest font-bold ${cls}`}
    >
      {label}
    </span>
  );
};

const FingerprintBlock = ({
  fingerprint,
}: {
  fingerprint: NonNullable<Detectors["fingerprint"]>;
}) => {
  const tone = fingerprintTone(fingerprint.confidence);
  const pct = Math.round(fingerprint.confidence * 100);
  return (
    <div className="border border-terminal-border/60 bg-terminal-panel/60 px-1 py-1">
      <div className="flex items-center justify-between mb-0.5">
        <span
          className="stat text-[9px] font-bold uppercase tracking-wider"
          style={{ color: tone.hex }}
        >
          FR-04 {fingerprint.tag.toUpperCase()}
        </span>
        <span
          className="text-[8px] font-bold tabular-nums"
          style={{ color: tone.hex }}
        >
          {pct}% {tone.label}
        </span>
      </div>
      <div className="text-[8px] text-terminal-fg leading-tight mb-0.5">
        {fingerprint.name}
      </div>
      {fingerprint.primaryEffect && (
        <div className="text-[8px] text-terminal-dim italic leading-tight mb-0.5">
          {fingerprint.primaryEffect}
        </div>
      )}
      {fingerprint.matchedSignals.length > 0 && (
        <div className="text-[8px] text-terminal-dim leading-tight mb-0.5">
          matched: {fingerprint.matchedSignals.join(", ")}
        </div>
      )}
      <div className="text-[8px] text-terminal-dim leading-tight truncate">
        src: {fingerprint.source}
      </div>
      <div className="text-[7px] text-terminal-dim italic mt-0.5 leading-tight">
        ATTRIBUTED from wire shape — not RF observation.
      </div>
    </div>
  );
};

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
        <span className="text-[8px] uppercase tracking-widest text-terminal-dim shrink-0 w-[58px]">TRUST:</span>
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
        <span className="text-[8px] uppercase tracking-widest text-terminal-dim shrink-0 w-[58px]">WINDOW:</span>
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

