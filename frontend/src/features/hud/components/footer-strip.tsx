import { PRESET_BBOX } from "@/config/constants";

const fmtBbox = (n: number, dir: "lat" | "lng") => {
  const abs = Math.abs(n).toFixed(4);
  const hemi =
    dir === "lat" ? (n >= 0 ? "N" : "S") : n >= 0 ? "E" : "W";
  return `${abs}°${hemi}`;
};

export const FooterStrip = () => (
  <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-20">
    <div className="pointer-events-auto panel border-x-0 border-b-0 px-3 py-1.5 flex items-center justify-between gap-4 text-[10px]">
      <div className="flex items-center gap-4">
        <span>
          <span className="label mr-1">AO</span>
          <span className="stat">
            {fmtBbox(PRESET_BBOX.south, "lat")} → {fmtBbox(PRESET_BBOX.north, "lat")}{" "}
            · {fmtBbox(PRESET_BBOX.west, "lng")} → {fmtBbox(PRESET_BBOX.east, "lng")}
          </span>
        </span>
        <span>
          <span className="label mr-1">Datum</span>
          <span className="stat">WGS84</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="label">[ R ] reset view</span>
        <span className="label text-terminal-dim">
          © Mapbox · OpenStreetMap
        </span>
      </div>
    </div>
  </footer>
);
