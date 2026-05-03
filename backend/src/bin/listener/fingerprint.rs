//! **FR-04** — Jammer fingerprint catalog + matcher.
//!
//! Deterministic threshold matching against publicly characterized systems
//! (TRADOC ODIN tier-2 government + Lo 2025 tier-1 peer-reviewed). This is
//! the **R14 mitigation** in `docs/threshold-defense.md`: judge asks "is
//! this ML?" — answer is no, the fingerprints are in the open press, not
//! a trained model. Q&A card 4.
//!
//! ## Demo-vs-prod honesty
//!
//! In this demo we don't have RF feature extraction — the sender writes a
//! `threat=<tag>` token into the CoT `<remarks>` block, and the listener
//! looks it up here. That's a scripted concession for stage; the production
//! swap is RF feature extraction matching the same catalog. The catalog
//! shape (frequency band + range + sector geometry) is what survives.
//!
//! Every entry below has a `SOURCE:` line naming the publication and tier.
//! Pitch lead can grep this file for `SOURCE:` to recite provenance live.

use serde::Serialize;

/// Public characterization of a single named jammer / spoofer system.
/// Frequency band is `(low_mhz, high_mhz)`; ranges in km; sector geometry
/// only set when the source documents a directional pattern.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Fingerprint {
    pub name: &'static str,
    /// Lowercase token used in the CoT `<remarks>` `threat=` field for
    /// scenario-tagged matching.
    pub tag: &'static str,
    pub freq_band_mhz: (f64, f64),
    pub gnss_overlap: &'static str,
    pub range_km: f64,
    pub sector_deg: Option<f64>,
    pub source: &'static str,
}

/// Hardcoded fingerprint registry. Not loaded from disk — keeps the
/// `SOURCE:` provenance grep-able from the same binary the pitch lead
/// is demonstrating.
pub static CATALOG: &[Fingerprint] = &[
    // SOURCE: TRADOC ODIN Pole-21E Russian RF Jammer (tier-2 government).
    //   https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer
    //   Cited in Q&A card 4 as the named-system fingerprint.
    Fingerprint {
        name: "Pole-21 / Pole-21M",
        tag: "pole21",
        freq_band_mhz: (1176.45, 1575.42),
        gnss_overlap: "L1, L2, L5 + GLONASS",
        range_km: 25.0,
        sector_deg: Some(125.0),
        source: "TRADOC ODIN — Pole-21E (tier-2)",
    },
    // SOURCE: TRADOC ODIN R-330Zh Zhitel Russian Cellular Jamming and DF
    // System (tier-2 government). Range cross-corroborated by Defense
    // Post / Defense Express / Forbes-RNTF (tier-4 convergent).
    Fingerprint {
        name: "R-330Zh Zhitel",
        tag: "rb330zh",
        freq_band_mhz: (100.0, 2000.0),
        gnss_overlap: "L1 + L2",
        range_km: 25.0,
        sector_deg: None,
        source: "TRADOC ODIN — R-330Zh Zhitel (tier-2)",
    },
    // SOURCE: Withington, Armada International 2022 (tier-4 defense
    // journalism). Krasukha-4 8.5–18 GHz X/Ku band, captured Russian unit
    // confirms parameters.
    Fingerprint {
        name: "1RL257 Krasukha-4",
        tag: "krasukha4",
        freq_band_mhz: (8_500.0, 18_000.0),
        gnss_overlap: "none (radar band)",
        range_km: 200.0,
        sector_deg: None,
        source: "Withington, Armada International 2022 (tier-4)",
    },
    // SOURCE: Army Recognition 2022 (tier-4). Drone-borne GSM jammer +
    // IMSI catcher carried on Orlan-10. Matches the role of the two
    // hostile UAVs orbiting TEAM-2 in the Donetsk demo scenario.
    Fingerprint {
        name: "RB-341V Leer-3",
        tag: "leer3",
        freq_band_mhz: (900.0, 2_100.0),
        gnss_overlap: "none",
        range_km: 30.0,
        sector_deg: None,
        source: "Army Recognition — Leer-3 (tier-4)",
    },
    // SOURCE: TRADOC ODIN Borisoglebsk-2 (RB-301B) Russian Amphibious
    // Multipurpose Jamming Complex (tier-2 government).
    Fingerprint {
        name: "RB-301B Borisoglebsk-2",
        tag: "rb301b",
        freq_band_mhz: (3.0, 2_000.0),
        gnss_overlap: "partial",
        range_km: 20.0,
        sector_deg: None,
        source: "TRADOC ODIN — Borisoglebsk-2 (tier-2)",
    },
    // SOURCE: RUSI / EurAsian Times 2023 (tier-4 with RUSI Watling /
    // Reynolds underlying). Tactical C-UAS noise + GNSS deception.
    Fingerprint {
        name: "Shipovnik-Aero",
        tag: "shipovnik",
        freq_band_mhz: (1_500.0, 1_700.0),
        gnss_overlap: "L1 spoof",
        range_km: 10.0,
        sector_deg: None,
        source: "RUSI / EurAsian Times 2023 (tier-4)",
    },
    // SOURCE: Lo, Liu, Ibrahim, Chen, Walter — Observations of GNSS
    // Spoofing in Russia in 2023-2024, ION ITM 2025 (TIER-1 PEER-REVIEWED).
    // Q&A card 3 — the technical-credibility anchor that the catalog as
    // a whole leans on for the "this is not ML, this is published" frame.
    Fingerprint {
        name: "Coordinated GNSS spoofer (Smolensk / Black Sea / Kaliningrad)",
        tag: "coordinated_spoofer",
        freq_band_mhz: (1_575.42, 1_575.42),
        gnss_overlap: "L1 + Galileo E1",
        range_km: 300.0,
        sector_deg: None,
        source: "Lo et al., ION ITM 2025 (tier-1 peer-reviewed)",
    },
    // SOURCE: Metcalfe, MIT Technology Review September 2024 (tier-4).
    // FPV-band frontline jammer class — Multik / Volnorez / Piranha;
    // 350–950 MHz + 5.8 GHz dual-band against C2 + video downlink.
    Fingerprint {
        name: "FPV-band frontline jammer (Multik / Volnorez / Piranha)",
        tag: "fpv_band",
        freq_band_mhz: (350.0, 5_800.0),
        gnss_overlap: "none",
        range_km: 2.0,
        sector_deg: None,
        source: "Metcalfe, MIT Tech Review 2024 (tier-4)",
    },
];

