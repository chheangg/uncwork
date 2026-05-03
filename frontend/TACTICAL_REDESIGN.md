# UNCWORK // C2 — TACTICAL REDESIGN SPECIFICATION

## DESIGN PHILOSOPHY: FUNCTIONAL BRUTALISM

**Aesthetic:** Militarized Windows 95 meets modern geospatial intelligence
**Palette:** Monochrome amber/green on dark gray/black (optional tactical mode)
**Typography:** Strictly monospaced, tabular numerals, grid-aligned
**Principle:** If a pixel isn't conveying critical telemetry, remove it

---

## METRICS

### Current UI Footprint
- Header: ~64px height
- Event Terminal: 600px × 200px (expandable to 500px+)
- Side Panels: 288px width each
- Footer: ~40px height
- **Total Non-Map Area:** ~850px vertical, 576px horizontal

### Target UI Footprint (40% reduction)
- Header: 32px height (-50%)
- Status Ticker: 24px height (replaces 200px+ terminal)
- Side Panels: 180px width (-37.5%)
- Footer: 20px height (-50%)
- **Total Non-Map Area:** ~510px vertical, 360px horizontal
- **Map Area Increase:** ~45% more visible map space

---

## COMPONENT REDESIGN

### 1. MISSION HEADER (64px → 32px)

**BEFORE:**
```
┌─────────────────────────────────────────────────────────────┐
│ ● UNCWORK  // C2  │ Mission │ AO │ DEFCON │ Tracks │ ...  │
│                    │ OVERWATCH│ EU │   3   │  042   │ ...  │
└─────────────────────────────────────────────────────────────┘
```

**AFTER (Tactical Shorthand):**
```
┌─────────────────────────────────────────────────────────────┐
│ ●UNCWORK//C2 │MSN:OVERWATCH│AO:EU│DC:3│TRK:042│CNF:87%│Z:1342│
└─────────────────────────────────────────────────────────────┘
```

**Changes:**
- Single line, 32px height
- Remove "Mission", "Tracks" labels → use codes (MSN, TRK, CNF, Z for ZULU)
- Condensed spacing (px-2 py-1)
- Pipe separators instead of borders
- Tabular nums, uppercase only

---

### 2. EVENT TERMINAL (600×200+ → Full-width 24px Ticker)

**BEFORE:**
- Collapsible panel, 600px wide, 200px+ tall
- Advanced filters with dimension/sensor dropdowns
- Scrollable log with timestamps

