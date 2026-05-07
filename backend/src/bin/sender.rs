use chrono::Utc;
use rand::RngExt;
use rand::rng;
use serde::Deserialize;
use std::collections::{HashMap, VecDeque};
use std::net::UdpSocket;
use std::sync::{Arc, RwLock, mpsc};
use std::thread;
use std::time::{Duration, Instant};

const LISTENER_URL: &str = "http://127.0.0.1:3000";

// Ground unit positions sourced directly from the ndxml scenario
const UNIT_A_LAT: f64 = 48.470; // GRD-FRIEND-01 (TEAM-1)
const UNIT_A_LON: f64 = 37.020;
const UNIT_B_LAT: f64 = 48.480; // GRD-FRIEND-02 (TEAM-2)
const UNIT_B_LON: f64 = 37.050;
const UNIT_C_LAT: f64 = 48.468; // GRD-FRIEND-03 (TEAM-3)
const UNIT_C_LON: f64 = 37.018;

// Per-unit ndxml file names. The actual path is resolved at runtime
// against `scenarios/<active>/<file>` so the operator can swap
// scenarios without restarting the sender.
const NDXML_FILE_A: &str = "grd-friend-01.ndxml";
const NDXML_FILE_B: &str = "grd-friend-02.ndxml";
const NDXML_FILE_C: &str = "grd-friend-03.ndxml";
const NDXML_FILE_FW: &str = "fw-friend-01.ndxml";
const NDXML_FILE_UAV1: &str = "uav-hostile-01.ndxml";
const NDXML_FILE_UAV2: &str = "uav-hostile-02.ndxml";

// Files the listener writes to when the operator changes scenario or
// speed. Sender threads poll these via dedicated state and react on
// the next tick. Live next to `scenarios/`.
const ACTIVE_SCENARIO_FILE: &str = "scenarios/.active";
const SPEED_FILE: &str = "scenarios/.speed";
const PAUSED_FILE: &str = "scenarios/.paused";
const RESTART_FILE: &str = "scenarios/.restart_seq";
const DEFAULT_SCENARIO: &str = "uav";
const SCENARIO_POLL_MS: u64 = 500;

// Fallback bbox for the very first fetch before the listener tells us
// the frontend's viewport. Roughly the SF bay area.
const DEFAULT_VIEWPORT: Viewport = Viewport {
    south: 36.5,
    west: -123.5,
    north: 38.5,
    east: -121.0,
};

const OPENSKY_URL: &str = "https://opensky-network.org/api/states/all";
const OPENSKY_POLL_SECS: u64 = 10;
// Base tick interval at speed multiplier 1.0. Scenario .ndxml files
// generate frames at TICK_S=0.5, so 250ms is "2x scenario design".
// The runtime speed multiplier scales this -- effective_ms = BASE
// / speed. The listener exposes a slider that writes the speed to
// scenarios/.speed; the sender poller picks it up.
const EMIT_TICK_BASE_MS: u64 = 250;
const SPEED_MIN: f64 = 0.25;
const SPEED_MAX: f64 = 4.0;
const SPEED_DEFAULT: f64 = 1.0;
// If a track hasn't been re-anchored by OpenSky in this many seconds,
// stop emitting for it -- frontend will prune it shortly. Keeps trails
// from drifting off into space when an aircraft leaves the bbox.
const EMIT_SKIP_AFTER_SECS: u64 = 18;
// Hard drop from in-memory state after this long. Anything beyond this
// is definitely gone (left airspace / OpenSky lost it).
const ANCHOR_MAX_AGE_SECS: u64 = 60;

#[derive(Clone, Copy, Deserialize)]
struct Viewport {
    south: f64,
    west: f64,
    north: f64,
    east: f64,
}

// main is the no-chaos baseline scenario: clean wire, no scripted
// drops/dups/corrupts/reorders. Demo branches (feat/scripted-data-jam,
// feat/fire-and-maneuver-scenario) override these with active chaos
// profiles so jamming can be visualised.
const NO_CHAOS: ChaosConfig = ChaosConfig {
    drop_threshold: 0.0,
    duplicate_threshold: 0.0,
    corrupt_threshold: 0.0,
    reorder_threshold: 0.0,
    burst_probability: 0.0,
    burst_max: 3,
};

const HEAVY_JAM: ChaosConfig = ChaosConfig {
    drop_threshold: 0.45,
    duplicate_threshold: 0.55,
    corrupt_threshold: 0.65,
    reorder_threshold: 0.72,
    burst_probability: 0.08,
    burst_max: 5,
};

