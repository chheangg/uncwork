# UncWork C2 — Frontend Spec v2

## Summary

A C2 system that fixes most C2 systems. It knows when links are degraded, presents you concise information, and narrows your choices to the actions that matter. No more ambiguity — fact-and-AI-driven decision making, with a replayable event log so we can prove to judges (and to ourselves) exactly what happened and when.

Stack at a glance (details live inside each feature): **React 18 + Vite + TS, Tailwind + shadcn/ui, Zustand, MapLibre GL JS + deck.gl, Lucide, Vercel deploy.** No Electron — it's a 17hr hackathon, we want a URL judges can open from their phone.

## Shared Data Contracts (lock with backend at hour 0)

These three shapes power every feature below. Every feature consumes them, no feature owns them. If we agree on these in the first 30 minutes, frontend never blocks backend and backend never blocks me.

```ts
type Link = {
  id: string;
  type: "defense" | "detection" | "offense" | "recon_mobile" | "recon_static";
  status: "healthy" | "degraded" | "critical" | "offline";
  conf_int: number; // 0-1
  lat: number;
  lng: number;
  alt?: number;
  metadata: Record<string, unknown>;
  updated_at: string; // ISO
};

type Event = {
  id: string;
  timestamp: string; // ISO
  link_id: string;
  event_type: string; // 'status_change' | 'detection' | 'recommendation' | ...
  payload: Record<string, unknown>;
};

type Recommendation = {
  id: string;
  link_id: string;
  action: string; // 'engage' | 'monitor' | 'reroute' | ...
  probability: number; // 0-1
  rationale: string; // streamed text
  conf_int: number;
};
```

## Features

### 1. 3D Map System

The base layer everything renders on. Real-world buildings, trees, elevation in 3D.

1. Description
   1. Tilted/perspective camera by default (not flat top-down) so 3D actually pops.
   2. Buildings extruded from OpenStreetMap data, terrain from MapTiler / OpenFreeMap tiles.
   3. Users locked to a preset bounding box for the demo, so nobody can pan to Antarctica mid-judging. Hotkey to reset view.
   4. Pickable objects everywhere — click anything to focus it.
2. Notes
   1. MapTiler's free tier ships 3D building tiles. No Mapbox token, no paywall.
   2. deck.gl layers stack on top of MapLibre and share the same camera, so 3D parallax just works for free.
   3. Hour 0–1 spike: get a deck.gl IconLayer + HexagonLayer rendering on MapLibre. If the GPU stack is broken on the demo laptop, I want to know at hour 1, not hour 14.
   4. Risk: 3D building tiles look bad in our chosen AO. Fallback is flat MapLibre with extruded heatmap doing the 3D heavy lifting. Still looks great.
3. Library
   1. **MapLibre GL JS** (free Mapbox fork) + **deck.gl** (layers).
   2. Backup: pure Mapbox if free tile aesthetics look ugly. Token's fine for a demo.
   3. Why not locked-in: deck.gl renders on top of any base map (MapLibre, Mapbox, Google), so swapping the base layer is a one-liner.
4. Mini features
   1. Day/night terrain toggle.
   2. Layer toggles (buildings on/off, terrain on/off, heatmap on/off).
   3. Geofence drawing — operator draws a polygon, all events/links inside get filtered downstream. Uses deck.gl EditableGeoJsonLayer.
   4. CRT/phosphor theme toggle — amber-on-black retro mode. Useless. Looks insane on the projector. Worth it.
   5. `?layout=ops-center` URL param splits map / panel / terminal across three browser windows for multi-monitor demos. Looks like NASA.

### 2. Edge-Link Status Indicators

Icons on the map representing every sensor/asset, color and shape coded to status. Click → drill down. AI narrows the action choices so the operator isn't paralyzed at 3am.

1. Description
   1. One icon per Link. Shape = type (defense/detection/offense/recon_mobile/recon_static). Color = status (green/yellow/red/grey).
   2. Pulse animation on degraded/critical so the eye catches them across a dense map.
   3. Click → side panel slides in with full details + action buttons.
   4. Action buttons are pre-narrowed by the AI Recommender (Feature 3) — no scrolling through 40 options at 3am.
   5. Works for every Link type in the data contract: defense sensors, detection sensors, offense sensors, mobile and static recon. Anything new = add an enum value, no UI rewrite.
