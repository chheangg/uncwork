# Frontend — UncWork C2

Hackathon C2 ops console. Terminal/defense aesthetic, red theme. Map-first, single screen, no auth, desktop only.

## What this app does

Renders a 3D Mapbox map of an AO (currently Kyiv, tight ~25 km box). Tracks — fixed sensors, ground vehicles, planes — appear as elevated icons with status badges, optional bottom-right delivery-late ("stale") badge, dashed trails that fade out over 60 s with a solid head segment from the previous to current point, status-colored poles, status+confidence labels, and a per-status confidence heatmap that auto-blooms when zoomed out. Right-click a track icon → context menu → telemetry detail panel. Three data sources toggleable: **Mock** (fake CoT generator), **Live** (real ADS-B via backend WebSocket), **Off** (no data).

## Stack

- React 18 + Vite + TypeScript (strict)
- Tailwind 3 with `terminal-*` red palette
- Zustand for cross-feature state
- **Mapbox GL JS** v3 base map (DEM terrain enabled), **deck.gl** v9 layers stacked on top via `<DeckGL>` parent + `<Map>` child
- **react-map-gl** v7 default Mapbox export
- **milsymbol** for MIL-STD-2525C / APP-6 NATO symbology — SVG output baked into data URIs at icon construction, cached per `(dimension, status, recovery, stale)` cache key
- pnpm

Bundle ~3MB total minified, ~790KB gzipped (mapbox is the biggest chunk).

## Architecture (React Bulletproof flavor)

```
src/
  app.tsx                  # composition root: hooks, layer memos, HUD layout
  main.tsx
  styles/globals.css       # tailwind + CRT scanline overlay
  config/
    constants.ts           # PRESET_VIEW (Kyiv), PRESET_BBOX, MISSION, HEATMAP_MAX_ZOOM
    env.ts                 # mapbox token, style url, api host, wsUrl helper
  types/
    cot.ts                 # Dimension, LinkStatus, SensorType, CotEvent
  lib/                     # generic helpers
    cn.ts
    cot.ts                 # parseDimension, computeStatus (confInt-driven),
                           # (confInt-driven), computeStale, computeConfInt,
                           # enrichCot
    sensor.ts              # SENSORS_BY_DIMENSION, sensorLabel, sensorFullName
    track-path.ts          # TrackPath type + positionAt() interpolator
  stores/
    events.ts              # uid->CotEvent map, upsertMany/clear
    data-source.ts         # 'mock' | 'live' | 'off'
    layers.ts              # toggles: links / trails / heatmap / buildings + crt
    view-state.ts          # mapbox viewState (lng/lat/zoom/pitch/bearing)
    selection.ts           # selectedUid for the link detail panel
    viewport.ts            # current map bbox (consumed by backend viewport sync)
  mock/
    fake-cot.ts            # seedTracks / stepTrack / emitFromTrack
                           # MockCategory = sensor | ground | air; sensors are
                           # zero-velocity (only health decays); per-tick
                           # delayed flag flips on/off to inject stale arrivals
  components/ui/           # Toggle, Panel
  features/
    data-source/
      hooks/use-mock-feed.ts    # 28 tracks @ 2.5s tick (10 sensor / 9 ground / 9 air)
      hooks/use-live-feed.ts    # WebSocket /ws -> CotEvent stream, auto-reconnect
      components/data-source-toggle.tsx
    map/
      lib/map-style.ts          # ensureTerrain, ensureBuildingLayer, setBuildingVisibility
      components/map-view.tsx   # DeckGL parent, Map child, R-key reset, right-click
                                # picks 'link-icon' and reports {x,y,track}
      components/layer-toggle-panel.tsx
    links/
      lib/icons.ts              # SIDC_BY_DIMENSION -> milsymbol -> nested SVG +
                                # status + stale badges; cache key
                                # (dim:status:rec/norm:late/ontime)
      lib/link-style.ts         # statusColor (RGBA per LinkStatus)
      lib/build-link-layers.ts  # LineLayer pole + IconLayer + TextLayer label;
                                # animated alpha by status (sin flicker for
                                # degraded/critical, ×0.85 dim if stale flag set)
      hooks/use-affected-augment.ts # 30s recently-affected memory per uid
      components/track-context-menu.tsx  # right-click popup -> [DETAIL]
      components/link-detail-panel.tsx   # NASA telemetry panel (status/stale/
                                          # confidence/position/sensor/window)
    heatmap/
      lib/build-heatmap-layer.ts # one HeatmapLayer per status (healthy/degraded/
                                 # critical), each with status-tinted gradient
                                 # and per-status radius (45/80/130 px)
    trails/
      hooks/use-track-history.ts # rolling 60s history per uid (TRAIL_FADE_S)
      hooks/use-animated-seconds.ts # ~30Hz currentTime via setInterval
      lib/build-trails-layer.ts  # buildTrailsLayers returns [PathLayer dashed
                                # history (per-vertex age fade), PathLayer solid
                                # head spanning only the last segment]
    hud/
      components/mission-header.tsx
      components/status-summary.tsx     # 4 statuses + separate "Delayed" line
      components/type-legend.tsx
      components/footer-strip.tsx
      hooks/use-utc-clock.ts
      lib/aggregate.ts           # countByStatus, countStale, meanConfidence
```

