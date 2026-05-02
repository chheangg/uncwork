import { create } from "zustand";

type SelectionStore = {
  selectedUid: string | null;
  select: (uid: string) => void;
  deselect: () => void;
};

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedUid: null,
  select: (uid) => set({ selectedUid: uid }),
  deselect: () => set({ selectedUid: null }),
}));
