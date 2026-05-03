import { MISSION } from "@/config/constants";
import { useUtcClock } from "../hooks/use-utc-clock";

type MissionHeaderProps = {
  trackCount: number;
  meanConfidence: number;
};

export const MissionHeader = ({
  trackCount,
  meanConfidence,
}: MissionHeaderProps) => {
  const utc = useUtcClock();
  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-20">
      <div className="pointer-events-auto panel border-x-0 border-t-0 flex items-center h-8 px-2 gap-0 divide-x divide-terminal-border text-[10px] leading-none">
        <Brand />
        <CompactSlot label="MSN" value={MISSION.callsign} />
        <CompactSlot label="AO" value={MISSION.ao} />
        <CompactSlot label="DC" value={String(MISSION.defcon)} accent />
        <CompactSlot label="TRK" value={trackCount.toString().padStart(3, "0")} />
        <CompactSlot label="CNF" value={`${(meanConfidence * 100).toFixed(0)}%`} />
        <CompactSlot label="Z" value={utc} className="ml-auto" />
        <Classification text={MISSION.classification} />
      </div>
    </header>
  );
};

const Brand = () => (
  <div className="flex items-center gap-1.5 px-2">
    <div className="h-1.5 w-1.5 rounded-full bg-terminal-accent shadow-glow animate-blink" />
    <span className="font-bold text-terminal-accent tracking-[0.2em] text-[10px]">
      HAMILTON//C2
    </span>
  </div>
);

const CompactSlot = ({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) => (
  <div className={`flex items-center gap-1 px-2 ${className ?? ""}`}>
    <span className="text-[9px] uppercase tracking-widest text-terminal-dim">{label}:</span>
    <span
      className={`text-[10px] tabular-nums font-bold tracking-tight ${accent ? "text-terminal-accent" : "text-terminal-fg"}`}
    >
      {value}
    </span>
  </div>
);

const Classification = ({ text }: { text: string }) => (
  <div className="flex items-center px-2 bg-terminal-accent/10 border-l border-terminal-accent/40">
    <span className="text-[9px] font-bold tracking-[0.2em] text-terminal-accent">
      {text}
    </span>
  </div>
);
