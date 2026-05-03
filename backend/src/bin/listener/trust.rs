//! Trust scoring — EMA + neighbor drag + FR-01 temporal-anomaly detector.
//!
//! Module split out of `main.rs` so the listener stays under the 800-line cap
//! once FR-01..04 detectors land. Every threshold here cross-references the
//! provenance map at the top of `main.rs`, which in turn anchors on
//! `docs/threshold-defense.md`.

use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

/// EMA smoothing factor — ~12-message time constant. Trust drifts slowly so a
/// single corrupt/dropped frame doesn't yank the score off a cliff.
///
/// **R16 alignment.** Continuous (not binary) trust is required by the
/// Excalibur 70%→6% gradual-then-collapse evidence (RUSI Stormbreak 2023,
/// Patt House Armed Services Mar 2024). See `docs/threshold-defense.md` §P5.
pub const TRUST_ALPHA: f64 = 0.08;
/// Quality codes feeding the EMA. Higher = healthier. The spread between
/// CLEAN and CORRUPT is intentionally wide so an FR-02 CRC breach pulls the
/// score visibly on stage without a binary cliff.
pub const QUALITY_CLEAN: f64 = 0.95;
pub const QUALITY_DUPLICATE: f64 = 0.55;
pub const QUALITY_OUT_OF_ORDER: f64 = 0.45;
pub const QUALITY_DROPPED: f64 = 0.20;
pub const QUALITY_CORRUPT: f64 = 0.10;
/// **FR-01 hit** — quality assigned when the temporal-anomaly detector trips
/// on a single IAT > μ + 3σ. Sized between OUT_OF_ORDER and DROPPED so an
/// anomaly is meaningful but not a binary kill — the score recovers across
/// ~12 clean samples (R16 graceful-degradation).
pub const QUALITY_TEMPORAL_ANOMALY: f64 = 0.30;
/// **FR-02 hit** — quality assigned on the *rising edge* of a CRC rate
/// breach (rate climbing past `CRC_BREACH_PCT`). Fires once per breach so
/// the EMA isn't pinned to the floor while the breach lingers; per-frame
/// CORRUPT samples already pull the score down on the way up.
pub const QUALITY_CRC_BREACH: f64 = 0.30;
/// **FR-04 hit** — quality assigned when an event matches a known jammer
/// fingerprint in the catalog. Sized lower than CLEAN/CRC_BREACH so that
/// scenario-tagged hostile UAVs visibly trail their healthy peers on the
/// trust HUD without instant-killing the score.
pub const QUALITY_FINGERPRINT_MATCH: f64 = 0.25;

/// Silence decay only kicks in after 60s of true silence (covers a clean
/// pause), then bleeds at 0.99/sec so a paused sender doesn't crater the
/// moment it stops talking.
pub const DECAY_THRESHOLD_SECS: f64 = 60.0;
pub const DECAY_RATE_PER_SEC: f64 = 0.99;

/// **FR-03** — Neighbor-influence radius for spatial correlation, in **meters**.
/// Default 500 m is the Donetsk-tactical FRS spec (Q&A card 7).
pub const DEFAULT_NEIGHBOR_RADIUS_M: f64 = 500.0;
/// Drag coefficient: an own score is pulled this fraction of the way toward
/// the worst neighbor inside the radius. One-way only (better neighbors do
/// not raise the score) so a faulty sensor cannot launder its trust through
/// a healthy cluster.
pub const NEIGHBOR_INFLUENCE: f64 = 0.5;

