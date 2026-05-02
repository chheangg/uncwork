import { create } from "zustand";
import { PRESET_BBOX } from "@/config/constants";
import type { Bbox } from "@/types/bbox";

export type { Bbox };

type ViewportStore = {
  bbox: Bbox;
  set: (bbox: Bbox) => void;
};

export const useViewportStore = create<ViewportStore>((set) => ({
  bbox: { ...PRESET_BBOX },
  set: (bbox) => set({ bbox }),
}));
