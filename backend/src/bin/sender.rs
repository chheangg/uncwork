use chrono::Utc;
use rand::RngExt;
use rand::rng;
use serde::Deserialize;
use std::collections::{HashMap, VecDeque};
use std::net::UdpSocket;
use std::sync::mpsc;
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

// Per-unit ndxml files (one per track UID)
const NDXML_PATH_A: &str = "grd-friend-01.ndxml";
const NDXML_PATH_B: &str = "grd-friend-02.ndxml";
const NDXML_PATH_C: &str = "grd-friend-03.ndxml";
const NDXML_PATH_FW: &str = "fw-friend-01.ndxml";
const NDXML_PATH_UAV1: &str = "uav-hostile-01.ndxml";
const NDXML_PATH_UAV2: &str = "uav-hostile-02.ndxml";

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
const EMIT_TICK_MS: u64 = 1000;
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

// Chaos pipeline disabled for the scripted scenario: all degradation
// is now scripted directly into the ndxml ce/le ramp + jitter, so the
// random drop/dup/corrupt/reorder mutations from the sender (which
// occasionally clobbered the uid attribute and produced phantom
// tracks) have been zeroed out.
const NO_CHAOS: ChaosConfig = ChaosConfig {
    drop_threshold: 0.0,
    duplicate_threshold: 0.0,
    corrupt_threshold: 0.0,
    reorder_threshold: 0.0,
    burst_probability: 0.0,
    burst_max: 3,
};

const UNIT_A_CHAOS: ChaosConfig = NO_CHAOS;
const UNIT_B_CHAOS: ChaosConfig = NO_CHAOS;
const UNIT_C_CHAOS: ChaosConfig = NO_CHAOS;

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
    chaos: ChaosConfig,
    sensor_lat: f64,
    sensor_lon: f64,
    ndxml_files: Option<Vec<Vec<String>>>,
) {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", bind_port))
        .unwrap_or_else(|e| panic!("[{unit}] failed to bind port {bind_port}: {e}"));
    let target = "127.0.0.1:9999";

    let mut rng = rng();
    let mut state: HashMap<String, ExtrapState> = HashMap::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    let mut seq = 0u64;
    let mut last_tick = Instant::now();
    // One cursor per file so all lists advance in parallel each tick.
    let mut ndxml_indices: Vec<usize> = ndxml_files
        .as_ref()
        .map(|fs| vec![0usize; fs.len()])
        .unwrap_or_default();

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

        // Tick once per EMIT_TICK_MS: queue the next message(s).
        let now = Instant::now();
        if now.duration_since(last_tick) >= Duration::from_millis(EMIT_TICK_MS) {
            let dt = now.duration_since(last_tick).as_secs_f64();

            if let Some(ref files) = ndxml_files {
                // NDXML mode: emit one message per file per tick, all files advance in parallel.
                for (file_msgs, idx) in files.iter().zip(ndxml_indices.iter_mut()) {
                    seq += 1;
                    let raw = &file_msgs[*idx % file_msgs.len()];
                    *idx += 1;
                    queue.push_back(inject_ndxml(raw, seq, unit, sensor_lat, sensor_lon));
                }
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

        // Apply chaos and ship whatever's queued.
        let mut outgoing: Vec<String> = Vec::new();

        while let Some(mut m) = queue.pop_front() {
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

        thread::sleep(Duration::from_millis(50));
    }
}

fn main() {
    let files_a = load_ndxml(NDXML_PATH_A).map(|f| vec![f]);

    // unit_b drives its own position plus the friendly fixed-wing asset in parallel
    let files_b = {
        let mut files: Vec<Vec<String>> = Vec::new();
        if let Some(f) = load_ndxml(NDXML_PATH_B) { files.push(f); }
        if let Some(f) = load_ndxml(NDXML_PATH_FW) { files.push(f); }
        if files.is_empty() { None } else { Some(files) }
    };

    // unit_c drives its own position plus both hostile UAVs in parallel
    let files_c = {
        let mut files: Vec<Vec<String>> = Vec::new();
        if let Some(f) = load_ndxml(NDXML_PATH_C) { files.push(f); }
        if let Some(f) = load_ndxml(NDXML_PATH_UAV1) { files.push(f); }
        if let Some(f) = load_ndxml(NDXML_PATH_UAV2) { files.push(f); }
        if files.is_empty() { None } else { Some(files) }
    };

    let using_ndxml = files_a.is_some() || files_b.is_some() || files_c.is_some();

    let (tx_a, rx_a) = mpsc::channel::<Vec<StateVector>>();
    let (tx_b, rx_b) = mpsc::channel::<Vec<StateVector>>();
    let (tx_c, rx_c) = mpsc::channel::<Vec<StateVector>>();

    thread::spawn(move || run_sender("unit_a", 9001, rx_a, UNIT_A_CHAOS, UNIT_A_LAT, UNIT_A_LON, files_a));
    thread::spawn(move || run_sender("unit_b", 9002, rx_b, UNIT_B_CHAOS, UNIT_B_LAT, UNIT_B_LON, files_b));
    thread::spawn(move || run_sender("unit_c", 9003, rx_c, UNIT_C_CHAOS, UNIT_C_LAT, UNIT_C_LON, files_c));

    if using_ndxml {
        println!("[main] ndxml mode active; ADS-B fetcher disabled");
        loop { thread::sleep(Duration::from_secs(3600)); }
    } else {
        run_fetcher(vec![tx_a, tx_b, tx_c]);
    }
}

// Locate the ndxml file by trying CWD first, then walking up from the binary's
// location. The binary lives at <repo>/backend/target/release/sender, so 4 pops
// land at the repo root where the .ndxml file lives.
fn find_ndxml(filename: &str) -> Option<std::path::PathBuf> {
    let cwd_path = std::path::Path::new(filename);
    if cwd_path.exists() {
        return Some(cwd_path.to_path_buf());
    }
    if let Ok(mut exe) = std::env::current_exe() {
        for _ in 0..4 {
            exe.pop();
        }
        exe.push(filename);
        if exe.exists() {
            return Some(exe);
        }
    }
    None
}

fn load_ndxml(path: &str) -> Option<Vec<String>> {
    let resolved = match find_ndxml(path) {
        Some(p) => p,
        None => {
            println!("[ndxml] could not find {} — falling back to ADS-B", path);
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
                println!("[ndxml] file is empty, falling back to ADS-B");
                None
            } else {
                println!("[ndxml] loaded {} messages from {}", lines.len(), resolved.display());
                Some(lines)
            }
        }
        Err(e) => {
            println!("[ndxml] could not read {}: {} — falling back to ADS-B", resolved.display(), e);
            None
        }
    }
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
    let mut bytes = input.as_bytes().to_vec();

    if !bytes.is_empty() {
        let idx = rng.random_range(0..bytes.len());
        bytes[idx] = b'X';
    }

    String::from_utf8_lossy(&bytes).to_string()
}