/// **FR-01** — Inter-arrival-time history depth. We keep the last 60 IATs
/// per sender. Population for (μ, σ).
pub const IAT_HISTORY_CAP: usize = 60;
/// **FR-01** — Minimum samples before the 3σ test is allowed to fire.
/// Below this the (μ, σ) estimate is too noisy and would false-positive
/// during sender warmup. The Radoš 2024 sliding-window construction uses
/// "prior 50 epochs"; 30 is our floor for first-fire.
pub const IAT_MIN_SAMPLES: usize = 30;
/// **FR-01** — Sigma multiplier. **R17 honesty gap owned in code:** no
/// peer-reviewed 2022+ source defends a specific σ multiplier for tactical-
/// radio inter-arrival. Anchored on EWMA control-chart canonical practice
/// (Osanaiye Sensors 2018) and the structural pattern of Radoš Sensors 2024
/// (last-window-vs-baseline). 3σ is engineering judgment; pitch lead recites
/// Q&A card 6 if asked.
pub const IAT_SIGMA_MULTIPLIER: f64 = 3.0;
/// **FR-01** — Floor on μ + kσ to avoid divide-by-tiny-σ tripping on
/// effectively-deterministic clean wires. Below 250 ms above mean we don't
/// claim anomaly. Engineering judgment.
pub const IAT_ANOMALY_FLOOR_SECS: f64 = 0.25;

/// **FR-02** — Rolling CRC error-rate window length, in seconds.
/// FRS §2.2 specifies 60 s; matches 3GPP "sustained" framing.
pub const CRC_WINDOW_SECS: u64 = 60;
/// **FR-02** — Threshold for declaring a CRC breach: 5% of frames in the
/// rolling window failed parse / CRC.
///
/// **R17 honesty gap owned in code:** no peer-reviewed 2022+ source binds
/// this exact number for tactical FH-spread-spectrum waveforms with
/// Reed-Solomon FEC. Anchored between commercial CRC > 1% (Red Hat / Cisco,
/// tier-4) and 3GPP NR/LTE BLER > 10% sustained link-failure. Pitch lead
/// recites Q&A card 5 if asked.
pub const CRC_BREACH_PCT: f64 = 0.05;
/// **FR-02** — Minimum frames in the window before a breach can fire.
/// Below this the percentage is too noisy to be meaningful (a single
/// corrupt out of two events would read as 50%).
pub const CRC_MIN_SAMPLES: usize = 20;

/// **FR-03** — Score below which a sender counts as "degraded" for the
/// localized-vs-blanket classifier. Engineering judgment: above 0.7 the
/// sender is healthy enough that aggregating it into a "spatial pattern"
/// would just dilute the signal.
pub const SPATIAL_DEGRADED_THRESHOLD: f64 = 0.7;

/// Rolling inter-arrival-time statistics for one sender. Owned by
/// `TrustState` so all per-sender state lives in one place.
#[derive(Default)]
pub struct IatHistory {
    samples_secs: VecDeque<f64>,
    last_event_at: Option<Instant>,
}

impl IatHistory {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record an event arrival, return the inter-arrival delta in seconds
    /// (None on the first event since there's no prior anchor).
    pub fn observe(&mut self, now: Instant) -> Option<f64> {
        let dt = self.last_event_at.map(|t| (now - t).as_secs_f64());
        self.last_event_at = Some(now);
        if let Some(secs) = dt {
            self.samples_secs.push_back(secs);
            if self.samples_secs.len() > IAT_HISTORY_CAP {
                self.samples_secs.pop_front();
            }
        }
        dt
    }

    /// Number of IAT samples currently retained.
    pub fn len(&self) -> usize {
        self.samples_secs.len()
    }