**Rules**

1. Features never reach into each other's internals — go through `features/<x>/index.ts`.
2. Generic helpers in `src/lib`, generic primitives in `src/components/ui`.
3. Stores in `src/stores` only when state is cross-feature.
4. `src/types/cot.ts` is the contract.
5. No barrels except feature `index.ts`.

## Data contract

`CotEvent` is the single shape every layer consumes:

```ts
type CotEvent = {
  uid: string;
  cotType: string;            // raw, e.g. "a-f-A-W-D"
  dimension: Dimension;       // parsed from cotType[2]
  sensorType: SensorType;     // sensor platform (radar/sonar/eo_ir/...)
  time: string; start: string;
  staleAt: string;            // CoT XML <event stale="..."> wire timestamp
  lat: number; lon: number; hae?: number;
  ce?: number; le?: number; remarks?: string; callsign?: string;
  // derived
  confInt: number;            // 0..1, ce/le-driven (NOT age-decayed)
  status: LinkStatus;         // healthy | degraded | critical | offline
  stale: boolean;             // delivery-late flag: now > staleAt
};
```

`status` and `stale` are independent axes: `status` reflects **data quality** (driven by `confInt`, which is `ce`/`le`-driven), and `stale` reflects **delivery lateness**. A track can be `{status: "healthy", stale: true}` — the report is accurate but arrived after its CoT stale deadline. The stale flag is presentational only — it does **not** gate position updates, trail extension, or any other state. Stale events flow through the pipeline like normal events; the only thing different is the visual indicator (bottom-right clock badge, slight icon dim, "Delayed" HUD count, "STALE / DELAYED" row in the detail panel).

`computeStatus(confInt)`:
- `≥ 0.6` → `healthy`
- `≥ 0.3` → `degraded`
- `≥ 0.08` → `critical`
- otherwise → `offline`

`computeStale(staleAt, now)` is just `now > Date.parse(staleAt)`.

`Dimension`: `air | ground | sea_surface | sea_subsurface | space | sof | sensor | other`. Mock only seeds `sensor / ground / air`; sensors are fixed-position. The `X` CoT type code maps to `"sensor"`.

This is a friendly-only C2: the `Affiliation` axis was removed entirely (type, parser, HUD panel, aggregator). cotTypes still carry the `f` in position 2 for wire compatibility, but it isn't parsed — every track is treated as friendly.

`SensorType`: `radar | sonar | eo_ir | sigint | acoustic | seismic | ais | lidar | ew | adsb`. ADS-B is reserved for live feed.

## Backend integration (live mode)

Backend is Rust (axum, tokio). On `origin/main` after the cherry-pick:

- **UDP listener** binds `0.0.0.0:9999`, parses CoT XML, dedupes by uid, broadcasts via tokio channel.
- **HTTP/WS server** binds `0.0.0.0:3000`:
  - `GET /senders` → `Vec<SenderInfo { addr, last_seen, message_count }>`
  - `GET /ws` → upgrades to WebSocket, streams `CotMessage` JSON per CoT frame:
    ```json
    {
      "uid": "unit_a-ICAO-...",
      "time": "ISO", "start": "ISO", "stale": "ISO",
      "lat": "37.x", "lon": "-122.x", "hae": "...",   // STRINGS
      "flight_number": "AAL123",
      "remarks": "unit=unit_a callsign=AAL123 seq=42",
      "source": "127.0.0.1:9001"
    }
    ```
- **Sender** pulls live ADS-B from OpenSky (10s interval, SF ±100mi), distributes to two units (`unit_a`, `unit_b`) with different chaos profiles (drop/dup/corrupt/reorder). Each emits CoT XML with `type="a-u-A-C-F"`.

`useLiveFeed` (`src/features/data-source/hooks/use-live-feed.ts`):
- Connects to `ws://${VITE_API_HOST}/ws` (default `localhost:3000`).
- Parses `CotMessage` JSON, converts `lat`/`lon`/`hae` strings to numbers.
- Forces `cotType = "a-f-A-C-F"` (friendly civil air) and `sensorType = "adsb"`.
- Maps the wire field `m.stale` (CoT XML timestamp) onto the frontend's `staleAt`; the boolean `stale` flag is then derived inside `enrichCot`.
- Puts `flight_number` in front of `remarks`.
- `enrichCot` derives status + confInt + stale flag the same way as mock.
- `useEventStore.upsertMany([cot])` per message.
- Auto-reconnect after 1.5s on close.
- Clears the store and tears down on `source !== "live"`.

