#!/usr/bin/env python3
"""Regenerate the main-branch scripted scenario.

Produces 6 ndxml files (40 frames @ 0.5s tick = 20s loop):

  grd-friend-01.ndxml  TEAM-1   (static, jam-jitter, KIA at end)
  grd-friend-02.ndxml  TEAM-2   (static, jam-jitter, KIA at end)
  grd-friend-03.ndxml  TEAM-3   (static, jam-jitter, KIA at end)
  uav-hostile-01.ndxml UNKNOWN-1 (cotType a-h-A-M-F-Q, perp jitter,
                                  HUGE jam-spike jump at T=10s)
  uav-hostile-02.ndxml UNKNOWN-2 (cotType a-h-A-M-F-Q, perp jitter,
                                  HUGE jam-spike jump at T=10s)
  fw-friend-01.ndxml   MSL-1    (cotType a-f-A-M-F-M, parks on rail
                                 pre-fire, flies T=8..12, parks at
                                 impact post-12 -- never off-map)

Phases:
  T=0..5s    clear comms       (ce=3, le=4)
  T=5..13s   jam ramp           (ce 3->137, le 4->274)
  T=13..18s  full jam            (ce=137, le=274 -> CRITICAL)
  T=18..20s  KIA snap for TEAM-* (ce=300, le=500 -> OFFLINE)
"""

import math
import random

random.seed(48487)

LOOP_S = 20.0
TICK_S = 0.5
N_FRAMES = int(LOOP_S / TICK_S)
TIMES = [i * TICK_S for i in range(N_FRAMES)]

T_JAM_START = 5.0
T_JAM_END = 13.0
T_KIA = 18.0
T_KIA_TEAM2 = 14.0   # TEAM-2 KIA first

CE_CLEAN, LE_CLEAN = 3.0, 4.0
CE_JAM, LE_JAM = 137.0, 274.0
CE_KIA, LE_KIA = 300.0, 500.0

T_FIRE = 8.0
T_HIT = 12.0
CE_MSL_FLY, LE_MSL_FLY = 70.0, 120.0
CE_MSL_INERT, LE_MSL_INERT = 290.0, 480.0

JITTER_AMP_MAX_M = 80.0
COARSE_STEP_S = 1.0

UNITS = {
    "TEAM-1": (48.470, 37.020),
    "TEAM-2": (48.480, 37.050),
    "TEAM-3": (48.468, 37.018),
}

# Friendly teams now advance along straight-line headings.
# ~12 m/tick at 0.5s tick -> 24 m/s ~= 86 km/h (fast armor on the move)
# ~480 m total over 20 s loop -- visible but not outpacing the camera.
TEAM_HEADINGS = {
    "TEAM-1": (0.00010, 0.00012),  # roughly NE
    "TEAM-2": (0.00009, 0.00014),  # roughly E-NE
    "TEAM-3": (0.00012, 0.00010),  # roughly N-NE
}

# UAVs travel in a straight line throughout the loop. Speed is
# unchanged from before; only the HUGE jump was removed -- the user
# wants gradual motion so jam manifests purely as ce/le drift + small
# perpendicular jitter, not as a teleport.
# UAV interception waypoints (t_seconds, lat, lon).
# Both UAVs are synchronised:
#   T=10..14  encircle TEAM-2 from opposite sides (UAV-1 east -> south,
#             UAV-2 west -> north), converging on TEAM-2's KIA position
#             at exactly T=14 -- the moment TEAM-2 dies.
#   T=14..18  immediately fan out on parallel SW headings to overrun
#             TEAM-1 (UAV-1) and TEAM-3 (UAV-2) at exactly T=18 -- when
#             both die at the same time.
TEAM1_KIA_LAT = UNITS["TEAM-1"][0] + TEAM_HEADINGS["TEAM-1"][0] * (T_KIA / TICK_S)
TEAM1_KIA_LON = UNITS["TEAM-1"][1] + TEAM_HEADINGS["TEAM-1"][1] * (T_KIA / TICK_S)
TEAM2_KIA_LAT = UNITS["TEAM-2"][0] + TEAM_HEADINGS["TEAM-2"][0] * (T_KIA_TEAM2 / TICK_S)
TEAM2_KIA_LON = UNITS["TEAM-2"][1] + TEAM_HEADINGS["TEAM-2"][1] * (T_KIA_TEAM2 / TICK_S)
TEAM3_KIA_LAT = UNITS["TEAM-3"][0] + TEAM_HEADINGS["TEAM-3"][0] * (T_KIA / TICK_S)
TEAM3_KIA_LON = UNITS["TEAM-3"][1] + TEAM_HEADINGS["TEAM-3"][1] * (T_KIA / TICK_S)

