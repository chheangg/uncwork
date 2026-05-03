#!/usr/bin/env python3
"""Synthesise UAV ndxml files where UNKNOWN-1 and UNKNOWN-2 orbit
TEAM-2 from opposite sides of a tight circle.

Joey's original UAV waypoints were inbound traces but didn't read
visibly as an encirclement on the map. This generator replaces those
waypoints with two synchronised circular orbits around TEAM-2's
position so the operator immediately sees a pincer.

cotType: `a-h-A-M-F-Q` (hostile air military fixed-wing UAV)
Loop: 40 frames @ 1 Hz emission == 40s wall-clock cycle.
Speed: per-tick step ~87m on the map (~310 km/h apparent).

Run from repo root:
  python3 scripts/scenario/gen-uav-encircle.py
"""

import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# TEAM-2 position from joey's grd-friend-02.ndxml
CENTER_LAT = 48.480
CENTER_LON = 37.050

N_FRAMES = 40                       # 1 Hz emission -> 40s loop
TICK_S = 1                          # scripted-time tick used for the time= attribute
STALE_OFFSET = 20

# Orbit radius. ~555m on the ground -- big enough to read as a clear
# circle, small enough that the encirclement of TEAM-2 is unmistakable.
R_LAT = 0.005
R_LON = 0.0075


def fmt_iso(secs):
    secs = int(round(secs))
    h = 12 + secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"2026-05-02T{h:02d}:{m:02d}:{s:02d}Z"


def event_xml(uid, callsign, t_s, lat, lon, hae, course, remark):
    time_iso = fmt_iso(t_s)
    stale_iso = fmt_iso(t_s + STALE_OFFSET)
    return (
        f'<event version="2.0" uid="{uid}" type="a-h-A-M-F-Q" how="m-g" '
        f'time="{time_iso}" start="{time_iso}" stale="{stale_iso}">'
        f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{hae:.1f}"/>'
        f'<detail><contact callsign="{callsign}"/>'
        f'<track speed="80.0" course="{course:.0f}"/>'
        f'<remarks>{remark}</remarks></detail></event>'
    )


def orbit(i, phase_offset):
    theta = 2 * math.pi * i / N_FRAMES + phase_offset
    lat = CENTER_LAT + R_LAT * math.cos(theta)
    lon = CENTER_LON + R_LON * math.sin(theta)
    # Tangent direction = derivative of (cos, sin) = (-sin, cos)
    # Bearing in degrees from north.
    dlat = -R_LAT * math.sin(theta)
    dlon = R_LON * math.cos(theta)
    course_rad = math.atan2(dlon, dlat)
    course_deg = (math.degrees(course_rad) + 360) % 360
    return lat, lon, course_deg


def write_uav(path, uid, callsign, hae, phase_offset):
    lines = []
    for i in range(N_FRAMES):
        lat, lon, course = orbit(i, phase_offset)
        lines.append(event_xml(
            uid, callsign, i * TICK_S, lat, lon, hae, course,
            f"{callsign} encircling target",
        ))
    path.write_text("\n".join(lines) + "\n")
    print(f"wrote {path.name}: {N_FRAMES} frames, R~555m, period {N_FRAMES}s")


def main():
    write_uav(REPO_ROOT / "uav-hostile-01.ndxml",
              "UAV-HOSTILE-01", "UNKNOWN-1", hae=1200.0, phase_offset=0.0)
    write_uav(REPO_ROOT / "uav-hostile-02.ndxml",
              "UAV-HOSTILE-02", "UNKNOWN-2", hae=1100.0, phase_offset=math.pi)


if __name__ == "__main__":
    main()
