import math
import os

OUT = "/Users/macbookair/repos/uncwork"

TICK_S = 0.5
DURATION_S = 60.0
FRAMES = int(DURATION_S / TICK_S)

T_DEGRADE_START = 15.0
T_DEGRADE_END   = 50.0
T_FIRE          = 35.0
T_HIT           = 42.0
T_IMPACT_END    = 47.0
T_DISABLE       = 50.0

A_START = (48.4640, 37.0010)
A_END   = (48.4654, 37.0075)

B_START = (48.4640, 37.0030)
B_END   = (48.4608, 37.0078)

ENEMY_BASE = (48.4690, 37.0250)
ENEMY_END  = (48.4674, 37.0172)

JAMMER     = (48.4710, 37.0270)
STASH      = (89.9, 0.0)


def lerp(a, b, t):
    return a + (b - a) * max(0.0, min(1.0, t))


def lerp2(p0, p1, t):
    return (lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t))


def fmt_iso(secs):
    h = 12 + int(secs // 3600)
    m = int((secs % 3600) // 60)
    s = secs % 60
    return f"2026-05-03T{h:02d}:{m:02d}:{s:06.3f}Z"


def event_xml(uid, cot_type, callsign, t, lat, lon, hae, ce, le, speed, course, remarks=None):
    time_iso = fmt_iso(t)
    stale_iso = fmt_iso(t + 20)
    rem_xml = f"<remarks>{remarks}</remarks>" if remarks else ""
    return (
        f'<event version="2.0" uid="{uid}" type="{cot_type}" how="m-g" '
        f'time="{time_iso}" start="{time_iso}" stale="{stale_iso}">'
        f'<point lat="{lat:.6f}" lon="{lon:.6f}" hae="{hae:.1f}" ce="{ce:.1f}" le="{le:.1f}"/>'
        f'<detail><contact callsign="{callsign}"/>'
        f'<track speed="{speed:.1f}" course="{course:.0f}"/>'
        f'{rem_xml}</detail></event>'
    )


def write_track(path, lines):
    full = os.path.join(OUT, path)
    with open(full, "w") as f:
        for line in lines:
            f.write(line + "\n")
    print(f"wrote {full}: {len(lines)} lines")


IMM     = (3.0, 4.0)
ENDLO   = (137.0, 274.0)
KIA_VAL = (300.0, 500.0)


# Jamming is now modelled exclusively at the wire layer (sender chaos
# profiles). Data-side ce/le ramps and jitter are disabled -- the
# scenario data stays clean so the visualised "comms quality" reflects
# what the listener actually observes on the wire.
def jam_progress(_t):
    return 0.0


def jam_ramp(_t):
    return IMM


# Jitter: amp scales with jam_progress. Dialed down: 30m max
# (was 80m -- "less severe").
COARSE_STEP_S        = 1.5
JITTER_AMP_MAX_M     = 30.0
M_PER_DEG_LAT        = 111_000.0
M_PER_DEG_LON_AT_LAT = 111_000.0 * math.cos(math.radians(48.46))


def perp_unit_m(dlat_deg, dlon_deg):
    v_lat = dlat_deg * M_PER_DEG_LAT
    v_lon = dlon_deg * M_PER_DEG_LON_AT_LAT
    norm = math.sqrt(v_lat * v_lat + v_lon * v_lon)
    if norm < 1e-6:
        return (0.0, 0.0)
    return (-v_lon / norm, v_lat / norm)


def jitter_offset_deg(perp_m, amplitude_m, seed):
    return (perp_m[0] * amplitude_m * seed / M_PER_DEG_LAT,
            perp_m[1] * amplitude_m * seed / M_PER_DEG_LON_AT_LAT)


def positioned(t, start, end, t_max, phase):
    base = lerp2(start, end, t / t_max)
    p = jam_progress(t)
    if p <= 0.0:
        return base
    perp = perp_unit_m(end[0] - start[0], end[1] - start[1])
    tc = math.floor(t / COARSE_STEP_S) * COARSE_STEP_S
    seed = math.sin(tc * 7.13 + phase)
    amp_m = p * JITTER_AMP_MAX_M
    off = jitter_offset_deg(perp, amp_m, seed)
    return (base[0] + off[0], base[1] + off[1])


def unit_pos(t, start, end, t_disable, phase):
    if t >= t_disable:
        return positioned(t_disable - TICK_S, start, end, t_disable, phase)
    return positioned(t, start, end, t_disable, phase)


def enemy_pos(t):
    return positioned(t, ENEMY_BASE, ENEMY_END, DURATION_S, 3.7)


# Pre-compute the missile's impact point so the missile parks at a
# FIXED location and doesn't follow ENEMY-1 around. ENEMY-1 keeps
# moving past this point, so the two icons separate visibly after
# impact -- the data shows the strike landed where the enemy *was*,
# not where the enemy *is*.
MSL_IMPACT = enemy_pos(T_HIT)


unit_a, unit_b, enemy, jammer, missile = [], [], [], [], []

for i in range(FRAMES):
    t = i * TICK_S

    lat, lon = unit_pos(t, A_START, A_END, T_DISABLE, 1.1)
    if t < T_DEGRADE_START:
        ce_a, le_a = IMM; rem_a = "TEAM-A advancing on combatant"
    elif t < T_DISABLE:
        ce_a, le_a = jam_ramp(t); rem_a = "TEAM-A advancing -- comms degrading"
    else:
        ce_a, le_a = KIA_VAL; rem_a = "TEAM-A KIA"
    speed_a = 0.0 if t >= T_DISABLE else 10.0
    unit_a.append(event_xml("GRD-FRIEND-01", "a-f-G-U-C-I", "TEAM-A",
        t, lat, lon, 195.0, ce_a, le_a, speed_a, 75.0, rem_a))

    lat, lon = unit_pos(t, B_START, B_END, T_DISABLE, 2.7)
    if t < T_DEGRADE_START:
        ce_b, le_b = IMM; rem_b = "TEAM-B flanking"
    elif t < T_DISABLE:
        ce_b, le_b = jam_ramp(t)
        rem_b = "TEAM-B FIRES MISSILE" if T_FIRE <= t < T_FIRE + 1 else "TEAM-B flanking -- comms degrading"
    else:
        ce_b, le_b = KIA_VAL; rem_b = "TEAM-B KIA"
    speed_b = 0.0 if t >= T_DISABLE else 10.0
    unit_b.append(event_xml("GRD-FRIEND-02", "a-f-G-U-C-I", "TEAM-B",
        t, lat, lon, 198.0, ce_b, le_b, speed_b, 130.0, rem_b))

    e_lat, e_lon = enemy_pos(t)
    # ce/le stays clean -- jam comes from the wire, not the data.
    ce_e, le_e = IMM
    rem_e = "hostile advancing"
    enemy.append(event_xml("ENM-HOSTILE-01", "a-h-G-U-C", "ENEMY-1",
        t, e_lat, e_lon, 205.0, ce_e, le_e, 10.0, 250.0, rem_e))

    # Jammer also uses STASH for visibility windows; ce/le stays clean.
    if t < T_DEGRADE_START:
        lat_j, lon_j = STASH; ce_j, le_j = IMM; rem_j = "(hidden)"
    elif t <= T_IMPACT_END:
        lat_j, lon_j = JAMMER; ce_j, le_j = IMM; rem_j = "EW JAMMER ACTIVE"
    else:
        lat_j, lon_j = STASH; ce_j, le_j = IMM; rem_j = "(faded off)"
    jammer.append(event_xml("ENM-HOSTILE-02", "a-h-G-E-W-J", "JAMMER",
        t, lat_j, lon_j, 215.0, ce_j, le_j, 0.0, 0.0, rem_j))

    # MISSILE: fly from B's position to a FIXED impact point. After
    # T_HIT the missile sits at MSL_IMPACT for the debris window --
    # it does NOT track ENEMY-1's ongoing motion, so the icons don't
    # stay attached.
    # Missile uses STASH-style positioning to hide pre-fire / post-spent
    # (a non-jam visibility decision). When visible, ce/le is clean.
    if t < T_FIRE:
        lat_m, lon_m = STASH
        ce_m, le_m = IMM
        speed_m = 0.0
        rem_m = "(missile loaded)"
    elif t <= T_HIT:
        u = (t - T_FIRE) / (T_HIT - T_FIRE)
        launch = unit_pos(T_FIRE, B_START, B_END, T_DISABLE, 2.7)
        lat_m, lon_m = lerp2(launch, MSL_IMPACT, u)
        ce_m, le_m = IMM
        speed_m = 130.0
        rem_m = "MSL-1 homing on target"
    elif t <= T_IMPACT_END:
        lat_m, lon_m = MSL_IMPACT
        ce_m, le_m = IMM
        speed_m = 0.0
        rem_m = "MSL-1 IMPACT confirmed"
    else:
        lat_m, lon_m = STASH
        ce_m, le_m = IMM
        speed_m = 0.0
        rem_m = "(missile spent)"
    missile.append(event_xml("FW-FRIEND-01", "a-f-A-M-F-M", "MSL-1",
        t, lat_m, lon_m, 240.0, ce_m, le_m, speed_m, 45.0, rem_m))


write_track("grd-friend-01.ndxml", unit_a)
write_track("grd-friend-02.ndxml", unit_b)
write_track("grd-friend-03.ndxml", [])
write_track("uav-hostile-01.ndxml", enemy)
write_track("uav-hostile-02.ndxml", jammer)
write_track("fw-friend-01.ndxml", missile)