    /// Required by clippy's `len_without_is_empty` whenever `len()` exists,
    /// even if production code never asks. Kept on the public surface for
    /// consistency.
    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.samples_secs.is_empty()
    }

    /// (μ, σ) over the retained IAT window. Returns `None` if there are
    /// fewer than 2 samples (σ undefined).
    pub fn mean_std(&self) -> Option<(f64, f64)> {
        let n = self.samples_secs.len();
        if n < 2 {
            return None;
        }
        let sum: f64 = self.samples_secs.iter().copied().sum();
        let mean = sum / n as f64;
        let var = self
            .samples_secs
            .iter()
            .map(|x| {
                let d = *x - mean;
                d * d
            })
            .sum::<f64>()
            / (n - 1) as f64;
        Some((mean, var.sqrt()))
    }

    /// **FR-01** — Is the most recent inter-arrival `dt_secs` an anomaly?
    /// True when the window has at least `IAT_MIN_SAMPLES` samples *and*
    /// `dt > μ + 3σ` (also above an absolute floor to suppress noise).
    pub fn is_anomaly(&self, dt_secs: f64) -> bool {
        if self.samples_secs.len() < IAT_MIN_SAMPLES {
            return false;
        }
        let Some((mean, std)) = self.mean_std() else {
            return false;
        };
        let threshold = (mean + IAT_SIGMA_MULTIPLIER * std).max(mean + IAT_ANOMALY_FLOOR_SECS);
        dt_secs > threshold
    }
}

/// **FR-02** — Rolling 60s CRC-rate window. Each event is a `(when, was_corrupt)`
/// tuple; old entries beyond `CRC_WINDOW_SECS` are evicted on every observe.
#[derive(Default)]
pub struct CrcWindow {
    events: VecDeque<(Instant, bool)>,
    /// Edge-detector — true while the most recent observe saw the rate above
    /// `CRC_BREACH_PCT`. Used so we only feed `QUALITY_CRC_BREACH` into the
    /// EMA on the *rising* edge, not on every event while breached.
    breached: bool,
}

impl CrcWindow {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record one event. `was_corrupt = true` for parse failures (FR-02
    /// CRC-equivalent), false for cleanly-parsed frames. Returns
    /// `(corrupt_pct, breach_state, rising_edge)`:
    /// - `corrupt_pct`: `corrupt / total` in the live 60s window (0.0..1.0)
    /// - `breach_state`: whether the rate currently exceeds `CRC_BREACH_PCT`
    ///   *and* the window has at least `CRC_MIN_SAMPLES` events
    /// - `rising_edge`: true iff this observation transitioned us from
    ///   below-threshold to above-threshold (caller fires the EMA penalty)
    pub fn observe(&mut self, now: Instant, was_corrupt: bool) -> (f64, bool, bool) {
        self.events.push_back((now, was_corrupt));
        let cutoff = now - Duration::from_secs(CRC_WINDOW_SECS);
        while let Some(&(t, _)) = self.events.front() {
            if t < cutoff {
                self.events.pop_front();
            } else {
                break;
            }
        }
        let total = self.events.len();
        let corrupt = self.events.iter().filter(|(_, c)| *c).count();
        let pct = if total == 0 {
            0.0
        } else {
            corrupt as f64 / total as f64
        };
        let now_breached = total >= CRC_MIN_SAMPLES && pct > CRC_BREACH_PCT;
        let rising_edge = now_breached && !self.breached;
        self.breached = now_breached;
        (pct, now_breached, rising_edge)
    }

    /// Read-only access to the current corrupt percentage — used by tests.
    #[cfg(test)]
    pub fn corrupt_pct(&self) -> f64 {
        let total = self.events.len();
        if total == 0 {
            0.0
        } else {
            self.events.iter().filter(|(_, c)| *c).count() as f64 / total as f64
        }
    }
}

/// Per-sender trust state: the EMA score plus the IAT history feeding FR-01
/// and the CRC window feeding FR-02.
pub struct TrustState {
    score: f64,
    last_event: Instant,
    pub iat: IatHistory,
    pub crc: CrcWindow,
}

impl TrustState {
    pub fn new() -> Self {
        Self {
            score: 1.0,
            last_event: Instant::now(),
            iat: IatHistory::new(),
            crc: CrcWindow::new(),
        }
    }

    /// Constructor for tests — accepts an injected clock so deterministic
    /// IAT sequences can be replayed without sleeping.
    #[cfg(test)]
    pub fn new_at(now: Instant) -> Self {
        Self {
            score: 1.0,
            last_event: now,
            iat: IatHistory::new(),
            crc: CrcWindow::new(),
        }
    }

