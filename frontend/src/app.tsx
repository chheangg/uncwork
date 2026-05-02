import { useCallback, useEffect, useMemo, useState } from "react";
import { positionAt } from "@/lib/track-path";
import type { Layer } from "@deck.gl/core";
import { LayerTogglePanel, MapView } from "@/features/map";
import {
  DataSourceToggle,
  useLiveFeed,
  useMockFeed,
} from "@/features/data-source";
import {
  buildLinkLayers,
  useAffectedAugment,
  TrackContextMenu,
  LinkDetailPanel,
  type ContextMenuState,
} from "@/features/links";
import { useSelectionStore } from "@/stores/selection";
import { buildHeatmapLayers } from "@/features/heatmap";
import {
  buildTrailsLayers,
  useAnimatedSeconds,
  useTrackHistory,
} from "@/features/trails";
import {
  AffiliationSummary,
  FooterStrip,
  MissionHeader,
  StatusSummary,
  TypeLegend,
  countByAffiliation,
  countByStatus,
  countStale,
  meanConfidence,
} from "@/features/hud";
import { useEventStore, selectEventList } from "@/stores/events";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import { HEATMAP_MAX_ZOOM } from "@/config/constants";

// Render slightly behind real time so we always have a future
// history sample to interpolate toward. Mock emits at 2Hz, live at
// ~1Hz with chaos drops. 2s lag covers a single dropped packet on
// live without the icon ever clamping to the last sample.
const RENDER_LAG_S = 2.0;

export const App = () => {
  useMockFeed();
  useLiveFeed();
  const events = useEventStore(selectEventList);
  const augmentedEvents = useAffectedAugment(events);
  const trackPaths = useTrackHistory(augmentedEvents);
  const visible = useLayersStore((s) => s.visible);
  const crt = useLayersStore((s) => s.crt);
  const zoomedOut = useViewStateStore(
    (s) => s.viewState.zoom < HEATMAP_MAX_ZOOM,
  );
  const animTime = useAnimatedSeconds(33);
  const renderTime = animTime - RENDER_LAG_S;

  const heatmapActive = visible.heatmap && zoomedOut;

  const heatmapLayers = useMemo(
    () => (heatmapActive ? buildHeatmapLayers(events) : []),
    [events, heatmapActive],
  );

  const linkLayers = useMemo(
    () =>
      visible.links ? buildLinkLayers(trackPaths, renderTime, animTime) : [],
    [trackPaths, renderTime, animTime, visible.links],
  );

  // Trails fade in 0.5s steps (see build-trails-layer.ts); rebuilding
  // the PathLayer object 30Hz when the fade clock only ticks at 2Hz
  // is wasted work, so memoize on the quantized clock.
  const trailsClock = Math.floor(animTime * 2) / 2;
  const trailsLayers = useMemo(
    () =>
      visible.trails ? buildTrailsLayers(trackPaths, trailsClock) : [],
    [trackPaths, trailsClock, visible.trails],
  );

  const layers = useMemo<Layer[]>(() => {
    const result: Layer[] = [];
    result.push(...trailsLayers);
    result.push(...heatmapLayers);
    result.push(...linkLayers);
    return result;
  }, [trailsLayers, heatmapLayers, linkLayers]);

  const statusCounts = useMemo(() => countByStatus(events), [events]);
  const affiliationCounts = useMemo(
    () => countByAffiliation(events),
    [events],
  );
  const meanConf = useMemo(() => meanConfidence(events), [events]);
  const delayedCount = useMemo(() => countStale(events), [events]);

  const selectedUid = useSelectionStore((s) => s.selectedUid);
  const select = useSelectionStore((s) => s.select);
  const deselect = useSelectionStore((s) => s.deselect);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
    null,
  );

  const handleTrackContext = useCallback(
    (info: { x: number; y: number; track: { uid: string; callsign?: string } } | null) => {
      if (!info) {
        setContextMenu(null);
        return;
      }
      setContextMenu({
        uid: info.track.uid,
        callsign: info.track.callsign ?? info.track.uid,
        x: info.x,
        y: info.y,
      });
    },
    [],
  );

  const selectedTrack = useMemo(
    () => trackPaths.find((p) => p.uid === selectedUid) ?? null,
    [trackPaths, selectedUid],
  );

  const detailOpen = selectedTrack !== null;

  useEffect(() => {
    if (!selectedTrack || selectedTrack.path.length === 0) return;
    const [lon, lat] = positionAt(
      selectedTrack.path,
      selectedTrack.timestamps,
      renderTime,
    );
    const store = useViewStateStore.getState();
    if (
      store.viewState.longitude === lon &&
      store.viewState.latitude === lat
    ) {
      return;
    }
    store.set({ ...store.viewState, longitude: lon, latitude: lat });
  }, [selectedTrack, renderTime]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-terminal-bg text-terminal-fg">
      <MapView layers={layers} onTrackContext={handleTrackContext} />
      {crt && <div className="crt-overlay" />}
      <MissionHeader trackCount={events.length} meanConfidence={meanConf} />
      <aside className="pointer-events-auto absolute top-16 left-3 z-10 flex w-72 flex-col gap-3">
        <DataSourceToggle />
        <LayerTogglePanel />
        <StatusSummary
          counts={statusCounts}
          total={events.length}
          delayed={delayedCount}
        />
      </aside>
      {!detailOpen && (
        <aside className="pointer-events-auto absolute top-16 right-3 z-10 flex w-72 flex-col gap-3">
          <AffiliationSummary counts={affiliationCounts} />
          <TypeLegend />
        </aside>
      )}
      <LinkDetailPanel track={selectedTrack} onClose={deselect} />
      <TrackContextMenu
        menu={contextMenu}
        onDetail={(uid) => {
          select(uid);
          setContextMenu(null);
        }}
        onDismiss={() => setContextMenu(null)}
      />
      <FooterStrip />
    </div>
  );
};
