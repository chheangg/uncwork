import { useMemo } from "react";
import type { Layer } from "@deck.gl/core";
import { LayerTogglePanel, MapView } from "@/features/map";
import { DataSourceToggle, useMockFeed } from "@/features/data-source";
import { buildLinkLayers } from "@/features/links";
import { buildHeatmapLayer } from "@/features/heatmap";
import {
  buildTrailsLayer,
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
import { HEATMAP_MAX_ZOOM } from "@/config/constants";

export const App = () => {
  useMockFeed();
  const events = useEventStore(selectEventList);
  const visible = useLayersStore((s) => s.visible);
  const crt = useLayersStore((s) => s.crt);
  const zoomedOut = useViewStateStore(
    (s) => s.viewState.zoom < HEATMAP_MAX_ZOOM,
  );
  const trackPaths = useTrackHistory();
  const currentTime = useAnimatedSeconds(33);

  const heatmapActive = visible.heatmap && zoomedOut;

  const heatmapLayer = useMemo(
    () => (heatmapActive ? buildHeatmapLayer(events) : null),
    [events, heatmapActive],
  );

  const linkLayers = useMemo(
    () => (visible.links ? buildLinkLayers(events, currentTime) : []),
    [events, currentTime, visible.links],
  );

  const trailsLayer = useMemo(
    () => (visible.trails ? buildTrailsLayer(trackPaths, currentTime) : null),
    [trackPaths, currentTime, visible.trails],
  );

  const layers = useMemo<Layer[]>(() => {
    const result: Layer[] = [];
    if (trailsLayer) result.push(trailsLayer);
    if (heatmapLayer) result.push(heatmapLayer);
    result.push(...linkLayers);
    return result;
  }, [trailsLayer, heatmapLayer, linkLayers]);

  const statusCounts = useMemo(() => countByStatus(events), [events]);
  const affiliationCounts = useMemo(
    () => countByAffiliation(events),
    [events],
  );
  const meanConf = useMemo(() => meanConfidence(events), [events]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-terminal-bg text-terminal-fg">
      <MapView layers={layers} />
      {crt && <div className="crt-overlay" />}
      <MissionHeader trackCount={events.length} meanConfidence={meanConf} />
      <aside className="pointer-events-auto absolute top-16 left-3 z-10 flex w-72 flex-col gap-3">
        <DataSourceToggle />
        <LayerTogglePanel />
        <StatusSummary counts={statusCounts} total={events.length} />
      </aside>
      <aside className="pointer-events-auto absolute top-16 right-3 z-10 flex w-72 flex-col gap-3">
        <AffiliationSummary counts={affiliationCounts} />
        <TypeLegend />
      </aside>
      <FooterStrip />
    </div>
  );
};
