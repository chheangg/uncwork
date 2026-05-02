import { create } from "zustand";
import { PRESET_BBOX } from "@/config/constants";

export type Bbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type ViewportStore = {
  bbox: Bbox;
  set: (bbox: Bbox) => void;
};

export const useViewportStore = create<ViewportStore>((set) => ({
  bbox: { ...PRESET_BBOX },
  set: (bbox) => set({ bbox }),
}));
