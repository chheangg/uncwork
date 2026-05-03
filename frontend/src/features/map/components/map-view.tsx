import { useCallback, useEffect, useRef, useState } from "react";
import DeckGL, { type DeckGLRef } from "@deck.gl/react";
import type { Layer } from "@deck.gl/core";
import { Map, type MapRef } from "react-map-gl";
import { env } from "@/config/env";
import { PRESET_VIEW } from "@/config/constants";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import { useViewportStore } from "@/stores/viewport";
import {
  ensureBuildingLayer,
  ensureTerrain,
  setBuildingVisibility,
} from "../lib/map-style";

type PickedTrack = { uid: string; callsign?: string };

type MapViewProps = {
  layers: Layer[];
  onTrackContext?: (
    info: { x: number; y: number; track: PickedTrack } | null,
  ) => void;
};

type ViewState = typeof PRESET_VIEW & { padding?: Record<string, number> };

export const MapView = ({ layers, onTrackContext }: MapViewProps) => {
  const viewState = useViewStateStore((s) => s.viewState);
  const setViewState = useViewStateStore((s) => s.set);
  const resetView = useViewStateStore((s) => s.reset);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapRef | null>(null);
  const deckRef = useRef<DeckGLRef | null>(null);
  const buildingsVisible = useLayersStore((s) => s.visible.buildings);
  const mapStyle = useLayersStore((s) => s.mapStyle);

  // Hardcoded so the user's VITE_MAP_STYLE_URL can't override the
  // default and break the toggle. Topographic default for the
  // tactical "military map" feel; satellite-streets for imagery.
  const STYLE_URLS = {
    topo: "mapbox://styles/mapbox/outdoors-v12",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  } as const;
  const mapStyleUrl = STYLE_URLS[mapStyle];

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
    // Mapbox wipes custom sources/layers (DEM terrain, our extruded
    // building layer) every time the style loads. Re-apply on init
    // AND on every style.load so flipping TOPO <-> SAT preserves
    // terrain + buildings.
    const apply = () => {
      ensureTerrain(map);
      ensureBuildingLayer(map);
      setBuildingVisibility(map, buildingsVisible);
    };
    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [mapReady, buildingsVisible, mapStyleUrl]);

  const setBbox = useViewportStore((s) => s.set);

  const captureBbox = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    // Mapbox getBounds() returns the on-screen rectangle. With pitch
    // the visible trapezoid extends beyond that, so pad 15% on each
    // axis. Also enforce a minimum span so deep zooms still pull a
    // useful slice from OpenSky.
    const PAD = 0.25;
    const MIN_SPAN_DEG = 0.35;
    const south0 = b.getSouth();
    const north0 = b.getNorth();
    const west0 = b.getWest();
    const east0 = b.getEast();
    const latSpan = Math.max(north0 - south0, MIN_SPAN_DEG);
    const lngSpan = Math.max(east0 - west0, MIN_SPAN_DEG);
    const latCenter = (north0 + south0) / 2;
    const lngCenter = (east0 + west0) / 2;
    const halfLat = latSpan * (0.5 + PAD);
    const halfLng = lngSpan * (0.5 + PAD);
    setBbox({
      south: latCenter - halfLat,
      north: latCenter + halfLat,
      west: lngCenter - halfLng,
      east: lngCenter + halfLng,
    });
  }, [setBbox]);

  const handleLoad = useCallback(() => {
    setMapReady(true);
    captureBbox();
  }, [captureBbox]);

  // When the user flips TOPO <-> SAT, the <Map> remounts (new key).
  // Reset mapReady so the apply effect re-runs against the new
  // mapbox instance once its `load` fires.
  useEffect(() => {
    setMapReady(false);
  }, [mapStyleUrl]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!onTrackContext) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const deck = deckRef.current;
      if (!deck) {
        onTrackContext(null);
        return;
      }
      const picked = deck.pickObject({
        x,
        y,
        radius: 6,
        layerIds: ["link-icon"],
      });
      const obj = picked?.object as
        | { uid?: string; latest?: { callsign?: string } }
        | undefined;
      if (!obj || !obj.uid) {
        onTrackContext(null);
        return;
      }
      onTrackContext({
        x: event.clientX,
        y: event.clientY,
        track: { uid: obj.uid, callsign: obj.latest?.callsign },
      });
    },
    [onTrackContext],
  );

  if (!env.mapboxToken) return <MissingTokenNotice />;

  return (
    <div className="h-full w-full" onContextMenu={handleContextMenu}>
      <DeckGL
        ref={deckRef}
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
          key={mapStyleUrl}
          ref={mapRef}
          mapboxAccessToken={env.mapboxToken}
          mapStyle={mapStyleUrl}
          onLoad={handleLoad}
          onMoveEnd={captureBbox}
          attributionControl={false}
          projection={{ name: "globe" }}
        />
      </DeckGL>
    </div>
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
