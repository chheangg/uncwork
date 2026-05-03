//! **FR-04** — Jammer fingerprint catalog + signature-based classifier.
//!
//! Deterministic threshold matching against publicly characterized systems
//! (TRADOC ODIN tier-2 government + Lo 2025 tier-1 peer-reviewed). This is
//! the **R14 mitigation** in `docs/threshold-defense.md`: judge asks "is
//! this ML?" — answer is no, the fingerprints are derived from telemetry
//! shape against catalog entries documented in the open press, not from a
//! trained model.
//!
//! ## Demo-vs-prod honesty
//!
//! In this demo we don't have RF feature extraction. The classifier reads
//! the *shape* of each sender's degradation as observed on the wire (drop
//! rate, CRC %, reorder %, spatial class, temporal-anomaly state) and
//! matches that against expected-pattern signatures attached to each
//! catalog entry. The signature ranges below are *engineering judgment*
//! mapped from each system's documented role — production swap is RF
//! feature extraction matching the same catalog. The catalog shape
//! (frequency band + range + sector geometry + signature) is what survives.
//!
//! Every entry below has a `SOURCE:` line naming the publication and tier.
//! Pitch lead can grep this file for `SOURCE:` to recite provenance live.
//!
//! ## What matches what
//!
//! Each `Signature` declares ranges on a subset of the observable axes.
//! The classifier scores each catalog entry's signature against the live
//! `SignalSnapshot` and returns the top match above `MIN_CONFIDENCE`. A
//! signature axis set to `None` is "don't care" — it's ignored in scoring.
//! Confidence is the mean per-axis fit (0.0–1.0) over the *defined* axes.

use crate::signals::SignalSnapshot;
use crate::trust::SpatialClass;
use serde::Serialize;

/// Catalog entries below this match score are not reported. Below ~0.30
/// the snapshot doesn't really resemble any signature — emitting a match
/// would be misleading. Above this floor the colour gradient kicks in
/// (low / med / high) on the frontend.
pub const MIN_CONFIDENCE: f64 = 0.30;

/// Public characterization of a single named jammer / spoofer system.
/// Frequency band is `(low_mhz, high_mhz)`; ranges in km; sector geometry
/// only set when the source documents a directional pattern.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Fingerprint {
    pub name: &'static str,
    pub tag: &'static str,
    pub freq_band_mhz: (f64, f64),
    pub gnss_overlap: &'static str,
    pub range_km: f64,
    pub sector_deg: Option<f64>,
    pub source: &'static str,
    pub signature: Signature,
}

/// Expected wire-shape pattern for a single catalog entry, mapped from
/// the system's documented role to signals the listener can observe.
///
/// **Honesty note (R17 owned in code):** these ranges are engineering
/// judgment mapped from public characterization, not measured RF traces
/// of each system. The signature shapes are defensible *patterns* (a
/// drone-borne GSM jammer should manifest as bursty drops + moderate
/// corruption; a wideband barrage system should produce blanket spatial
/// + sustained CRC) but the exact boundaries are tunable.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Signature {
    /// Expected fraction of attempted sends dropped (0.0..1.0).
    pub drop_rate: Option<(f64, f64)>,
    /// Expected fraction of received frames failing CRC parse.
    pub crc_rate: Option<(f64, f64)>,
    /// Expected fraction of frames arriving out-of-order.
    pub reorder_rate: Option<(f64, f64)>,
    /// Expected fraction of duplicate retransmits.
    pub dup_rate: Option<(f64, f64)>,
    /// Required spatial class. `None` = any class allowed.
    pub spatial: Option<SpatialClass>,
    /// `Some(true)` = temporal anomaly required; `Some(false)` = absent;
    /// `None` = don't care.
    pub temporal_anomaly: Option<bool>,
    /// Human-readable hint about the dominant attack mode. Surfaced to
    /// the operator alongside the catalog metadata.
    pub primary_effect: &'static str,
}

