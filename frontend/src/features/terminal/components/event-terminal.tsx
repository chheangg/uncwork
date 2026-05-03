import { useEffect, useRef } from "react";
import { useLogStore } from "../lib/log-store";
import type { LinkStatus } from "@/types/cot";

const STATUS_COLOR: Record<LinkStatus, string> = {
  healthy: "text-green-400",
  degraded: "text-yellow-400",
  critical: "text-red-500",
  offline: "text-neutral-500",
};

const pad = (n: number) => String(n).padStart(2, "0");

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

export const EventTerminal = () => {
  const lines = useLogStore((s) => s.lines);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="pointer-events-none absolute bottom-8 left-0 right-0 z-10 px-3">
      <div className="pointer-events-auto mx-auto max-w-4xl rounded border border-red-900/40 bg-black/70 px-3 py-1.5 backdrop-blur-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest text-red-600">
            EVENT LOG
          </span>
          <span className="text-[10px] text-neutral-600">{lines.length} entries</span>
        </div>
        <div className="h-20 overflow-y-auto font-mono text-[11px] leading-5">
          {lines.map((line) => (
            <div key={line.id} className="flex gap-2 whitespace-nowrap">
              <span className="text-neutral-600">{fmtTime(line.ts)}</span>
              <span className={`w-16 truncate ${STATUS_COLOR[line.status]}`}>
                {line.status.toUpperCase().slice(0, 4)}
              </span>
              <span className="w-32 truncate text-neutral-300">{line.callsign}</span>
              <span className="text-neutral-500">
                {line.lat.toFixed(3)},{line.lon.toFixed(3)}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};
