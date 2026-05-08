import { useCallback, useEffect, useMemo, useState } from "react";
import { positionAt } from "@/lib/track-path";
import type { Layer } from "@deck.gl/core";
import { LayerTogglePanel, MapView } from "@/features/map";
import {
  PlaybackPanel,
  WalkthroughOverlay,
  WalkthroughComplete,
  useWalkthroughDriver,
} from "@/features/walkthrough";
import { AiRecommenderPanel } from "@/features/recommender";
import { useLiveFeed, useBattleFeed, DataSourceToggle } from "@/features/data-source";
import {
  buildLinkLayers,
  useAffectedAugment,
  TrackContextMenu,
  LinkDetailPanel,
  type ContextMenuState,
} from "@/features/links";
import { buildAttributionLayer } from "@/features/attribution";
import { EventTerminal, useDerivedLog } from "@/features/terminal";
import { useSelectionStore } from "@/stores/selection";
import { buildHeatmapLayers } from "@/features/heatmap";
import {
  buildTrailsLayers,
  useAnimatedSeconds,
  useTrackHistory,
} from "@/features/trails";
import {
  FooterStrip,
  MissionHeader,
  StatusSummary,
  TypeLegend,
  countByStatus,
  countStale,
  meanTrust,
} from "@/features/hud";
import { useEventStore, selectEventList } from "@/stores/events";
import { useDataSourceStore } from "@/stores/data-source";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import { HEATMAP_MAX_ZOOM } from "@/config/constants";

// Render slightly behind real time so we always have a future
// history sample to interpolate toward. Mock emits at 2Hz (500ms),
// so 0.6s lag gives us a buffer for smooth interpolation without
// making the icon lag too far behind the visible trail.
const RENDER_LAG_S = 0.6;

export const App = () => {
  useLiveFeed();
  useBattleFeed();
  useDerivedLog();
  useWalkthroughDriver();

  const events = useEventStore(selectEventList);
  const augmentedEvents = useAffectedAugment(events);
  const trackPaths = useTrackHistory(augmentedEvents);
  const visible = useLayersStore((s) => s.visible);
  const dataSource = useDataSourceStore((s) => s.source);
  const viewMode = useLayersStore((s) => s.viewMode);
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

  const attributionLayers = useMemo(
    () =>
      visible.links && viewMode === "operator"
        ? buildAttributionLayer(trackPaths, renderTime, animTime)
        : [],
    [trackPaths, renderTime, animTime, visible.links, viewMode],
  );

  // Trails fade in 0.5s steps (see build-trails-layer.ts); rebuilding
  // the PathLayer object 30Hz when the fade clock only ticks at 2Hz
  // is wasted work, so memoize on the quantized clock.
  // Use renderTime (not animTime) so trails stay synced with link icons.
  const trailsClock = Math.floor(renderTime * 2) / 2;
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
    result.push(...attributionLayers);
    return result;
  }, [trailsLayers, heatmapLayers, linkLayers, attributionLayers]);

  const statusCounts = useMemo(() => countByStatus(events), [events]);
  const meanTrustVal = useMemo(() => meanTrust(events), [events]);
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
      <ScreenFrame />
      <MissionHeader trackCount={events.length} meanTrust={meanTrustVal} />
      <aside className="pointer-events-auto absolute top-8 left-2 z-10 flex w-45 flex-col gap-2">
        <DataSourceToggle />
        {dataSource === "live" && <PlaybackPanel />}
        <LayerTogglePanel />
        <StatusSummary
          counts={statusCounts}
          total={events.length}
          delayed={delayedCount}
          meanTrust={meanTrustVal}
        />
      </aside>
      {!detailOpen && (
        <aside className="pointer-events-auto absolute top-8 right-2 bottom-32 z-10 flex w-72 flex-col gap-2 overflow-y-auto pr-1">
          <TypeLegend />
        </aside>
      )}
      <LinkDetailPanel track={selectedTrack} onClose={deselect} />
      <AiRecommenderPanel
        track={selectedTrack ? selectedTrack.latest : null}
      />
      <TrackContextMenu
        menu={contextMenu}
        onDetail={(uid) => {
          select(uid);
          setContextMenu(null);
        }}
        onDismiss={() => setContextMenu(null)}
      />
      <WalkthroughOverlay />
      <WalkthroughComplete />
      <EventTerminal />
      <FooterStrip />
    </div>
  );
};

const ScreenFrame = () => (
  <div className="screen-frame">
    <span className="corner-tr" />
    <span className="corner-bl" />
    <span className="sweep" />
  </div>
);
