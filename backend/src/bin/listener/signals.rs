//! Per-sender rolling signal counters feeding the FR-04 fingerprint classifier.
//!
//! Tracks the *shape* of degradation on each sender's wire over a rolling
//! 60s window so the classifier can ask questions like "what fraction of
//! this sender's attempted sends were dropped in the last minute?". The
//! existing `CrcWindow` covers corrupt-frame rate; this module adds the
//! sibling counters for drops, duplicates, and reorders.
//!
//! Drops are inferred from sequence gaps observed in `<remarks>` `seq=N`
//! tokens — the listener never sees the dropped packet, but the gap size
//! tells it how many were missing. Duplicates are observed at the dedup
//! check before parse. Reorders fire when an arriving `seq` is less than
//! the next-expected `seq`.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Rolling-window length matching `trust::CRC_WINDOW_SECS` so all four
/// counters describe the same 60s view of the sender.
pub const SIGNAL_WINDOW_SECS: u64 = 60;

/// Below this many observed events the rates are too noisy to feed the
/// classifier — `snapshot()` returns `None` until the window fills up.
/// Mirrors `trust::CRC_MIN_SAMPLES` philosophy.
pub const SIGNAL_MIN_SAMPLES: usize = 15;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SignalEvent {
    /// One frame parsed cleanly and arrived in-order.
    Clean,
    /// One or more frames were inferred missing from a sequence gap.
    Dropped,
    /// One frame arrived but was a retransmit of an already-seen `(uid,time)`.
    Duplicated,
    /// One frame arrived with `seq < expected`.
    Reordered,
}

#[derive(Default)]
pub struct SignalCounters {
    events: VecDeque<(Instant, SignalEvent)>,
}

/// Snapshot of the current rolling rates for a sender. All rates are
/// fractions in `0.0..=1.0` of the total event count in the window.
/// `clean_rate` and `total_events` aren't read by the classifier today
/// but are kept on the struct so debugging tools and future detectors
/// (e.g. a "low-throughput" check) can use them without re-walking the
/// counter window.
#[derive(Clone, Copy, Debug)]
#[allow(dead_code)]
pub struct SignalSnapshot {
    pub drop_rate: f64,
    pub dup_rate: f64,
    pub reorder_rate: f64,
    pub clean_rate: f64,
    pub total_events: usize,
}

impl SignalCounters {
    pub fn new() -> Self {
        Self::default()
    }

    /// Record one observation. The classifier reads aggregated rates via
    /// `snapshot()`; per-event detail is not retained beyond the window.
    pub fn observe(&mut self, now: Instant, event: SignalEvent) {
        self.events.push_back((now, event));
        self.evict_old(now);
    }

    /// Convenience helper for the gap path — record `n` dropped events at
    /// the same instant. Used when a single sequence gap implies multiple
    /// missing frames (gap size > 1).
    pub fn observe_drops(&mut self, now: Instant, n: usize) {
        for _ in 0..n {
            self.events.push_back((now, SignalEvent::Dropped));
        }
        self.evict_old(now);
    }

    fn evict_old(&mut self, now: Instant) {
        let cutoff = now - Duration::from_secs(SIGNAL_WINDOW_SECS);
        while let Some(&(t, _)) = self.events.front() {
            if t < cutoff {
                self.events.pop_front();
            } else {
                break;
            }
        }
    }

