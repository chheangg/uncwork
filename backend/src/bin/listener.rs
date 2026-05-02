use axum::{
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use axum::extract::ws::{Message, WebSocket};
use chrono::Utc;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::CorsLayer;

// EMA smoothing: ~6-message time constant
const TRUST_ALPHA: f64 = 0.15;
const QUALITY_CLEAN: f64 = 0.95;
const QUALITY_DUPLICATE: f64 = 0.40;
const QUALITY_OUT_OF_ORDER: f64 = 0.30;
const QUALITY_DROPPED: f64 = 0.05;
const QUALITY_CORRUPT: f64 = 0.00;
// Silence decay: after 20s idle, score falls at 0.97/sec
const DECAY_THRESHOLD_SECS: f64 = 20.0;
const DECAY_RATE_PER_SEC: f64 = 0.97;
// Neighbor influence: senders within this radius share degradation
const NEIGHBOR_RADIUS_MILES: f64 = 5.0;
const NEIGHBOR_INFLUENCE: f64 = 0.5;

struct TrustState {
    score: f64,
    last_event: Instant,
}

impl TrustState {
    fn new() -> Self {
        Self { score: 1.0, last_event: Instant::now() }
    }

    fn record(&mut self, quality: f64) {
        self.score = (TRUST_ALPHA * quality + (1.0 - TRUST_ALPHA) * self.score).clamp(0.0, 1.0);
        self.last_event = Instant::now();
    }

    fn decay_if_stale(&mut self) {
        let elapsed = self.last_event.elapsed().as_secs_f64();
        if elapsed > DECAY_THRESHOLD_SECS {
            let secs_past = elapsed - DECAY_THRESHOLD_SECS;
            self.score = (self.score * DECAY_RATE_PER_SEC.powf(secs_past)).clamp(0.0, 1.0);
        }
    }

    fn current(&self) -> f64 {
        self.score
    }
}

#[derive(Clone, Serialize)]
struct SenderInfo {
    addr: String,
    last_seen: String,
    message_count: u64,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
}

#[derive(Serialize)]
struct SenderResponse {
    addr: String,
    last_seen: String,
    message_count: u64,
    trust_score: f64,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
}

#[derive(Clone, Serialize)]
struct CotMessage {
    uid: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    hae: Option<String>,
    flight_number: Option<String>,
    remarks: Option<String>,
    source: String,
    trust_score: f64,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
struct Viewport {
    south: f64,
    west: f64,
    north: f64,
    east: f64,
}

const DEFAULT_VIEWPORT: Viewport = Viewport {
    south: 36.5,
    west: -123.5,
    north: 38.5,
    east: -121.0,
};

struct AppState {
    senders: RwLock<HashMap<String, SenderInfo>>,
    trust: RwLock<HashMap<String, TrustState>>,
    cot_tx: broadcast::Sender<CotMessage>,
    viewport: RwLock<Viewport>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (cot_tx, _) = broadcast::channel::<CotMessage>(256);

    let state = Arc::new(AppState {
        senders: RwLock::new(HashMap::new()),
        trust: RwLock::new(HashMap::new()),
        cot_tx,
        viewport: RwLock::new(DEFAULT_VIEWPORT),
    });

    let udp_state = Arc::clone(&state);
    tokio::spawn(async move {
        if let Err(e) = run_udp(udp_state).await {
            eprintln!("UDP listener error: {e}");
        }
    });

    let decay_state = Arc::clone(&state);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
        loop {
            interval.tick().await;
            let mut trust = decay_state.trust.write().await;
            for t in trust.values_mut() {
                t.decay_if_stale();
            }
        }
    });

    let app = Router::new()
        .route("/senders", get(get_senders))
        .route("/ws", get(ws_handler))
        .route("/viewport", get(get_viewport).post(set_viewport))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let tcp = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("HTTP/WS server on http://0.0.0.0:3000");
    axum::serve(tcp, app).await?;

    Ok(())
}

