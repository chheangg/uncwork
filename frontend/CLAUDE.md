# Frontend — UncWork C2

Hackathon C2 ops console. Terminal/defense aesthetic, red theme. Map-first, single screen, no auth, desktop only.

## What this app does

Renders a 3D Mapbox map of an AO (currently SF, ±100mi). Tracks (sensors / drones / vehicles) appear as elevated icons with status badges, fading dashed trails, status-colored poles, status+confidence badges, and an optional confidence heatmap that auto-blooms when zoomed out. Three data sources toggleable: **Mock** (fake CoT generator), **Live** (real ADS-B via backend WebSocket), **Off** (no data).

## Stack

- React 18 + Vite + TypeScript (strict)
- Tailwind 3 with `terminal-*` red palette
- Zustand for cross-feature state
- **Mapbox GL JS** v3 base map (DEM terrain enabled), **deck.gl** v9 layers stacked on top via `<DeckGL>` parent + `<Map>` child
- **react-map-gl** v7 default Mapbox export
- **react-icons/gi** (game-icons.net) for tactical silhouettes
- **react-dom/server** `renderToStaticMarkup` to bake icons into SVG data URIs at module init
- pnpm

Bundle ~3MB total minified, ~790KB gzipped (mapbox is the biggest chunk).

## Architecture (React Bulletproof flavor)

```
src/
  app.tsx                  # composition root: hooks, layer memos, HUD layout
  main.tsx
  styles/globals.css       # tailwind + CRT scanline overlay
  config/
    constants.ts           # PRESET_VIEW, PRESET_BBOX, MISSION, HEATMAP_MAX_ZOOM
    env.ts                 # mapbox token, style url, api host, wsUrl helper
  types/
    cot.ts                 # Affiliation, Dimension, LinkStatus, SensorType, CotEvent
  lib/                     # generic helpers
    cn.ts
    cot.ts                 # parseAffiliation, parseDimension, computeStatus,
                           # computeConfInt, enrichCot
    sensor.ts              # SENSORS_BY_DIMENSION, sensorLabel, sensorFullName
  stores/
    events.ts              # uid->CotEvent map, upsertMany/clear
    data-source.ts         # 'mock' | 'live' | 'off'
    layers.ts              # toggles: links / trails / heatmap / buildings + crt
    view-state.ts          # mapbox viewState (lng/lat/zoom/pitch/bearing)
  mock/
    fake-cot.ts            # seedTracks / stepTrack / emitFromTrack
                           # friendly-only COT_TYPES, sensor pool per dim,
                           # health-driven smooth state (ce/le/stale derived)
  components/ui/           # Toggle, Panel
  features/
    data-source/
      hooks/use-mock-feed.ts    # 28 tracks @ 2.5s tick
      hooks/use-live-feed.ts    # WebSocket /ws -> CotEvent stream, auto-reconnect
      components/data-source-toggle.tsx
    map/
      lib/map-style.ts          # ensureTerrain, ensureBuildingLayer, setBuildingVisibility
      components/map-view.tsx   # DeckGL parent, Map child, R-key reset
      components/layer-toggle-panel.tsx
    links/
      lib/icons.ts              # buildSvg(dim, status, recovery) -> data URI,
                                # cache key (dim:status:rec/norm)
      lib/link-style.ts         # statusColor (RGBA per LinkStatus)
      lib/build-link-layers.ts  # LineLayer pole + IconLayer + TextLayer label;
                                # animated alpha by status (sin flicker for
                                # degraded/critical, dim for stale/offline)
      hooks/use-affected-augment.ts # 30s recently-affected memory per uid
    heatmap/
      lib/build-heatmap-layer.ts # HeatmapLayer (pixel-radius, gradient ramp)
    trails/
      hooks/use-track-history.ts # rolling 36s history per uid
      hooks/use-animated-seconds.ts # ~30Hz currentTime via setInterval
      lib/build-trails-layer.ts  # buildTrailsLayers returns [PathLayer dashed
                                # history, TripsLayer fading head]
    hud/
      components/mission-header.tsx
      components/status-summary.tsx
      components/affiliation-summary.tsx
      components/type-legend.tsx
      components/footer-strip.tsx
      hooks/use-utc-clock.ts
      lib/aggregate.ts           # countByStatus, countByAffiliation, meanConfidence
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
  affiliation: Affiliation;   // parsed from cotType[1]
  dimension: Dimension;       // parsed from cotType[2]
  sensorType: SensorType;     // sensor platform (radar/sonar/eo_ir/...)
  time: string; start: string; stale: string;
  lat: number; lon: number; hae?: number;
  ce?: number; le?: number; remarks?: string;
  // derived
  confInt: number;            // 0..1, decays with stale-age + ce/le
  status: LinkStatus;         // healthy | degraded | critical | stale | offline
};
```