    /// Push a quality observation into the EMA using the wall-clock
    /// `Instant::now()`. Production callers use this; tests use `record_at`.
    pub fn record(&mut self, quality: f64) {
        self.record_at(quality, Instant::now());
    }

    /// Push a quality observation into the EMA using the supplied `Instant`
    /// as "now". Mockable clock surface for unit tests.
    pub fn record_at(&mut self, quality: f64, now: Instant) {
        self.score = (TRUST_ALPHA * quality + (1.0 - TRUST_ALPHA) * self.score).clamp(0.0, 1.0);
        self.last_event = now;
    }

    /// Bleed the score after `DECAY_THRESHOLD_SECS` of silence.
    pub fn decay_if_stale(&mut self) {
        let elapsed = self.last_event.elapsed().as_secs_f64();
        if elapsed > DECAY_THRESHOLD_SECS {
            let secs_past = elapsed - DECAY_THRESHOLD_SECS;
            self.score = (self.score * DECAY_RATE_PER_SEC.powf(secs_past)).clamp(0.0, 1.0);
        }
    }

    pub fn current(&self) -> f64 {
        self.score
    }
}

/// Minimal sender-position view used by the neighbor-drag math. The full
/// `SenderInfo` lives in `main.rs`; this trait keeps `compute_effective_trust`
/// generic over storage so unit tests can pass plain `HashMap`s.
pub trait SenderPosition {
    fn position(&self) -> Option<(f64, f64)>;
}

/// **FR-03** — Localized-vs-blanket classifier output.
///
/// - `Clear` — no neighbor degradation worth reporting.
/// - `Localized` — degraded neighbors are concentrated *inside* the FR-03
///   radius around this sender (consistent with a directional jammer
///   footprint: Pole-21 sector, R-330Zh ground footprint, Leer-3 drone-borne).
/// - `Blanket` — degraded neighbors spread *outside* the radius too,
///   consistent with an atmospheric/ionospheric anomaly or a wide-area
///   barrage system (Krasukha-4, Murmansk-BN, ionospheric scintillation).
///
/// Spatial-pattern-as-discriminator argument: Lo et al., ION ITM 2025
/// (tier-1 peer-reviewed) and Aguiar et al., *Space Weather* 2025
/// (tier-1) — neither cites a specific neighbor radius (R17 honesty gap).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SpatialClass {
    Clear,
    Localized,
    Blanket,
}

/// **FR-03 classifier.** Inspect the trust topology around `own_addr` and
/// emit a label. Independent of `compute_effective_trust` (which is the
/// *action*); this is the *label*.
pub fn classify_spatial<S: SenderPosition>(
    own_addr: &str,
    senders: &HashMap<String, S>,
    trust: &HashMap<String, TrustState>,
    radius_m: f64,
) -> SpatialClass {
    let Some(own_info) = senders.get(own_addr) else {
        return SpatialClass::Clear;
    };
    let Some((own_lat, own_lon)) = own_info.position() else {
        return SpatialClass::Clear;
    };

    let mut degraded_inside = 0usize;
    let mut degraded_outside = 0usize;
    for (addr, t) in trust.iter() {
        if addr.as_str() == own_addr {
            continue;
        }
        let Some(info) = senders.get(addr) else {
            continue;
        };
        let Some((n_lat, n_lon)) = info.position() else {
            continue;
        };
        if t.current() >= SPATIAL_DEGRADED_THRESHOLD {
            continue;
        }
        let dist_m = haversine_meters(own_lat, own_lon, n_lat, n_lon);
        if dist_m <= radius_m {
            degraded_inside += 1;
        } else {
            degraded_outside += 1;
        }
    }

    // Blanket signature dominates: if the degradation reaches *past* the
    // FR-03 radius (≥2 neighbors outside also degraded), call it blanket
    // even when there are degraded neighbors inside — that's the gradient
    // pattern Aguiar 2025 + Lo 2025 describe.
    if degraded_outside >= 2 {
        SpatialClass::Blanket
    } else if degraded_inside >= 1 {
        SpatialClass::Localized
    } else {
        SpatialClass::Clear
    }
}

