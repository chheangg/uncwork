import { create } from "zustand";

export type LayerKey = "links" | "heatmap" | "buildings" | "trails";
export type MapStyle = "topo" | "satellite";

type LayersStore = {
  visible: Record<LayerKey, boolean>;
  mapStyle: MapStyle;
  toggle: (key: LayerKey) => void;
  set: (key: LayerKey, value: boolean) => void;
  setMapStyle: (style: MapStyle) => void;
};

export const useLayersStore = create<LayersStore>((set) => ({
  visible: { links: true, heatmap: true, buildings: true, trails: true },
  mapStyle: "topo",
  toggle: (key) =>
    set((state) => ({
      visible: { ...state.visible, [key]: !state.visible[key] },
    })),
  set: (key, value) =>
    set((state) => ({ visible: { ...state.visible, [key]: value } })),
  setMapStyle: (style) => set({ mapStyle: style }),
}));
