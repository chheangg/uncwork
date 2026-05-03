import { useLayersStore, type MapStyle } from "@/stores/layers";
import type { LinkStatus } from "@/types/cot";

export type RGBA = [number, number, number, number];

// Two palettes, one per basemap.
// - topo: light/busy backgrounds (greens, tans) -> punchy, full-opacity colors
//   so links and trails read at a glance.
// - satellite: darker imagery -> the muted palette, since satellite already
//   provides plenty of contrast and full-saturation labels look neon.
const PALETTES: Record<MapStyle, Record<LinkStatus, RGBA>> = {
  topo: {
    healthy: [38, 160, 96, 255],
    degraded: [220, 155, 30, 255],
    critical: [218, 60, 48, 255],
    offline: [105, 115, 125, 220],
  },
  satellite: {
    healthy: [108, 180, 132, 235],
    degraded: [215, 170, 75, 235],
    critical: [215, 90, 78, 245],
    offline: [125, 132, 140, 175],
  },
};

// Per-basemap alpha for the heatmap halo. Satellite stays at full
// punch (the dark imagery already mutes the disc). Topo is heavily
// translucent so the halos don't completely paint over the light
// terrain, leaving roads and labels readable underneath.
const HEATMAP_ALPHA: Record<MapStyle, number> = {
  topo: 110,
  satellite: 215,
};

let activeMapStyle: MapStyle = useLayersStore.getState().mapStyle;
useLayersStore.subscribe((state) => {
  activeMapStyle = state.mapStyle;
});

export const statusColor = (status: LinkStatus): RGBA =>
  PALETTES[activeMapStyle][status];

export const heatmapBaseAlpha = (): number => HEATMAP_ALPHA[activeMapStyle];