/// **FR-03** — One-way neighbor drag. If any sender within `radius_m` has a
/// lower raw trust score, pull the effective score toward that worst neighbor
/// by `NEIGHBOR_INFLUENCE`. Scores can only go down — a better neighbor has
/// no effect, so a faulty sensor cannot launder its trust through a healthy
/// cluster.
///
/// This is the *action*. The localized-vs-blanket *classifier* (Phase 3)
/// sits alongside this function and outputs a label, not a score.
pub fn compute_effective_trust<S: SenderPosition>(
    own_addr: &str,
    raw_score: f64,
    senders: &HashMap<String, S>,
    trust: &HashMap<String, TrustState>,
    radius_m: f64,
) -> f64 {
    let Some(own_info) = senders.get(own_addr) else {
        return raw_score;
    };
    let Some((own_lat, own_lon)) = own_info.position() else {
        return raw_score;
    };

    let worst_nearby = trust
        .iter()
        .filter(|(addr, _)| addr.as_str() != own_addr)
        .filter_map(|(addr, t)| {
            let info = senders.get(addr)?;
            let (n_lat, n_lon) = info.position()?;
            let dist_m = haversine_meters(own_lat, own_lon, n_lat, n_lon);
            if dist_m <= radius_m {
                Some(t.current())
            } else {
                None
            }
        })
        .fold(f64::INFINITY, f64::min);

    if worst_nearby.is_finite() && worst_nearby < raw_score {
        let dragged = raw_score + NEIGHBOR_INFLUENCE * (worst_nearby - raw_score);
        dragged.clamp(0.0, raw_score)
    } else {
        raw_score
    }
}