**AFTER (Single-Line Ticker):**
```
┌──────────────────────────────────────────────────────────────────────┐
│ 13:42:18 TRK A-042 STA:OK │ 13:42:19 DEL B-103 STALE │ 13:42:20 ... │
└──────────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Auto-scrolling horizontal ticker (24px height)
- Shows last 5-10 events in condensed format
- Click to expand full terminal (overlay modal, not persistent panel)
- Format: `HH:MM:SS TYPE UID STATUS`
- Color-coded by severity (green/yellow/red text)

---

### 3. SIDE PANELS (288px → 180px)

**Link Status Panel:**

**BEFORE:**
```
┌─────────────────────────┐
│ Link Status    042 total│
├─────────────────────────┤
│ Healthy                 │
│ 038        90%          │
│ ████████████████████░░  │
│                         │
│ Degraded                │
│ 003         7%          │
│ ███░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────┘
```

**AFTER:**
```
┌──────────────────┐
│ LNK STA    042   │
├──────────────────┤
│ OK  038 90% ████ │
│ DEG 003  7% █░░░ │
│ CRT 001  2% ░░░░ │
│ OFF 000  0% ░░░░ │
│ DLY 002  5% █░░░ │
└──────────────────┘
```

**Changes:**
- Width: 288px → 180px
- Labels: "Healthy" → "OK", "Degraded" → "DEG", "Critical" → "CRT", "Offline" → "OFF", "Delayed" → "DLY"
- Single-line per status with inline bar
- Condensed padding (px-2 py-1)
- Smaller font (9px)

---

### 4. LAYER TOGGLE PANEL

**BEFORE:**
```
┌─────────────────────────┐
│ Layers  press r to reset│
├─────────────────────────┤
│ ┌─────┐ ┌──────┐        │
│ │Links│ │Trails│        │
│ └─────┘ └──────┘        │
│ ┌───────┐ ┌─────────┐  │
│ │Heatmap│ │Buildings│  │
│ └───────┘ └─────────┘  │
│ ┌──────────────────┐   │
│ │   CRT Mode       │   │
│ └──────────────────┘   │
└─────────────────────────┘
```

**AFTER:**
```
┌──────────────────┐
│ LYR [R]          │
├──────────────────┤
│ [X]LNK [X]TRL    │
│ [ ]HTM [ ]BLD    │
│ [X]CRT           │
└──────────────────┘
```

**Changes:**
- Checkbox-style toggles: `[X]` = on, `[ ]` = off
- 3-letter codes: LNK, TRL, HTM, BLD, CRT
- 2-column grid, minimal spacing
- Remove "press r to reset" → just show [R]

---

### 5. LINK DETAIL PANEL (Tactical Telemetry)

**BEFORE:**
- Decorative corner brackets
- Animated scanline
- Verbose labels ("Callsign / UID", "Position", "Last Update")
- Large buttons: "[ ACK ]", "[ ESCALATE ]"

**AFTER:**
```
┌──────────────────┐
│ ●TEL A-042       │
├──────────────────┤
│ STA:OK CNF:87%   │
│ DEL:ONTIME       │
│ POS:42.3456N     │
│     13.7890E     │
│ ALT:1250m CE:45m │
│ SNS:RADAR DIM:AIR│
│ UPD:12s ago      │
│ ──────────────── │
│ PTS:42 DST:12km  │
│ ──────────────── │
│ [ACK] [ESC]      │
└──────────────────┘
```

**Changes:**
- Remove decorative elements (corner brackets, scanline)
- Condensed labels (STA, CNF, DEL, POS, ALT, SNS, DIM, UPD)
- Single-line data where possible
- Smaller buttons, text-only
- Width: 320px → 180px

---

### 6. FOOTER (40px → 20px)

**BEFORE:**
```
┌──────────────────────────────────────────────────────────────┐
│ AO 35.6789°N → 45.1234°N · 12.3456°E → 23.4567°E            │
│ Datum WGS84          [ R ] reset view    © Mapbox · OSM     │
└──────────────────────────────────────────────────────────────┘
```

**AFTER:**
```
┌──────────────────────────────────────────────────────────────┐
│ AO:35.68N-45.12N·12.35E-23.46E │ WGS84 │ [R] │ ©Mapbox·OSM │
└──────────────────────────────────────────────────────────────┘
```

**Changes:**
- Single line, 20px height
- Condensed coordinates (4 decimals → 2)
- Pipe separators
- Minimal padding

---

## TACTICAL COLOR SCHEME (Optional Mode)

### Current (Red/Amber Theme)
```css
bg: #0a0203 (near black with red tint)
fg: #ffd0d0 (pink-white)
accent: #ff3a3a (red)
green: #4ade80
yellow: #ffd166
```

### Tactical Amber Mode
```css
bg: #0a0a08 (near black with amber tint)
fg: #ffb000 (amber)
accent: #ff8800 (bright amber)
green: #00ff00 (pure green - for OK status)
yellow: #ffff00 (pure yellow - for warnings)
dim: #664400 (dark amber)
```

### Tactical Green Mode (Classic Terminal)
```css
bg: #000000 (pure black)
fg: #00ff00 (pure green)
accent: #00ff00 (pure green)
green: #00ff00
yellow: #ffff00
dim: #006600 (dark green)
```

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Compression (Immediate)
1. ✓ Header redesign (mission-header.tsx)
2. ✓ Footer redesign (footer-strip.tsx)
3. ✓ Side panel width reduction (app.tsx: w-72 → w-45)
4. ✓ Status summary condensation (status-summary.tsx)
5. ✓ Layer toggle condensation (layer-toggle-panel.tsx)

### Phase 2: Event Terminal Replacement
6. ✓ Create event-ticker.tsx (single-line scrolling ticker)
7. ✓ Create event-terminal-modal.tsx (overlay for full log)
8. ✓ Replace EventTerminal in app.tsx

### Phase 3: Detail Panel Optimization
9. ✓ Link detail panel condensation (link-detail-panel.tsx)
10. ✓ Remove decorative elements

### Phase 4: Tactical Color Modes
11. ✓ Add color mode toggle to layers store
12. ✓ Create tactical color variants in tailwind.config.js
13. ✓ Apply conditional classes throughout

---

## TYPOGRAPHY RULES

### Strict Monospace Enforcement
- All text: `font-mono`
- All numbers: `tabular-nums`
- All labels: `uppercase tracking-widest`
- Font sizes: 9px (labels), 10px (data), 11px (emphasis)

### Grid Alignment
- Use fixed-width columns for data
- Pad numbers with leading zeros: `042` not `42`
- Align decimals in tables
- Use pipe separators: `│` not borders

---

## BORDER & SPACING RULES

### Borders
- Default: 1px solid
- No shadows except critical alerts (status:critical, stale data)
- No rounded corners (border-radius: 0)
- Use ASCII box-drawing characters where appropriate

### Spacing
- Padding: px-2 py-1 (default), px-1 py-0.5 (compact)
- Gaps: gap-1 (4px), gap-2 (8px) maximum
- Line height: leading-tight (1.25) or leading-none (1)

---

## CRT EFFECTS

### Keep
- Scanline overlay (subtle, 3px repeat)
- Vignette (radial gradient from center)
- Slight glow on accent color

### Remove
- Blur effects
- Heavy shadows
- Animated scanlines on individual panels

---

## ACCESSIBILITY NOTES

- Maintain 4.5:1 contrast ratio minimum
- Provide text alternatives for color-coded status
- Ensure keyboard navigation works
- Add ARIA labels to condensed controls

---

## TESTING CHECKLIST

- [ ] Measure actual map viewport increase (target: 45%+)
- [ ] Verify readability at 1920×1080, 2560×1440, 3840×2160
- [ ] Test with 100+ tracks (performance)
- [ ] Validate all data still accessible (no information loss)
- [ ] Check color modes for accessibility
- [ ] Test keyboard shortcuts
- [ ] Verify mobile/tablet behavior (if applicable)

---

## MOCKUP COMPARISON

### Before (Current)
```
┌────────────────────────────────────────────────────────────────┐
│ ● UNCWORK // C2 │ Mission │ AO │ DEFCON │ Tracks │ Conf │ ZULU│ 64px
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────┐                              ┌──────────┐         │
│ │ Data Src │                              │ Type Lgd │ 288px   │
│ │ Layers   │      MAP VIEWPORT            │          │         │
│ │ Link Sta │                              │          │         │
│ └──────────┘                              └──────────┘         │
│                                                                 │
│                                     ┌────────────────┐         │
│                                     │ Event Terminal │ 200px   │
│                                     │ [filters...]   │         │
│                                     └────────────────┘         │
├────────────────────────────────────────────────────────────────┤
│ AO: coords... │ Datum │ [R] reset │ © Mapbox                  │ 40px
└────────────────────────────────────────────────────────────────┘
```

### After (Tactical)
```
┌────────────────────────────────────────────────────────────────┐
│ ●UNCWORK//C2│MSN:OW│AO:EU│DC:3│TRK:042│CNF:87%│Z:1342│        │ 32px
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────┐                                        ┌──────┐       │
│ │ SRC  │                                        │ TLMT │ 180px │
│ │ LYR  │         MAP VIEWPORT                   │      │       │
│ │ LNK  │         (45% LARGER)                   │      │       │
│ └──────┘                                        └──────┘       │
│                                                                 │
│                                                                 │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ 13:42:18 TRK A-042 OK│13:42:19 DEL B-103 STALE│13:42:20 ...   │ 24px
├────────────────────────────────────────────────────────────────┤
│ AO:35.68N-45.12N·12.35E-23.46E│WGS84│[R]│©Mapbox·OSM          │ 20px
└────────────────────────────────────────────────────────────────┘
```

**Result:** Map viewport increases from ~60% to ~85% of screen space.
