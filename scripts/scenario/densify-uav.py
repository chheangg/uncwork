#!/usr/bin/env python3
"""Densify joey's UAV ndxml files for smoother visual motion at 1 Hz.

Joey's files (from baa079b) have 40 frames spanning ~5 minutes of
scenario time, which means ~7.3s of motion per frame. The sender
emits at 1 Hz, so each visible step jumps ~140m on the map -- the
operator perceives the UAV as teleporting rather than flying.

This script reads each UAV file, linearly interpolates DENSIFY_FACTOR
sub-frames between every original waypoint, and rewrites the file.
ALSO rewrites the cotType to `a-h-A-M-F-Q` so the milsymbol output
renders as a hostile (enemy) air military fixed-wing UAV instead of
the original `a-u-S-UAV` (unknown sea-surface).

Run from the repo root:
  python3 scripts/scenario/densify-uav.py
"""

import re
from pathlib import Path

DENSIFY_FACTOR = 5
NEW_COT_TYPE = "a-h-A-M-F-Q"

UAV_FILES = ["uav-hostile-01.ndxml", "uav-hostile-02.ndxml"]
REPO_ROOT = Path(__file__).resolve().parents[2]


EVENT_RE = re.compile(
    r'<event[^>]*\buid="([^"]+)"[^>]*\btype="([^"]+)"[^>]*'
    r'\btime="([^"]+)"[^>]*\bstale="([^"]+)"[^>]*>'
    r'<point\s+lat="([^"]+)"\s+lon="([^"]+)"\s+hae="([^"]+)"\s*/>'
    r'(<detail>.*?</detail>)\s*</event>',
)


def parse_iso(s):
    # 2026-05-02T12:04:52Z  -> seconds since 12:00:00
    h = int(s[11:13]); m = int(s[14:16]); sec = int(s[17:19])
    return (h - 12) * 3600 + m * 60 + sec


def fmt_iso(seconds):
    seconds = max(0, int(round(seconds)))
    h = 12 + seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"2026-05-02T{h:02d}:{m:02d}:{s:02d}Z"


def densify(path):
    raw = path.read_text()
    events = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = EVENT_RE.search(line)
        if not m:
            print(f"  skipped (no match): {line[:80]}")
            continue
        events.append({
            "uid": m.group(1),
            "time": parse_iso(m.group(3)),
            "stale_offset": parse_iso(m.group(4)) - parse_iso(m.group(3)),
            "lat": float(m.group(5)),
            "lon": float(m.group(6)),
            "hae": float(m.group(7)),
            "detail": m.group(8),
        })

    if not events:
        print(f"  no events found in {path.name}")
        return

    out_lines = []
    n = len(events)
    for i in range(n):
        cur = events[i]
        nxt = events[(i + 1) % n]
        # how many ticks of scripted scenario time between cur and nxt?
        # for the wrap-around (last->first) we just step 1 unit so the
        # loop seam isn't a giant jump.
        if i == n - 1:
            dt = 1
        else:
            dt = max(1, nxt["time"] - cur["time"])
        for k in range(DENSIFY_FACTOR):
            u = k / DENSIFY_FACTOR
            lat = cur["lat"] + (nxt["lat"] - cur["lat"]) * u
            lon = cur["lon"] + (nxt["lon"] - cur["lon"]) * u
            hae = cur["hae"] + (nxt["hae"] - cur["hae"]) * u
            t_s = cur["time"] + dt * u
            stale_s = t_s + cur["stale_offset"]
            time_iso = fmt_iso(t_s)
            stale_iso = fmt_iso(stale_s)
            line = (
                f'<event version="2.0" uid="{cur["uid"]}" '
                f'type="{NEW_COT_TYPE}" how="m-g" '
                f'time="{time_iso}" start="{time_iso}" '
                f'stale="{stale_iso}">'
                f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{hae:.1f}"/>'
                f'{cur["detail"]}</event>'
            )
            out_lines.append(line)

    path.write_text("\n".join(out_lines) + "\n")
    print(f"  wrote {path.name}: {n} -> {len(out_lines)} frames")


def main():
    for name in UAV_FILES:
        path = REPO_ROOT / name
        if not path.exists():
            print(f"skip {name} (not found)")
            continue
        print(f"densify {name}")
        densify(path)


if __name__ == "__main__":
    main()