// Tick (= ndxml frame index) at which maneuver jamming kicks in.
//
// The maneuver scenario data has fixed beats: Team 2 transmits a
// `TEAM-2 FIRES MISSILE` remark at frame 70 (≈atSec 17.5) and the
// teams transition into KIA frames at frame 150 (≈atSec 37.5).
// The narrative requires the *jamming* to start *before* the
// missile fires (so the GPS guidance is corrupted by EW). Setting
// JAM_START_TICK = 48 (≈atSec 12) gives the trust EMA ~22 frames
// to converge to LOW before the missile-fire frame at 70, and
// matches the walkthrough's "Interference begins" stop at atSec 13.
//
// 4 frames per atSec at any speed (sender emits one frame per
// 250 ms / speed; walkthrough driver scales elapsedSec by the same
// speed), so the ratio holds regardless of the speed slider.
const MANEUVER_JAM_START_TICK: u64 = 48;

// Per-(scenario, unit, tick) chaos profile.
//
// uav scenario:  Team 1 (unit_a) is operating an EW system to jam the
//                hostile drone — running the EW shows up on Team 1's
//                own wire from the first frame. Team 3 (unit_c) sits
//                ~250 m away, well inside the 500 m neighbor-drag
//                radius, so its trust drops via FR-03 even though
//                its own wire is clean. Team 2 (unit_b) is ~2.5 km
//                away — outside the radius, stays HIGH. Eagle 1
//                (FW-FRIEND-01) is relayed by Team 2 and inherits
//                its clean trust.
// maneuver scenario: Clean for the first MANEUVER_JAM_START_TICK
//                frames (setup + flank approach). After that, both
//                Team 1 and Team 2 flip to HEAVY_JAM — Team 2 is
//                the dominant target; Team 1 sits close enough that
//                it gets dragged via FR-03 even on ticks when its
//                own wire is holding together.
fn chaos_for(unit: &str, scenario: &str, tick: u64) -> ChaosConfig {
    match (scenario, unit) {
        ("uav", "unit_a") => HEAVY_JAM,
        ("maneuver", "unit_a") | ("maneuver", "unit_b") => {
            if tick >= MANEUVER_JAM_START_TICK {
                HEAVY_JAM
            } else {
                NO_CHAOS
            }
        }
        _ => NO_CHAOS,
    }
}

#[derive(Clone, Copy)]
struct ChaosConfig {
    drop_threshold: f64,
    duplicate_threshold: f64,
    corrupt_threshold: f64,
    reorder_threshold: f64,
    burst_probability: f64,
    burst_max: u32,
}

#[derive(Clone)]
struct StateVector {
    icao24: String,
    callsign: Option<String>,
    latitude: f64,
    longitude: f64,
    baro_altitude: Option<f64>,
    velocity: Option<f64>,
    true_track: Option<f64>,
}

// Per-aircraft state held inside each sender unit. Refreshed from
// OpenSky every OPENSKY_POLL_SECS, extrapolated forward every tick.
#[derive(Clone)]
struct ExtrapState {
    icao24: String,
    callsign: Option<String>,
    lat: f64,
    lon: f64,
    altitude: f64,
    velocity_mps: f64,
    heading_rad: f64,
    last_anchor: Instant,
    last_emit: Instant,
}

impl ExtrapState {
    fn from_vector(sv: &StateVector) -> Self {
        let now = Instant::now();
        Self {
            icao24: sv.icao24.clone(),
            callsign: sv.callsign.clone(),
            lat: sv.latitude,
            lon: sv.longitude,
            altitude: sv.baro_altitude.unwrap_or(0.0),
            velocity_mps: sv.velocity.unwrap_or(0.0),
            heading_rad: sv.true_track.unwrap_or(0.0).to_radians(),
            last_anchor: now,
            last_emit: now,
        }
    }

    fn refresh(&mut self, sv: &StateVector) {
        self.lat = sv.latitude;
        self.lon = sv.longitude;
        if let Some(alt) = sv.baro_altitude {
            self.altitude = alt;
        }
        if let Some(vel) = sv.velocity {
            self.velocity_mps = vel;
        }
        if let Some(track) = sv.true_track {
            self.heading_rad = track.to_radians();
        }
        if sv.callsign.is_some() {
            self.callsign = sv.callsign.clone();
        }
        let now = Instant::now();
        self.last_anchor = now;
        self.last_emit = now;
    }

    fn extrapolate(&mut self, dt_secs: f64) {
        if self.velocity_mps == 0.0 || dt_secs <= 0.0 {
            return;
        }
        let mpd_lat = 111_320.0_f64;
        let mpd_lon = 111_320.0 * self.lat.to_radians().cos().max(0.05);
        let dx_m = self.velocity_mps * dt_secs * self.heading_rad.sin();
        let dy_m = self.velocity_mps * dt_secs * self.heading_rad.cos();
        self.lat += dy_m / mpd_lat;
        self.lon += dx_m / mpd_lon;
    }

