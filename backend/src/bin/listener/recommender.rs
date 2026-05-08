//! Server-side Gemini proxy.
//!
//! The frontend POSTs the live picture (scenario + flattened track
//! list) to `/recommend`. We hold the Gemini API key in env, build
//! the system prompt + user message + JSON schema here, call Gemini,
//! and return the parsed structured response.
//!
//! Putting the key on the backend keeps it out of the browser bundle
//! and lets us add rate limits, prompt safety checks, and provider
//! swaps without touching the frontend.
//!
//! Env: `GEMINI_API_KEY` (no `VITE_` prefix — that prefix is a Vite
//! convention for vars exposed to the browser, which is exactly what
//! we are no longer doing).

use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const GEMINI_MODEL: &str = "gemini-2.0-flash";
const GEMINI_ENDPOINT: &str =
    "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT: &str = r#"You are a tactical decision-support assistant embedded in a friendly C2 (Command and Control) console operated by Officer Adam.

The operator is monitoring a live electronic-warfare-aware air/ground picture. Each track is called a "link" and carries:

  - callsign (e.g. TEAM-1, TEAM-2, TEAM-3, EAGLE-1, ENEMY-1)
  - dimension: air | ground | sea_surface | sea_subsurface | space | sof | sensor | other
  - affiliation: friendly | hostile | unknown | neutral
  - sensorType (radar, adsb, ew, etc.)
  - status: healthy | degraded | critical | offline (driven by trustScore: >=0.60 healthy, >=0.30 degraded, >=0.08 critical, else offline)
  - trustScore: 0..1, per-sender EMA of frame quality, then dragged toward the worst neighbor inside 500 m (one-way: a healthy neighbor cannot lift a low score)
  - stale: report past its CoT stale deadline
  - fingerprint (FR-04 classifier, may be null): catalog tag, confidence 0..1, range_km, signature axes

Your job is to identify which links require Adam's attention right now and present 2-3 concrete options for each, ranked best-first, each with an estimated success probability.

A link "requires attention" when ANY of these hold:
  - trustScore < 0.50
  - fingerprint.confidence >= 0.50
  - status is "degraded", "critical", or "offline"
  - stale is true AND the link is friendly
  - it is hostile and any nearby friendly is degraded (clustered EW)

For each attention-worthy link, give 2-3 options. Each option must:
  1. Be a single concrete action verb-first, AFFILIATION- and DIMENSION-aware:
     - friendly ground (TEAM-*): "Reposition", "Hold", "Switch to backup comms", "Pull from line".
     - friendly air (EAGLE-*): "Vector off", "Hand off to backup sensor", "RTB".
     - hostile (UNKNOWN-*, ENEMY-*): "Cue counter-EW", "Engage with kinetic", "Continue track only".
     - sensor: "Cross-cue another sensor", "Mark as unreliable".
     Adapt verbs to the dimension; never recommend kinetic action against a friendly.
  2. Cite the specific evidence (callsign, trustScore numeric, fingerprint tag + confidence, neighbor relationship). Trust score and fingerprint MUST drive the recommendation — do not suggest acting on a low-trust feed without flagging it, and weight any fingerprint match heavily.
  3. Carry a successProb in 0..1 reflecting your estimate of the action achieving Adam's likely intent (typically: protect friendlies, neutralize threat, preserve mission).

Calibration for successProb:
  - 0.80-0.95 = high-confidence, evidence is strong, action is conservative. Use when trustScore is high AND fingerprint is null/low, OR when verifying a low-trust feed.
  - 0.50-0.79 = reasonable bet, some risk. Use when trust is mid or one piece of evidence is mixed.
  - 0.20-0.49 = risky, the data argues against this but it might pay off. Use when acting on a low-trust feed without independent confirmation.
  - 0.05-0.19 = bad option included to show contrast — typically "trust the link as-is" when fingerprint is HIGH.

