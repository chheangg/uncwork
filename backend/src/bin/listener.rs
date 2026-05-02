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
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::CorsLayer;

#[derive(Clone, Serialize)]
struct SenderInfo {
    addr: String,
    last_seen: String,
    message_count: u64,
}

#[derive(Clone, Serialize)]
struct CotMessage {
    uid: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
    remarks: Option<String>,
    source: String,
}

struct AppState {
    senders: RwLock<HashMap<String, SenderInfo>>,
    cot_tx: broadcast::Sender<CotMessage>,
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let (cot_tx, _) = broadcast::channel::<CotMessage>(256);

    let state = Arc::new(AppState {
        senders: RwLock::new(HashMap::new()),
        cot_tx,
    });

    let udp_state = Arc::clone(&state);
    tokio::spawn(async move {
        if let Err(e) = run_udp(udp_state).await {
            eprintln!("UDP listener error: {e}");
        }
    });

    let app = Router::new()
        .route("/senders", get(get_senders))
        .route("/ws", get(ws_handler))
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
    let mut seen_uids: HashSet<String> = HashSet::new();
    let mut next_expected_seq: u64 = 1;

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
            });
            entry.last_seen = Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
            entry.message_count += 1;
        }

        match parse_cot(&xml) {
            Some(data) => {
                let uid = data.uid.clone().unwrap_or_default();

                if seen_uids.contains(&uid) {
                    println!("DUPLICATE suppressed: {}\n", uid);
                    continue;
                }
                seen_uids.insert(uid.clone());

                if let Some(seq) = parse_seq(&uid) {
                    if seq < next_expected_seq {
                        println!(
                            "OUT-OF-ORDER: seq={} arrived after seq={}",
                            seq,
                            next_expected_seq - 1
                        );
                    } else if seq > next_expected_seq {
                        let dropped = seq - next_expected_seq;
                        println!(
                            "GAP detected: seq={} (missed {} message{})",
                            seq,
                            dropped,
                            if dropped == 1 { "" } else { "s" }
                        );
                        next_expected_seq = seq + 1;
                    } else {
                        next_expected_seq = seq + 1;
                    }
                }

                let cot_msg = CotMessage {
                    uid: data.uid,
                    time: data.time,
                    start: data.start,
                    stale: data.stale,
                    lat: data.lat,
                    lon: data.lon,
                    remarks: data.remarks,
                    source: src_str,
                };

                print_cot(&cot_msg);
                let _ = state.cot_tx.send(cot_msg);
            }
            None => println!("Failed to parse CoT message\n"),
        }
    }
}

async fn get_senders(State(state): State<Arc<AppState>>) -> Json<Vec<SenderInfo>> {
    let senders = state.senders.read().await;
    Json(senders.values().cloned().collect())
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

fn parse_seq(uid: &str) -> Option<u64> {
    uid.strip_prefix("test-")?.parse().ok()
}

#[derive(Default)]
struct CotData {
    uid: Option<String>,
    time: Option<String>,
    start: Option<String>,
    stale: Option<String>,
    lat: Option<String>,
    lon: Option<String>,
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

    Some(data)
}

fn print_cot(msg: &CotMessage) {
    println!("UID:      {}", msg.uid.as_deref().unwrap_or("N/A"));
    println!("Time:     {}", msg.time.as_deref().unwrap_or("N/A"));
    println!("Start:    {}", msg.start.as_deref().unwrap_or("N/A"));
    println!("Stale:    {}", msg.stale.as_deref().unwrap_or("N/A"));
    println!(
        "Position: lat={}, lon={}",
        msg.lat.as_deref().unwrap_or("N/A"),
        msg.lon.as_deref().unwrap_or("N/A")
    );
    if let Some(r) = &msg.remarks {
        println!("Remarks:  {}", r);
    }
    println!("--------------------------------------\n");
}