ORBIT_DLAT = 0.0030
ORBIT_DLON = 0.0045

UAV1_WAYPOINTS = [
    (0.0,  48.490, 37.080),                                    # far NE staging
    (10.0, TEAM2_KIA_LAT,              TEAM2_KIA_LON + ORBIT_DLON),  # east of TEAM-2
    (12.0, TEAM2_KIA_LAT - ORBIT_DLAT, TEAM2_KIA_LON),               # south of TEAM-2
    (14.0, TEAM2_KIA_LAT,              TEAM2_KIA_LON),               # encircle/kill TEAM-2
    (18.0, TEAM1_KIA_LAT,              TEAM1_KIA_LON),               # parallel run -> kill TEAM-1
    (20.0, TEAM1_KIA_LAT - 0.003,      TEAM1_KIA_LON - 0.005),       # exits NW
]

UAV2_WAYPOINTS = [
    (0.0,  48.495, 37.075),                                    # far NE-N staging
    (10.0, TEAM2_KIA_LAT,              TEAM2_KIA_LON - ORBIT_DLON),  # west of TEAM-2 (opposite)
    (12.0, TEAM2_KIA_LAT + ORBIT_DLAT, TEAM2_KIA_LON),               # north of TEAM-2 (opposite)
    (14.0, TEAM2_KIA_LAT,              TEAM2_KIA_LON),               # encircle/kill TEAM-2
    (18.0, TEAM3_KIA_LAT,              TEAM3_KIA_LON),               # parallel run -> kill TEAM-3
    (20.0, TEAM3_KIA_LAT - 0.003,      TEAM3_KIA_LON - 0.005),       # exits NW
]

