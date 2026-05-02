use rand::RngExt;
use rand::rng;
use std::collections::VecDeque;
use std::net::UdpSocket;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    let target = "127.0.0.1:9999";

    let mut rng = rng();
    let mut queue: VecDeque<String> = VecDeque::new();

    let mut seq = 0;

    loop {
        seq += 1;

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let msg = format!(
            r#"<event version="2.0" uid="test-{seq}" type="a-f-G-U-C"
time="{now}" start="{now}" stale="{stale}">
    <point lat="37.7749" lon="-122.4194" />
    <remarks>seq={seq}</remarks>
</event>"#,
            seq = seq,
            now = now,
            stale = now + 60
        );

        queue.push_back(msg);

        let mut outgoing: Vec<String> = Vec::new();

        while let Some(mut m) = queue.pop_front() {
            let roll: f64 = rng.random();

            if roll < 0.2 {
                println!("DROP");
                continue;
            }

            if roll < 0.4 {
                println!("DUPLICATE");
                outgoing.push(m.clone());
            }

            if roll < 0.55 {
                println!("CORRUPT");
                m = corrupt_message(&m, &mut rng);
            }

            if roll < 0.75 {
                println!("REORDER");
                queue.push_back(m);
                continue;
            }

            outgoing.push(m);
        }

        if rng.random_bool(0.3) {
            println!("BURST MODE");
            for _ in 0..rng.random_range(2..5) {
                if let Some(extra) = queue.pop_front() {
                    outgoing.push(extra);
                }
            }
        }

        let n = rng.random_range(2..5);

        for msg in outgoing {
            socket.send_to(msg.as_bytes(), target)?;
            println!("SENT:\n{}\n", msg);
        }

        thread::sleep(Duration::from_secs(2));
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