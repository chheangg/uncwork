import { useMemo } from "react";
import type { Layer } from "@deck.gl/core";
import { LayerTogglePanel, MapView } from "@/features/map";
import {
  DataSourceToggle,
  useLiveFeed,
  useMockFeed,
} from "@/features/data-source";
import { buildLinkLayers, useAffectedAugment } from "@/features/links";
import { buildHeatmapLayer } from "@/features/heatmap";
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
  meanConfidence,
} from "@/features/hud";
import { useEventStore, selectEventList } from "@/stores/events";
import { useLayersStore } from "@/stores/layers";
import { useViewStateStore } from "@/stores/view-state";
import { useViewportStore } from "@/stores/viewport";
import { inBbox } from "@/lib/bbox";
import { HEATMAP_MAX_ZOOM } from "@/config/constants";

// Render slightly behind real time so we always have a future
// history sample to interpolate toward. Backend emits at 1Hz; with
// a 1.5s buffer we have at least one fresh sample most of the time.
const RENDER_LAG_S = 1.5;

export const App = () => {
  useMockFeed();
  useLiveFeed();
  const events = useEventStore(selectEventList);
  const augmentedEvents = useAffectedAugment(events);
  const trackPaths = useTrackHistory(augmentedEvents);
  const visible = useLayersStore((s) => s.visible);
  const crt = useLayersStore((s) => s.crt);
  const bbox = useViewportStore((s) => s.bbox);
  const zoomedOut = useViewStateStore(
    (s) => s.viewState.zoom < HEATMAP_MAX_ZOOM,
  );
  const animTime = useAnimatedSeconds(33);
  const renderTime = animTime - RENDER_LAG_S;

  // Backend streams the whole default region; we cull to the current
  // viewport at render time so panning is instant and we keep
  // history for tracks even when they briefly leave view.
  const visibleEvents = useMemo(
    () => events.filter((e) => inBbox(e.lat, e.lon, bbox)),
    [events, bbox],
  );
  const visiblePaths = useMemo(
    () =>
      trackPaths.filter((p) => inBbox(p.latest.lat, p.latest.lon, bbox)),
    [trackPaths, bbox],
  );

  const heatmapActive = visible.heatmap && zoomedOut;

  const heatmapLayer = useMemo(
    () => (heatmapActive ? buildHeatmapLayer(visibleEvents) : null),
    [visibleEvents, heatmapActive],
  );

  const linkLayers = useMemo(
    () =>
      visible.links
        ? buildLinkLayers(visiblePaths, renderTime, animTime)
        : [],
    [visiblePaths, renderTime, animTime, visible.links],
  );

  const trailsLayers = useMemo(
    () =>
      visible.trails ? buildTrailsLayers(visiblePaths, renderTime) : [],
    [visiblePaths, renderTime, visible.trails],
  );

  const layers = useMemo<Layer[]>(() => {
    const result: Layer[] = [];
    result.push(...trailsLayers);
    if (heatmapLayer) result.push(heatmapLayer);
    result.push(...linkLayers);
    return result;
  }, [trailsLayers, heatmapLayer, linkLayers]);

  const statusCounts = useMemo(
    () => countByStatus(visibleEvents),
    [visibleEvents],
  );
  const affiliationCounts = useMemo(
    () => countByAffiliation(visibleEvents),
    [visibleEvents],
  );
  const meanConf = useMemo(() => meanConfidence(visibleEvents), [visibleEvents]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-terminal-bg text-terminal-fg">
      <MapView layers={layers} />
      {crt && <div className="crt-overlay" />}
      <MissionHeader
        trackCount={visibleEvents.length}
        meanConfidence={meanConf}
      />
      <aside className="pointer-events-auto absolute top-16 left-3 z-10 flex w-72 flex-col gap-3">
        <DataSourceToggle />
        <LayerTogglePanel />
        <StatusSummary counts={statusCounts} total={visibleEvents.length} />
      </aside>
      <aside className="pointer-events-auto absolute top-16 right-3 z-10 flex w-72 flex-col gap-3">
        <AffiliationSummary counts={affiliationCounts} />
        <TypeLegend />
      </aside>
      <FooterStrip />
    </div>
  );
};