`useMockFeed` and `useLiveFeed` both subscribe to `useDataSourceStore`. Whichever matches the current source is active; the other is dormant. Don't run them simultaneously — `clear()` is called when source flips.

## Env

```bash
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token_here
VITE_MAP_STYLE_URL=mapbox://styles/mapbox/dark-v11
VITE_API_HOST=localhost:3000
```

The `.env` file lives in `frontend/` and is gitignored.

## Visual contract

- **Pole** (`LineLayer`): from ground (lat/lon, alt=0) up to icon altitude. Color = status. Alpha tracks `confInt`.
- **Icon** (`IconLayer`): NATO symbology. SIDC built from `Dimension` (`A`/`G`/`S`/`U`/`P`/`F`/`X` for the battle dimension) with affiliation hard-coded to `F` (friendly C2). milsymbol renders an SVG per SIDC (cached); we wrap it in a nested `<svg>` so it scales to fit a 64×64 cell while preserving aspect ratio, then composite the status badge (top-right) and stale badge (bottom-right) over the same canvas. Elevated by dimension (air 220 m, space 360 m, sof 60 m, ground 25 m, surface 10 m, subsurface 5 m, sensor 8 m, other 25 m). Anchored at bottom. Bigger and brighter at high `confInt` (size 38–56, alpha 0.45–1.0). Animated alpha:
  - healthy: `base`
  - degraded: `base × (0.55 + 0.45 × sin(t·4 + uidHash))` — flicker
  - critical: `base × (0.4 + 0.5 × sin(t·5.6 + uidHash))` — faster, deeper
  - offline: pinned to `0.3`
  - if `stale === true`: result is multiplied by `0.85` (slight dim, layered on top of any pulse) — purely indicative, no other behavior changes.
- **Status badge** (top-right of icon SVG, baked in): warning ▲ (yellow degraded / red critical) · X (offline) · ✓ (recovery — for 30s after returning to healthy).
- **Stale badge** (bottom-right, independent of status): orange clock glyph rendered iff `stale === true`. A degraded-and-late track shows both badges.
- **Label** (`TextLayer`): `RDR 82%` floating ~42px above icon. Status-colored background, white text with black outline.
- **Trail** = two `PathLayer`s. Dashed history (`[8, 5]` dash via `PathStyleExtension`, per-vertex color status-tinted with alpha faded by `max(0, 1 − age/60)`); solid head whose path is just `[path[n−2], path[n−1]]` so only the segment from the previous point to the current point is solid. Whole trail dissolves over `TRAIL_FADE_S = 60` seconds. Old vertices are trimmed from the rolling history once they age past 60s (last 2 vertices always kept).
- **Heatmap**: one `HeatmapLayer` per status (`healthy / degraded / critical`), each filtered to its own subset and given a `transparent → statusColor` color range; per-status `radiusPixels` (45 / 80 / 130) so worse-status blooms wider. Per-layer auto-scaling means the saturated color is always the status color, never a gradient surprise. Only shown when `zoom < HEATMAP_MAX_ZOOM`.
- **Buildings**: Mapbox composite source with `extrude == true` filter, dark red ramp, zoom-interpolated height. Toggleable.
- **Terrain**: Mapbox DEM (`mapbox-terrain-dem-v1`), exaggeration 1.6.
- **CRT overlay**: red scanlines, vignette. Toggleable.

## Right-click → detail panel

`MapView` wraps `<DeckGL>` in a div with `onContextMenu`. On right-click it `preventDefault`s, computes canvas-relative `x/y`, and calls `deckRef.current.pickObject({ x, y, radius: 6, layerIds: ["link-icon"] })`. If a track is hit it bubbles `{ x, y, track: { uid, callsign } }` up via `onTrackContext`; otherwise `null`. App stores that as `ContextMenuState` and renders `TrackContextMenu` (small `panel-hot` popup at cursor with one `[ DETAIL ]` row, dismisses on Esc or any outside `mousedown`). Clicking DETAIL calls `useSelectionStore.select(uid)`. `LinkDetailPanel` renders whenever `selectedUid` resolves to a track in `trackPaths`. The right-side `TypeLegend` HUD is hidden while the detail panel is open so they don't fight for the same column. Esc closes.

