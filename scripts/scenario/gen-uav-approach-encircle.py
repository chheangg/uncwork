#!/usr/bin/env python3
"""Build UAV ndxml: joey's approach then a clear orbit around TEAM-2.

Joey's original UAV waypoints describe an inbound approach that ends
just east (UAV-1) and west (UAV-2) of TEAM-2. The trajectory hints at
encirclement but doesn't actually complete one. This generator
preserves joey's approach verbatim and appends:

  * an orbit phase: full revolution around TEAM-2, both UAVs 180-deg
    out of phase so the encirclement reads on the map
  * a return leg: linear lerp from the orbit endpoint back to joey's
    approach start so the loop is seamless

Per-tick step is ~140m on the approach (joey's native), ~110m in
orbit, ~210m on the return leg (a faster egress run). Total per-cycle
length is 100 frames at 1 Hz emission == 100s wall-clock loop.

cotType is rewritten to `a-h-A-M-F-Q` so milsymbol renders the UAVs
as enemy combatants per MIL-STD-2525C.

Run from the repo root:
  python3 scripts/scenario/gen-uav-approach-encircle.py
"""

import math
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOEY_REF = "baa079b"   # commit holding joey's original UAV files
COT_TYPE = "a-h-A-M-F-Q"

# TEAM-2 position (matches grd-friend-02.ndxml)
CENTER_LAT = 48.480
CENTER_LON = 37.050

# Orbit geometry. R_LAT/R_LON chosen so the apparent ground radius is
# ~600m at this latitude (cos(48.5deg) ~= 0.66, so R_LON is ~1.5x
# R_LAT to keep the orbit visually circular on the map).
R_LAT = 0.0055
R_LON = 0.0080
ORBIT_FRAMES = 40       # one full revolution
RETURN_FRAMES = 20      # lerp from orbit endpoint back to approach start

STALE_OFFSET_S = 20


def joey_track(filename):
    """Pull joey's original ndxml from baa079b and parse waypoints."""
    raw = subprocess.check_output(
        ["git", "show", f"{JOEY_REF}:{filename}"], cwd=REPO_ROOT,
    ).decode()
    pts = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.search(r'\bcallsign="([^"]+)"', line)
        cs = m.group(1) if m else "UNKNOWN"
        m = re.search(r'\buid="([^"]+)"', line)
        uid = m.group(1) if m else None
        m = re.search(r'\bhae="([^"]+)"', line)
        hae = float(m.group(1)) if m else 1200.0
        m = re.search(r'\blat="([^"]+)"\s+lon="([^"]+)"', line)
        if not m:
            continue
        pts.append({
            "uid": uid, "callsign": cs, "hae": hae,
            "lat": float(m.group(1)), "lon": float(m.group(2)),
        })
    return pts


def fmt_iso(secs):
    secs = int(round(secs))
    h = 12 + secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"2026-05-02T{h:02d}:{m:02d}:{s:02d}Z"


def event_xml(uid, callsign, t_s, lat, lon, hae, course, remark, speed=80.0):
    time_iso = fmt_iso(t_s)
    stale_iso = fmt_iso(t_s + STALE_OFFSET_S)
    return (
        f'<event version="2.0" uid="{uid}" type="{COT_TYPE}" how="m-g" '
        f'time="{time_iso}" start="{time_iso}" stale="{stale_iso}">'
        f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{hae:.1f}"/>'
        f'<detail><contact callsign="{callsign}"/>'
        f'<track speed="{speed:.1f}" course="{course:.0f}"/>'
        f'<remarks>{remark}</remarks></detail></event>'
    )


def bearing_deg(dlat, dlon, ref_lat):
    """Bearing from north (0) clockwise, computed at this latitude."""
    east_m = dlon * 111320.0 * math.cos(math.radians(ref_lat))
    north_m = dlat * 111320.0
    return (math.degrees(math.atan2(east_m, north_m)) + 360) % 360


