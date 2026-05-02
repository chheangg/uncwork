import { useCallback, useEffect, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import type { Layer } from "@deck.gl/core";
import { Map, type MapRef } from "react-map-gl";
import { env } from "@/config/env";
import { PRESET_VIEW } from "@/config/constants";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import {
  ensureBuildingLayer,
  ensureTerrain,
  setBuildingVisibility,
} from "../lib/map-style";

type MapViewProps = {
  layers: Layer[];
};

type ViewState = typeof PRESET_VIEW & { padding?: Record<string, number> };

export const MapView = ({ layers }: MapViewProps) => {
  const viewState = useViewStateStore((s) => s.viewState);
  const setViewState = useViewStateStore((s) => s.set);
  const resetView = useViewStateStore((s) => s.reset);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const buildingsVisible = useLayersStore((s) => s.visible.buildings);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetView]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    ensureTerrain(map);
    ensureBuildingLayer(map);
    setBuildingVisibility(map, buildingsVisible);
  }, [mapReady, buildingsVisible]);

  const handleLoad = useCallback(() => setMapReady(true), []);

  if (!env.mapboxToken) return <MissingTokenNotice />;

  return (
    <DeckGL
      viewState={viewState}
      controller
      layers={layers}
      onViewStateChange={({ viewState: next }) => {
        const v = next as ViewState;
        setViewState({
          longitude: v.longitude,
          latitude: v.latitude,
          zoom: v.zoom,
          pitch: v.pitch,
          bearing: v.bearing,
        });
      }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={env.mapboxToken}
        mapStyle={env.mapStyleUrl}
        onLoad={handleLoad}
        reuseMaps
        attributionControl={false}
      />
    </DeckGL>
  );
};

const MissingTokenNotice = () => (
  <div className="flex h-full w-full items-center justify-center bg-terminal-bg text-terminal-fg">
    <div className="panel max-w-md p-6 text-sm leading-relaxed">
      <div className="label text-terminal-hot mb-2">Missing Mapbox token</div>
      <p className="mb-2">
        Set <code className="text-terminal-accent">VITE_MAPBOX_TOKEN</code> in
        <code className="text-terminal-accent">{" frontend/.env"}</code> with a
        public token from your Mapbox account.
      </p>
      <p className="text-terminal-dim text-xs">
        See <code>.env.example</code> for the format.
      </p>
    </div>
  </div>
);
