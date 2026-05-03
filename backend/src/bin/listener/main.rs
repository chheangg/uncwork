//! UncWork CoT listener — UDP ingest + trust scoring + WS broadcast.
//!
//! ## FRS provenance map
//!
//! Every threshold below is anchored on `docs/threshold-defense.md` (the
//! master evidence artifact). Search that file for the FR-id to find the
//! source-tier breakdown and the Q&A index card the pitch lead recites on
//! stage.
//!
//! - **FR-01 — Temporal anomaly (3σ inter-arrival).** EWMA-on-IAT shape from
//!   Osanaiye, Alfa, Hancke, *Sensors* 2018 (foundational-supporting); short-
//!   window-vs-baseline construction from Radoš, Brkić, Begušić, *Sensors*
//!   2024 (tier-1). The 3σ multiplier itself is engineering judgment —
//!   Q&A card 6, R17 honesty gap. Detector lives in `trust::IatHistory`.
//! - **FR-02 — Network stability (5% CRC over 60s rolling).** Sits between
//!   commercial CRC > 1% (Red Hat / Cisco, tier-4) and 3GPP NR/LTE BLER >
//!   10% sustained link-failure trigger. Q&A card 5, R17 honesty gap.
//!   Detector lives in `crc::CrcWindow` (Phase 2).
//! - **FR-03 — Spatial correlation (500m neighbor radius).** Operator-
//!   anchored: FPV-operator practice from Hambling, *IEEE Spectrum* 2024
//!   (tier-4); flanked above by Pole-21 25 km/module (TRADOC ODIN, tier-2)
//!   and R-330Zh 25–30 km ground footprint. Spatial-pattern-as-discriminator
//!   argument: Lo et al., ION ITM 2025 (tier-1) + Aguiar et al., *Space
//!   Weather* 2025 (tier-1). Q&A card 7, R17 honesty gap.
//! - **FR-04 — Jammer fingerprint catalog.** Deterministic threshold
//!   matching against publicly characterized systems (TRADOC ODIN tier-2 +
//!   Lo 2025 tier-1). Q&A card 4, R14 mitigation: this is *not* ML.
//! - **OR-fusion architecture.** Priyadarshani et al., IEEE 2024 (tier-1):
//!   PER-only detectors miss deceptive jamming. Q&A card 8.
//! - **R16 mitigation — continuous trust, not binary.** Excalibur PK
//!   70%→6% (Watling/Reynolds, RUSI Stormbreak 2023, tier-2; cited by Patt,
//!   House Armed Services testimony Mar 2024, tier-2): munitions degrade
//!   gracefully then collapse. Q&A card 1.
//!
//! Grep `FR-01`..`FR-04`, `R14`, `R16`, `R17` in this directory for the
//! live trail.

mod fingerprint;
mod trust;