# Impact point for MSL-1 -- intercept UAV-1 at T=12s along its nominal
# waypoint path (interpolated at file-gen time).
def _interp_waypoints(waypoints, t):
    for (t0, la0, lo0), (t1, la1, lo1) in zip(waypoints, waypoints[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            return la0 + (la1 - la0) * u, lo0 + (lo1 - lo0) * u
    return waypoints[-1][1], waypoints[-1][2]


IMPACT = _interp_waypoints(UAV1_WAYPOINTS, 12.0)


def lerp(a, b, u):
    return a + (b - a) * max(0.0, min(1.0, u))


def jam_progress(t):
    if t <= T_JAM_START:
        return 0.0
    if t >= T_JAM_END:
        return 1.0
    return (t - T_JAM_START) / (T_JAM_END - T_JAM_START)


def ce_le_team(t, kia_t):
    if t >= kia_t:
        return CE_KIA, LE_KIA
    p = jam_progress(t)
    return lerp(CE_CLEAN, CE_JAM, p), lerp(LE_CLEAN, LE_JAM, p)


def ce_le_uav(t):
    p = jam_progress(t)
    return lerp(CE_CLEAN, CE_JAM, p), lerp(LE_CLEAN, LE_JAM, p)


def coarse_seed(uid, t):
    bin_idx = int(t / COARSE_STEP_S)
    return hash((uid, bin_idx)) & 0xFFFFFFFF


def jitter_radial_deg(uid, t, lat):
    p = jam_progress(t)
    if p <= 0.001:
        return 0.0, 0.0
    rng = random.Random(coarse_seed(uid, t))
    angle = rng.uniform(0, 2 * math.pi)
    amp_m = p * JITTER_AMP_MAX_M
    dlat = (amp_m * math.cos(angle)) / 111_320.0
    dlon = (amp_m * math.sin(angle)) / (111_320.0 * math.cos(math.radians(lat)))
    return dlat, dlon


def jitter_perp_deg(uid, t, lat, vlat, vlon):
    p = jam_progress(t)
    if p <= 0.001:
        return 0.0, 0.0
    v_lat_m = vlat * 111_320.0
    v_lon_m = vlon * 111_320.0 * math.cos(math.radians(lat))
    norm = math.hypot(v_lat_m, v_lon_m)
    if norm < 1e-6:
        return jitter_radial_deg(uid, t, lat)
    perp_lat_m = -v_lon_m / norm
    perp_lon_m = v_lat_m / norm
    rng = random.Random(coarse_seed(uid, t))
    sign = 1.0 if rng.random() < 0.5 else -1.0
    amp_m = p * JITTER_AMP_MAX_M * sign
    dlat = (perp_lat_m * amp_m) / 111_320.0
    dlon = (perp_lon_m * amp_m) / (111_320.0 * math.cos(math.radians(lat)))
    return dlat, dlon


def fmt_iso(t):
    base_h = 12
    seconds = t
    m, s = divmod(seconds, 60)
    whole = int(s)
    frac = int(round((s - whole) * 1000))
    if frac >= 1000:
        whole += 1
        frac -= 1000
    return f"2026-05-03T{base_h:02d}:{int(m):02d}:{whole:02d}.{frac:03d}Z"


def event_xml(uid, cot_type, callsign, t, lat, lon, hae, ce, le,
              speed, course, remark):
    time_iso = fmt_iso(t)
    stale_iso = fmt_iso(t + 20.0)
    return (
        f'<event version="2.0" uid="{uid}" type="{cot_type}" how="m-g" '
        f'time="{time_iso}" start="{time_iso}" stale="{stale_iso}">'
        f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{hae:.1f}" '
        f'ce="{ce:.1f}" le="{le:.1f}"/>'
        f'<detail><contact callsign="{callsign}"/>'
        f'<track speed="{speed:.1f}" course="{course:.0f}"/>'
        f"<remarks>{remark}</remarks></detail></event>"
    )


def remark_team(callsign, t, kia_t):
    if t >= kia_t:
        return f"{callsign} KIA -- link offline"
    if t >= T_JAM_END:
        return f"{callsign} holding -- comms critical"
    if t >= T_JAM_START:
        return f"{callsign} holding -- comms degrading"
    return f"{callsign} holding"


def remark_uav(callsign, t):
    if t >= T_JAM_END:
        return f"{callsign} inbound -- comms critical"
    if t >= T_JAM_START:
        return f"{callsign} inbound -- comms degrading"
    return f"{callsign} inbound"


def write_team(path, uid, callsign, base, heading, kia_t=T_KIA):
    """Friendly teams move in a straight line at constant velocity.
    No jitter -- pure linear motion. KIA at kia_t freezes the position
    at the spot where the team was killed."""
    base_lat, base_lon = base
    head_dlat, head_dlon = heading
    # Position at the moment of KIA -- track stays here once dead.
    kia_idx = int(kia_t / TICK_S)
    kia_lat = base_lat + head_dlat * kia_idx
    kia_lon = base_lon + head_dlon * kia_idx
    course_deg = math.degrees(math.atan2(
        head_dlon * math.cos(math.radians(base_lat)), head_dlat,
    ))
    speed_mps = math.hypot(head_dlat * 111_320.0,
                           head_dlon * 111_320.0 * math.cos(math.radians(base_lat))) / TICK_S
    lines = []
    for i, t in enumerate(TIMES):
        ce, le = ce_le_team(t, kia_t)
        if t >= kia_t:
            lat, lon = kia_lat, kia_lon
            speed = 0.0
        else:
            lat = base_lat + head_dlat * i
            lon = base_lon + head_dlon * i
            speed = speed_mps
        lines.append(event_xml(
            uid, "a-f-G-U-C", callsign, t, lat, lon, 200.0,
            ce, le, speed, course_deg, remark_team(callsign, t, kia_t),
        ))
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path} ({len(lines)} frames, kia at T={kia_t}s, "
          f"speed={speed_mps:.1f} m/s)")


def write_uav_waypoints(path, uid, callsign, waypoints, hae):
    """UAV follows a piecewise-linear waypoint path. The path is
    designed to overrun a friendly target (the corresponding team's
    KIA position at the team's KIA time) so the visual story reads as
    'UAV closed in, jam ramp masked our tracks, UAV reached the team
    just as the team went dark'.

    Speed and course are derived from the active segment so the icon
    rotates naturally at hairpins.
    """
    lines = []
    for i, t in enumerate(TIMES):
        # Find the active segment (t0, t1].
        seg_idx = 0
        for j in range(len(waypoints) - 1):
            if waypoints[j][0] <= t <= waypoints[j + 1][0]:
                seg_idx = j
                break
        else:
            seg_idx = len(waypoints) - 2
        (t0, la0, lo0) = waypoints[seg_idx]
        (t1, la1, lo1) = waypoints[seg_idx + 1]
        u = (t - t0) / max(1e-6, t1 - t0)
        u = max(0.0, min(1.0, u))
        lat = la0 + (la1 - la0) * u
        lon = lo0 + (lo1 - lo0) * u
        # Per-segment velocity (deg/tick units fed to jitter_perp_deg).
        seg_dt_ticks = max(1e-6, (t1 - t0) / TICK_S)
        v_dlat = (la1 - la0) / seg_dt_ticks
        v_dlon = (lo1 - lo0) / seg_dt_ticks
        course = math.degrees(math.atan2(
            v_dlon * math.cos(math.radians(lat)), v_dlat,
        ))
        speed_mps = math.hypot(v_dlat * 111_320.0,
                               v_dlon * 111_320.0 * math.cos(math.radians(lat))) / TICK_S
        # Apply jam jitter perpendicular to the segment heading.
        dlat_j, dlon_j = jitter_perp_deg(uid, t, lat, v_dlat, v_dlon)
        lat += dlat_j
        lon += dlon_j
        ce, le = ce_le_uav(t)
        lines.append(event_xml(
            uid, "a-h-A-M-F-Q", callsign, t, lat, lon, hae,
            ce, le, speed_mps, course, remark_uav(callsign, t),
        ))
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path} ({len(lines)} frames, waypoint path)")