    fn to_cot(&self, seq: u64, unit: &str, sensor_lat: f64, sensor_lon: f64) -> String {
        let now = Utc::now();
        let stale = now + chrono::Duration::seconds(60);
        let now_str = now.format("%Y-%m-%dT%H:%M:%S%.3fZ");
        let stale_str = stale.format("%Y-%m-%dT%H:%M:%S%.3fZ");

        let uid = format!("{}-ICAO-{}", unit, self.icao24);
        let callsign = self
            .callsign
            .as_deref()
            .unwrap_or(self.icao24.as_str());
        let course_deg = self.heading_rad.to_degrees();

        format!(
            r#"<event version="2.0" uid="{uid}" type="a-u-A-C-F" time="{now}" start="{now}" stale="{stale}">
    <point lat="{lat}" lon="{lon}" hae="{hae:.1}" ce="9999.0" le="9999.0"/>
    <detail>
        <contact callsign="{callsign}"/>
        <track course="{course:.1}" speed="{speed:.1}"/>
        <sensor lat="{sensor_lat}" lon="{sensor_lon}"/>
    </detail>
    <remarks>unit={unit} callsign={callsign} seq={seq}</remarks>
</event>"#,
            uid = uid,
            now = now_str,
            stale = stale_str,
            lat = self.lat,
            lon = self.lon,
            hae = self.altitude,
            callsign = callsign,
            course = course_deg,
            speed = self.velocity_mps,
            sensor_lat = sensor_lat,
            sensor_lon = sensor_lon,
            unit = unit,
            seq = seq,
        )
    }
}

fn fetch_viewport(client: &reqwest::blocking::Client) -> Viewport {
    match client
        .get(format!("{}/viewport", LISTENER_URL))
        .timeout(Duration::from_secs(2))
        .send()
        .and_then(|r| r.json::<Viewport>())
    {
        Ok(vp) => vp,
        Err(_) => DEFAULT_VIEWPORT,
    }
}

enum FetchOutcome {
    Ok(Vec<StateVector>),
    RateLimited(u64),
    Err(String),
}

fn fetch_opensky(
    client: &reqwest::blocking::Client,
    vp: &Viewport,
) -> FetchOutcome {
    let url = format!(
        "{}?lamin={}&lomin={}&lamax={}&lomax={}",
        OPENSKY_URL, vp.south, vp.west, vp.north, vp.east,
    );

    let resp = match client.get(&url).timeout(Duration::from_secs(8)).send() {
        Ok(r) => r,
        Err(e) => return FetchOutcome::Err(format!("send: {e}")),
    };

    if resp.status().as_u16() == 429 {
        let retry_after = resp
            .headers()
            .get("x-rate-limit-retry-after-seconds")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);
        return FetchOutcome::RateLimited(retry_after);
    }
    if !resp.status().is_success() {
        return FetchOutcome::Err(format!("http status: {}", resp.status()));
    }

    let body: serde_json::Value = match resp.json() {
        Ok(v) => v,
        Err(e) => return FetchOutcome::Err(format!("json: {e}")),
    };

    let mut result = Vec::new();
    let states = match body["states"].as_array() {
        Some(s) => s,
        None => return FetchOutcome::Ok(result),
    };

    for state in states {
        let arr = match state.as_array() {
            Some(a) => a,
            None => continue,
        };

        let icao24 = match arr.first().and_then(|v| v.as_str()) {
            Some(s) => s.trim().to_string(),
            None => continue,
        };

        let callsign = arr
            .get(1)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let longitude = match arr.get(5).and_then(|v| v.as_f64()) {
            Some(v) => v,
            None => continue,
        };
        let latitude = match arr.get(6).and_then(|v| v.as_f64()) {
            Some(v) => v,
            None => continue,
        };

        result.push(StateVector {
            icao24,
            callsign,
            latitude,
            longitude,
            baro_altitude: arr.get(7).and_then(|v| v.as_f64()),
            velocity: arr.get(9).and_then(|v| v.as_f64()),
            true_track: arr.get(10).and_then(|v| v.as_f64()),
        });
    }

    FetchOutcome::Ok(result)
}

fn run_fetcher(senders: Vec<mpsc::Sender<Vec<StateVector>>>) {
    let client = reqwest::blocking::Client::new();

    loop {
        let vp = fetch_viewport(&client);
        println!(
            "[fetcher] OpenSky bbox lat=[{:.3},{:.3}] lon=[{:.3},{:.3}]",
            vp.south, vp.north, vp.west, vp.east
        );
        let sleep_secs = match fetch_opensky(&client, &vp) {
            FetchOutcome::Ok(aircraft) => {
                println!(
                    "[fetcher] {} aircraft -> {} units",
                    aircraft.len(),
                    senders.len()
                );
                for tx in &senders {
                    let _ = tx.send(aircraft.clone());
                }
                OPENSKY_POLL_SECS
            }
            FetchOutcome::RateLimited(retry_after) => {
                let backoff = retry_after.clamp(60, 60 * 60);
                eprintln!(
                    "[fetcher] OpenSky 429 rate limited; backing off {}s",
                    backoff
                );
                backoff
            }
            FetchOutcome::Err(e) => {
                eprintln!("[fetcher] OpenSky fetch error: {e}; backing off 30s");
                30
            }
        };
        thread::sleep(Duration::from_secs(sleep_secs));
    }
}

