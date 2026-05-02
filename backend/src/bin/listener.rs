use quick_xml::events::Event;
use quick_xml::Reader;
use std::collections::HashSet;
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("0.0.0.0:9999")?;
    println!("Listening on 0.0.0.0:9999...");

    let mut buf = [0u8; 4096];
    let mut seen_uids: HashSet<String> = HashSet::new();
    let mut next_expected_seq: u64 = 1;

    loop {
        let (amt, src) = socket.recv_from(&mut buf)?;
        let xml = String::from_utf8_lossy(&buf[..amt]);

        println!("--- Incoming CoT from {} ---", src);

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

                print_cot(data);
            }
            None => println!("Failed to parse CoT message\n"),
        }
    }
}

fn parse_seq(uid: &str) -> Option<u64> {
    uid.strip_prefix("test-")?.parse().ok()
}

#[derive(Default, Debug)]
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

fn print_cot(data: CotData) {
    println!("UID:      {}", data.uid.unwrap_or_else(|| "N/A".into()));
    println!("Time:     {}", data.time.unwrap_or_else(|| "N/A".into()));
    println!("Start:    {}", data.start.unwrap_or_else(|| "N/A".into()));
    println!("Stale:    {}", data.stale.unwrap_or_else(|| "N/A".into()));
    println!(
        "Position: lat={}, lon={}",
        data.lat.unwrap_or_else(|| "N/A".into()),
        data.lon.unwrap_or_else(|| "N/A".into())
    );

    if let Some(r) = data.remarks {
        println!("Remarks:  {}", r);
    }

    println!("--------------------------------------\n");
}