def write_msl(path):
    """MSL-1 stays silent (skip-marker) until launch, then flies and
    parks at impact. The sender filters lines starting with `<!--`,
    so MSL-1 simply doesn't appear on the wire pre-fire."""
    launch_lat, launch_lon = UNITS["TEAM-3"]
    lines = []
    skipped = 0
    for t in TIMES:
        if t < T_FIRE:
            lines.append("<!--SKIP MSL-1 pre-fire-->")
            skipped += 1
            continue
        if t < T_HIT:
            u = (t - T_FIRE) / (T_HIT - T_FIRE)
            lat = lerp(launch_lat, IMPACT[0], u)
            lon = lerp(launch_lon, IMPACT[1], u)
            ce = lerp(CE_MSL_FLY, CE_MSL_FLY * 1.7, u)
            le = lerp(LE_MSL_FLY, LE_MSL_FLY * 1.7, u)
            speed = 130.0
            remark = "MSL-1 homing on target"
        else:
            lat, lon = IMPACT
            ce, le = CE_MSL_INERT, LE_MSL_INERT
            speed = 0.0
            remark = "MSL-1 IMPACT confirmed"
        lines.append(event_xml(
            "FW-FRIEND-01", "a-f-A-M-F-M", "MSL-1", t,
            lat, lon, 240.0, ce, le, speed, 45, remark,
        ))
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {path} ({len(lines)} frames, {skipped} skipped pre-fire)")


def main():
    write_team("grd-friend-01.ndxml", "GRD-FRIEND-01", "TEAM-1",
               UNITS["TEAM-1"], TEAM_HEADINGS["TEAM-1"], T_KIA)
    write_team("grd-friend-02.ndxml", "GRD-FRIEND-02", "TEAM-2",
               UNITS["TEAM-2"], TEAM_HEADINGS["TEAM-2"], T_KIA_TEAM2)
    write_team("grd-friend-03.ndxml", "GRD-FRIEND-03", "TEAM-3",
               UNITS["TEAM-3"], TEAM_HEADINGS["TEAM-3"], T_KIA)
    write_uav_waypoints("uav-hostile-01.ndxml", "UAV-HOSTILE-01",
                        "UNKNOWN-1", UAV1_WAYPOINTS, hae=1200.0)
    write_uav_waypoints("uav-hostile-02.ndxml", "UAV-HOSTILE-02",
                        "UNKNOWN-2", UAV2_WAYPOINTS, hae=1100.0)
    write_msl("fw-friend-01.ndxml")


if __name__ == "__main__":
    main()