2. Notes
   1. Render via deck.gl IconLayer for performance — handles 10k+ markers without dying.
   2. Status enum is intentionally loose. We can add `maintenance`, `compromised`, etc. without breaking anything.
   3. Acknowledge / escalate actions write back into the Event stream, so the Event Terminal (sub-feature of #3) automatically shows operator decisions alongside system events. No extra wiring.
   4. Confidence-aware UI: low-confidence elements visually pulsate or blur slightly. Makes uncertainty _felt_, not just shown.
3. Library
   1. deck.gl IconLayer for the icons.
   2. shadcn/ui Sheet for the slide-in panel.
   3. Lucide for the icon set (military-ish glyphs available, easy to swap).
   4. Why not locked-in: shadcn copies components into our repo rather than installing as a dep. We can rip them out feature by feature.
4. Mini features
   1. Right-click → quick-action radial menu (skip the panel for fast ops).
   2. Bulk select (drag a box) → batch action on multiple links.
   3. Acknowledge / escalate buttons that route into the event log.
   4. Audio cues — subtle beep on critical status changes, soft tone when AI finishes recommending. Web Audio API, ~20 lines.
   5. Cmd+K command palette — every action behind a fuzzy search. Makes us look like a real ops tool, not a webapp.

### 3. AI Recommender (with heatmap, replay, and event terminal)

Reads link health + confidence interval + context, recommends actions with rationale. This feature is bigger than the other two — the heatmap, the replay, and the terminal log all live here because they all consume the same AI/event stream and they don't make sense without it.

1. Description
   1. Live panel that updates as the selected link's data updates.
   2. Format: "Engage (10% conf) — sensor reports degraded, last 3 events show signal drift, recommend hold + recon."
   3. Streams the rationale token-by-token so the operator sees the AI thinking. Huge for judges.
   4. Each recommendation = a clickable action that fires the corresponding flow and writes an Event back to the log.
2. Notes
   1. Backend hands us a streaming SSE endpoint. We render whatever comes through.
   2. Don't try to be smart on frontend — pass through the rationale as-is. Let the model's reasoning be the show.
   3. The recommender is dumb on the frontend by design. Model swaps, new tools, new prompts are purely a backend change. We never have to ship for that.
   4. Risk: backend SSE not ready by hour 4. Mitigation: keep a `mockStream()` util that emits canned tokens, so the AI panel works against fake streams until backend lands.
3. Library
   1. Vercel AI SDK (`useChat` hook) — handles streaming, partial messages, retries.
   2. Or native `EventSource` if we want zero deps.
   3. Why not locked-in: both options just consume an SSE endpoint. Backend can swap models, providers, or even framework without us caring.
4. Mini features
   1. **Confidence Heatmap Overlay**
      1. Spatial heatmap showing where confidence is high/low across the AO.
      2. Toggle: "all links" view (aggregate confidence across the whole map) vs "single link type" view (just defense, just recon, etc).
      3. 3D extruded hex bins for the wow factor — flat heatmaps look 2010.
      4. Library: deck.gl HexagonLayer (3D extruded) or HeatmapLayer (flat).
      5. Sub-mini features: slider to filter by threshold ("show me only sub-50%"), color ramp toggle (plasma / viridis / red-green for color-blind).
      6. Zero new backend work — consumes the same `Link.conf_int` field every other feature reads.
   2. **Time-Series Replay (NO FAKING)**
      1. The killer feature. Scrub through any past event window and watch the system play out.
      2. Video-player UI at the bottom of the screen: play/pause, scrubber, 1x/10x/100x speed.
      3. Holds a "playhead" timestamp in Zustand. All map layers + log + AI panel filter to `event.timestamp <= playhead`.
      4. Replay is _deterministic_ — same event log, same playback every time. Not faking, re-rendering reality.
      5. Demo move: "let us replay last Tuesday's incident" → judges watch the system react in real time.
      6. Library: Zustand for the playhead store, deck.gl TripsLayer for animated path data (drone tracks, vessel routes), native `<input type="range">` for the scrubber.
      7. Validated pattern, 100% works. Same approach as Kepler.gl, Uber Movement, election-night maps.
      8. Sub-mini features:
         1. **Scrub-to-predict** — drag the playhead INTO the future, AI projects what happens next on the map. Maximum wow. Probably nobody else at the hackathon will have this.
         2. Bookmarks — operator pins moments in the timeline ("here's where it went sideways").
         3. Export — dump the current view as a screenshot or short MP4 for after-action reports.
      9. Risk: replay perf with lots of events. Mitigation: if >5k events, pre-bucket by minute on load and only re-filter the current bucket on playhead tick.
   3. **Event Terminal**
      1. Live-tailing terminal-style log of every event in the system. Proof for judges.
      2. Bottom-right pane, monospace, auto-scrolling, tail-follows-output.
      3. Each line: `[timestamp] [link_id] [event_type] [summary]`.
      4. Filterable by event type, link type, severity.
      5. Replay-aware: when you scrub the timeline, the terminal rewinds with you. No extra logic — it reads from the same playhead-filtered Event stream.
      6. Library: plain React + Tailwind. xterm.js is overkill — a styled `<div>` with a `<pre>` is enough. Drop in `react-window` only if log exceeds ~1000 lines.
      7. Sub-mini features: click a log line → map flies to that link and panel opens, color-coded severity, copy-as-markdown for instant post-incident reports.
   4. **"Why?" expansion** on each rec → shows the full chain of evidence (which events, which links, which conf_ints fed the recommendation).
   5. **Reject / override** button — when operator disagrees with the AI, that goes into the event log too. Replay-able. Trainable. Auditable.
   6. **Confidence as a visual bar**, not just a number. Pairs with the heatmap so the same color encoding shows up everywhere.

## What I'm NOT Building (explicit cut scope)

So nobody asks me at hour 12.

1. Auth / login. Demo only.
2. Real persistence. Backend's session-only data is fine.
3. Mobile responsive. Desktop ops tool.
4. Settings / preferences. Sensible defaults, hotkey to reset view.

## Hour-by-Hour Sanity Check

Rough ordering so I know if I'm behind. 11pm start, 4pm end, 17 hours.

1. **H0–1**: Repo bootstrap (Vite + React + TS + Tailwind + shadcn). deck.gl + MapLibre spike with one IconLayer and one HexagonLayer. Lock data contracts with backend.
2. **H1–4**: Feature 1 (3D map, preset bbox, building extrusion, basic theme).
3. **H4–8**: Feature 2 (Link icons, status colors, side panel, action buttons wired to mock data).
4. **H8–12**: Feature 3 core (AI panel with streaming, event terminal, heatmap overlay).
5. **H12–15**: Replay system (playhead store, scrubber UI, layer filtering, deterministic playback).
6. **H15–16**: Wow features (Cmd+K, audio cues, scrub-to-predict, CRT toggle, geofence).
7. **H16–17**: Demo polish, deploy to Vercel, write the 3-minute pitch script with my team.

If I'm behind at H8 I cut wow features ruthlessly. If I'm behind at H12 I cut scrub-to-predict. The replay itself is non-negotiable — it's our differentiator.