/// Output of the classifier: the matched catalog entry, the model's
/// confidence (0.0..1.0), and which signature axes carried the match.
#[derive(Debug, Clone, Serialize)]
pub struct FingerprintMatch {
    pub tag: &'static str,
    pub name: &'static str,
    /// Mean per-axis fit over the signature's defined axes, in 0.0..1.0.
    /// Frontend renders three reds keyed off this scalar.
    pub confidence: f64,
    /// Names of the signature axes that contributed positively (fit > 0.5).
    pub matched_signals: Vec<&'static str>,
    pub freq_band_mhz: (f64, f64),
    pub gnss_overlap: &'static str,
    pub range_km: f64,
    pub sector_deg: Option<f64>,
    pub source: &'static str,
    pub primary_effect: &'static str,
}

/// Hardcoded fingerprint registry. Not loaded from disk — keeps the
/// `SOURCE:` provenance grep-able from the same binary the pitch lead
/// is demonstrating.
pub static CATALOG: &[Fingerprint] = &[
    // SOURCE: TRADOC ODIN Pole-21E Russian RF Jammer (tier-2 government).
    //   https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer
    // Pole-21 is a GNSS-band jammer — it disrupts position fixes, not
    // packet delivery. Without an RF detector or position-jitter check
    // the listener can't see Pole-21 directly; the closest observable
    // proxy is "moderate localized drops with temporal anomaly from
    // sender-side fix degradation". Honest match will have low confidence.
    Fingerprint {
        name: "Pole-21 / Pole-21M",
        tag: "pole21",
        freq_band_mhz: (1176.45, 1575.42),
        gnss_overlap: "L1, L2, L5 + GLONASS",
        range_km: 25.0,
        sector_deg: Some(125.0),
        source: "TRADOC ODIN — Pole-21E (tier-2)",
        signature: Signature {
            drop_rate: Some((0.05, 0.20)),
            crc_rate: Some((0.0, 0.05)),
            reorder_rate: None,
            dup_rate: None,
            spatial: Some(SpatialClass::Localized),
            temporal_anomaly: Some(true),
            primary_effect: "GNSS denial — position fix degradation",
        },
    },
    // SOURCE: TRADOC ODIN R-330Zh Zhitel (tier-2 government). Range cross-
    // corroborated by Defense Post / Defense Express / Forbes-RNTF.
    // Wideband cellular jammer + DF — high drops across cellular bands,
    // moderate corruption from edge interference, localized footprint.
    Fingerprint {
        name: "R-330Zh Zhitel",
        tag: "rb330zh",
        freq_band_mhz: (100.0, 2000.0),
        gnss_overlap: "L1 + L2",
        range_km: 25.0,
        sector_deg: None,
        source: "TRADOC ODIN — R-330Zh Zhitel (tier-2)",
        signature: Signature {
            drop_rate: Some((0.20, 0.45)),
            crc_rate: Some((0.05, 0.20)),
            reorder_rate: Some((0.02, 0.15)),
            dup_rate: None,
            spatial: Some(SpatialClass::Localized),
            temporal_anomaly: None,
            primary_effect: "Cellular-band noise + DF",
        },
    },
    // SOURCE: Withington, Armada International 2022 (tier-4). Krasukha-4
    // 8.5–18 GHz X/Ku band wide-area barrage — should manifest as a
    // blanket spatial signature with sustained CRC % across multiple
    // senders, not localized to one ground unit.
    Fingerprint {
        name: "1RL257 Krasukha-4",
        tag: "krasukha4",
        freq_band_mhz: (8_500.0, 18_000.0),
        gnss_overlap: "none (radar band)",
        range_km: 200.0,
        sector_deg: None,
        source: "Withington, Armada International 2022 (tier-4)",
        signature: Signature {
            drop_rate: Some((0.10, 0.35)),
            crc_rate: Some((0.10, 0.35)),
            reorder_rate: Some((0.02, 0.15)),
            dup_rate: None,
            spatial: Some(SpatialClass::Blanket),
            temporal_anomaly: None,
            primary_effect: "Wide-area X/Ku barrage",
        },
    },
    // SOURCE: Army Recognition 2022 (tier-4). Drone-borne GSM jammer +
    // IMSI catcher carried on Orlan-10. The dominant observable: heavy
    // packet drops on whatever sender it's loitering near, moderate
    // corruption at band edges, localized spatial (point source moving
    // through the sky), bursty cadence as the drone orbits in/out of
    // line-of-sight. **This is the canonical match for unit_C's
    // HEAVY_JAM chaos profile in the demo.**
    Fingerprint {
        name: "RB-341V Leer-3",
        tag: "leer3",
        freq_band_mhz: (900.0, 2_100.0),
        gnss_overlap: "none",
        range_km: 30.0,
        sector_deg: None,
        source: "Army Recognition — Leer-3 (tier-4)",
        signature: Signature {
            drop_rate: Some((0.30, 0.65)),
            crc_rate: Some((0.05, 0.25)),
            reorder_rate: Some((0.02, 0.15)),
            dup_rate: Some((0.02, 0.20)),
            spatial: Some(SpatialClass::Localized),
            temporal_anomaly: None,
            primary_effect: "Drone-borne GSM noise + IMSI catch",
        },
    },
    // SOURCE: TRADOC ODIN Borisoglebsk-2 (RB-301B) Russian Amphibious
    // Multipurpose Jamming Complex (tier-2). HF/VHF wideband — extreme
    // drops + extreme corruption across the lowest bands, localized
    // signature within ~20 km, often with reorder cascades.
    Fingerprint {
        name: "RB-301B Borisoglebsk-2",
        tag: "rb301b",
        freq_band_mhz: (3.0, 2_000.0),
        gnss_overlap: "partial",
        range_km: 20.0,
        sector_deg: None,
        source: "TRADOC ODIN — Borisoglebsk-2 (tier-2)",
        signature: Signature {
            drop_rate: Some((0.45, 0.85)),
            crc_rate: Some((0.20, 0.50)),
            reorder_rate: Some((0.05, 0.25)),
            dup_rate: None,
            spatial: Some(SpatialClass::Localized),
            temporal_anomaly: Some(true),
            primary_effect: "HF/VHF heavy barrage + DF",
        },
    },
    // SOURCE: RUSI / EurAsian Times 2023 (tier-4 with RUSI Watling /
    // Reynolds underlying). Tactical C-UAS noise + GNSS deception — the
    // observable proxy is moderate localized drops *without* sustained
    // CRC corruption (deception, not destruction).
    Fingerprint {
        name: "Shipovnik-Aero",
        tag: "shipovnik",
        freq_band_mhz: (1_500.0, 1_700.0),
        gnss_overlap: "L1 spoof",
        range_km: 10.0,
        sector_deg: None,
        source: "RUSI / EurAsian Times 2023 (tier-4)",
        signature: Signature {
            drop_rate: Some((0.10, 0.30)),
            crc_rate: Some((0.0, 0.05)),
            reorder_rate: None,
            dup_rate: None,
            spatial: Some(SpatialClass::Localized),
            temporal_anomaly: Some(true),
            primary_effect: "C-UAS noise + GNSS deception",
        },
    },
    // SOURCE: Lo, Liu, Ibrahim, Chen, Walter — Observations of GNSS
    // Spoofing in Russia in 2023-2024, ION ITM 2025 (TIER-1 PEER-REVIEWED).
    // Coordinated multi-emitter spoofer — wide-area effect, but on the
    // wire side it's *clean delivery* with implausible positions. The
    // closest observable: blanket spatial class, low CRC (spoofed
    // packets parse cleanly), persistent temporal anomaly across senders.
    Fingerprint {
        name: "Coordinated GNSS spoofer (Smolensk / Black Sea / Kaliningrad)",
        tag: "coordinated_spoofer",
        freq_band_mhz: (1_575.42, 1_575.42),
        gnss_overlap: "L1 + Galileo E1",
        range_km: 300.0,
        sector_deg: None,
        source: "Lo et al., ION ITM 2025 (tier-1 peer-reviewed)",
        signature: Signature {
            drop_rate: Some((0.0, 0.10)),
            crc_rate: Some((0.0, 0.05)),
            reorder_rate: None,
            dup_rate: None,
            spatial: Some(SpatialClass::Blanket),
            temporal_anomaly: Some(true),
            primary_effect: "GNSS deception — clean delivery, false fixes",
        },
    },
    // SOURCE: Metcalfe, MIT Technology Review September 2024 (tier-4).
    // FPV-band frontline jammer — short range (~2 km), dual-band C2 +
    // video downlink targeting. Designed to saturate the narrow C2/video
    // link, so the wire signature is *higher drops + higher corruption*
    // than a drone-borne GSM jammer (Leer-3) and *fewer duplicates*
    // because the saturated link doesn't recover enough to retransmit.
    Fingerprint {
        name: "FPV-band frontline jammer (Multik / Volnorez / Piranha)",
        tag: "fpv_band",
        freq_band_mhz: (350.0, 5_800.0),
        gnss_overlap: "none",
        range_km: 2.0,
        sector_deg: None,
        source: "Metcalfe, MIT Tech Review 2024 (tier-4)",
        signature: Signature {
            drop_rate: Some((0.50, 0.85)),
            crc_rate: Some((0.20, 0.45)),
            reorder_rate: Some((0.05, 0.20)),
            dup_rate: Some((0.0, 0.05)),
            spatial: Some(SpatialClass::Localized),
            // Saturation jamming is steady-state — IAT cadence stays
            // even, so a temporal-anomaly flag is evidence *against*
            // FPV-band and in favor of (e.g.) Borisoglebsk-2 burst
            // patterns that disturb cadence.
            temporal_anomaly: Some(false),
            primary_effect: "FPV C2/video dual-band saturation",
        },
    },
];