pub fn haversine_meters(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_M: f64 = 6_371_000.0;
    let dlat = (lat2 - lat1).to_radians();
    let dlon = (lon2 - lon1).to_radians();
    let lat1 = lat1.to_radians();
    let lat2 = lat2.to_radians();
    let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    EARTH_RADIUS_M * 2.0 * a.sqrt().asin()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    struct StubSender(Option<(f64, f64)>);
    impl SenderPosition for StubSender {
        fn position(&self) -> Option<(f64, f64)> {
            self.0
        }
    }

    // -------- IatHistory --------

    #[test]
    fn iat_observe_returns_none_on_first_event() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        assert_eq!(hist.observe(t0), None);
        assert_eq!(hist.len(), 0);
    }

    #[test]
    fn iat_observe_records_delta_seconds() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        hist.observe(t0);
        let dt = hist.observe(t0 + Duration::from_millis(1_500)).unwrap();
        assert!((dt - 1.5).abs() < 1e-9);
        assert_eq!(hist.len(), 1);
    }

    #[test]
    fn iat_history_caps_at_capacity() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        hist.observe(t0);
        for i in 1..=(IAT_HISTORY_CAP + 50) {
            hist.observe(t0 + Duration::from_millis(i as u64 * 1_000));
        }
        assert_eq!(hist.len(), IAT_HISTORY_CAP);
    }

    #[test]
    fn iat_anomaly_does_not_fire_before_min_samples() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        hist.observe(t0);
        // Build only IAT_MIN_SAMPLES - 5 samples at 1s cadence.
        for i in 1..(IAT_MIN_SAMPLES - 5) {
            hist.observe(t0 + Duration::from_millis(i as u64 * 1_000));
        }
        // Even a wildly long dt does not trip yet — not enough population.
        assert!(!hist.is_anomaly(60.0));
    }

    #[test]
    fn iat_anomaly_fires_above_three_sigma() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        hist.observe(t0);
        // 40 samples at exactly 1s cadence → μ ≈ 1.0, σ ≈ 0.
        for i in 1..=40 {
            hist.observe(t0 + Duration::from_millis(i as u64 * 1_000));
        }
        // dt of 5s is well past μ + floor (1.0 + 0.25) and outside any
        // realistic 3σ band on a constant-cadence stream.
        assert!(hist.is_anomaly(5.0));
        // dt of 1s is on-cadence → not an anomaly.
        assert!(!hist.is_anomaly(1.0));
    }

    #[test]
    fn iat_anomaly_respects_floor_on_low_variance() {
        let mut hist = IatHistory::new();
        let t0 = Instant::now();
        hist.observe(t0);
        // Effectively zero-variance population at 1s cadence.
        for i in 1..=40 {
            hist.observe(t0 + Duration::from_millis(i as u64 * 1_000));
        }
        // Even though σ ≈ 0, a 1.10s sample (only 100ms over μ) sits below
        // the absolute floor of μ + 0.25s, so we do not declare an anomaly.
        assert!(!hist.is_anomaly(1.10));
        // 1.30s clears the floor.
        assert!(hist.is_anomaly(1.30));
    }

    // -------- CrcWindow --------

    #[test]
    fn crc_window_starts_clean() {
        let mut w = CrcWindow::new();
        let (pct, breached, rising) = w.observe(Instant::now(), false);
        assert_eq!(pct, 0.0);
        assert!(!breached);
        assert!(!rising);
    }

    #[test]
    fn crc_window_does_not_breach_below_min_samples() {
        let mut w = CrcWindow::new();
        let t0 = Instant::now();
        // Five corrupts back-to-back — 100% rate but only 5 samples.
        let mut last = (0.0, false, false);
        for i in 0..5 {
            last = w.observe(t0 + Duration::from_millis(i * 100), true);
        }
        let (pct, breached, _rising) = last;
        assert!((pct - 1.0).abs() < 1e-9);
        assert!(!breached, "below CRC_MIN_SAMPLES should never breach");
    }

    #[test]
    fn crc_window_rising_edge_fires_once() {
        let mut w = CrcWindow::new();
        let t0 = Instant::now();
        // Build 19 clean events.
        for i in 0..19 {
            let r = w.observe(t0 + Duration::from_millis(i * 100), false);
            assert!(!r.1);
        }
        // Now push enough corrupts to clear 5%. With 25 total and 2 corrupt
        // we'd be at 8% — but we need to cross from below to above.
        // Push 6 corrupts in a row (25 events: 19 clean + 6 corrupt = 24%).
        let mut rising_count = 0;
        for i in 19..25 {
            let (_pct, breached, rising) = w.observe(t0 + Duration::from_millis(i * 100), true);
            if breached { /* allowed */ }
            if rising {
                rising_count += 1;
            }
        }
        assert_eq!(rising_count, 1, "rising edge should fire exactly once");
    }

    #[test]
    fn crc_window_evicts_old_events() {
        let mut w = CrcWindow::new();
        let t0 = Instant::now();
        // 20 corrupts at t0 → would be a breach.
        for i in 0..20 {
            w.observe(t0 + Duration::from_millis(i * 100), true);
        }
        // Skip forward 120 s with one clean event — old entries should evict.
        let (pct, breached, _) = w.observe(t0 + Duration::from_secs(CRC_WINDOW_SECS + 60), false);
        assert_eq!(pct, 0.0);
        assert!(!breached);
    }

    #[test]
    fn crc_window_pct_reflects_window_contents() {
        let mut w = CrcWindow::new();
        let t0 = Instant::now();
        // 30 events: 3 corrupt → 10%.
        for i in 0..27 {
            w.observe(t0 + Duration::from_millis(i * 100), false);
        }
        for i in 27..30 {
            w.observe(t0 + Duration::from_millis(i * 100), true);
        }
        assert!((w.corrupt_pct() - 0.10).abs() < 1e-9);
    }

    // -------- TrustState EMA --------

    #[test]
    fn trust_state_starts_at_one() {
        let now = Instant::now();
        let t = TrustState::new_at(now);
        assert!((t.current() - 1.0).abs() < 1e-9);
    }

    #[test]
    fn trust_state_record_pulls_score_toward_quality() {
        let now = Instant::now();
        let mut t = TrustState::new_at(now);
        t.record_at(QUALITY_CORRUPT, now);
        // After one CORRUPT (0.10) sample, EMA = 0.08*0.10 + 0.92*1.0 = 0.928
        assert!((t.current() - 0.928).abs() < 1e-9);
    }

    #[test]
    fn trust_state_recovers_after_clean_run() {
        let now = Instant::now();
        let mut t = TrustState::new_at(now);
        // One bad event drops the score.
        t.record_at(QUALITY_CORRUPT, now);
        let dipped = t.current();
        // Twenty clean events should pull it back near (but not past) 1.0.
        for _ in 0..20 {
            t.record_at(QUALITY_CLEAN, now);
        }
        assert!(t.current() > dipped);
        assert!(t.current() <= 1.0);
    }

    // -------- Neighbor drag --------

    #[test]
    fn neighbor_drag_pulls_toward_worst_inside_radius() {
        let mut senders: HashMap<String, StubSender> = HashMap::new();
        let mut trust: HashMap<String, TrustState> = HashMap::new();

        // Two senders, ~100 m apart in Donetsk-ish coordinates.
        senders.insert("a".into(), StubSender(Some((48.0, 37.0))));
        senders.insert("b".into(), StubSender(Some((48.0009, 37.0))));
        let now = Instant::now();
        let mut a = TrustState::new_at(now);
        let mut b = TrustState::new_at(now);
        // Pull `b` down to 0.40.
        for _ in 0..50 {
            b.record_at(QUALITY_CORRUPT, now);
        }
        // `a` stays clean at ~1.0.
        for _ in 0..3 {
            a.record_at(QUALITY_CLEAN, now);
        }
        let raw_a = a.current();
        let raw_b = b.current();
        trust.insert("a".into(), a);
        trust.insert("b".into(), b);

        let effective_a = compute_effective_trust("a", raw_a, &senders, &trust, 500.0);
        let effective_b = compute_effective_trust("b", raw_b, &senders, &trust, 500.0);
        // `a` is dragged toward `b`'s low score.
        assert!(effective_a < raw_a);
        // `b` is not lifted by `a`'s high score.
        assert!((effective_b - raw_b).abs() < 1e-9);
    }

    #[test]
    fn neighbor_drag_ignores_senders_outside_radius() {
        let mut senders: HashMap<String, StubSender> = HashMap::new();
        let mut trust: HashMap<String, TrustState> = HashMap::new();

        // ~10 km apart — outside the 500 m FR-03 default.
        senders.insert("a".into(), StubSender(Some((48.0, 37.0))));
        senders.insert("b".into(), StubSender(Some((48.09, 37.0))));
        let now = Instant::now();
        let mut a = TrustState::new_at(now);
        let mut b = TrustState::new_at(now);
        for _ in 0..50 {
            b.record_at(QUALITY_CORRUPT, now);
        }
        for _ in 0..3 {
            a.record_at(QUALITY_CLEAN, now);
        }
        let raw_a = a.current();
        trust.insert("a".into(), a);
        trust.insert("b".into(), b);

        let effective_a = compute_effective_trust("a", raw_a, &senders, &trust, 500.0);
        // No drag — `b` is well outside 500 m.
        assert!((effective_a - raw_a).abs() < 1e-9);
    }

    #[test]
    fn neighbor_drag_skips_senders_without_position() {
        let mut senders: HashMap<String, StubSender> = HashMap::new();
        let mut trust: HashMap<String, TrustState> = HashMap::new();

        senders.insert("a".into(), StubSender(None));
        let now = Instant::now();
        trust.insert("a".into(), TrustState::new_at(now));

        let effective = compute_effective_trust("a", 0.95, &senders, &trust, 500.0);
        assert!((effective - 0.95).abs() < 1e-9);
    }

    // -------- FR-03 spatial classifier --------

    /// Helper: build a (senders, trust) pair from a list of
    /// (addr, lat, lon, score) tuples. Score < SPATIAL_DEGRADED_THRESHOLD
    /// is taken to mean "degraded neighbor".
    fn build_topo(
        rows: &[(&str, f64, f64, f64)],
    ) -> (HashMap<String, StubSender>, HashMap<String, TrustState>) {
        let mut senders = HashMap::new();
        let mut trust = HashMap::new();
        let now = Instant::now();
        for (addr, lat, lon, score) in rows {
            senders.insert((*addr).to_string(), StubSender(Some((*lat, *lon))));
            let mut t = TrustState::new_at(now);
            // Force-set the EMA to the requested score by direct assignment
            // through repeated record_at — simpler: just slam it.
            t.score = *score;
            trust.insert((*addr).to_string(), t);
        }
        (senders, trust)
    }

    #[test]
    fn spatial_clear_when_all_neighbors_healthy() {
        let (senders, trust) = build_topo(&[
            ("self", 48.0, 37.0, 0.95),
            ("a", 48.001, 37.0, 0.92),
            ("b", 48.0, 37.001, 0.91),
            ("c", 48.10, 37.0, 0.90),
        ]);
        assert_eq!(
            classify_spatial("self", &senders, &trust, 500.0),
            SpatialClass::Clear
        );
    }

    #[test]
    fn spatial_localized_when_only_inside_neighbors_degrade() {
        let (senders, trust) = build_topo(&[
            ("self", 48.0, 37.0, 0.95),
            // ~110 m from self — inside 500 m, degraded.
            ("near", 48.001, 37.0, 0.40),
            // ~10 km away — outside 500 m, healthy.
            ("far", 48.10, 37.0, 0.92),
        ]);
        assert_eq!(
            classify_spatial("self", &senders, &trust, 500.0),
            SpatialClass::Localized
        );
    }

    #[test]
    fn spatial_blanket_when_two_or_more_outside_neighbors_degrade() {
        let (senders, trust) = build_topo(&[
            ("self", 48.0, 37.0, 0.95),
            // Inside 500 m, degraded.
            ("near", 48.001, 37.0, 0.40),
            // Outside 500 m, both degraded → blanket signature.
            ("far1", 48.10, 37.0, 0.30),
            ("far2", 48.0, 37.10, 0.35),
        ]);
        assert_eq!(
            classify_spatial("self", &senders, &trust, 500.0),
            SpatialClass::Blanket
        );
    }

    #[test]
    fn spatial_localized_with_one_outside_degraded_only() {
        let (senders, trust) = build_topo(&[
            ("self", 48.0, 37.0, 0.95),
            ("near", 48.001, 37.0, 0.40),
            // Only ONE outside-radius degraded neighbor → still localized.
            ("far", 48.10, 37.0, 0.30),
        ]);
        assert_eq!(
            classify_spatial("self", &senders, &trust, 500.0),
            SpatialClass::Localized
        );
    }

    #[test]
    fn spatial_clear_for_unknown_sender() {
        let (senders, trust) = build_topo(&[("a", 48.0, 37.0, 0.40), ("b", 48.001, 37.0, 0.40)]);
        assert_eq!(
            classify_spatial("missing", &senders, &trust, 500.0),
            SpatialClass::Clear
        );
    }

    // -------- haversine sanity --------

    #[test]
    fn haversine_zero_distance_for_same_point() {
        assert!(haversine_meters(48.0, 37.0, 48.0, 37.0) < 1e-6);
    }

    #[test]
    fn haversine_one_arcminute_lat_is_about_1852m() {
        // 1 arc-minute of latitude ≈ 1 nautical mile ≈ 1852 m. Tolerance ±5 m.
        let d = haversine_meters(48.0, 37.0, 48.0 + 1.0 / 60.0, 37.0);
        assert!((d - 1_852.0).abs() < 5.0, "got {d}");
    }
}
