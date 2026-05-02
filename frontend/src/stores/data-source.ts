import { create } from "zustand";

export type DataSource = "mock" | "live" | "off";

type DataSourceStore = {
  source: DataSource;
  setSource: (source: DataSource) => void;
};

export const useDataSourceStore = create<DataSourceStore>((set) => ({
  source: "mock",
  setSource: (source) => set({ source }),
}));