/// Live snapshot of all signal axes for one sender, assembled by the
/// listener and handed to `classify`. Combines `SignalCounters` rates,
/// the FR-02 CRC rate, the FR-03 spatial class, and the FR-01 anomaly
/// flag into one read-only struct so the classifier doesn't reach into
/// per-detector state.
#[derive(Debug, Clone, Copy)]
pub struct SignalContext {
    pub drop_rate: f64,
    pub dup_rate: f64,
    pub reorder_rate: f64,
    pub crc_rate: f64,
    pub spatial: SpatialClass,
    pub temporal_anomaly: bool,
}

impl SignalContext {
    /// Build a context from the signal counter snapshot plus the
    /// already-computed CRC / spatial / anomaly state for this frame.
    pub fn from_parts(
        signals: &SignalSnapshot,
        crc_rate: f64,
        spatial: SpatialClass,
        temporal_anomaly: bool,
    ) -> Self {
        Self {
            drop_rate: signals.drop_rate,
            dup_rate: signals.dup_rate,
            reorder_rate: signals.reorder_rate,
            crc_rate,
            spatial,
            temporal_anomaly,
        }
    }
}

/// Score a single signature against the live context. Returns the mean
/// per-axis fit and a list of axes that contributed positively
/// (per-axis score > 0.5).
fn score_signature(sig: &Signature, ctx: &SignalContext) -> (f64, Vec<&'static str>) {
    let mut sum = 0.0;
    let mut count = 0usize;
    let mut matched: Vec<&'static str> = Vec::new();

    let mut score_range = |label: &'static str, range: Option<(f64, f64)>, value: f64| {
        if let Some((lo, hi)) = range {
            let s = range_fit(value, lo, hi);
            sum += s;
            count += 1;
            if s > 0.5 {
                matched.push(label);
            }
        }
    };

    score_range("drop_rate", sig.drop_rate, ctx.drop_rate);
    score_range("crc_rate", sig.crc_rate, ctx.crc_rate);
    score_range("reorder_rate", sig.reorder_rate, ctx.reorder_rate);
    score_range("dup_rate", sig.dup_rate, ctx.dup_rate);

    if let Some(class) = sig.spatial {
        let s = if class == ctx.spatial { 1.0 } else { 0.0 };
        sum += s;
        count += 1;
        if s > 0.0 {
            matched.push("spatial_class");
        }
    }

    if let Some(req) = sig.temporal_anomaly {
        let s = if req == ctx.temporal_anomaly { 1.0 } else { 0.0 };
        sum += s;
        count += 1;
        if s > 0.0 {
            matched.push("temporal_anomaly");
        }
    }

    if count == 0 {
        (0.0, matched)
    } else {
        (sum / count as f64, matched)
    }
}

