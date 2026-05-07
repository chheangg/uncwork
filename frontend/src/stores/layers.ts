import { create } from "zustand";

export type LayerKey = "links" | "heatmap" | "buildings" | "trails";
export type MapStyle = "topo" | "satellite";
// "operator" — full system view: trust scores, fingerprint badges,
// status colors driven by trust. "naive" — same map without our
// surfaces: trust % hidden, fingerprint badges hidden, status colors
// flattened. The toggle is the demo's central "what would you see
// without us?" comparison.
export type ViewMode = "operator" | "naive";

type LayersStore = {
  visible: Record<LayerKey, boolean>;
  mapStyle: MapStyle;
  viewMode: ViewMode;
  toggle: (key: LayerKey) => void;
  set: (key: LayerKey, value: boolean) => void;
  setMapStyle: (style: MapStyle) => void;
  setViewMode: (mode: ViewMode) => void;
};

export const useLayersStore = create<LayersStore>((set) => ({
  visible: { links: true, heatmap: true, buildings: true, trails: true },
  mapStyle: "satellite",
  viewMode: "operator",
  toggle: (key) =>
    set((state) => ({
      visible: { ...state.visible, [key]: !state.visible[key] },
    })),
  set: (key, value) =>
    set((state) => ({ visible: { ...state.visible, [key]: value } })),
  setMapStyle: (style) => set({ mapStyle: style }),
  setViewMode: (viewMode) => set({ viewMode }),
}));
