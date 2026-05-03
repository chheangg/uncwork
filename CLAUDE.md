# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with three top-level pieces:

- `frontend/` — React 18 + Vite + TypeScript C2 ops console (Mapbox + deck.gl). See `frontend/CLAUDE.md` for the full architecture, data contract, layer-by-layer visual spec, and store list.
- `backend/` — Rust workspace (axum + tokio) with two binaries:
  - `listener` — UDP CoT ingest on `:9999`, HTTP+WebSocket on `:3000`. Parses CoT XML, dedupes, tracks per-sender trust EMA + neighbor drag, and broadcasts JSON to `/ws` subscribers.
  - `sender` — Pulls ADS-B from OpenSky (or replays the `*.ndxml` scenario files at the repo root), wraps as CoT XML, and emits to `udp://127.0.0.1:9999` from multiple simulated units (`unit_a`/`b`/`c`) with per-unit chaos profiles (drop / dup / corrupt / reorder).
  - `main.rs` is a stub — both real entry points are under `src/bin/`.
- `scripts/` — Local + ngrok demo bootstrappers (`local.sh`, `deploy.sh`).
- `*.ndxml` (repo root) — Scripted scenario streams (Donetsk-area: 3 friendly ground units, 1 friendly fixed-wing, 2 hostile UAVs) consumed by `sender`. `interactive_multi_asset.ndxml` is the larger composite scenario.

## How the pieces wire together

```
ndxml files / OpenSky  →  sender  ──UDP CoT XML──▶  listener  ──WS JSON──▶  frontend
                            (chaos)               (dedupe, trust)            (deck.gl)
```

- The frontend posts its current map bbox to `POST /viewport` so the sender can scope OpenSky queries to what's actually visible.
- The listener tags every outbound message with an `effective_score` (raw EMA dragged toward the worst neighbor inside `NEIGHBOR_RADIUS_MILES = 5mi`).
- Each ground unit in the scripted scenario doubles as the transmitter for a track in the air: unit C transmits the two UAVs, unit B transmits the friendly fixed-wing.

## Common commands

### Run the full stack locally

```bash
./scripts/local.sh        # builds backend release, starts listener + sender + vite
./scripts/deploy.sh       # same + two ngrok tunnels for a public demo
```

Both expect `frontend/.env` to exist with `VITE_MAPBOX_TOKEN` set, free ports `3000 / 9999 / 5173`, and pipe component logs to `scripts/logs/{listener,sender,cargo,ngrok}.log`.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev          # vite on http://localhost:5173
pnpm build        # tsc -b && vite build
pnpm typecheck    # tsc --noEmit
```

There is no test or lint script wired up in `package.json`.

### Backend

```bash
cd backend
cargo run --bin listener    # WS+HTTP :3000, UDP :9999
cargo run --bin sender      # scenario / OpenSky → CoT XML to UDP :9999
cargo build --release --bins
cargo test                  # currently no tests defined
```

`cargo fmt` / `cargo clippy -- -D warnings` apply per the global Rust rules.

## Wire format (listener → frontend)

`/ws` streams one JSON object per CoT frame. Numeric fields arrive as **strings** — the frontend converts them in `useLiveFeed`. The boolean `stale` axis on the frontend is **derived** from `staleAt` vs. `now`, not sent on the wire.

```jsonc
{
  "uid": "unit_a-ICAO-...",
  "cot_type": "a-u-A-C-F",
  "time": "ISO", "start": "ISO", "stale": "ISO",   // wire timestamps
  "lat": "37.x", "lon": "-122.x", "hae": "...",     // strings
  "flight_number": "AAL123",
  "remarks": "unit=unit_a callsign=AAL123 seq=42",
  "source": "127.0.0.1:9001",
  "trust_score": 0.83,                               // effective EMA after neighbor drag
  "sensor_lat": 37.77, "sensor_lon": -122.4
}
```

The frontend overrides `cotType = "a-f-A-C-F"` (friendly civil air) and `sensorType = "adsb"` for live frames — affiliation is hard-coded friendly throughout (see `frontend/CLAUDE.md` → "Data contract").

## Things to know before changing the listener

- Dedupe is keyed by `(uid, time)` so legitimate position updates pass through; only retransmits of the exact same frame are dropped.
- Trust EMA constants live as module-level `const`s (`TRUST_ALPHA`, `QUALITY_*`, `DECAY_*`, `NEIGHBOR_*`). Decay only kicks in after 20 s of silence.
- Sequence gaps are detected from `seq=N` inside `<remarks>`, written by the sender. Keep that contract intact when adding new senders.
- `parse_cot` rejects messages whose `lat`/`lon` aren't valid `f64` — corruption that mangles attribute names ("lat" → "lXt") would otherwise serialize as JSON `null` and render at (0,0).

## Things to know before changing the frontend

The frontend has its own detailed `CLAUDE.md` covering architecture rules, store boundaries, the two-axis status/stale model, and the per-layer visual contract. Read that file before changing anything under `frontend/src/`. Do not duplicate that content here.

## Env

```
VITE_MAPBOX_TOKEN=pk.your_mapbox_public_token_here
VITE_MAP_STYLE_URL=mapbox://styles/mapbox/dark-v11
VITE_API_HOST=localhost:3000
```

Lives in `frontend/.env` (gitignored). `.env`, `.env.*` (except `.env.example`), `target/`, `node_modules/`, and `dist/` are all ignored at the root.
