import { create } from "zustand";
import { PRESET_VIEW } from "@/config/constants";

export type ViewStateValues = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

type ViewStateStore = {
  viewState: ViewStateValues;
  set: (next: ViewStateValues) => void;
  reset: () => void;
};

const initial = (): ViewStateValues => ({
  longitude: PRESET_VIEW.longitude,
  latitude: PRESET_VIEW.latitude,
  zoom: PRESET_VIEW.zoom,
  pitch: PRESET_VIEW.pitch,
  bearing: PRESET_VIEW.bearing,
});

export const useViewStateStore = create<ViewStateStore>((set) => ({
  viewState: initial(),
  set: (next) => set({ viewState: next }),
  reset: () => set({ viewState: initial() }),
}));