Then add a short "summary" string (<= 2 sentences) tying the picture together.

Hard constraints:
  - Only reference callsigns that appear in the supplied state.
  - Do not invent fingerprint tags or numeric values.
  - Output JSON matching the supplied schema. No prose outside the JSON.
  - Keep each rationale to one sentence. Total response under 300 words."#;

#[derive(Debug, Deserialize, Clone)]
pub struct FingerprintIn {
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub confidence: f64,
    #[serde(default)]
    pub range_km: f64,
    #[serde(default, rename = "matchedSignals")]
    pub matched_signals: Vec<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct EventIn {
    pub callsign: Option<String>,
    pub uid: Option<String>,
    pub dimension: Option<String>,
    pub affiliation: Option<String>,
    #[serde(rename = "sensorType")]
    pub sensor_type: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "trustScore")]
    pub trust_score: Option<f64>,
    pub stale: Option<bool>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub fingerprint: Option<FingerprintIn>,
}

#[derive(Debug, Deserialize)]
pub struct RecommendRequest {
    pub scenario: String,
    pub events: Vec<EventIn>,
    /// Optional callsign the recommender must focus on. When set, the
    /// model is told to evaluate only this link (using the rest of the
    /// fleet purely as context for neighbor-drag reasoning) and return
    /// a single entry in `links`.
    #[serde(default)]
    pub focus: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OptionOut {
    pub action: String,
    pub rationale: String,
    #[serde(rename = "successProb")]
    pub success_prob: f64,
}

#[derive(Debug, Serialize)]
pub struct LinkRecOut {
    pub callsign: String,
    pub concern: String,
    pub options: Vec<OptionOut>,
}

#[derive(Debug, Serialize)]
pub struct RecommendResponse {
    pub links: Vec<LinkRecOut>,
    pub summary: String,
}

fn fmt_track(e: &EventIn) -> String {
    let cs = e.callsign.as_deref().or(e.uid.as_deref()).unwrap_or("?");
    let dim = e.dimension.as_deref().unwrap_or("?");
    let affil = e.affiliation.as_deref().unwrap_or("?");
    let sensor = e.sensor_type.as_deref().unwrap_or("?");
    let status = e.status.as_deref().unwrap_or("?");
    let trust = e.trust_score.unwrap_or(1.0);
    let stale = e.stale.unwrap_or(false);
    let lat = e.lat.unwrap_or(0.0);
    let lon = e.lon.unwrap_or(0.0);
    let fp = match &e.fingerprint {
        None => "none".to_string(),
        Some(fp) => format!(
            "{} ({:.0}%, {}, range_km={}, signals={})",
            fp.tag,
            fp.confidence * 100.0,
            fp.name,
            fp.range_km,
            if fp.matched_signals.is_empty() {
                "—".to_string()
            } else {
                fp.matched_signals.join("+")
            }
        ),
    };
    format!(
        "- {} · dim={} · affiliation={} · sensor={} · status={} · trust={:.2} · stale={} · pos=({:.4}, {:.4}) · fingerprint={}",
        cs,
        dim,
        affil,
        sensor,
        status,
        trust,
        if stale { "yes" } else { "no" },
        lat,
        lon,
        fp,
    )
}

fn build_user_message(req: &RecommendRequest) -> String {
    let mut lines: Vec<String> = Vec::new();
    lines.push(format!("SCENARIO: {}", req.scenario));
    lines.push(format!("TRACKS ({}):", req.events.len()));
    for e in &req.events {
        lines.push(fmt_track(e));
    }
    lines.push(String::new());
    if let Some(focus) = req.focus.as_deref() {
        lines.push(format!(
            "FOCUS: Officer Adam has the link with callsign \"{}\" open in the detail panel. Evaluate ONLY that link. Use the surrounding tracks above purely as neighbor-drag and EW context — do not return entries for them. Output exactly one entry in `links` with that callsign, 2-3 affiliation- and dimension-aware options ranked best-first, and a 1–2 sentence summary that contrasts the operator-with-this-layer view (trust score + fingerprint) against a naive view that would be missing those signals.",
            focus
        ));
    } else {
        lines.push(
            "Return JSON per the schema. Identify every link requiring attention and give 2-3 best-first options each, with successProb. Add a short summary."
                .to_string(),
        );
    }
    lines.join("\n")
}

fn response_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "links": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "callsign": { "type": "string" },
                        "concern": { "type": "string" },
                        "options": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "action": { "type": "string" },
                                    "rationale": { "type": "string" },
                                    "successProb": { "type": "number" }
                                },
                                "required": ["action", "rationale", "successProb"]
                            }
                        }
                    },
                    "required": ["callsign", "concern", "options"]
                }
            },
            "summary": { "type": "string" }
        },
        "required": ["links", "summary"]
    })
}