    /// Compute a rates snapshot over the live window. Returns `None` until
    /// the window has at least `SIGNAL_MIN_SAMPLES` events — below that
    /// floor the percentages are too noisy for the classifier (a single
    /// drop out of three events would read as 33%).
    pub fn snapshot(&self, now: Instant) -> Option<SignalSnapshot> {
        let cutoff = now - Duration::from_secs(SIGNAL_WINDOW_SECS);
        let live = self
            .events
            .iter()
            .filter(|(t, _)| *t >= cutoff)
            .collect::<Vec<_>>();
        let total = live.len();
        if total < SIGNAL_MIN_SAMPLES {
            return None;
        }
        let total_f = total as f64;
        let mut drops = 0usize;
        let mut dups = 0usize;
        let mut reorders = 0usize;
        let mut cleans = 0usize;
        for (_, e) in &live {
            match e {
                SignalEvent::Dropped => drops += 1,
                SignalEvent::Duplicated => dups += 1,
                SignalEvent::Reordered => reorders += 1,
                SignalEvent::Clean => cleans += 1,
            }
        }
        Some(SignalSnapshot {
            drop_rate: drops as f64 / total_f,
            dup_rate: dups as f64 / total_f,
            reorder_rate: reorders as f64 / total_f,
            clean_rate: cleans as f64 / total_f,
            total_events: total,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_returns_none_below_min_samples() {
        let mut c = SignalCounters::new();
        let t0 = Instant::now();
        for i in 0..(SIGNAL_MIN_SAMPLES - 1) {
            c.observe(t0 + Duration::from_millis(i as u64 * 100), SignalEvent::Clean);
        }
        assert!(c.snapshot(t0 + Duration::from_secs(1)).is_none());
    }

    #[test]
    fn snapshot_reports_drop_rate_over_window() {
        let mut c = SignalCounters::new();
        let t0 = Instant::now();
        // 30 events: 12 dropped, 18 clean → 40% drop rate
        for i in 0..18 {
            c.observe(t0 + Duration::from_millis(i * 100), SignalEvent::Clean);
        }
        for i in 18..30 {
            c.observe(t0 + Duration::from_millis(i * 100), SignalEvent::Dropped);
        }
        let snap = c.snapshot(t0 + Duration::from_secs(4)).unwrap();
        assert!((snap.drop_rate - 0.40).abs() < 1e-9);
        assert_eq!(snap.total_events, 30);
    }

    #[test]
    fn observe_drops_records_multiple_events() {
        let mut c = SignalCounters::new();
        let t0 = Instant::now();
        for i in 0..10 {
            c.observe(t0 + Duration::from_millis(i * 100), SignalEvent::Clean);
        }
        c.observe_drops(t0 + Duration::from_millis(1100), 10);
        let snap = c.snapshot(t0 + Duration::from_secs(2)).unwrap();
        assert_eq!(snap.total_events, 20);
        assert!((snap.drop_rate - 0.50).abs() < 1e-9);
    }

    #[test]
    fn snapshot_evicts_events_outside_window() {
        let mut c = SignalCounters::new();
        let t0 = Instant::now();
        // 20 drops at t0 — would be 100% drop rate
        for i in 0..20 {
            c.observe(t0 + Duration::from_millis(i * 10), SignalEvent::Dropped);
        }
        // Skip 120 s forward with 20 clean events — drops should evict.
        let later = t0 + Duration::from_secs(SIGNAL_WINDOW_SECS + 60);
        for i in 0..20 {
            c.observe(later + Duration::from_millis(i * 10), SignalEvent::Clean);
        }
        let snap = c
            .snapshot(later + Duration::from_secs(1))
            .expect("should have ≥ MIN samples post-eviction");
        assert_eq!(snap.drop_rate, 0.0);
        assert_eq!(snap.clean_rate, 1.0);
    }

    #[test]
    fn rates_sum_to_one_within_window() {
        let mut c = SignalCounters::new();
        let t0 = Instant::now();
        for (i, e) in [
            SignalEvent::Clean,
            SignalEvent::Clean,
            SignalEvent::Clean,
            SignalEvent::Dropped,
            SignalEvent::Duplicated,
            SignalEvent::Reordered,
        ]
        .iter()
        .cycle()
        .take(SIGNAL_MIN_SAMPLES + 6)
        .enumerate()
        {
            c.observe(t0 + Duration::from_millis(i as u64 * 100), *e);
        }
        let snap = c.snapshot(t0 + Duration::from_secs(3)).unwrap();
        let total = snap.drop_rate + snap.dup_rate + snap.reorder_rate + snap.clean_rate;
        assert!((total - 1.0).abs() < 1e-9, "rates must sum to 1.0 (got {total})");
    }
}
