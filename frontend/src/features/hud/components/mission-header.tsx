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
      <div className="pointer-events-auto panel border-x-0 border-t-0 flex items-stretch divide-x divide-terminal-border">
        <Brand />
        <Slot label="Mission" value={MISSION.callsign} />
        <Slot label="AO" value={MISSION.ao} />
        <Slot label="DEFCON" value={String(MISSION.defcon)} accent />
        <Slot label="Tracks" value={trackCount.toString().padStart(3, "0")} />
        <Slot
          label="Mean Conf"
          value={`${(meanConfidence * 100).toFixed(0)}%`}
        />
        <Slot label="ZULU" value={utc} className="ml-auto" />
        <Classification text={MISSION.classification} />
      </div>
    </header>
  );
};

const Brand = () => (
  <div className="flex items-center gap-3 px-4 py-2.5">
    <div className="h-2.5 w-2.5 rounded-full bg-terminal-accent shadow-glow animate-blink" />
    <span className="font-bold text-terminal-accent tracking-[0.32em]">
      UNCWORK
    </span>
    <span className="label">// C2</span>
  </div>
);

const Slot = ({
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
  <div className={`flex flex-col justify-center px-4 py-1.5 ${className ?? ""}`}>
    <span className="label">{label}</span>
    <span
      className={`text-xs tabular-nums ${accent ? "text-terminal-accent" : "text-terminal-fg"}`}
    >
      {value}
    </span>
  </div>
);

const Classification = ({ text }: { text: string }) => (
  <div className="flex items-center px-3 bg-terminal-accent/10 border-l border-terminal-accent/40">
    <span className="text-[10px] font-bold tracking-[0.22em] text-terminal-accent">
      {text}
    </span>
  </div>
);