The detail panel is intentionally NASA-flavored: corner brackets, animated scanline, blinking `▮` cursor, status-tinted confidence bar, and a status-window strip that draws every history sample as a colored vertical tick across the 60s `TRAIL_FADE_S` window.

## Stores (Zustand)

- `useEventStore` — `Record<uid, CotEvent>`. `upsertMany`, `remove`, `clear`. `selectEventList` returns `Object.values()`.
- `useDataSourceStore` — `'mock' | 'live' | 'off'`. Live/Mock hooks check this and start/stop accordingly.
- `useLayersStore` — `visible.{links,trails,heatmap,buildings}` + `crt`. `toggle(key)`, `set(key, val)`, `toggleCrt`.
- `useViewStateStore` — viewState driven by deck.gl controller, read by App for zoom-gated heatmap.
- `useSelectionStore` — `selectedUid: string | null` + `select(uid) / deselect()`. Drives the link detail panel.
- `useViewportStore` — current visible bbox (from `mapbox.getBounds()` with pitch padding); fed to backend so live ADS-B requests track the camera.

## Animation pattern

`useAnimatedSeconds(33)` returns a `Date.now()/1000` timestamp updated every 33ms. Used as:
- `renderTime` (= `animTime − 1.5s`) for icon/pole/label position interpolation via `positionAt(...)`.
- input to `statusAlpha()` in icon layer for sin-based flicker.
- `now` for the trails' per-vertex age fade (`updateTriggers.getColor: now` busts the GPU color buffer each tick).

App rebuilds the link layers and trail layers ~30Hz; `useMemo` deps include `animTime`. Heatmap layers memoize on `events` only — they don't fade dynamically.

## Conventions

- Files: `kebab-case.ts(x)`. Components: `PascalCase`. Hooks: `useCamelCase`. Stores: `useThingStore`.
- Strict TS, no `any`. `unknown` + narrowing at boundaries. Two known unavoidable casts: `PathStyleExtension` props on `PathLayer`/`TripsLayer` (extension props aren't in the layer type). Cast via `as unknown as ConstructorParameters<typeof X>[0]`.
- No comments unless they explain a non-obvious *why*. Don't narrate code.
- Reach for `useMemo` only when the computation is meaningful or the result is used as a dep.
- `updateTriggers` are required when a deck.gl `getX` accessor depends on data that changes between renders without the data array reference changing — e.g. `getIcon` reading `event.status` (for the badge cache hit) needs `updateTriggers.getIcon` to bust the GPU cache.
- Stale CSS classes: prefer `panel`, `label`, `stat`, `panel-hot` defined in `globals.css`.

## Hackathon priorities (current)

Built (in order):
1. 3D map + pitched view + R-reset (now centered on Kyiv)
2. Mock CoT pipeline with smooth health-driven state — restricted to sensor / ground / air, sensors are zero-velocity and only decay
3. Pole + icon + status + stale badge + label + animated alpha
4. Status summary (with separate "Delayed" line), type legend, mission header, footer
5. CRT mode, terrain, building injection
6. 60s dashed trails with per-vertex age fade + solid head segment between previous and current point + recovery badge (✓ for 30s after a status incident clears)
7. Live feed via WebSocket /ws
8. Per-status confidence heatmaps (one HeatmapLayer per status, status-tinted gradient, per-status radius)
9. Stale-as-flag refactor — `LinkStatus` is now strictly `healthy | degraded | critical | offline`; `stale: boolean` is a separate axis driven by delivery lateness
10. Right-click → context menu → NASA-flavored link detail panel (status, stale, confidence, position, ce/le, sensor, status-window strip, distance/points/Δ-status stats)

Pending (in CLAUDE.md priority):
1. **Notification store** — tap `AFFECTED_HISTORY` to emit toasts on transitions (`healthy → degraded`, `degraded → healthy`, etc.). Bottom-right stack, status-colored.
2. **AI recommender** — SSE stream, panel beside detail, action buttons that emit operator events back into the log.
3. **Event terminal** — bottom strip, monospace tail of all CoT events.
4. **Replay scrubber** — playhead store, filter all layers by `event.timestamp <= playhead`.

## What the user has ruled out

- Auth.
- Persistence beyond session.
- Mobile responsive.
- Settings/preferences.
- Affiliation as a concept (the type and HUD panel were removed — every track is treated as friendly).

## Dev

```bash
cd frontend && pnpm install
cp .env.example .env  # fill in VITE_MAPBOX_TOKEN
pnpm dev              # vite, http://localhost:5173
pnpm build            # tsc -b && vite build
```

Backend:
```bash
cd backend
cargo run --bin listener     # WS+HTTP :3000, UDP :9999
cargo run --bin sender       # OpenSky -> CoT XML to UDP :9999
```

Then in the frontend: toggle `Live` in the Data Source panel.