fn run_sender(
    unit: &str,
    bind_port: u16,
    rx: mpsc::Receiver<Vec<StateVector>>,
    sensor_lat: f64,
    sensor_lon: f64,
    ndxml_files_for_unit: Option<Vec<&'static str>>,
    scenario: Arc<RwLock<String>>,
    speed: Arc<RwLock<f64>>,
    paused: Arc<RwLock<bool>>,
    restart_seq: Arc<RwLock<u64>>,
) {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", bind_port))
        .unwrap_or_else(|e| panic!("[{unit}] failed to bind port {bind_port}: {e}"));
    let target = "127.0.0.1:9999";

    let mut rng = rng();
    let mut state: HashMap<String, ExtrapState> = HashMap::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    let mut seq = 0u64;
    let mut last_tick = Instant::now();

    // Load the .ndxml files for the active scenario, then track which
    // scenario we're currently playing so we can reload on switch.
    let mut current_scenario = scenario.read().unwrap().clone();
    let mut current_restart_seq = *restart_seq.read().unwrap();
    let mut ndxml_files: Option<Vec<Vec<String>>> =
        ndxml_files_for_unit.as_ref().map(|filenames| {
            filenames
                .iter()
                .filter_map(|fname| load_scenario_ndxml(&current_scenario, fname))
                .collect::<Vec<_>>()
        });
    // Drop empty / all-failed loads so the unit goes ADS-B-mode.
    if let Some(ref f) = ndxml_files {
        if f.is_empty() {
            ndxml_files = None;
        }
    }
    // One cursor per file so all lists advance in parallel each tick.
    let mut ndxml_indices: Vec<usize> = ndxml_files
        .as_ref()
        .map(|fs| vec![0usize; fs.len()])
        .unwrap_or_default();
    // Tick counter and primary loop period drive the
    // SCENARIO_LOOP_RESET sentinel that tells the frontend to clear.
    let mut ndxml_tick_count: u64 = 0;
    let mut ndxml_loop_period: u64 = ndxml_files
        .as_ref()
        .and_then(|fs| fs.iter().map(|f| f.len()).find(|&n| n > 0))
        .unwrap_or(0) as u64;

    loop {
        // Drain any new fetches from the OpenSky thread (non-blocking).
        // In ndxml mode this channel stays empty; the drain is harmless.
        while let Ok(batch) = rx.try_recv() {
            for sv in &batch {
                state
                    .entry(sv.icao24.clone())
                    .and_modify(|ac| ac.refresh(sv))
                    .or_insert_with(|| ExtrapState::from_vector(sv));
            }
            println!(
                "[{unit}] anchored {} tracks (state size {})",
                batch.len(),
                state.len()
            );
        }

        // Tick once per (BASE / speed) ms: queue the next message(s).
        // Speed is read every loop iteration so a slider change takes
        // effect on the next tick.
        //
        // While playback is paused, freeze the cursor and skip the
        // tick body. We do NOT advance `last_tick` while paused, so
        // resume picks up exactly where it left off — the next tick
        // fires immediately, then resyncs to the normal cadence. No
        // message is queued, no chaos applied, no UDP send.
        let now = Instant::now();
        let is_paused = *paused.read().unwrap();
        if is_paused {
            // Slide last_tick forward while paused so the unpause
            // doesn't trigger a giant `dt` (which would teleport
            // ADS-B extrapolation tracks far off course).
            last_tick = now;
            thread::sleep(Duration::from_millis(50));
            continue;
        }
        let speed_now = *speed.read().unwrap();
        let tick_ms = ((EMIT_TICK_BASE_MS as f64) / speed_now.clamp(SPEED_MIN, SPEED_MAX))
            .round() as u64;
        let tick_ms = tick_ms.max(20);
        if now.duration_since(last_tick) >= Duration::from_millis(tick_ms) {
            let dt = now.duration_since(last_tick).as_secs_f64();

            // If the active scenario changed OR the operator bumped
            // the restart counter ("walk through again"), reload
            // .ndxml files, reset cursors to frame 0, and emit a
            // reset signal (unit_a only).
            let latest_scenario = scenario.read().unwrap().clone();
            let latest_restart_seq = *restart_seq.read().unwrap();
            let scenario_changed = latest_scenario != current_scenario;
            let restart_bumped = latest_restart_seq != current_restart_seq;
            if (scenario_changed || restart_bumped) && ndxml_files_for_unit.is_some() {
                if scenario_changed {
                    println!(
                        "[{unit}] scenario change {} -> {}, reloading",
                        current_scenario, latest_scenario
                    );
                } else {
                    println!(
                        "[{unit}] restart bump {} -> {}, reloading from frame 0",
                        current_restart_seq, latest_restart_seq
                    );
                }
                current_scenario = latest_scenario;
                current_restart_seq = latest_restart_seq;
                ndxml_files = ndxml_files_for_unit.as_ref().map(|filenames| {
                    filenames
                        .iter()
                        .filter_map(|fname| load_scenario_ndxml(&current_scenario, fname))
                        .collect::<Vec<_>>()
                });
                if let Some(ref f) = ndxml_files {
                    if f.is_empty() {
                        ndxml_files = None;
                    }
                }
                ndxml_indices = ndxml_files
                    .as_ref()
                    .map(|fs| vec![0usize; fs.len()])
                    .unwrap_or_default();
                ndxml_loop_period = ndxml_files
                    .as_ref()
                    .and_then(|fs| fs.iter().map(|f| f.len()).find(|&n| n > 0))
                    .unwrap_or(0) as u64;
                ndxml_tick_count = 0;
                if unit == "unit_a" {
                    seq += 1;
                    queue.push_back(reset_signal_xml(seq, unit, sensor_lat, sensor_lon));
                }
            }

            if let Some(ref files) = ndxml_files {
                // The unit's *primary* ndxml file (first by main()
                // convention) is the unit's own ground track. Pull
                // lat/lon off its current frame and use that as the
                // sensor position for every frame this unit emits
                // this tick. Static scenarios (uav) read back the
                // start coords; moving scenarios (maneuver) get a
                // sensor position that follows the unit. Falls back
                // to the configured constants if parsing fails.
                let (tick_sensor_lat, tick_sensor_lon) = files
                    .first()
                    .and_then(|first| {
                        let i = ndxml_indices.first().copied().unwrap_or(0);
                        let raw = first.get(i % first.len())?;
                        read_lat_lon(raw)
                    })
                    .unwrap_or((sensor_lat, sensor_lon));

                // unit_a is the canonical loop driver -- when its
                // tick count wraps the file length, all units have
                // wrapped (they share period). Emit a sentinel reset
                // event before the next loop's frame 0 so the
                // frontend can clear state.
                if unit == "unit_a"
                    && ndxml_loop_period > 0
                    && ndxml_tick_count > 0
                    && ndxml_tick_count % ndxml_loop_period == 0
                {
                    seq += 1;
                    queue.push_back(reset_signal_xml(
                        seq, unit, tick_sensor_lat, tick_sensor_lon,
                    ));
                }

                // NDXML mode: emit one message per file per tick, all files advance in parallel.
                for (file_msgs, idx) in files.iter().zip(ndxml_indices.iter_mut()) {
                    seq += 1;
                    let raw = &file_msgs[*idx % file_msgs.len()];
                    *idx += 1;
                    queue.push_back(inject_ndxml(
                        raw, seq, unit, tick_sensor_lat, tick_sensor_lon,
                    ));
                }
                ndxml_tick_count += 1;
            } else {
                // ADS-B mode: extrapolate every tracked aircraft and queue CoT.
                for ac in state.values_mut() {
                    let anchor_age = now.duration_since(ac.last_anchor);
                    if anchor_age >= Duration::from_secs(EMIT_SKIP_AFTER_SECS) {
                        continue;
                    }
                    ac.extrapolate(dt);
                    ac.last_emit = now;
                    seq += 1;
                    queue.push_back(ac.to_cot(seq, unit, sensor_lat, sensor_lon));
                }
                state.retain(|_, ac| {
                    now.duration_since(ac.last_anchor) < Duration::from_secs(ANCHOR_MAX_AGE_SECS)
                });
            }
            last_tick = now;
        }

        // Apply chaos and ship whatever's queued. Chaos profile is
        // (scenario, unit) -- recomputed each batch so a scenario
        // switch immediately changes the wire shape.
        let chaos = chaos_for(unit, &current_scenario, ndxml_tick_count);
        let mut outgoing: Vec<String> = Vec::new();

        while let Some(mut m) = queue.pop_front() {
            // The scenario-loop / scenario-switch sentinel must reach
            // the listener intact -- if HEAVY_JAM swallows it (45%
            // drop, 65% corrupt) on a uav -> maneuver switch the
            // frontend never sees the reset and the prior scenario's
            // tracks ghost on the map until they age out.
            if m.contains(SCENARIO_RESET_UID) {
                outgoing.push(m);
                continue;
            }

            let roll: f64 = rng.random();

            if roll < chaos.drop_threshold {
                continue;
            }

            if roll < chaos.duplicate_threshold {
                outgoing.push(m.clone());
            }

            if roll < chaos.corrupt_threshold {
                m = corrupt_message(&m, &mut rng);
            }

            if roll < chaos.reorder_threshold {
                queue.push_back(m);
                continue;
            }

            outgoing.push(m);
        }

        if rng.random_bool(chaos.burst_probability) {
            for _ in 0..rng.random_range(2u32..chaos.burst_max) {
                if let Some(extra) = queue.pop_front() {
                    outgoing.push(extra);
                }
            }
        }

        for msg in outgoing {
            if let Err(e) = socket.send_to(msg.as_bytes(), target) {
                eprintln!("[{unit}] send error: {e}");
            }
        }

        // 5ms is small enough that tick cadence stays accurate at
        // speed 4× (tick_period = 63 ms), large enough to avoid
        // pegging a core. Earlier this was 50 ms which floored the
        // tick rate at higher speeds and caused the walkthrough's
        // wall-clock-paced popups to drift ahead of the sender's
        // actual frame advance.
        thread::sleep(Duration::from_millis(5));
    }
}