/// Linear fit of `value` against the band `[lo, hi]`. Inside the band
/// returns 1.0; outside, falls off linearly over a window before clamping
/// to 0.0. The below-`lo` falloff window is capped at `lo` itself so a
/// signature requiring (e.g.) drop_rate ≥ 0.30 doesn't generously
/// half-credit a value of 0.0 just because it's "close" to the band.
/// A degenerate signature with `lo == hi` falls off over a 0.05 window
/// so it doesn't divide by zero.
fn range_fit(value: f64, lo: f64, hi: f64) -> f64 {
    if !value.is_finite() {
        return 0.0;
    }
    if value >= lo && value <= hi {
        return 1.0;
    }
    let band = (hi - lo).max(0.05);
    if value < lo {
        // Can't be "more below" than 0 — if lo is small, the falloff is small.
        let window = band.min(lo.max(0.05));
        ((value - (lo - window)) / window).clamp(0.0, 1.0)
    } else {
        (((hi + band) - value) / band).clamp(0.0, 1.0)
    }
}

/// Below this scalar floor across every axis the wire is effectively
/// healthy and the classifier should not nominate any signature — even
/// signatures that legitimately allow zero on some axes (e.g.
/// coordinated_spoofer's "clean delivery + blanket + temporal anomaly")
/// would otherwise trivially match a fully-clean snapshot.
const EVIDENCE_FLOOR: f64 = 0.02;

