import { create } from "zustand";

export type LayerKey = "links" | "heatmap" | "buildings" | "trails";
export type MapStyle = "dark" | "satellite";

type LayersStore = {
  visible: Record<LayerKey, boolean>;
  crt: boolean;
  mapStyle: MapStyle;
  toggle: (key: LayerKey) => void;
  set: (key: LayerKey, value: boolean) => void;
  toggleCrt: () => void;
  setMapStyle: (style: MapStyle) => void;
};

export const useLayersStore = create<LayersStore>((set) => ({
  visible: { links: true, heatmap: true, buildings: true, trails: true },
  crt: true,
  mapStyle: "dark",
  toggle: (key) =>
    set((state) => ({
      visible: { ...state.visible, [key]: !state.visible[key] },
    })),
  set: (key, value) =>
    set((state) => ({ visible: { ...state.visible, [key]: value } })),
  toggleCrt: () => set((state) => ({ crt: !state.crt })),
  setMapStyle: (style) => set({ mapStyle: style }),
}));