fn main() {
    // Per-unit ndxml file lists. Unit_a is back to driving the
    // scenario reset cadence; uav scenario doesn't have a unit_a file
    // so load_scenario_ndxml will simply skip it for that scenario
    // and unit_a will fall through to ADS-B (or stay idle).
    let files_a: Option<Vec<&'static str>> = Some(vec![NDXML_FILE_A]);
    let files_b: Option<Vec<&'static str>> = Some(vec![NDXML_FILE_B, NDXML_FILE_FW]);
    let files_c: Option<Vec<&'static str>> = Some(vec![
        NDXML_FILE_C,
        NDXML_FILE_UAV1,
        NDXML_FILE_UAV2,
    ]);

    // Shared scenario state. Initialized from the active-scenario
    // marker file (or DEFAULT_SCENARIO if absent), then kept in sync
    // by the poller thread below. unit threads read this each tick
    // and reload .ndxml when it changes.
    let initial = read_active_scenario_file().unwrap_or_else(|| DEFAULT_SCENARIO.to_string());
    let scenario = Arc::new(RwLock::new(initial.clone()));
    println!("[main] active scenario at startup: {}", initial);

    // Shared playback-speed multiplier. Same poller pattern -- reads
    // scenarios/.speed on a tight loop so the operator's slider
    // change reaches every unit thread within ~SCENARIO_POLL_MS.
    let initial_speed = read_speed_file().unwrap_or(SPEED_DEFAULT);
    let speed = Arc::new(RwLock::new(initial_speed));
    println!("[main] speed multiplier at startup: {:.2}x", initial_speed);

    let initial_paused = read_paused_file().unwrap_or(false);
    let paused = Arc::new(RwLock::new(initial_paused));
    println!("[main] paused at startup: {}", initial_paused);

    let initial_restart = read_restart_seq_file().unwrap_or(0);
    let restart_seq = Arc::new(RwLock::new(initial_restart));
    println!("[main] restart_seq at startup: {}", initial_restart);

    {
        let scenario = Arc::clone(&scenario);
        let speed = Arc::clone(&speed);
        let paused = Arc::clone(&paused);
        let restart_seq = Arc::clone(&restart_seq);
        thread::spawn(move || run_scenario_poller(scenario, speed, paused, restart_seq));
    }

    let (_tx_a, rx_a) = mpsc::channel::<Vec<StateVector>>();
    let (tx_b, rx_b) = mpsc::channel::<Vec<StateVector>>();
    let (tx_c, rx_c) = mpsc::channel::<Vec<StateVector>>();

    {
        let scenario = Arc::clone(&scenario);
        let speed = Arc::clone(&speed);
        let paused = Arc::clone(&paused);
        let restart_seq = Arc::clone(&restart_seq);
        thread::spawn(move || {
            run_sender(
                "unit_a", 9001, rx_a, UNIT_A_LAT, UNIT_A_LON,
                files_a, scenario, speed, paused, restart_seq,
            )
        });
    }
    {
        let scenario = Arc::clone(&scenario);
        let speed = Arc::clone(&speed);
        let paused = Arc::clone(&paused);
        let restart_seq = Arc::clone(&restart_seq);
        thread::spawn(move || {
            run_sender(
                "unit_b", 9002, rx_b, UNIT_B_LAT, UNIT_B_LON,
                files_b, scenario, speed, paused, restart_seq,
            )
        });
    }
    {
        let scenario = Arc::clone(&scenario);
        let speed = Arc::clone(&speed);
        let paused = Arc::clone(&paused);
        let restart_seq = Arc::clone(&restart_seq);
        thread::spawn(move || {
            run_sender(
                "unit_c", 9003, rx_c, UNIT_C_LAT, UNIT_C_LON,
                files_c, scenario, speed, paused, restart_seq,
            )
        });
    }

    println!("[main] ndxml mode active; ADS-B fetcher disabled");
    loop {
        thread::sleep(Duration::from_secs(3600));
    }
}