pub async fn handle_recommend(
    Json(req): Json<RecommendRequest>,
) -> Result<Json<RecommendResponse>, (StatusCode, String)> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "GEMINI_API_KEY not set in backend env".to_string(),
            )
        })?;

    let user_message = build_user_message(&req);
    let body = json!({
        "system_instruction": { "parts": [{ "text": SYSTEM_PROMPT }] },
        "contents": [
            { "role": "user", "parts": [{ "text": user_message }] }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 800,
            "response_mime_type": "application/json",
            "response_schema": response_schema(),
        }
    });

    let url = format!(
        "{}/{}:generateContent?key={}",
        GEMINI_ENDPOINT, GEMINI_MODEL, api_key
    );

    let client = reqwest::Client::new();
    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("gemini request: {e}")))?;

    let status = res.status();
    let raw = res
        .text()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("gemini body: {e}")))?;

    if !status.is_success() {
        // Surface Gemini's error message verbatim so the operator can
        // see exactly what's wrong (bad key, quota, model name, etc.)
        // without inventing our own taxonomy of failure modes.
        let parsed: Value = serde_json::from_str(&raw).unwrap_or_default();
        let detail = parsed
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| raw.clone());
        return Err((StatusCode::BAD_GATEWAY, detail));
    }

    let parsed: Value = serde_json::from_str(&raw).map_err(|e| {
        (StatusCode::BAD_GATEWAY, format!("parse gemini response: {e}"))
    })?;

    // Walk candidates[0].content.parts[*].text and join.
    let text = parsed
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    if text.trim().is_empty() {
        return Err((StatusCode::BAD_GATEWAY, "empty response from gemini".into()));
    }

    let inner: Value = serde_json::from_str(&text).map_err(|e| {
        (
            StatusCode::BAD_GATEWAY,
            format!("model returned non-JSON: {e}"),
        )
    })?;

    // Walk the schema-shaped JSON, clamp probs, limit option counts.
    let links = inner
        .get("links")
        .and_then(|l| l.as_array())
        .map(|arr| {
            arr.iter()
                .take(6)
                .filter_map(|l| {
                    let callsign = l.get("callsign")?.as_str()?.to_string();
                    let concern = l
                        .get("concern")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string();
                    let options = l
                        .get("options")
                        .and_then(|o| o.as_array())?
                        .iter()
                        .take(3)
                        .filter_map(|o| {
                            let action = o.get("action")?.as_str()?.to_string();
                            let rationale = o
                                .get("rationale")
                                .and_then(|r| r.as_str())
                                .unwrap_or("")
                                .to_string();
                            let p = o.get("successProb")?.as_f64()?;
                            Some(OptionOut {
                                action,
                                rationale,
                                success_prob: p.clamp(0.0, 1.0),
                            })
                        })
                        .collect::<Vec<_>>();
                    Some(LinkRecOut {
                        callsign,
                        concern,
                        options,
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let summary = inner
        .get("summary")
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();

    Ok(Json(RecommendResponse { links, summary }))
}
