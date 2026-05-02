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
const ANCHOR_MAX_AGE_SECS: u64 = 120;

#[derive(Clone, Copy, Deserialize)]
struct Viewport {
    south: f64,
    west: f64,
    north: f64,
    east: f64,
}

// unit_a: moderate instability
const UNIT_A_CHAOS: ChaosConfig = ChaosConfig {
    drop_threshold: 0.20,
    duplicate_threshold: 0.40,
    corrupt_threshold: 0.55,
    reorder_threshold: 0.75,
    burst_probability: 0.30,
    burst_max: 5,
};

// unit_b: severely degraded link
const UNIT_B_CHAOS: ChaosConfig = ChaosConfig {
    drop_threshold: 0.40,
    duplicate_threshold: 0.60,
    corrupt_threshold: 0.75,
    reorder_threshold: 0.90,
    burst_probability: 0.55,
    burst_max: 8,
};

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

    fn to_cot(&self, seq: u64, unit: &str) -> String {
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

fn fetch_opensky(
    client: &reqwest::blocking::Client,
    vp: &Viewport,
) -> Result<Vec<StateVector>, Box<dyn std::error::Error>> {
    let url = format!(
        "{}?lamin={}&lomin={}&lamax={}&lomax={}",
        OPENSKY_URL, vp.south, vp.west, vp.north, vp.east,
    );

    let body: serde_json::Value = client
        .get(&url)
        .timeout(Duration::from_secs(8))
        .send()?
        .json()?;

    let mut result = Vec::new();
    let states = match body["states"].as_array() {
        Some(s) => s,
        None => return Ok(result),
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

    Ok(result)
}

fn run_fetcher(senders: Vec<mpsc::Sender<Vec<StateVector>>>) {
    let client = reqwest::blocking::Client::new();

    loop {
        let vp = fetch_viewport(&client);
        println!(
            "[fetcher] OpenSky bbox lat=[{:.3},{:.3}] lon=[{:.3},{:.3}]",
            vp.south, vp.north, vp.west, vp.east
        );
        match fetch_opensky(&client, &vp) {
            Ok(aircraft) => {
                println!(
                    "[fetcher] {} aircraft -> {} units",
                    aircraft.len(),
                    senders.len()
                );
                for tx in &senders {
                    let _ = tx.send(aircraft.clone());
                }
            }
            Err(e) => eprintln!("[fetcher] OpenSky fetch error: {e}"),
        }
        thread::sleep(Duration::from_secs(OPENSKY_POLL_SECS));
    }
}

fn run_sender(
    unit: &str,
    bind_port: u16,
    rx: mpsc::Receiver<Vec<StateVector>>,
    chaos: ChaosConfig,
) {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", bind_port))
        .unwrap_or_else(|e| panic!("[{unit}] failed to bind port {bind_port}: {e}"));
    let target = "127.0.0.1:9999";

    let mut rng = rng();
    let mut state: HashMap<String, ExtrapState> = HashMap::new();
    let mut queue: VecDeque<String> = VecDeque::new();
    let mut seq = 0u64;
    let mut last_tick = Instant::now();

    loop {
        // Drain any new fetches from the OpenSky thread (non-blocking).
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

        // Tick once per EMIT_TICK_MS: extrapolate every aircraft and queue
        // a CoT message for it.
        let now = Instant::now();
        if now.duration_since(last_tick) >= Duration::from_millis(EMIT_TICK_MS) {
            let dt = now.duration_since(last_tick).as_secs_f64();
            for ac in state.values_mut() {
                ac.extrapolate(dt);
                ac.last_emit = now;
                seq += 1;
                queue.push_back(ac.to_cot(seq, unit));
            }
            last_tick = now;

            // Drop tracks that haven't been refreshed by OpenSky in a while.
            state.retain(|_, ac| {
                now.duration_since(ac.last_anchor)
                    < Duration::from_secs(ANCHOR_MAX_AGE_SECS)
            });
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
    let (tx_a, rx_a) = mpsc::channel::<Vec<StateVector>>();
    let (tx_b, rx_b) = mpsc::channel::<Vec<StateVector>>();

    thread::spawn(move || run_sender("unit_a", 9001, rx_a, UNIT_A_CHAOS));
    thread::spawn(move || run_sender("unit_b", 9002, rx_b, UNIT_B_CHAOS));

    run_fetcher(vec![tx_a, tx_b]);
}

fn corrupt_message(input: &str, rng: &mut impl RngExt) -> String {
    let mut bytes = input.as_bytes().to_vec();

    if !bytes.is_empty() {
        let idx = rng.random_range(0..bytes.len());
        bytes[idx] = b'X';
    }

    String::from_utf8_lossy(&bytes).to_string()
}
