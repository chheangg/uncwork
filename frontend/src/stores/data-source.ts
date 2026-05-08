import { create } from "zustand";

export type DataSource = "battle" | "live" | "off";

type DataSourceStore = {
  source: DataSource;
  setSource: (source: DataSource) => void;
};

export const useDataSourceStore = create<DataSourceStore>((set) => ({
  source: "live",
  setSource: (source) => set({ source }),
}));
