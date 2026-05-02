import { create } from "zustand";

export type LayerKey = "links" | "heatmap" | "buildings";

type LayersStore = {
  visible: Record<LayerKey, boolean>;
  crt: boolean;
  toggle: (key: LayerKey) => void;
  set: (key: LayerKey, value: boolean) => void;
  toggleCrt: () => void;
};

export const useLayersStore = create<LayersStore>((set) => ({
  visible: { links: true, heatmap: true, buildings: true },
  crt: true,
  toggle: (key) =>
    set((state) => ({
      visible: { ...state.visible, [key]: !state.visible[key] },
    })),
  set: (key, value) =>
    set((state) => ({ visible: { ...state.visible, [key]: value } })),
  toggleCrt: () => set((state) => ({ crt: !state.crt })),
}));
