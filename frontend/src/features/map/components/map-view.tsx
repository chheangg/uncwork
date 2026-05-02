import { useEffect, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import type { Layer } from "@deck.gl/core";
import { Map, type MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { env } from "@/config/env";
import { PRESET_VIEW } from "@/config/constants";
import { useLayersStore } from "@/stores/layers";
import { ensureBuildingLayer, setBuildingVisibility } from "../lib/map-style";

type MapViewProps = {
  layers: Layer[];
};

type ViewState = typeof PRESET_VIEW & { padding?: Record<string, number> };

export const MapView = ({ layers }: MapViewProps) => {
  const [viewState, setViewState] = useState<ViewState>(PRESET_VIEW);
  const mapRef = useRef<MapRef | null>(null);
  const buildingsVisible = useLayersStore((s) => s.visible.buildings);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey) {
        setViewState({ ...PRESET_VIEW });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const apply = () => {
      ensureBuildingLayer(map);
      setBuildingVisibility(map, buildingsVisible);
    };
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("idle", apply);
      return () => {
        map.off("idle", apply);
      };
    }
  }, [buildingsVisible]);

  return (
    <DeckGL
      viewState={viewState}
      controller
      layers={layers}
      onViewStateChange={({ viewState: next }) =>
        setViewState(next as ViewState)
      }
    >
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={env.mapStyleUrl}
        reuseMaps
        attributionControl={false}
      />
    </DeckGL>
  );
};