Affiliation is parsed but the app filters to **friendly only** in mock; live ADS-B is forced to `a-f-A-C-F` (friendly civil air) so the demo stays "track only friendly".

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
- Puts `flight_number` in front of `remarks`.
- `enrichCot` derives status + confInt the same way as mock.
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
- **Icon** (`IconLayer`): elevated by dimension (air 220m, space 360m, sof 60m, ground 25m, surface 10m, subsurface 5m, other 25m). Anchored at bottom. Bigger and brighter at high `confInt` (size 38–56, alpha 0.45–1.0). Animated alpha:
  - degraded: `base × (0.55 + 0.45 × sin(t·4 + uidHash))` — flicker
  - critical: `base × (0.4 + 0.5 × sin(t·5.6 + uidHash))` — faster, deeper
  - stale: `base × 0.55` — dim
  - offline: pinned to `0.3`
- **Status badge** (top-right of icon SVG, baked in): warning ▲ (yellow degraded / red critical) · clock (stale) · X (offline) · ✓ (recovery — for 30s after returning to healthy).
- **Label** (`TextLayer`): `RDR 82%` floating ~42px above icon. Status-colored background, white text with black outline.
- **Trail** = two layers: dashed `PathLayer` (full history, dim, `[8, 5]` dash via `PathStyleExtension`) + `TripsLayer` (fading head, last 30s, no dash, bright). Combine: dashed history with a glowing recent end.
- **Heatmap**: `HeatmapLayer` gradient (transparent → green → yellow → red), pixel-radius. Only shown when `zoom < HEATMAP_MAX_ZOOM`.
- **Buildings**: Mapbox composite source with `extrude == true` filter, dark red ramp, zoom-interpolated height. Toggleable.
- **Terrain**: Mapbox DEM (`mapbox-terrain-dem-v1`), exaggeration 1.6.
- **CRT overlay**: red scanlines, vignette. Toggleable.

## Stores (Zustand)

- `useEventStore` — `Record<uid, CotEvent>`. `upsertMany`, `remove`, `clear`. `selectEventList` returns `Object.values()`.
- `useDataSourceStore` — `'mock' | 'live' | 'off'`. Live/Mock hooks check this and start/stop accordingly.
- `useLayersStore` — `visible.{links,trails,heatmap,buildings}` + `crt`. `toggle(key)`, `set(key, val)`, `toggleCrt`.
- `useViewStateStore` — viewState driven by deck.gl controller, read by App for zoom-gated heatmap.

## Animation pattern

`useAnimatedSeconds(33)` returns a `Date.now()/1000` timestamp updated every 33ms. Used as:
- `currentTime` for `TripsLayer` fadeTrail (path positions interpolated by GPU).
- input to `statusAlpha()` in icon layer for sin-based flicker.

App rebuilds the icon and trail layers ~30Hz; `useMemo` deps include `currentTime`. Other layers (heatmap, pole, label) memoize on `events` only.

## Conventions

- Files: `kebab-case.ts(x)`. Components: `PascalCase`. Hooks: `useCamelCase`. Stores: `useThingStore`.
- Strict TS, no `any`. `unknown` + narrowing at boundaries. Two known unavoidable casts: `PathStyleExtension` props on `PathLayer`/`TripsLayer` (extension props aren't in the layer type). Cast via `as unknown as ConstructorParameters<typeof X>[0]`.
- No comments unless they explain a non-obvious *why*. Don't narrate code.
- Reach for `useMemo` only when the computation is meaningful or the result is used as a dep.
- `updateTriggers` are required when a deck.gl `getX` accessor depends on data that changes between renders without the data array reference changing — e.g. `getIcon` reading `event.status` (for the badge cache hit) needs `updateTriggers.getIcon` to bust the GPU cache.
- Stale CSS classes: prefer `panel`, `label`, `stat`, `panel-hot` defined in `globals.css`.

## Hackathon priorities (current)

Built (in order):
1. 3D map + pitched view + R-reset
2. Mock CoT pipeline with smooth health-driven state
3. Pole + icon + status badge + label + animated alpha
4. Status summary, affiliation summary, type legend, mission header, footer
5. CRT mode, terrain, building injection
6. 30s dashed trails + recovery badge (✓ for 30s after a status incident clears)
7. Live feed via WebSocket /ws (this commit)

Pending (in CLAUDE.md priority):
1. **Notification store** — tap `AFFECTED_HISTORY` to emit toasts on transitions (`healthy → degraded`, `degraded → healthy`, etc.). Bottom-right stack, status-colored.
2. **Click → side panel** — pickable IconLayer; show event detail (uid, callsign, sensor, full CoT type, ce/le, remarks).
3. **AI recommender** — SSE stream, panel beside detail, action buttons that emit operator events back into the log.
4. **Event terminal** — bottom strip, monospace tail of all CoT events.
5. **Replay scrubber** — playhead store, filter all layers by `event.timestamp <= playhead`.

## What the user has ruled out

- Auth.
- Persistence beyond session.
- Mobile responsive.
- Settings/preferences.
- Hostile/unknown affiliations on the map (friendly only — civil air is forced to friendly).

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
