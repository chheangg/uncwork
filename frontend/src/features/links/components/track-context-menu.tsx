import { useEffect } from "react";

export type ContextMenuState = {
  uid: string;
  callsign: string;
  x: number;
  y: number;
};

type Props = {
  menu: ContextMenuState | null;
  onDetail: (uid: string) => void;
  onDismiss: () => void;
};

export const TrackContextMenu = ({ menu, onDetail, onDismiss }: Props) => {
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    const onAnyClick = () => onDismiss();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onAnyClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onAnyClick);
    };
  }, [menu, onDismiss]);

  if (!menu) return null;

  const PAD = 8;
  const W = 196;
  const H = 92;
  const left = Math.min(menu.x + PAD, window.innerWidth - W - PAD);
  const top = Math.min(menu.y + PAD, window.innerHeight - H - PAD);

  return (
    <div
      className="pointer-events-auto fixed z-40 panel-hot text-[11px]"
      style={{ left, top, width: W }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="border-b border-terminal-accent/40 px-2.5 py-1.5">
        <div className="label text-terminal-accent">Track</div>
        <div className="stat truncate">{menu.callsign}</div>
      </div>
      <button
        type="button"
        className="block w-full px-2.5 py-2 text-left tracking-wider text-terminal-fg hover:bg-terminal-accent/15"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDetail(menu.uid);
        }}
      >
        <span className="text-terminal-accent">[</span>
        <span className="px-1">DETAIL</span>
        <span className="text-terminal-accent">]</span>
        <span className="ml-2 text-terminal-dim">open telemetry</span>
      </button>
    </div>
  );
};