/// Look up a fingerprint by its lowercase scenario tag. Returns `None`
/// for unknown tags so a typo in a `.ndxml` doesn't crash the listener.
pub fn lookup_by_tag(tag: &str) -> Option<&'static Fingerprint> {
    CATALOG.iter().find(|f| f.tag.eq_ignore_ascii_case(tag))
}

/// Extract the `threat=<tag>` value from a CoT `<remarks>` body. Returns
/// `None` if no threat token is present (clean traffic).
pub fn parse_threat_tag(remarks: &str) -> Option<&str> {
    remarks
        .split_whitespace()
        .find_map(|tok| tok.strip_prefix("threat="))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_threat_tag_picks_up_token() {
        let r = "UNKNOWN-1 encircling target threat=leer3 unit=unit_c seq=42";
        assert_eq!(parse_threat_tag(r), Some("leer3"));
    }

    #[test]
    fn parse_threat_tag_returns_none_when_absent() {
        let r = "UNKNOWN-1 encircling target unit=unit_c seq=42";
        assert!(parse_threat_tag(r).is_none());
    }

    #[test]
    fn parse_threat_tag_ignores_other_tokens() {
        let r = "threat= unit=unit_c seq=1";
        assert_eq!(parse_threat_tag(r), Some(""));
    }

    #[test]
    fn lookup_finds_known_tags() {
        assert_eq!(
            lookup_by_tag("leer3").map(|f| f.name),
            Some("RB-341V Leer-3")
        );
        assert_eq!(
            lookup_by_tag("pole21").map(|f| f.name),
            Some("Pole-21 / Pole-21M")
        );
        assert_eq!(
            lookup_by_tag("coordinated_spoofer").map(|f| f.tag),
            Some("coordinated_spoofer")
        );
    }

    #[test]
    fn lookup_is_case_insensitive() {
        assert!(lookup_by_tag("LEER3").is_some());
        assert!(lookup_by_tag("Leer3").is_some());
    }

    #[test]
    fn lookup_returns_none_for_unknown_tags() {
        assert!(lookup_by_tag("not_a_real_jammer").is_none());
        assert!(lookup_by_tag("").is_none());
    }

    #[test]
    fn every_catalog_entry_has_a_source_attribution() {
        for fp in CATALOG.iter() {
            assert!(
                !fp.source.is_empty(),
                "fingerprint {} missing source attribution",
                fp.name
            );
            assert!(
                fp.source.contains("tier-") || fp.source.to_ascii_lowercase().contains("ion itm"),
                "fingerprint {} source missing tier marker: {:?}",
                fp.name,
                fp.source
            );
        }
    }

    #[test]
    fn every_catalog_tag_is_lowercase() {
        for fp in CATALOG.iter() {
            assert_eq!(
                fp.tag,
                fp.tag.to_ascii_lowercase(),
                "fingerprint {} has a non-lowercase tag",
                fp.name
            );
        }
    }
}
