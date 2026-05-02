/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
