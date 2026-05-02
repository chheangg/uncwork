use chrono::Utc;
use rand::RngExt;
use rand::rng;
use std::collections::VecDeque;
use std::net::UdpSocket;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

// San Francisco center + bounding box for a ~100-mile radius
const SF_LAT: f64 = 37.7749;
const SF_LON: f64 = -122.4194;
// 100 miles ≈ 160.9 km; 1° lat ≈ 111.32 km; 1° lon at 37.77° ≈ 88.0 km
const LAT_DELTA: f64 = 1.446;
const LON_DELTA: f64 = 1.829;

const OPENSKY_URL: &str = "https://opensky-network.org/api/states/all";

// unit_a: moderate instability (existing conditions)
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

fn fetch_opensky(client: &reqwest::blocking::Client) -> Result<Vec<StateVector>, Box<dyn std::error::Error>> {
    let url = format!(
        "{}?lamin={}&lomin={}&lamax={}&lomax={}",
        OPENSKY_URL,
        SF_LAT - LAT_DELTA,
        SF_LON - LON_DELTA,
        SF_LAT + LAT_DELTA,
        SF_LON + LON_DELTA,
    );

    let body: serde_json::Value = client.get(&url).send()?.json()?;

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

        // Field order per OpenSky REST API docs (v1):
        // [0] icao24  [1] callsign  [5] longitude  [6] latitude
        // [7] baro_altitude  [9] velocity  [10] true_track
        let icao24 = match arr.get(0).and_then(|v| v.as_str()) {
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

fn state_to_cot(sv: &StateVector, seq: u64, unit: &str) -> String {
    let now = Utc::now();
    let stale = now + chrono::Duration::seconds(300);
    let now_str = now.format("%Y-%m-%dT%H:%M:%S%.3fZ");
    let stale_str = stale.format("%Y-%m-%dT%H:%M:%S%.3fZ");

    let uid = format!("{}-ICAO-{}", unit, sv.icao24);
    let callsign = sv.callsign.as_deref().unwrap_or(sv.icao24.as_str());
    let hae = sv.baro_altitude.unwrap_or(0.0);
    let course = sv.true_track.unwrap_or(0.0);
    let speed = sv.velocity.unwrap_or(0.0);

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
        lat = sv.latitude,
        lon = sv.longitude,
        hae = hae,
        callsign = callsign,
        course = course,
        speed = speed,
        unit = unit,
        seq = seq,
    )
}

fn run_fetcher(senders: Vec<mpsc::Sender<Vec<StateVector>>>) {
    let client = reqwest::blocking::Client::new();

    loop {
        println!("[fetcher] Fetching OpenSky data (San Francisco ±100mi)...");
        match fetch_opensky(&client) {
            Ok(aircraft) => {
                println!("[fetcher] Got {} aircraft, distributing to {} units", aircraft.len(), senders.len());
                for tx in &senders {
                    // Each unit gets its own clone of the batch
                    let _ = tx.send(aircraft.clone());
                }
            }
            Err(e) => eprintln!("[fetcher] OpenSky fetch error: {e}"),
        }

        // OpenSky asks for ≥10s between anonymous requests
        thread::sleep(Duration::from_secs(10));
    }
}

fn run_sender(unit: &str, bind_port: u16, rx: mpsc::Receiver<Vec<StateVector>>, chaos: ChaosConfig) {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", bind_port))
        .unwrap_or_else(|e| panic!("[{unit}] failed to bind port {bind_port}: {e}"));
    let target = "127.0.0.1:9999";

    let mut rng = rng();
    let mut queue: VecDeque<String> = VecDeque::new();
    let mut seq = 0u64;

    loop {
        let aircraft = match rx.recv() {
            Ok(a) => a,
            Err(_) => {
                eprintln!("[{unit}] fetcher channel closed, exiting");
                return;
            }
        };

        for sv in &aircraft {
            seq += 1;
            queue.push_back(state_to_cot(sv, seq, unit));
        }

        let mut outgoing: Vec<String> = Vec::new();

        while let Some(mut m) = queue.pop_front() {
            let roll: f64 = rng.random();

            if roll < chaos.drop_threshold {
                println!("[{unit}] DROP");
                continue;
            }

            if roll < chaos.duplicate_threshold {
                println!("[{unit}] DUPLICATE");
                outgoing.push(m.clone());
            }

            if roll < chaos.corrupt_threshold {
                println!("[{unit}] CORRUPT");
                m = corrupt_message(&m, &mut rng);
            }

            if roll < chaos.reorder_threshold {
                println!("[{unit}] REORDER");
                queue.push_back(m);
                continue;
            }

            outgoing.push(m);
        }

        if rng.random_bool(chaos.burst_probability) {
            println!("[{unit}] BURST MODE");
            for _ in 0..rng.random_range(2u32..chaos.burst_max) {
                if let Some(extra) = queue.pop_front() {
                    outgoing.push(extra);
                }
            }
        }

        for msg in outgoing {
            if let Err(e) = socket.send_to(msg.as_bytes(), target) {
                eprintln!("[{unit}] send error: {e}");
            } else {
                println!("[{unit}] SENT:\n{}\n", msg);
            }
        }
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