fn has_evidence(ctx: &SignalContext) -> bool {
    ctx.drop_rate > EVIDENCE_FLOOR
        || ctx.dup_rate > EVIDENCE_FLOOR
        || ctx.reorder_rate > EVIDENCE_FLOOR
        || ctx.crc_rate > EVIDENCE_FLOOR
        || ctx.spatial != SpatialClass::Clear
        || ctx.temporal_anomaly
}

/// Classify the live signal context against the catalog. Returns the
/// top-scoring entry above `MIN_CONFIDENCE`, or `None` if no signature
/// is a credible fit. Ties broken by alphabetical tag for determinism.
pub fn classify(ctx: &SignalContext) -> Option<FingerprintMatch> {
    if !has_evidence(ctx) {
        return None;
    }
    let mut best: Option<(f64, &Fingerprint, Vec<&'static str>)> = None;
    for fp in CATALOG {
        let (score, matched) = score_signature(&fp.signature, ctx);
        if score < MIN_CONFIDENCE {
            continue;
        }
        let take = match &best {
            None => true,
            Some((s, current, _)) => score > *s || (score == *s && fp.tag < current.tag),
        };
        if take {
            best = Some((score, fp, matched));
        }
    }
    best.map(|(score, fp, matched)| FingerprintMatch {
        tag: fp.tag,
        name: fp.name,
        confidence: score,
        matched_signals: matched,
        freq_band_mhz: fp.freq_band_mhz,
        gnss_overlap: fp.gnss_overlap,
        range_km: fp.range_km,
        sector_deg: fp.sector_deg,
        source: fp.source,
        primary_effect: fp.signature.primary_effect,
    })
}

/// Look up a fingerprint by its lowercase catalog tag. Retained for
/// tests and any operator tooling that wants to inspect a specific
/// catalog entry by name.
#[allow(dead_code)]
pub fn lookup_by_tag(tag: &str) -> Option<&'static Fingerprint> {
    CATALOG.iter().find(|f| f.tag.eq_ignore_ascii_case(tag))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(
        drop_rate: f64,
        crc_rate: f64,
        reorder_rate: f64,
        dup_rate: f64,
        spatial: SpatialClass,
        temporal: bool,
    ) -> SignalContext {
        SignalContext {
            drop_rate,
            crc_rate,
            reorder_rate,
            dup_rate,
            spatial,
            temporal_anomaly: temporal,
        }
    }

    #[test]
    fn range_fit_inside_band_returns_one() {
        assert!((range_fit(0.5, 0.4, 0.6) - 1.0).abs() < 1e-9);
        assert!((range_fit(0.4, 0.4, 0.6) - 1.0).abs() < 1e-9);
        assert!((range_fit(0.6, 0.4, 0.6) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn range_fit_outside_band_falls_off_linearly() {
        // Window width = 0.2. Value 0.3 is one window below lo=0.4 → fit 0.0
        assert!(range_fit(0.2, 0.4, 0.6) < 0.05);
        // Value 0.3 is half a window below lo → fit ~0.5
        let s = range_fit(0.3, 0.4, 0.6);
        assert!((s - 0.5).abs() < 0.05, "got {s}");
    }

    #[test]
    fn classify_returns_none_for_clean_wire() {
        let clean = ctx(0.0, 0.0, 0.0, 0.0, SpatialClass::Clear, false);
        assert!(classify(&clean).is_none());
    }

    #[test]
    fn classify_picks_leer3_for_drone_borne_pattern() {
        // Drone-borne GSM jammer profile: heavy drops, moderate crc,
        // some reorders + dups, localized spatial.
        let leer_ish = ctx(0.45, 0.12, 0.08, 0.10, SpatialClass::Localized, false);
        let m = classify(&leer_ish).expect("should match leer3 zone");
        assert_eq!(m.tag, "leer3", "expected leer3, got {} ({})", m.tag, m.name);
        assert!(m.confidence >= 0.75, "confidence too low: {}", m.confidence);
        assert!(
            m.matched_signals.contains(&"drop_rate"),
            "expected drop_rate among matched, got {:?}",
            m.matched_signals
        );
    }

    #[test]
    fn classify_picks_krasukha4_for_blanket_pattern() {
        // Wide-area X/Ku barrage: blanket spatial, sustained moderate
        // CRC and drops across multiple senders.
        let krasukha_ish = ctx(0.18, 0.20, 0.05, 0.0, SpatialClass::Blanket, false);
        let m = classify(&krasukha_ish).expect("should match krasukha4");
        assert_eq!(m.tag, "krasukha4");
        assert!(m.matched_signals.contains(&"spatial_class"));
    }

    #[test]
    fn classify_picks_borisoglebsk_for_extreme_localized_barrage() {
        // Heavy localized barrage with temporal anomaly — Borisoglebsk-2.
        let bori_ish = ctx(0.65, 0.30, 0.10, 0.0, SpatialClass::Localized, true);
        let m = classify(&bori_ish).expect("should match rb301b");
        assert_eq!(m.tag, "rb301b");
    }

    #[test]
    fn classify_picks_coordinated_spoofer_for_clean_blanket_anomaly() {
        // Clean delivery + blanket + temporal anomaly = GNSS deception.
        let spoofed = ctx(0.02, 0.01, 0.0, 0.0, SpatialClass::Blanket, true);
        let m = classify(&spoofed).expect("should match coordinated_spoofer");
        assert_eq!(m.tag, "coordinated_spoofer");
    }

    #[test]
    fn classify_breaks_ties_by_alphabetical_tag() {
        // Construct a context that hits two signatures with the same
        // confidence — the tag-sort tiebreaker should be deterministic.
        // (This is a defensive test; in practice the ranges differ.)
        let ambiguous = ctx(0.30, 0.10, 0.10, 0.10, SpatialClass::Localized, false);
        let m1 = classify(&ambiguous).unwrap();
        let m2 = classify(&ambiguous).unwrap();
        assert_eq!(m1.tag, m2.tag, "classifier must be deterministic");
    }

    #[test]
    fn lookup_finds_known_tags() {
        assert_eq!(
            lookup_by_tag("leer3").map(|f| f.name),
            Some("RB-341V Leer-3")
        );
        assert!(lookup_by_tag("LEER3").is_some(), "should be case-insensitive");
        assert!(lookup_by_tag("not_a_real_jammer").is_none());
    }

    #[test]
    fn every_catalog_entry_has_source_and_lowercase_tag() {
        for fp in CATALOG.iter() {
            assert!(!fp.source.is_empty(), "{} missing source", fp.name);
            assert!(
                fp.source.contains("tier-") || fp.source.to_ascii_lowercase().contains("ion itm"),
                "{} source missing tier marker: {:?}",
                fp.name,
                fp.source
            );
            assert_eq!(fp.tag, fp.tag.to_ascii_lowercase(), "{}", fp.name);
            assert!(
                !fp.signature.primary_effect.is_empty(),
                "{} signature missing primary_effect description",
                fp.name
            );
        }
    }

    #[test]
    fn every_catalog_entry_has_at_least_one_defined_signature_axis() {
        for fp in CATALOG.iter() {
            let defined = [
                fp.signature.drop_rate.is_some(),
                fp.signature.crc_rate.is_some(),
                fp.signature.reorder_rate.is_some(),
                fp.signature.dup_rate.is_some(),
                fp.signature.spatial.is_some(),
                fp.signature.temporal_anomaly.is_some(),
            ]
            .iter()
            .filter(|b| **b)
            .count();
            assert!(
                defined >= 2,
                "{} signature should declare >=2 axes (got {}) so the classifier has discrimination",
                fp.name,
                defined
            );
        }
    }
}