use axum::extract::ws::{Message, WebSocket};
use axum::{
    Json, Router,
    extract::{State, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
};
use chrono::Utc;
use quick_xml::Reader;
use quick_xml::events::Event;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use tokio::net::UdpSocket;
use tokio::sync::{RwLock, broadcast};
use tower_http::cors::CorsLayer;

use trust::{
    DEFAULT_NEIGHBOR_RADIUS_M, QUALITY_CLEAN, QUALITY_CORRUPT, QUALITY_CRC_BREACH, QUALITY_DROPPED,
    QUALITY_DUPLICATE, QUALITY_FINGERPRINT_MATCH, QUALITY_OUT_OF_ORDER, QUALITY_TEMPORAL_ANOMALY,
    SenderPosition, SpatialClass, TrustState, classify_spatial, compute_effective_trust,
};

use fingerprint::Fingerprint;

#[derive(Clone, Serialize)]
struct SenderInfo {
    addr: String,
    last_seen: String,
    message_count: u64,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
}

impl SenderPosition for SenderInfo {
    fn position(&self) -> Option<(f64, f64)> {
        match (self.sensor_lat, self.sensor_lon) {
            (Some(lat), Some(lon)) => Some((lat, lon)),
            _ => None,
        }
    }
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

/// **OR-fusion** wire bag. Per-detector flags emitted alongside the scalar
/// `trust_score` so the frontend (and the pitch lead's stdout demo) can show
/// *which* FR signal tripped, not just the aggregated EMA. Each phase plugs
/// in its own field; absent fields are serialized as `false` / `null` so
/// older WS clients gracefully ignore them.
#[derive(Clone, Serialize)]
struct Detectors {
    /// **FR-01** — most recent inter-arrival was > μ + 3σ for this sender.
    temporal_anomaly: bool,
    /// **FR-02** — corrupt-frame rate over the rolling 60s window (0.0..1.0).
    crc_pct_60s: f64,
    /// **FR-02** — `crc_pct_60s > 5%` *and* the window has at least
    /// `CRC_MIN_SAMPLES` events.
    crc_breach: bool,
    /// **FR-03** — `clear` | `localized` | `blanket` based on the trust
    /// topology around this sender. See `trust::SpatialClass`.
    spatial_class: SpatialClass,
    /// **FR-04** — matched fingerprint (catalog entry) when the CoT
    /// `<remarks>` carry a `threat=<tag>` token. `None` for clean traffic.
    #[serde(skip_serializing_if = "Option::is_none")]
    fingerprint: Option<Fingerprint>,
}

impl Default for Detectors {
    fn default() -> Self {
        Self {
            temporal_anomaly: false,
            crc_pct_60s: 0.0,
            crc_breach: false,
            spatial_class: SpatialClass::Clear,
            fingerprint: None,
        }
    }
}

#[derive(Clone, Serialize)]
struct CotMessage {
    uid: Option<String>,
    cot_type: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    hae: Option<String>,
    ce: Option<String>,
    le: Option<String>,
    flight_number: Option<String>,
    remarks: Option<String>,
    source: String,
    trust_score: f64,
    sensor_lat: Option<f64>,
    sensor_lon: Option<f64>,
    detectors: Detectors,
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
    /// FR-03 neighbor radius in meters. Read once at startup from
    /// `NEIGHBOR_RADIUS_M` env var; default `DEFAULT_NEIGHBOR_RADIUS_M`.
    /// A config change requires a process restart, which matches the FRS
    /// framing of "tunable per deployment".
    neighbor_radius_m: f64,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (cot_tx, _) = broadcast::channel::<CotMessage>(256);

    let neighbor_radius_m = std::env::var("NEIGHBOR_RADIUS_M")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|v| v.is_finite() && *v > 0.0)
        .unwrap_or(DEFAULT_NEIGHBOR_RADIUS_M);
    println!(
        "FR-03 neighbor radius = {:.0} m (default {} m; override via NEIGHBOR_RADIUS_M)",
        neighbor_radius_m, DEFAULT_NEIGHBOR_RADIUS_M
    );

    let state = Arc::new(AppState {
        senders: RwLock::new(HashMap::new()),
        trust: RwLock::new(HashMap::new()),
        cot_tx,
        viewport: RwLock::new(DEFAULT_VIEWPORT),
        neighbor_radius_m,
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
    // Dedup by (uid, time) so retransmitted packets are dropped but
    // legitimate position updates for the same uid pass through.
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
            let entry = senders
                .entry(src_str.clone())
                .or_insert_with(|| SenderInfo {
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
                    // Dedup is keyed by (uid, time) so legitimate position
                    // updates pass through; only retransmits of the exact
                    // same frame land here. Feeds QUALITY_DUPLICATE into
                    // the EMA — contributes to FR-02 stability indirectly
                    // via the score, separate from the rolling CRC% rate.
                    println!("DUPLICATE suppressed: {}\n", uid);
                    state
                        .trust
                        .write()
                        .await
                        .entry(src_str.clone())
                        .or_insert_with(TrustState::new)
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

                // FR-04 — catalog match on scenario `threat=<tag>` token.
                // Resolved before trust update so we can fold the
                // QUALITY_FINGERPRINT_MATCH penalty into the same EMA pass.
                let fingerprint_match: Option<&'static Fingerprint> = data
                    .remarks
                    .as_deref()
                    .and_then(fingerprint::parse_threat_tag)
                    .and_then(fingerprint::lookup_by_tag);
                if let Some(fp) = fingerprint_match {
                    println!(
                        "FR-04 FINGERPRINT MATCH: {} (tag {}) on {} — source: {}",
                        fp.name, fp.tag, src_str, fp.source
                    );
                }

                // Sequence tracking + FR-01 IAT anomaly + FR-02 CRC rate
                // + FR-04 fingerprint penalty + EMA update.
                //
                // Sequence gaps and reorders are *adjacent* to FR-01
                // (temporal anomaly) but distinct: FR-01 is IAT-stat-based
                // (μ + 3σ) and sees on-cadence-but-quiet senders, while
                // seq-tracking sees explicit packet-loss / mis-order on the
                // wire. Both feed the EMA so the trust score reflects
                // either kind of degradation.
                let (temporal_anomaly, crc_pct_60s, crc_breach) = {
                    let now = Instant::now();
                    let mut trust = state.trust.write().await;
                    let t = trust.entry(src_str.clone()).or_insert_with(TrustState::new);
                    let expected = next_seq.entry(src_str.clone()).or_insert(1);

                    // FR-02 — register this clean-parse event in the
                    // rolling CRC window. Corrupt events are registered on
                    // the parse-failure branch (see `None =>` below).
                    let (crc_pct, breached, rising) = t.crc.observe(now, false);
                    if rising {
                        println!(
                            "FR-02 CRC BREACH (rising): {:.1}% > 5% on {}",
                            crc_pct * 100.0,
                            src_str
                        );
                        t.record_at(QUALITY_CRC_BREACH, now);
                    }

                    // FR-01 — observe IAT, ask the rolling-stat detector
                    // whether this delta is > μ + 3σ. Penalize before the
                    // seq-based record so an anomalous sample doesn't get
                    // its trust *raised* by a CLEAN seq below.
                    let dt = t.iat.observe(now);
                    let anomalous = dt.map(|s| t.iat.is_anomaly(s)).unwrap_or(false);
                    if anomalous {
                        let dt_secs = dt.unwrap_or_default();
                        println!(
                            "FR-01 TEMPORAL ANOMALY: dt={:.3}s on {} (window {} samples)",
                            dt_secs,
                            src_str,
                            t.iat.len()
                        );
                        t.record_at(QUALITY_TEMPORAL_ANOMALY, now);
                    }

                    // FR-04 — pull the score toward QUALITY_FINGERPRINT_MATCH
                    // every time a known-jammer signature is on the wire.
                    // The EMA decay handles cool-down naturally.
                    if fingerprint_match.is_some() {
                        t.record_at(QUALITY_FINGERPRINT_MATCH, now);
                    }

                    match data.remarks.as_deref().and_then(parse_seq_from_remarks) {
                        Some(seq) if seq < *expected => {
                            println!(
                                "OUT-OF-ORDER: seq={} arrived after seq={}",
                                seq,
                                *expected - 1
                            );
                            t.record_at(QUALITY_OUT_OF_ORDER, now);
                        }
                        Some(seq) if seq > *expected => {
                            let dropped = seq - *expected;
                            println!(
                                "GAP detected: seq={} (missed {} message{})",
                                seq,
                                dropped,
                                if dropped == 1 { "" } else { "s" }
                            );
                            for _ in 0..dropped.min(5) {
                                t.record_at(QUALITY_DROPPED, now);
                            }
                            t.record_at(QUALITY_CLEAN, now);
                            *expected = seq + 1;
                        }
                        Some(seq) => {
                            t.record_at(QUALITY_CLEAN, now);
                            *expected = seq + 1;
                        }
                        None => {
                            t.record_at(QUALITY_CLEAN, now);
                        }
                    }

                    (anomalous, crc_pct, breached)
                };

                // Compute effective trust: raw EMA pulled down by nearby
                // degraded senders. FR-03 — neighbor radius is the env-
                // tunable `state.neighbor_radius_m`. Also emit the
                // localized/blanket/clear classifier label alongside.
                let (effective_score, spatial_class) = {
                    let senders = state.senders.read().await;
                    let trust = state.trust.read().await;
                    let raw = trust.get(&src_str).map(|t| t.current()).unwrap_or(1.0);
                    let effective = compute_effective_trust(
                        &src_str,
                        raw,
                        &senders,
                        &trust,
                        state.neighbor_radius_m,
                    );
                    let class =
                        classify_spatial(&src_str, &senders, &trust, state.neighbor_radius_m);
                    (effective, class)
                };
                if spatial_class != SpatialClass::Clear {
                    println!("FR-03 SPATIAL: {:?} on {}", spatial_class, src_str);
                }

                let cot_msg = CotMessage {
                    uid: data.uid,
                    cot_type: data.cot_type,
                    time: data.time,
                    start: data.start,
                    stale: data.stale,
                    lat: data.lat,
                    lon: data.lon,
                    hae: data.hae,
                    ce: data.ce,
                    le: data.le,
                    flight_number: data.callsign,
                    remarks: data.remarks,
                    source: src_str,
                    trust_score: effective_score,
                    sensor_lat: data.sensor_lat,
                    sensor_lon: data.sensor_lon,
                    detectors: Detectors {
                        temporal_anomaly,
                        crc_pct_60s,
                        crc_breach,
                        spatial_class,
                        fingerprint: fingerprint_match.copied(),
                    },
                };

                print_cot(&cot_msg);
                let _ = state.cot_tx.send(cot_msg);
            }
            None => {
                // FR-02 input — every parse failure is one CRC-equivalent
                // event in the rolling-rate window. We register the
                // corrupt event, fire `QUALITY_CORRUPT` per-frame, and
                // additionally fire `QUALITY_CRC_BREACH` on the rising
                // edge of the 5%-over-60s threshold.
                println!("Failed to parse CoT message (corrupt)\n");
                let now = Instant::now();
                let mut trust = state.trust.write().await;
                let t = trust.entry(src_str.clone()).or_insert_with(TrustState::new);
                let (pct, _breached, rising) = t.crc.observe(now, true);
                if rising {
                    println!(
                        "FR-02 CRC BREACH (rising): {:.1}% > 5% on {}",
                        pct * 100.0,
                        src_str
                    );
                    t.record_at(QUALITY_CRC_BREACH, now);
                }
                t.record_at(QUALITY_CORRUPT, now);
            }
        }
    }
}

async fn get_senders(State(state): State<Arc<AppState>>) -> Json<Vec<SenderResponse>> {
    let senders = state.senders.read().await;
    let trust = state.trust.read().await;

    Json(
        senders
            .values()
            .map(|info| {
                let raw = trust.get(&info.addr).map(|t| t.current()).unwrap_or(1.0);
                let effective = compute_effective_trust(
                    &info.addr,
                    raw,
                    &senders,
                    &trust,
                    state.neighbor_radius_m,
                );
                SenderResponse {
                    addr: info.addr.clone(),
                    last_seen: info.last_seen.clone(),
                    message_count: info.message_count,
                    trust_score: effective,
                    sensor_lat: info.sensor_lat,
                    sensor_lon: info.sensor_lon,
                }
            })
            .collect(),
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

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
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

// Extracts "seq=N" from the remarks text produced by the sender.
fn parse_seq_from_remarks(remarks: &str) -> Option<u64> {
    remarks
        .split_whitespace()
        .find_map(|token| token.strip_prefix("seq=")?.parse().ok())
}

#[derive(Default)]
struct CotData {
    uid: Option<String>,
    cot_type: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    hae: Option<String>,
    ce: Option<String>,
    le: Option<String>,
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
                            "type" => data.cot_type = Some(val),
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
                            "ce" => data.ce = Some(val),
                            "le" => data.le = Some(val),
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
    // Corruption can hit attribute names (e.g. "lat" → "lXt") producing a
    // structurally valid XML document where the coordinate is simply never
    // populated, which would otherwise serialize as JSON null and be
    // treated as 0 by the frontend.
    let lat_valid = data
        .lat
        .as_deref()
        .and_then(|s| s.parse::<f64>().ok())
        .is_some();
    let lon_valid = data
        .lon
        .as_deref()
        .and_then(|s| s.parse::<f64>().ok())
        .is_some();
    if !lat_valid || !lon_valid {
        return None;
    }

    Some(data)
}

/// **OR-fusion stdout (Q&A card 8).** Emits one summary line listing
/// every detector that has fired for this message, so the pitch lead can
/// point at the live listener log on stage and show which FR signals the
/// score is composed of. Priyadarshani IEEE 2024 (tier-1) is the citation
/// behind the multi-detector framing — no single detector catches
/// everything.
fn render_detectors(d: &Detectors) -> Option<String> {
    let mut tags: Vec<String> = Vec::new();
    if d.temporal_anomaly {
        tags.push("[FR-01 ANOMALY]".to_string());
    }
    if d.crc_breach {
        tags.push(format!("[FR-02 CRC={:.1}%]", d.crc_pct_60s * 100.0));
    }
    match d.spatial_class {
        SpatialClass::Localized => tags.push("[FR-03 LOCALIZED]".to_string()),
        SpatialClass::Blanket => tags.push("[FR-03 BLANKET]".to_string()),
        SpatialClass::Clear => {}
    }
    if let Some(fp) = d.fingerprint {
        tags.push(format!("[FR-04 {}]", fp.tag.to_uppercase()));
    }
    if tags.is_empty() {
        None
    } else {
        Some(tags.join(" "))
    }
}

fn print_cot(msg: &CotMessage) {
    println!("UID:          {}", msg.uid.as_deref().unwrap_or("N/A"));
    println!(
        "Flight:       {}",
        msg.flight_number.as_deref().unwrap_or("N/A")
    );
    println!("Trust:        {:.3}", msg.trust_score);
    if let Some(line) = render_detectors(&msg.detectors) {
        println!("Detectors:    {}", line);
    }
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

#[cfg(test)]
mod render_tests {
    use super::*;
    use crate::fingerprint;

    #[test]
    fn render_detectors_clear_returns_none() {
        let d = Detectors::default();
        assert!(render_detectors(&d).is_none());
    }

    #[test]
    fn render_detectors_emits_all_active_signals() {
        let leer3 = fingerprint::lookup_by_tag("leer3").copied();
        let d = Detectors {
            temporal_anomaly: true,
            crc_pct_60s: 0.082,
            crc_breach: true,
            spatial_class: SpatialClass::Localized,
            fingerprint: leer3,
        };
        let line = render_detectors(&d).unwrap();
        assert!(line.contains("[FR-01 ANOMALY]"));
        assert!(line.contains("[FR-02 CRC=8.2%]"));
        assert!(line.contains("[FR-03 LOCALIZED]"));
        assert!(line.contains("[FR-04 LEER3]"));
    }

    #[test]
    fn render_detectors_omits_inactive_signals() {
        let d = Detectors {
            temporal_anomaly: false,
            crc_pct_60s: 0.0,
            crc_breach: false,
            spatial_class: SpatialClass::Blanket,
            fingerprint: None,
        };
        let line = render_detectors(&d).unwrap();
        assert_eq!(line, "[FR-03 BLANKET]");
    }
}
