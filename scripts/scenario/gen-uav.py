#!/usr/bin/env python3
"""Generate UAV ndxml: joey's data densified, combatant symbology.

Reads joey's original 40-frame UAV files from baa079b and produces:

  - 2x linear densification along joey's exact waypoints (per-tick
    step ~116 m at 1 Hz emission, ~416 km/h apparent)
  - cotType rewritten to `a-h-A-M-F-Q` so milsymbol renders the UAVs
    as hostile combatant drones per MIL-STD-2525C

Joey's path is preserved exactly -- this is just smoother sampling
of his trajectory.

Run from repo root:
  python3 scripts/scenario/gen-uav.py
"""

import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
JOEY_REF = "baa079b"
DENSIFY_FACTOR = 2
COT_TYPE = "a-h-A-M-F-Q"
STALE_OFFSET_S = 20

UAV_FILES = ["uav-hostile-01.ndxml", "uav-hostile-02.ndxml"]


def joey_waypoints(filename):
    """Pull joey's original ndxml from baa079b and parse waypoints."""
    raw = subprocess.check_output(
        ["git", "show", f"{JOEY_REF}:{filename}"], cwd=REPO_ROOT,
    ).decode()
    pts = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        m_uid = re.search(r'\buid="([^"]+)"', line)
        m_cs = re.search(r'\bcallsign="([^"]+)"', line)
        m_hae = re.search(r'\bhae="([^"]+)"', line)
        m_pt = re.search(r'\blat="([^"]+)"\s+lon="([^"]+)"', line)
        if not (m_uid and m_pt):
            continue
        pts.append({
            "uid": m_uid.group(1),
            "callsign": m_cs.group(1) if m_cs else "UNKNOWN",
            "hae": float(m_hae.group(1)) if m_hae else 1200.0,
            "lat": float(m_pt.group(1)),
            "lon": float(m_pt.group(2)),
        })
    return pts


def densify(pts, factor):
    """Insert (factor - 1) interpolated points between every pair."""
    if factor <= 1 or len(pts) < 2:
        return list(pts)
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        for k in range(factor):
            u = k / factor
            out.append({
                "uid": a["uid"],
                "callsign": a["callsign"],
                "hae": a["hae"] + (b["hae"] - a["hae"]) * u,
                "lat": a["lat"] + (b["lat"] - a["lat"]) * u,
                "lon": a["lon"] + (b["lon"] - a["lon"]) * u,
            })
    out.append(pts[-1])
    return out


def fmt_iso(secs):
    secs = int(round(secs))
    h = 12 + secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"2026-05-02T{h:02d}:{m:02d}:{s:02d}Z"


def event_xml(p, t_s):
    time_iso = fmt_iso(t_s)
    stale_iso = fmt_iso(t_s + STALE_OFFSET_S)
    return (
        f'<event version="2.0" uid="{p["uid"]}" type="{COT_TYPE}" how="m-g" '
        f'time="{time_iso}" start="{time_iso}" stale="{stale_iso}">'
        f'<point lat="{p["lat"]:.6f}" lon="{p["lon"]:.6f}" '
        f'hae="{p["hae"]:.1f}"/>'
        f'<detail><contact callsign="{p["callsign"]}"/>'
        f'<track speed="80.0" course="0"/>'
        f'<remarks>{p["callsign"]} on patrol</remarks></detail></event>'
    )


def write_uav(filename):
    pts = joey_waypoints(filename)
    if not pts:
        raise RuntimeError(f"no points parsed from {filename}")
    dense = densify(pts, DENSIFY_FACTOR)
    lines = [event_xml(p, i) for i, p in enumerate(dense)]
    (REPO_ROOT / filename).write_text("\n".join(lines) + "\n")
    print(f"wrote {filename}: {len(pts)} -> {len(dense)} densified frames")


def main():
    for f in UAV_FILES:
        write_uav(f)


if __name__ == "__main__":
    main()
