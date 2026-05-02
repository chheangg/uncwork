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
import { RecommenderPanel, useRecommender } from "@/features/recommender";
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
  meanConfidence,
} from "@/features/hud";
import { useEventStore, selectEventList } from "@/stores/events";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import { HEATMAP_MAX_ZOOM } from "@/config/constants";
import {
  ReplayControls,
  usePlaybackTick,
  useReplayEvents,
} from "@/features/replay";
import { useReplayStore } from "@/stores/replay";

// Render slightly behind real time so we always have a future
// history sample to interpolate toward. Mock emits at 2Hz (500ms),
// so 0.6s lag gives us a buffer for smooth interpolation without
// making the icon lag too far behind the visible trail.
const RENDER_LAG_S = 0.6;

export const App = () => {
  useMockFeed();
  useLiveFeed();
  useDerivedLog();
  usePlaybackTick();

  const mode = useReplayStore((s) => s.mode);
  const playhead = useReplayStore((s) => s.playhead);

  const allEvents = useEventStore(selectEventList);
  const events = useReplayEvents(allEvents);
  const augmentedEvents = useAffectedAugment(events);
  const trackPaths = useTrackHistory(augmentedEvents);
  const visible = useLayersStore((s) => s.visible);
  const crt = useLayersStore((s) => s.crt);
  const zoomedOut = useViewStateStore(
    (s) => s.viewState.zoom < HEATMAP_MAX_ZOOM,
  );
  const animTime = useAnimatedSeconds(33);
  
  // In replay mode, use playhead as the render time; in live mode, use animTime with lag
  const renderTime = mode === "replay" ? playhead : animTime - RENDER_LAG_S;

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
    return result;
  }, [trailsLayers, heatmapLayers, linkLayers]);

  const statusCounts = useMemo(() => countByStatus(events), [events]);
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
  const recommendation = useRecommender(selectedTrack);

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
          <TypeLegend />
        </aside>
      )}
      <LinkDetailPanel track={selectedTrack} onClose={deselect} />
      {detailOpen && <RecommenderPanel rec={recommendation} />}
      <TrackContextMenu
        menu={contextMenu}
        onDetail={(uid) => {
          select(uid);
          setContextMenu(null);
        }}
        onDismiss={() => setContextMenu(null)}
      />
      <EventTerminal />
      <ReplayControls />
      <FooterStrip />
    </div>
  );
};