async fn run_udp(state: Arc<AppState>) -> std::io::Result<()> {
    let socket = UdpSocket::bind("0.0.0.0:9999").await?;
    println!("Listening for CoT on 0.0.0.0:9999...");

    let mut buf = [0u8; 4096];
    // Dedup by (uid, time) so retransmitted packets are dropped
    // but legitimate position updates for the same uid pass through.
    let mut seen_frames: HashSet<(String, String)> = HashSet::new();
    // Per-sender sequence counters (unit_a and unit_b each have independent seqs)
    let mut next_seq: HashMap<String, u64> = HashMap::new();

    loop {
        let (amt, src) = socket.recv_from(&mut buf).await?;
        let xml = String::from_utf8_lossy(&buf[..amt]).to_string();
        let src_str = src.to_string();

        println!("--- Incoming CoT from {} ---", src_str);

        {
            let mut senders = state.senders.write().await;
            let entry = senders.entry(src_str.clone()).or_insert_with(|| SenderInfo {
                addr: src_str.clone(),
                last_seen: String::new(),
                message_count: 0,
                sensor_lat: None,
                sensor_lon: None,
            });
            entry.last_seen = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
            entry.message_count += 1;
        }

        match parse_cot(&xml) {
            Some(data) => {
                let uid = data.uid.clone().unwrap_or_default();
                let time_key = data.time.clone().unwrap_or_default();
                let frame_key = (uid.clone(), time_key);

                if seen_frames.contains(&frame_key) {
                    println!("DUPLICATE suppressed: {}\n", uid);
                    state.trust.write().await
                        .entry(src_str.clone()).or_insert_with(TrustState::new)
                        .record(QUALITY_DUPLICATE);
                    continue;
                }
                seen_frames.insert(frame_key);
                if seen_frames.len() > 8192 {
                    seen_frames.clear();
                }

                // Persist sensor position into the sender registry
                if data.sensor_lat.is_some() || data.sensor_lon.is_some() {
                    let mut senders = state.senders.write().await;
                    if let Some(info) = senders.get_mut(&src_str) {
                        info.sensor_lat = data.sensor_lat;
                        info.sensor_lon = data.sensor_lon;
                    }
                }

                // Sequence tracking + trust update
                {
                    let mut trust = state.trust.write().await;
                    let t = trust.entry(src_str.clone()).or_insert_with(TrustState::new);
                    let expected = next_seq.entry(src_str.clone()).or_insert(1);

                    match data.remarks.as_deref().and_then(parse_seq_from_remarks) {
                        Some(seq) if seq < *expected => {
                            println!("OUT-OF-ORDER: seq={} arrived after seq={}", seq, *expected - 1);
                            t.record(QUALITY_OUT_OF_ORDER);
                        }
                        Some(seq) if seq > *expected => {
                            let dropped = seq - *expected;
                            println!(
                                "GAP detected: seq={} (missed {} message{})",
                                seq, dropped, if dropped == 1 { "" } else { "s" }
                            );
                            for _ in 0..dropped.min(5) {
                                t.record(QUALITY_DROPPED);
                            }
                            t.record(QUALITY_CLEAN);
                            *expected = seq + 1;
                        }
                        Some(seq) => {
                            t.record(QUALITY_CLEAN);
                            *expected = seq + 1;
                        }
                        None => {
                            t.record(QUALITY_CLEAN);
                        }
                    }
                }

                // Compute effective trust: raw EMA pulled down by nearby degraded senders
                let effective_score = {
                    let senders = state.senders.read().await;
                    let trust = state.trust.read().await;
                    let raw = trust.get(&src_str).map(|t| t.current()).unwrap_or(1.0);
                    compute_effective_trust(&src_str, raw, &senders, &trust)
                };

                let cot_msg = CotMessage {
                    uid: data.uid,
                    time: data.time,
                    start: data.start,
                    stale: data.stale,
                    lat: data.lat,
                    lon: data.lon,
                    hae: data.hae,
                    flight_number: data.callsign,
                    remarks: data.remarks,
                    source: src_str,
                    trust_score: effective_score,
                    sensor_lat: data.sensor_lat,
                    sensor_lon: data.sensor_lon,
                };

                print_cot(&cot_msg);
                let _ = state.cot_tx.send(cot_msg);
            }
            None => {
                println!("Failed to parse CoT message (corrupt)\n");
                state.trust.write().await
                    .entry(src_str).or_insert_with(TrustState::new)
                    .record(QUALITY_CORRUPT);
            }
        }
    }
}

async fn get_senders(State(state): State<Arc<AppState>>) -> Json<Vec<SenderResponse>> {
    let senders = state.senders.read().await;
    let trust = state.trust.read().await;

    Json(
        senders.values().map(|info| {
            let raw = trust.get(&info.addr).map(|t| t.current()).unwrap_or(1.0);
            let effective = compute_effective_trust(&info.addr, raw, &senders, &trust);
            SenderResponse {
                addr: info.addr.clone(),
                last_seen: info.last_seen.clone(),
                message_count: info.message_count,
                trust_score: effective,
                sensor_lat: info.sensor_lat,
                sensor_lon: info.sensor_lon,
            }
        }).collect()
    )
}

async fn get_viewport(State(state): State<Arc<AppState>>) -> Json<Viewport> {
    Json(*state.viewport.read().await)
}