// Reads the active-scenario marker file at the repo root. None if the
// file is missing, empty, or not readable.
fn read_active_scenario_file() -> Option<String> {
    let path = find_repo_path(ACTIVE_SCENARIO_FILE)?;
    let content = std::fs::read_to_string(&path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn read_speed_file() -> Option<f64> {
    let path = find_repo_path(SPEED_FILE)?;
    let content = std::fs::read_to_string(&path).ok()?;
    let parsed: f64 = content.trim().parse().ok()?;
    if parsed.is_finite() && parsed > 0.0 {
        Some(parsed.clamp(SPEED_MIN, SPEED_MAX))
    } else {
        None
    }
}

fn read_paused_file() -> Option<bool> {
    let path = find_repo_path(PAUSED_FILE)?;
    let content = std::fs::read_to_string(&path).ok()?;
    Some(content.trim() == "1")
}

fn read_restart_seq_file() -> Option<u64> {
    let path = find_repo_path(RESTART_FILE)?;
    let content = std::fs::read_to_string(&path).ok()?;
    content.trim().parse::<u64>().ok()
}

// Polls the marker files on disk and pushes any change into the
// shared state. The listener writes the marker files when the
// frontend POSTs the corresponding endpoint, which makes the poller
// a thin bridge between the two processes.
fn run_scenario_poller(
    scenario: Arc<RwLock<String>>,
    speed: Arc<RwLock<f64>>,
    paused: Arc<RwLock<bool>>,
    restart_seq: Arc<RwLock<u64>>,
) {
    loop {
        thread::sleep(Duration::from_millis(SCENARIO_POLL_MS));
        if let Some(on_disk) = read_active_scenario_file() {
            let current = scenario.read().unwrap().clone();
            if on_disk != current {
                println!("[poller] scenario change on disk: {} -> {}", current, on_disk);
                *scenario.write().unwrap() = on_disk;
            }
        }
        if let Some(on_disk) = read_speed_file() {
            let current = *speed.read().unwrap();
            if (on_disk - current).abs() > 1e-3 {
                println!(
                    "[poller] speed change on disk: {:.2}x -> {:.2}x",
                    current, on_disk
                );
                *speed.write().unwrap() = on_disk;
            }
        }
        if let Some(on_disk) = read_paused_file() {
            let current = *paused.read().unwrap();
            if on_disk != current {
                println!(
                    "[poller] paused change on disk: {} -> {}",
                    current, on_disk
                );
                *paused.write().unwrap() = on_disk;
            }
        }
        if let Some(on_disk) = read_restart_seq_file() {
            let current = *restart_seq.read().unwrap();
            if on_disk != current {
                println!(
                    "[poller] restart bump on disk: {} -> {}",
                    current, on_disk
                );
                *restart_seq.write().unwrap() = on_disk;
            }
        }
    }
}

// Resolve a repo-relative path against CWD first, then walk up from
// the binary location. The binary lives at
// `<repo>/backend/target/{debug,release}/sender`, so popping 4 times
// lands at the repo root.
fn find_repo_path(rel: &str) -> Option<std::path::PathBuf> {
    let cwd_path = std::path::Path::new(rel);
    if cwd_path.exists() {
        return Some(cwd_path.to_path_buf());
    }
    if let Ok(mut exe) = std::env::current_exe() {
        for _ in 0..4 {
            exe.pop();
        }
        exe.push(rel);
        if exe.exists() {
            return Some(exe);
        }
    }
    None
}

// Resolve and load a single .ndxml file from `scenarios/<scenario>/<file>`.
// Returns None on missing, unreadable, or empty file.
fn load_scenario_ndxml(scenario: &str, filename: &str) -> Option<Vec<String>> {
    let rel = format!("scenarios/{}/{}", scenario, filename);
    let resolved = match find_repo_path(&rel) {
        Some(p) => p,
        None => {
            println!(
                "[ndxml] could not find {} — skipping for this scenario",
                rel
            );
            return None;
        }
    };
    match std::fs::read_to_string(&resolved) {
        Ok(content) => {
            let lines: Vec<String> = content
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|l| l.to_string())
                .collect();
            if lines.is_empty() {
                println!("[ndxml] {} is empty, skipping", resolved.display());
                None
            } else {
                println!(
                    "[ndxml] loaded {} messages from {}",
                    lines.len(),
                    resolved.display()
                );
                Some(lines)
            }
        }
        Err(e) => {
            println!("[ndxml] could not read {}: {} — skipping", resolved.display(), e);
            None
        }
    }
}

// Sentinel CoT event the frontend recognizes as "scenario looped or
// scenario switched -- drop everything you know and start fresh".
// Emitted by unit_a only on (a) loop wrap, (b) scenario change.
const SCENARIO_RESET_UID: &str = "__SCENARIO_LOOP_RESET__";

fn reset_signal_xml(seq: u64, unit: &str, sensor_lat: f64, sensor_lon: f64) -> String {
    let now = Utc::now();
    let stale = now + chrono::Duration::seconds(60);
    let now_str = now.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    let stale_str = stale.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    format!(
        concat!(
            r#"<event version="2.0" uid="{uid}" type="t-x-c-r" how="m-g" "#,
            r#"time="{now}" start="{now}" stale="{stale}">"#,
            r#"<point lat="0" lon="0" hae="0" ce="0" le="0"/>"#,
            r#"<detail><contact callsign="RESET"/>"#,
            r#"<sensor lat="{sensor_lat}" lon="{sensor_lon}"/>"#,
            r#"<remarks>unit={unit} seq={seq} scenario_reset</remarks>"#,
            r#"</detail></event>"#,
        ),
        uid = SCENARIO_RESET_UID,
        now = now_str,
        stale = stale_str,
        sensor_lat = sensor_lat,
        sensor_lon = sensor_lon,
        unit = unit,
        seq = seq,
    )
}

// Read a numeric XML attribute (lat/lon/etc.) out of a raw event
// string. Returns None if the attribute isn't present or doesn't
// parse as f64. Used to derive a unit's *current* transmitter
// position from its primary ndxml track each tick, so the sensor
// lat/lon stamped onto outbound frames follows the unit instead of
// staying pinned at the unit's start coords.
fn read_xml_attr_f64(s: &str, attr: &str) -> Option<f64> {
    let pattern = format!("{}=\"", attr);
    let val_start = s.find(&pattern)? + pattern.len();
    let end_offset = s[val_start..].find('"')?;
    s[val_start..val_start + end_offset].parse().ok()
}

fn read_lat_lon(s: &str) -> Option<(f64, f64)> {
    let lat = read_xml_attr_f64(s, "lat")?;
    let lon = read_xml_attr_f64(s, "lon")?;
    Some((lat, lon))
}

// Replace the value of a single XML attribute (first occurrence only).
fn replace_xml_attr(s: &str, attr: &str, value: &str) -> String {
    let pattern = format!("{}=\"", attr);
    if let Some(start) = s.find(&pattern) {
        let val_start = start + pattern.len();
        if let Some(end_offset) = s[val_start..].find('"') {
            let mut result = s.to_string();
            result.replace_range(val_start..val_start + end_offset, value);
            return result;
        }
    }
    s.to_string()
}

// Take a raw ndxml line and stamp it with current timestamps, inject <sensor>,
// and append a remarks element carrying the sender unit and seq number.
fn inject_ndxml(raw: &str, seq: u64, unit: &str, sensor_lat: f64, sensor_lon: f64) -> String {
    let now = Utc::now();
    let stale = now + chrono::Duration::seconds(60);
    let now_str = now.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    let stale_str = stale.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();

    let s = replace_xml_attr(raw, "time", &now_str);
    let s = replace_xml_attr(&s, "start", &now_str);
    let s = replace_xml_attr(&s, "stale", &stale_str);

    // Inject sensor position element before </detail>
    let sensor_tag = format!("<sensor lat=\"{}\" lon=\"{}\"/>", sensor_lat, sensor_lon);
    let s = s.replace("</detail>", &format!("{}</detail>", sensor_tag));

    // Attach unit + seq to remarks, adding the element if absent
    let remarks_suffix = format!("unit={} seq={}", unit, seq);
    if s.contains("<remarks>") {
        s.replace("</remarks>", &format!(" {}</remarks>", remarks_suffix))
    } else {
        s.replace("</event>", &format!("<remarks>{}</remarks></event>", remarks_suffix))
    }
}

fn corrupt_message(input: &str, rng: &mut impl RngExt) -> String {
    // Corrupt the `<point lat="...">` attribute name so the listener's
    // parse_cot rejects the message (data.lat = None → None return →
    // CRC-breach signal). Targeting `lat=` keeps the uid intact, so
    // corruption never spawns ghost tracks on the frontend the way a
    // random-byte flip used to.
    if let Some(start) = input.find("lat=\"") {
        let mut bytes = input.as_bytes().to_vec();
        let offset = rng.random_range(0..3);
        bytes[start + offset] = b'X';
        return String::from_utf8_lossy(&bytes).to_string();
    }

    let mut bytes = input.as_bytes().to_vec();
    if !bytes.is_empty() {
        let idx = rng.random_range(0..bytes.len());
        bytes[idx] = b'X';
    }
    String::from_utf8_lossy(&bytes).to_string()
}
