import { PRESET_BBOX } from "@/config/constants";

const fmtBbox = (n: number, dir: "lat" | "lng") => {
  const abs = Math.abs(n).toFixed(2);
  const hemi =
    dir === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${abs}${hemi}`;
};

export const FooterStrip = () => (
  <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-20">
    <div className="pointer-events-auto panel border-x-0 border-b-0 px-2 py-1 flex items-center justify-between gap-2 text-[9px] h-5 leading-none">
      <div className="flex items-center gap-2 divide-x divide-terminal-border/50">
        <span className="flex items-center gap-1">
          <span className="text-terminal-dim tracking-widest">AO:</span>
          <span className="stat text-[9px]">
            {fmtBbox(PRESET_BBOX.south, "lat")}-{fmtBbox(PRESET_BBOX.north, "lat")}·{fmtBbox(PRESET_BBOX.west, "lng")}-{fmtBbox(PRESET_BBOX.east, "lng")}
          </span>
        </span>
        <span className="flex items-center gap-1 pl-2">
          <span className="stat text-[9px]">WGS84</span>
        </span>
      </div>
      <div className="flex items-center gap-2 divide-x divide-terminal-border/50">
        <span className="text-terminal-dim tracking-widest">[R]</span>
        <span className="text-terminal-dim pl-2">
          ©Mapbox·OSM
        </span>
      </div>
    </div>
  </footer>
);