async fn set_viewport(
    State(state): State<Arc<AppState>>,
    Json(vp): Json<Viewport>,
) -> Json<Viewport> {
    let mut current = state.viewport.write().await;
    *current = vp;
    Json(vp)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.cot_tx.subscribe();

    loop {
        match rx.recv().await {
            Ok(msg) => {
                let json = match serde_json::to_string(&msg) {
                    Ok(j) => j,
                    Err(_) => continue,
                };
                if socket.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(n)) => {
                eprintln!("WS client lagged, dropped {} messages", n);
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

// Applies a one-way neighbor drag: if any sender within NEIGHBOR_RADIUS_MILES has a lower
// raw trust score, pull the effective score toward that worst neighbor.
// Scores can only go down — a better neighbor has no effect.
fn compute_effective_trust(
    own_addr: &str,
    raw_score: f64,
    senders: &HashMap<String, SenderInfo>,
    trust: &HashMap<String, TrustState>,
) -> f64 {
    let own_info = match senders.get(own_addr) {
        Some(i) => i,
        None => return raw_score,
    };
    let (own_lat, own_lon) = match (own_info.sensor_lat, own_info.sensor_lon) {
        (Some(lat), Some(lon)) => (lat, lon),
        _ => return raw_score,
    };

    let worst_nearby = trust
        .iter()
        .filter(|(addr, _)| addr.as_str() != own_addr)
        .filter_map(|(addr, t)| {
            let info = senders.get(addr)?;
            let neighbor_lat = info.sensor_lat?;
            let neighbor_lon = info.sensor_lon?;
            let dist = haversine_miles(own_lat, own_lon, neighbor_lat, neighbor_lon);
            if dist <= NEIGHBOR_RADIUS_MILES { Some(t.current()) } else { None }
        })
        .fold(f64::INFINITY, f64::min);

    if worst_nearby.is_finite() && worst_nearby < raw_score {
        let dragged = raw_score + NEIGHBOR_INFLUENCE * (worst_nearby - raw_score);
        dragged.clamp(0.0, raw_score)
    } else {
        raw_score
    }
}

fn haversine_miles(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_MILES: f64 = 3958.8;
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let lat1 = lat1.to_radians();
    let lat2 = lat2.to_radians();
    let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    EARTH_RADIUS_MILES * 2.0 * a.sqrt().asin()
}

// Extracts "seq=N" from the remarks text produced by the sender.
fn parse_seq_from_remarks(remarks: &str) -> Option<u64> {
    remarks
        .split_whitespace()
        .find_map(|token| token.strip_prefix("seq=")?.parse().ok())
}

#[derive(Default)]
struct CotData {
    uid: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    hae: Option<String>,
    callsign: Option<String>,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
    remarks: Option<String>,
}

fn parse_cot(xml: &str) -> Option<CotData> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut data = CotData::default();
    let mut current_tag = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag = tag.clone();

                if tag == "event" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let val = attr.unescape_value().unwrap_or_default().to_string();

                        match key.as_ref() {
                            "uid" => data.uid = Some(val),
                            "time" => data.time = Some(val),
                            "start" => data.start = Some(val),
                            "stale" => data.stale = Some(val),
                            _ => {}
                        }
                    }
                }
            }

            Ok(Event::Empty(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if tag == "point" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let val = attr.unescape_value().unwrap_or_default().to_string();

                        match key.as_ref() {
                            "lat" => data.lat = Some(val),
                            "lon" => data.lon = Some(val),
                            "hae" => data.hae = Some(val),
                            _ => {}
                        }
                    }
                } else if tag == "contact" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let val = attr.unescape_value().unwrap_or_default().to_string();

                        if key.as_ref() == "callsign" {
                            data.callsign = Some(val);
                        }
                    }
                } else if tag == "sensor" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let val = attr.unescape_value().unwrap_or_default().to_string();

                        match key.as_ref() {
                            "lat" => data.sensor_lat = val.parse().ok(),
                            "lon" => data.sensor_lon = val.parse().ok(),
                            _ => {}
                        }
                    }
                }
            }

            Ok(Event::Text(e)) => {
                let text = String::from_utf8_lossy(e.as_ref()).to_string();

                if current_tag == "remarks" && !text.is_empty() {
                    data.remarks = Some(text);
                }
            }

            Ok(Event::Eof) => break,
            Err(_) => return None,
            _ => {}
        }

        buf.clear();
    }

    // Reject messages where lat or lon is absent or not a valid f64.
    // Corruption can hit attribute names (e.g. "lat" → "lXt") producing
    // a structurally valid XML document where the coordinate is simply
    // never populated, which would otherwise serialize as JSON null and
    // be treated as 0 by the frontend.
    let lat_valid = data.lat.as_deref().and_then(|s| s.parse::<f64>().ok()).is_some();
    let lon_valid = data.lon.as_deref().and_then(|s| s.parse::<f64>().ok()).is_some();
    if !lat_valid || !lon_valid {
        return None;
    }

    Some(data)
}

fn print_cot(msg: &CotMessage) {
    println!("UID:          {}", msg.uid.as_deref().unwrap_or("N/A"));
    println!("Flight:       {}", msg.flight_number.as_deref().unwrap_or("N/A"));
    println!("Trust:        {:.3}", msg.trust_score);
    println!("Time:         {}", msg.time.as_deref().unwrap_or("N/A"));
    println!("Stale:        {}", msg.stale.as_deref().unwrap_or("N/A"));
    println!(
        "Position:     lat={}, lon={}, hae={}",
        msg.lat.as_deref().unwrap_or("N/A"),
        msg.lon.as_deref().unwrap_or("N/A"),
        msg.hae.as_deref().unwrap_or("N/A"),
    );
    if let Some(r) = &msg.remarks {
        println!("Remarks:      {}", r);
    }
    println!("--------------------------------------\n");
}