def build_track(filename, theta_start, hae_default):
    """Joey's approach + orbit (theta from theta_start, clockwise) +
    return-to-approach-start. Returns list of XML lines."""
    pts = joey_track(filename)
    if not pts:
        raise RuntimeError(f"no points parsed from {filename}")
    uid = pts[0]["uid"]
    callsign = pts[0]["callsign"]
    hae = pts[0]["hae"] if pts[0]["hae"] else hae_default

    lines = []
    t = 0

    # Phase 1: approach -- joey's waypoints, one per tick.
    for i, p in enumerate(pts):
        nxt = pts[i + 1] if i + 1 < len(pts) else None
        if nxt:
            course = bearing_deg(nxt["lat"] - p["lat"], nxt["lon"] - p["lon"], p["lat"])
        else:
            course = 0.0
        lines.append(event_xml(
            uid, callsign, t, p["lat"], p["lon"], hae, course,
            f"{callsign} inbound", speed=80.0,
        ))
        t += 1

    # Phase 2: orbit TEAM-2, clockwise (theta decreasing). Step
    # 2pi / ORBIT_FRAMES per tick.
    last = pts[-1]
    for k in range(ORBIT_FRAMES):
        theta = theta_start - 2 * math.pi * k / ORBIT_FRAMES
        lat = CENTER_LAT + R_LAT * math.cos(theta)
        lon = CENTER_LON + R_LON * math.sin(theta)
        # Tangent direction (derivative of position w.r.t. -theta clockwise):
        dlat = R_LAT * math.sin(theta)
        dlon = -R_LON * math.cos(theta)
        course = bearing_deg(dlat, dlon, lat)
        lines.append(event_xml(
            uid, callsign, t, lat, lon, hae, course,
            f"{callsign} encircling target", speed=120.0,
        ))
        t += 1

    # Phase 3: linear return from orbit endpoint to joey's approach
    # start, so the loop is seamless when the sender wraps the file.
    orbit_end_theta = theta_start - 2 * math.pi * ORBIT_FRAMES / ORBIT_FRAMES  # = theta_start
    orbit_end_lat = CENTER_LAT + R_LAT * math.cos(orbit_end_theta)
    orbit_end_lon = CENTER_LON + R_LON * math.sin(orbit_end_theta)
    return_target = pts[0]
    for k in range(1, RETURN_FRAMES + 1):
        u = k / RETURN_FRAMES
        lat = orbit_end_lat + (return_target["lat"] - orbit_end_lat) * u
        lon = orbit_end_lon + (return_target["lon"] - orbit_end_lon) * u
        # (Don't write the very last return frame -- the sender's wrap
        # will produce frame 0 next, and a duplicate position would
        # show up as a stutter. Include up to k = RETURN_FRAMES - 1.)
        if k == RETURN_FRAMES:
            break
        course = bearing_deg(
            return_target["lat"] - orbit_end_lat,
            return_target["lon"] - orbit_end_lon,
            lat,
        )
        lines.append(event_xml(
            uid, callsign, t, lat, lon, hae, course,
            f"{callsign} egress", speed=200.0,
        ))
        t += 1

    return lines


def main():
    # UAV-1 ends approach east of TEAM-2 -> start orbit at theta=pi/2.
    # UAV-2 ends approach west of TEAM-2 -> start orbit at theta=3pi/2
    # (180 deg out of phase, same direction). Both orbit clockwise so
    # they remain on opposite sides of TEAM-2 throughout the encircle.
    uav1 = build_track("uav-hostile-01.ndxml", math.pi / 2, hae_default=1200.0)
    uav2 = build_track("uav-hostile-02.ndxml", 3 * math.pi / 2, hae_default=1100.0)

    (REPO_ROOT / "uav-hostile-01.ndxml").write_text("\n".join(uav1) + "\n")
    print(f"wrote uav-hostile-01.ndxml: {len(uav1)} frames")
    (REPO_ROOT / "uav-hostile-02.ndxml").write_text("\n".join(uav2) + "\n")
    print(f"wrote uav-hostile-02.ndxml: {len(uav2)} frames")


if __name__ == "__main__":
    main()
