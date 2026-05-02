# Frontend — UncWork C2

Hackathon C2 ops console. Terminal/defense aesthetic. Map-first.
Backend speaks **CoT (Cursor on Target) XML over UDP** — frontend treats it as a normalized stream of `CotEvent` records (see `src/types/cot.ts`).

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS (terminal/CRT theme tokens in `src/styles/globals.css`)
- Zustand for cross-feature state (data source, layers, map view, playhead)
- MapLibre GL JS as base map, deck.gl layers stacked on top
- Lucide for icons
- pnpm

## Project structure (React Bulletproof flavor)

```
src/
  app.tsx                 // single-screen composition root
  main.tsx
  styles/globals.css
  config/                 // env, constants (preset bbox, theme tokens)
  types/                  // shared data contracts (CotEvent, derived enums)
  lib/                    // generic utils with no domain knowledge (cn, time, color)
  stores/                 // zustand stores shared across features
  mock/                   // fake-data generators (off by default, toggleable)
  components/ui/          // reusable presentational primitives (Button, Toggle, Panel)
  features/<feature>/
    components/           // feature-scoped React components
    hooks/                // feature-scoped hooks
    lib/                  // feature-scoped pure helpers
    index.ts              // public surface (re-exports only)
```

**Rules**

1. Features never import from each other's internals — only from the feature's `index.ts`.
2. If a helper is used in 2+ features, lift it to `src/lib`. If a component is used in 2+ features, lift it to `src/components/ui`.
3. Stores live in `src/stores` only when state is truly cross-feature. Feature-local state stays in the feature.
4. Types in `src/types` are the contract. Feature-internal types stay in the feature.
5. No barrels except `features/<x>/index.ts`. Avoid re-export pyramids.

## Naming

- Files: `kebab-case.ts(x)`. One default-exported component per file is fine, but prefer named exports for tree-shake and refactor stability.
- Components: `PascalCase`. Hooks: `useCamelCase`. Stores: `useThingStore`.
- Type files: `*.ts`, no `.types.ts` suffix. Tests: `*.test.ts(x)` colocated.

## Code quality

- Read like prose. If a comment is needed to explain *what*, rename instead. Comments only for *why* (non-obvious constraint, workaround, invariant).
- Small files. If a component is past ~150 lines, split it.
- No premature abstraction; three similar lines beat a wrong abstraction. Lift on the third occurrence, not the first.
- Strict TS. No `any`. Prefer `unknown` + narrowing at boundaries.
- One source of truth per piece of state. Derived data is computed, not stored.

## Data contracts (locked)

The backend currently emits TAK-style CoT events. The frontend layer normalizes those into a single shape:

```ts
type CotEvent = {
  uid: string;
  cotType: string;           // raw, e.g. "a-f-G-U-C"
  affiliation: Affiliation;  // parsed from cotType[2]
  dimension: Dimension;      // parsed from cotType[4]
  time: string;              // ISO
  start: string;             // ISO
  stale: string;             // ISO
  lat: number;
  lon: number;
  hae?: number;              // height above ellipsoid (m)
  ce?: number;               // circular error (m)
  le?: number;               // linear error (m)
  remarks?: string;
  // derived
  confInt: number;           // 0–1, derived from staleness + ce/le
  status: LinkStatus;        // 'healthy' | 'degraded' | 'critical' | 'stale' | 'offline'
};
```

The legacy `Link` / `Event` / `Recommendation` shapes from `FRONTEND_REQUIREMENTS.TSX` are superseded — `CotEvent` is the single ground truth. Recommendations and operator-side events stay separate (added when those features land).

## Hackathon priorities (now → later)

1. **Now (built)** — 3D map, link icons, confidence heatmap, mock-vs-live toggle.
2. **Next** — side panel on click, AI recommender stream, event terminal.
3. **Later** — replay scrubber, geofence, Cmd+K, scrub-to-predict.

Build for swap. Mocks behind a single store flag. Layers behind feature-local toggles. The map/layer split means we can drop in real CoT-over-WebSocket without touching layer code.

## Dev

```bash
pnpm i
pnpm dev      # vite, http://localhost:5173
pnpm build
pnpm preview
```

## Env

`VITE_MAP_STYLE_URL` — MapLibre style URL. Defaults to a free demo style; swap for MapTiler/Mapbox if available.
