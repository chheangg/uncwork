---
tags: [research, evidence, threshold-defense, master-artifact]
status: populated (S1 synthesis 2026-05-03; manual URL verification REQUIRED before stage use)
authored-on: 2026-05-03
populated-on: 2026-05-03
parent: [[../00 - Index]]
related:
  - [[prompts/00 - Index]]
  - [[../../../03 - Strategy/Specs/FRS]]
  - [[../../../03 - Strategy/Risk Register]]
  - [[../../../05 - Build Plan/Demo and Pitch]]
---

# Threshold Defense — Master Evidence Artifact

> **Purpose.** Single citable file holding every research finding routed from prompts P1–P5. Each finding is normalized to one schema so the pitch lead, tech lead, and white-paper editor can pull from the same source. Fabrication = fail. Honest "qualitative only" framing = pass.

> **Status (2026-05-03 S1 synthesis).** Populated from parallel agent runs of P1–P5. **Critical caveat: WebFetch was tool-denied across every agent run** — every URL below is corroborated via WebSearch snippet text only. **Pitch lead must manually open every tier-1/2 URL before any number is recited on stage or printed on a slide.** Top-priority manual-verification URLs flagged in §Verification Log.

## Routing key (where each finding lands)

| Finding type | Lands in |
|---|---|
| Numeric tier-1/2 binding to FR-01..04 | Inline citation in `Specs/FRS.md` §2 |
| Named-incident PK/CEP from P5 | White paper §3.5 vignette footnotes |
| High judge-bait one-liner | Q&A index cards in `Demo and Pitch.md` |
| P4 jammer profile + threshold | `Specs/FRS.md` §2.4 + pitch Q&A defense |
| Vendor competitive evidence | `Competitive Positioning.md` evidentiary fragility column |
| Foundational MIL-STD / physics | Bibliography only — never load-bearing |

## Top-line synthesis (what the pitch lead needs to know)

**Five findings carry the show:**

1. **Excalibur PK 70% → 6% (Watling/Reynolds RUSI Stormbreak 2023; cited verbatim in Hudson/Patt House Armed Services testimony 2024).** Tier-2 government record citing tier-2 think-tank. **THIS IS THE PITCH OPENER.**
2. **GLSDB CEP 1–3m → 30–50m, Pentagon on-record (LaPlante at CSIS Apr 2024, via Trevithick TWZ).** Order-of-magnitude collapse, on-record Pentagon attribution.
3. **Pole-21 networked GNSS jammer, 25 km per module / 50 km cluster, 125° × 25° sector geometry (TRADOC ODIN, tier-2 government).** The strongest named-system fingerprint.
4. **Lo et al. ION ITM 2025, Stanford GPS Lab — peer-reviewed Russian GNSS spoofing across Smolensk / Black Sea / Kaliningrad (multi-freq from 9 Nov 2024).** TIER-1 PEER-REVIEWED. The technical-credibility anchor for everything.
5. **Radoš et al. Sensors 2024 — peer-reviewed "last-10-epochs vs prior-50-epochs" GNSS jamming detection structure.** Strongest 2022+ peer-reviewed analog for FR-01's sliding-window σ test.

**Three honesty gaps the pitch must own (R17 insider-judge mitigation):**

- **No 2022+ peer-reviewed source defends 3σ specifically for tactical-radio inter-arrival.** FR-01's 3σ is engineering judgment anchored on EWMA-on-IAT math (Osanaiye 2018, foundational-supporting) and the 10-vs-50 epoch construction (Radoš 2024).
- **No 2022+ peer-reviewed source binds the 5% CRC threshold for FR-02.** Commercial 1% (Red Hat / Cisco) and 3GPP 10% (link-failure trigger) flank our 5%. Honest framing: 5% is post-FEC residual, sized for FH-spread-spectrum waveforms with Reed-Solomon FEC.
- **No 2022+ peer-reviewed source cites a numerical neighbor-radius threshold for FR-03's 500m.** Anchored bottom-up by FPV-operator practice (IEEE Spectrum 2024) and named-jammer effective ranges (Pole-21, R-330Zh). Tunable by deployment.

**Honest framing wins R17.** Naming these gaps before a judge does = humility credibility. Trying to fake a citation = lose.

## Conflict log

| Conflict | Sources | Resolution |
|---|---|---|
| **Excalibur degradation magnitude** | WaPo May 2024 (Pentagon assessment): 50%+ → <10% over ~3,000 rounds Jan-Aug 2023. **vs.** RUSI Stormbreak / Hudson Patt: 70% → 6%. | Use conservative WaPo (50%→10%) on stage; cite RUSI/Hudson 70%→6% as corroborating range. Both operator-postmortem; differ in baseline assumption. |
| **5% CRC threshold (FR-02)** | Commercial Ethernet/IP (Red Hat / Cisco): >1% excessive. **vs.** 3GPP NR/LTE: >10% sustained = link-failure. **vs.** FRS §2.2: 5% rolling. | 5% is post-FEC residual frame-CRC for FH-spread-spectrum tactical waveforms with Reed-Solomon FEC; commercial 1% is for un-coded wired channels and not applicable. 5% sits between commercial eMBB and tactical-modem clean-channel acceptance. |
| **3σ multiplier (FR-01)** | No 2022+ peer-reviewed source defends a specific σ multiple for tactical-radio IAT. EWMA-on-IAT math from Osanaiye 2018 (foundational); 10-vs-50 epoch from Radoš 2024 (tier-1) is structurally equivalent. **vs.** FRS §2.1: 3σ. | Honest framing: 3σ is engineering judgment, anchored on EWMA control-limit math + Radoš 2024 sliding-window construction. RUSI 2024 supplies operational urgency. |
| **R-330Zh effective range** | Defense Post / Defense Express / Forbes-RNTF: 25–30 km ground / 50 km airborne. **vs.** ODIN TRADOC: ~25 km ground. | Convergent across multiple sources at 25–30 km ground. Use 25 km on stage (most conservative + tier-2 ODIN). |

## Cross-prompt convergence (high-confidence anchors)

These appear across multiple prompts and are the most defensible:

- **Pole-21 / TRADOC ODIN** — P3 + P4 (named-system fingerprint, tier-2 gov source)
- **R-330Zh Zhitel** — P3 + P4 (named-system fingerprint, tier-2 gov source corroborated)
- **Lo et al. ION ITM 2025** — P3 + P4 + P5 (TIER-1 peer-reviewed Stanford GPS Lab)
- **Excalibur 70%→6% (Watling/Reynolds RUSI Stormbreak)** — P2 + P4 + P5 (tier-2 RUSI cited in tier-2 Hudson congressional testimony)

---

## P1 — Temporal Anomaly Findings (FR-01, 3σ inter-arrival)

> Source prompt: [[prompts/P1 - Temporal Anomaly Threshold]]. Detail: [[_findings/P1]].
> **Bound threshold:** inter-arrival > 3σ above source baseline cadence.
> **Honesty gap:** No 2022+ peer-reviewed source defends 3σ specifically for tactical waveforms.

### P1 numeric threshold table

| Threshold | Numeric value | System | Operational consequence | Source | Tier | Confidence |
|---|---|---|---|---|---|---|
| Packet IAT EWMA control-chart | sigma-multiple of baseline IAT std (canonical EWMA construction) | Generic WSN; portable to MANET | Detects reactive/constant/periodic jammers | Osanaiye, Alfa, Hancke, Sensors 2018 | foundational-supporting | medium |
| Short-window vs baseline | Last 10 epochs vs prior 50 epochs (1 Hz) | GNSS receivers (COTS) | Detects jamming when AGC + C/N0 both drop | Radoš, Brkić, Begušić, Sensors 2024 | 1 | medium |
| Useful jamming-detection sensitivity | JSR > -10 dB | GNSS | Detection probability rises sharply | Radoš et al., Sensors 2024 | 1 | medium |
| Jammer power-level sensitivity | Detectable -45 to -70 dBm injection | COTS GNSS | PNT deviation grows with power | JaGuard arXiv 2509.14000 (2025) | 1 (preprint) | medium |
| Operational kill-chain degradation | FPV hit rate 40-60% → 20-30%; Excalibur ~90% accuracy reduction; ~10k drones/month attrited | Ukrainian tactical edge | Precision munitions miss | RUSI 2024 + defense-press corroborated | 2 | medium |

### Recommended FRS §2.1 footnote (drop-in)

> *3σ inter-arrival threshold derived from the EWMA-on-packet-inter-arrival construction in Osanaiye, Alfa, & Hancke (Sensors 2018) and the short-window-vs-baseline detection structure in Radoš, Brkić, & Begušić (Sensors 2024). The specific 3σ multiplier is tuned by the team; no peer-reviewed 2022+ source cites a sigma multiplier for tactical-radio inter-arrival, and operator-corroborated evidence (RUSI 2024) supplies the operational urgency rather than the threshold value itself.*

---

## P2 — Network Stability Findings (FR-02, 5% CRC)

> Source prompt: [[prompts/P2 - Network Stability Thresholds]]. Detail: [[_findings/P2]].
> **Bound threshold:** CRC error rate > 5% rolling.
> **Honesty gap:** Commercial 1% baseline contests our 5%. Honest reframe: 5% is post-FEC residual.

### P2 numeric threshold table

| Threshold | Numeric value | System | Operational consequence | Source | Tier | Confidence |
|---|---|---|---|---|---|---|
| BLER (radio-link failure) | > 10% sustained | 3GPP NR/LTE | Link declared failed | 3GPP convention / 5G Tech World | foundational-supporting | high |
| CRC error rate (excessive) | > 1% of frames | Commercial Ethernet/IP | NIC replacement recommended | Red Hat / Cisco / Veritas | 4 | medium |
| BER (voice intelligibility) | 1% (10⁻²) | NATO STANAG-4591 MELPe | Speech intelligibility cliff | NATO STANAG-4591 | foundational-supporting | high |
| BER (data modem acceptance) | 10⁻³ (fading) to 10⁻⁵ (clean) | MIL-STD-188-110D | Acceptance/interop cert | DoD spec | foundational-supporting | high |
| PER (jamming detection) | abnormal vs baseline | Generic detector | Flags non-deceptive jamming; misses deceptive | Priyadarshani et al., arXiv:2403.19868 / IEEE 2024 | 1 | medium |
| Hit rate (operational proxy) | 50-70% → 6-10% | Excalibur / R-330Zh + Pole-21 | Weapon withdrawn mid-2023 | WaPo / RUSI / Hudson Patt | 2-4 | high |

### Recommended FRS §2.2 footnote (drop-in)

> FR-02 CRC error rate threshold of 5% over a 60-second rolling window is anchored on a layered evidence base:
> - **Foundational:** MIL-STD-188-110D specifies BER acceptance from 10⁻³ (fading) to 10⁻⁵ (clean) for tactical voice-band modems; NATO STANAG-4591 uses 1% BER as MELPe voice-intelligibility test condition.
> - **Commercial peer:** 3GPP NR/LTE convention treats BLER above 10% as link-failure trigger; commercial networking treats CRC above 1% as excessive (Red Hat / Cisco).
> - **Operator-corroborated:** Russian EW in Ukraine (RUSI Bronk/Reynolds/Watling 2022-2023; Washington Post Pentagon assessment 2024) demonstrates sustained tactical-link degradation as the contested-sector baseline.
> - **Caveat:** No single peer-reviewed 2022+ source binds the 5% number directly. The threshold is set conservatively below the 3GPP 10% commercial link-failure trigger and above the 1% STANAG voice-intelligibility cliff (which is pre-FEC BER, not post-FEC frame CRC), reflecting tactical FH-waveform tolerance with FEC.

### P2 R14 mitigation high-value reframe

Priyadarshani et al. (IEEE 2024 survey) explicitly notes PER alone misses deceptive jamming → directly supports our multi-detector OR-fusion architecture (FR-01..04). Use to update Risk Register R14 row.

---

## P3 — Spatial Correlation Findings (FR-03, 500m neighbor radius)

> Source prompt: [[prompts/P3 - Spatial Correlation Discrimination]]. Detail: [[_findings/P3]].
> **Bound threshold:** 500m neighbor radius (operator heuristic).
> **Honesty gap (large):** No peer-reviewed 2022+ source cites a numerical neighbor-radius threshold. 500m is operator-anchored.

### P3 named-jammer-radius table

| Named jammer | Beam pattern | Effective range | Source | Tier | Confidence |
|---|---|---|---|---|---|
| **Pole-21** | 125° az × 25° el per module; 100 modules cover 150 km × 150 km | 25 km/module | TRADOC ODIN | 2 | high |
| **R-330Zh Zhitel** | 4 telescopic phased-array antennas | 25–30 km ground / 50 km airborne | Defense Post / Defense Express (multi-source) | 4 (convergent) | high |
| **Krasukha-4** | Directional cone, coverage gaps | 150–300 km (X/Ku) | Global Defence Tech 2022 | 4 | medium |
| **Murmansk-BN** | 4 antenna groups, mast-mounted | 1,000–2,000 km HF | Army Recognition; ODIN | 2 / 4 | medium |
| **Bukovel-AD (UA c-UAS)** | Mobile directional GNSS | 15–20 km jam; 100 km detect | Defence Blog | 4 | medium |
| **EDM4S (UA portable)** | Handheld directional | 3–5 km | Naval Gazing | 4 | medium |
| **DF-M (UA drone-killer)** | Directional / "dome" options | 1.5 km dir / 100 m dome | UNITED24 Media | 4 | medium |

### P3 tier-1 peer-reviewed anchors

- **Lo et al., ION ITM 2025 (Stanford GPS Lab):** Spatial pattern *is* the discriminator — ADS-B-mapped Smolensk/Black Sea spoofing footprints. Does NOT cite a specific neighbor radius.
- **Aguiar et al., Space Weather 2025 (AGU/Wiley):** Ionospheric scintillation correlated across kilometers. Anchors the *blanket atmospheric* signature.

### Recommended FRS §2.3 footnote (drop-in)

> The 500 m neighbor radius is an operator-rule heuristic informed by (a) published effective-range envelopes for named Russian directional jammers — Pole-21 at 25 km per module with a 125° × 25° sector (TRADOC ODIN, 2023), R-330Zh Zhitel at 25–30 km ground footprint (Defense Post, Defense Express, Forbes/RNTF 2023), and Krasukha-4 at 150–300 km with documented directional coverage gaps (Global Defence Technology 2022) — and (b) tactical FPV-operator practice in Ukraine 2022–2026, where operators move inside ~500 m of their drone to keep the link inside the EW envelope (Hambling, IEEE Spectrum 2024). No peer-reviewed source published 2022 onward cites a numerical neighbor-radius threshold for discriminating localized directional EW from blanket atmospheric/ionospheric interference; Lo et al. (ION ITM 2025) and Aguiar et al. (Space Weather 2025) establish only that *spatial pattern* is the discriminator. The 500 m value is conservative — well below the per-module Pole-21 footprint, well below the R-330Zh ground footprint — and is **tunable per deployment** as a configuration parameter, not a fixed constant. Path-forward (§7) work item: validate against open EW receiver-cluster datasets (e.g., GPSPATRON, Stanford ADS-B feeds, Jammertest 2026 if available).

---

## P4 — Jammer Fingerprint Catalog (FR-04, judge-bait gold)

> Source prompt: [[prompts/P4 - Jammer Fingerprint Catalog]]. Detail: [[_findings/P4]].
> **Bound output:** named jammer profiles + RF fingerprints.
> **Coverage met:** R-330Zh ✓, Krasukha-4 ✓, Pole-21 ✓, drone-borne ✓ (Leer-3 + FPV class), GPS spoofer ✓ (Lo + IDF). **Gap: no clean Houthi-system finding.**

### P4 catalog table

| Named system | Class | Frequency band | GPS L1/L2 overlap | Effective range | Primary source | Tier | Confidence |
|---|---|---|---|---|---|---|---|
| R-330Zh Zhitel | Ground barrage (cellular + GNSS + satcom) | 100 MHz – 2 GHz | L1 + L2 | ~25 km / 50+ km aerial | ODIN TRADOC | 2 | high |
| 1RL257 Krasukha-4 | Ground radar jammer | 8.5 – 18 GHz (X/Ku) | None (radar band) | Tens of km | Withington, Armada 2022 | 4 | high |
| Pole-21 / Pole-21M | Distributed cell-tower GNSS jammer | 1176.45 – 1575.42 MHz | L1, L2, L5 + GLONASS | 50 km cont. / 80 km cluster | ODIN TRADOC | 2 | high |
| Murmansk-BN | Strategic HF barrage | 3 – 30 MHz | None | 5,000–8,000 km (skywave) | Army Recognition 2022 | 4 | medium |
| RB-301B Borisoglebsk-2 | Mobile multi-band tactical | 3 MHz – 2 GHz | Partial | 10–20 km tactical | ODIN TRADOC | 2 | medium |
| RB-341V Leer-3 | Drone-borne (Orlan-10) GSM jammer + IMSI catcher | GSM-900/1800 + 3G/4G | None | 30 km from UAS | Army Recognition 2022 | 4 | high |
| Shipovnik-Aero | Tactical C-UAS noise + GNSS deception | UAV C2 + GNSS L1 spoof | L1 spoof | ~10 km | RUSI/EurAsian Times 2023 | 4 (RUSI cite) | medium |
| **Coordinated GNSS spoofer (Black Sea / Smolensk)** | Lift-and-shift spoofing | GPS L1 + Galileo E1 | L1 primary | Regional (100s km) | **Lo et al., ION ITM 2025** | **1** | **high** |
| 14Ts227 Tobol | Strategic satcom + GNSS suppression | GNSS L-band + Starlink K-band | L1 primary | Baltic / Gulf of Finland | RUSI 2024 | 2 | medium |
| IDF defensive GPS spoofer (class) | State-deployed lift-and-shift | GPS L1 | L1 primary | Regional Israel/Lebanon | Mehta/Hitchens, Breaking Defense 2024 | 4 | high |
| FPV-band frontline jammer (Multik / Volnorez / Piranha class) | Tactical FPV C2 + video barrage | 350–950 MHz + 5.8 GHz | None | ≤2 km | MIT Tech Review 2024 | 4 | medium |
| Excalibur denial outcome (R-330Zh / Pole-21 layered) | Operational consequence | n/a | n/a | n/a | **Watling/Reynolds, RUSI Stormbreak 2023** | **2** | **high** |

### P4 critical attribution corrections

- **RUSI Stormbreak (Sep 2023): Watling + Reynolds, NOT Bronk.**
- **RUSI "Russian Air War" (Nov 2022): Bronk + Reynolds + Watling.** This is the Pole-21/Zhitel anchor.
- Naming Bronk on a Watling report = credibility hit during Q&A.

### P4 R14 mitigation citation

P4-F8 (Lo ION ITM 2025) is the single tier-1 peer-reviewed citation backing the deterministic-threshold-not-ML choice in Risk Register R14: deterministic threshold matching is defensible because the spoofing pattern is publicly characterized in peer-reviewed venues, not because we trained a classifier.

---

## P5 — Smart-Guidance Compromise Findings (white paper §3.5 + pitch opener)

> Source prompt: [[prompts/P5 - Smart-Guidance Compromise]]. Detail: [[_findings/P5]].
> **Bound output:** named-incident PK/CEP/abort-rate evidence.
> **Coverage met:** Excalibur ✓, GMLRS ✓, GLSDB ✓, Switchblade ✓, Lancet ✓, GPS spoof (Black Sea + Tartu + Israel/Lebanon) ✓.

### P5 named-incident table

| Incident | Theater + date | Munition | EW condition | Outcome | Source | Tier | Confidence |
|---|---|---|---|---|---|---|---|
| **Excalibur PK collapse** | Ukraine, Jan-Aug 2023 | M982 Excalibur 155mm | Pole-21 + Krasukha-4 + Zhitel | **PK 70%→6%; $300K→$1.9M/hit; withdrawn** | **RUSI Stormbreak (Watling/Reynolds 2023)** | **2** | **high** |
| **Excalibur testimony** | Cited 13 Mar 2024 | M982 Excalibur | Russian SDR EW adaptation | Cited in House Armed Services testimony | Hudson/Patt congressional statement | 2 | high |
| **GLSDB abandonment** | Ukraine, early 2024 | Ground-Launched SDB | EMI + GPS denial during glide | **CEP 1-3m → 30-50m; "tried 3 times then thrown aside"** | **TWZ / Trevithick (LaPlante CSIS)** | **4** | **high** |
| JDAM-ER misses | Ukraine, Spring 2023 | JDAM-ER | GPS jam | 4 of 9 strikes missed; USAF buys $23M Home-on-Jam | Defense Post (leaked DoD docs) | 4 | medium |
| GMLRS salvo redirection | Ukraine 2023 | M30/M31 GMLRS | Russian EW | Salvos redirected; Ukraine layers SEAD | RUSI Stormbreak | 2 | medium |
| Switchblade decline | Ukraine 2022-2023 | Switchblade 300/600 | GPS spoof + datalink jam | "Gradually declined"; US Army halts further 300 buys | Defense Post (CSIS Cancian) | 4 | medium |
| Black Sea spoofing (foundational) | Black Sea 2017-2019 | Maritime AIS | Mass GNSS spoof | ~10,000 events, 1,300+ vessels | C4ADS "Above Us Only Stars" | 2 | high |
| Tartu/Shapps Baltic jamming | Estonia/Kaliningrad Feb-May 2024 | Finnair ATR-72; RAF Falcon 900LX | Kaliningrad GNSS jam | Finnair 1-month closure; UK MinDef jet 30 min jam | TWZ / C4ISRNET | 4 | high |
| Israel/Lebanon spoofing | Levant Oct 2023→2024 | Civil aviation + drones | Mass GNSS spoof to Beirut | ~2,000 aircraft per 72h displaced | NPR / Breaking Defense | 4 | high |
| **Stanford ION 2025 study** | Russia 2023-2024 | Aviation GNSS (ADS-B) | Smolensk/Black Sea/Kaliningrad multi-freq | **Peer-reviewed evidence of escalating capability** | **Lo et al., ION ITM 2025** | **1** | **high** |
| Lancet-3 EW countermeasures | Ukraine 2023-2024 | ZALA Lancet-3 | Bukovel-AD jam + GNSS | "Effectiveness eroded"; Russia → optical AI seekers | Ukrainska Pravda | 5 | low |
| UMPK glide-bomb degradation | Ukraine 2024-2025 | FAB-500 with UMPK kit | Ukrainian Pokrova GLONASS spoof | Russia develops Kometa-M24 anti-jam antenna | United24 Media | 5 | medium |

### P5 white paper §3.5 vignette draft (drop-in)

> The story of smart guidance in contemporary combat is the story of how fast a guided munition can be reduced from precision to expensive iron. The single most-cited data point in the field — quoted in formal congressional testimony before the U.S. House Armed Services Subcommittee on Cyber, Information Technologies, and Innovation — is the collapse of M982 Excalibur 155mm GPS-guided artillery shells in Ukraine. According to RUSI's *Stormbreak* report, Excalibur achieved approximately 70% probability-of-kill in early Ukrainian use; by August 2023, in the middle of Ukraine's summer counteroffensive, that figure had fallen to 6% — lower than unguided artillery. The cost-per-successful-strike rose from roughly $300,000 to $1.9 million. In March 2024, Hudson Institute Senior Fellow Daniel Patt cited that figure verbatim to Congress, attributing it to RUSI's Jack Watling (Patt, House Armed Services testimony, 2024).
>
> Excalibur is not an outlier; it is the leading edge of a pattern. The Ground-Launched Small Diameter Bomb's designed CEP of 1–3 meters degrades to 30–50 meters under Russian electronic warfare — an order of magnitude shift that Pentagon Under Secretary Bill LaPlante acknowledged at the CSIS Global Security Forum in April 2024 with the line that Ukrainian forces "tried it three times and then they just threw it aside" (Trevithick, *The War Zone*, 2024). Leaked Pentagon documents from spring 2023 showed that 4 of 9 air-launched JDAM-ER bombs missed under Russian jamming, prompting the U.S. Air Force to buy $23.55 million of Home-on-GPS-Jam retrofit seekers explicitly for the Ukraine fight (Defense Post, 2023). RUSI's Watling and Reynolds report that Russian electronic protection systems were able to redirect entire GMLRS salvos, forcing Ukrainian operators to layer SEAD support, decoys, and timing windows simply to keep HIMARS effective (Watling and Reynolds, RUSI *Stormbreak*, 2023).
>
> The pattern extends beyond munitions and beyond Ukraine. C4ADS documented roughly 10,000 Russian GNSS spoofing events affecting more than 1,300 ships across the Black Sea, Mediterranean, and Baltic between 2017 and 2019 — establishing GNSS denial as a practiced state capability years before the current war (C4ADS, *Above Us Only Stars*, 2019). In March 2024 the UK Defence Secretary's RAF Falcon 900LX lost GPS for thirty minutes near Kaliningrad; Finnair suspended scheduled service to Tartu, Estonia, from April through May 2024 because Russian jamming had made GPS-required approaches unsafe (Trevithick, *The War Zone*, 2024). Stanford's GPS Laboratory, in a peer-reviewed Institute of Navigation paper, mapped three distinct active Russian spoofing regions — Smolensk, the Black Sea approaches to Crimea, and Kaliningrad with multi-frequency attacks beginning 9 November 2024 (Lo et al., ION ITM 2025). Israel runs a parallel program over the Levant, where roughly two thousand aircraft per seventy-two-hour window have been displaced to false Beirut-airport positions to defeat inbound drone geofences (Estrin, NPR, 2024).
>
> Read together, these incidents make a single point: contemporary GPS, INS-aided, and datalink-guided munitions degrade gradually and then collapse, often inside a six-week adversary adaptation cycle, and the operator on the receiving end finds out only after spending the inventory. The white paper's argument — that a continuous, per-action trust score on guidance integrity is no longer optional — is grounded in this evidence base. The honest framing is that specific PK figures inside an active war are imprecise in open press, but the qualitative pattern, published by RUSI, CSIS-adjacent congressional testimony, the Pentagon on-record, and a peer-reviewed ION paper, is unambiguous.

### P5 R16 mitigation (Lattice partial-overlap)

P5-F1 (Excalibur 70%→6%) and P5-F3 (GLSDB 1-3m→30-50m) are evidence that binary up/down trust is insufficient — munitions degrade *gracefully then collapse*. Use to update Risk Register R16 mitigation row.

---

## Pitch Q&A index cards (load-bearing artifact)

> Pitch lead memorizes these. Each names the outlet and (where defensible) a number. Recited verbatim in stage Q&A.

### Card 1 — Pitch opener / "Why does this matter?"
**Trigger:** *"Why now?"*, *"Is this a real problem?"*, opening hook
**Recite:** *"In March 2024, Hudson Institute's Dan Patt told the House Armed Services Committee that the GPS-guided Excalibur shell dropped from 70 percent effective to 6 percent in a matter of weeks under Russian electronic warfare — citing RUSI's Jack Watling. The cost per successful strike went from $300,000 to $1.9 million. That is what happens when guidance silently lies and no one in the kill chain has a trust score."*
**Source:** Patt, House Armed Services testimony 13 Mar 2024 (tier-2) citing Watling/Reynolds RUSI Stormbreak 2023 (tier-2)

### Card 2 — Pentagon on-record
**Trigger:** *"Are these numbers real?"*
**Recite:** *"The Pentagon's own acquisition chief, Bill LaPlante, told CSIS in April 2024 that Ukraine tried the Ground-Launched Small Diameter Bomb three times under Russian jamming, then threw it aside. The bomb's accuracy went from three meters to fifty. We need a system that catches that drift in the first salvo, not the third."*
**Source:** Trevithick, TWZ 2024 (tier-4) reporting LaPlante CSIS Global Security Forum

### Card 3 — TIER-1 peer-reviewed credibility anchor
**Trigger:** *"What's your peer-reviewed evidence?"* (likely from technical judge)
**Recite:** *"Stanford's GPS Lab published at the Institute of Navigation in 2025 that Russia is now actively spoofing aircraft GNSS in three regions simultaneously — Smolensk, the Black Sea, and Kaliningrad — with multi-frequency attacks since November 2024. Israel runs a parallel program over Lebanon. GPS denial is not a Ukraine problem, it's the operating environment."*
**Source:** Lo et al., ION ITM 2025 (tier-1 peer-reviewed)

### Card 4 — Named-system fingerprint (R14 mitigation: not ML)
**Trigger:** *"Is this ML? Is this brittle?"*
**Recite:** *"No. Our fingerprint library is deterministic threshold matching against publicly characterized systems — TRADOC ODIN documents the Pole-21 emitting into a 125-degree sector at 25 kilometers across GPS L1, L2, and L5 simultaneously. The fingerprints are in the open press, not in a trained model."*
**Source:** TRADOC ODIN Pole-21E profile (tier-2 government)

### Card 5 — 5% CRC threshold defense (FR-02)
**Trigger:** *"Where does the 5% come from?"*
**Recite:** *"3GPP treats sustained BLER above 10 percent as link failure; commercial networking treats CRC above 1 percent as excessive — our 5 percent sits deliberately between, sized for tactical FH waveforms with Reed-Solomon FEC. We don't claim a peer-reviewed paper anchors that exact number — it's engineering judgment between commercial and STANAG bounds."*
**Source:** 3GPP convention + Red Hat / Cisco + NATO STANAG-4591

### Card 6 — 3σ threshold defense (FR-01)
**Trigger:** *"Where does 3σ come from?"*
**Recite:** *"The math is anchored on the EWMA-on-inter-arrival construction in Osanaiye Sensors 2018 and the 10-epoch-versus-50-epoch sliding-window structure in Radoš Sensors 2024. The specific 3σ multiplier is engineering judgment — no 2022-onward source defends a specific σ multiple for tactical-radio inter-arrival, and we own that."*
**Source:** Radoš et al., Sensors 2024 (tier-1) + Osanaiye 2018 (foundational-supporting)

### Card 7 — 500m neighbor radius defense (FR-03)
**Trigger:** *"Why 500 meters?"*
**Recite:** *"500 meters is operator-anchored, not literature-anchored. Two convergent inputs: published effective ranges for Russian directional jammers — R-330Zh at 25 to 30 kilometers, Pole-21 at 25 — and Ukrainian FPV operator practice from IEEE Spectrum, where operators move inside 500 meters because the EW envelope geometry shifts there. It's tunable per deployment, not a hardcoded constant."*
**Source:** TRADOC ODIN + Defense Post + Hambling IEEE Spectrum 2024

### Card 8 — Multi-detector OR-fusion defense
**Trigger:** *"Why multiple detectors?"*
**Recite:** *"Priyadarshani in IEEE 2024 explicitly notes that PER-based jamming detectors miss deceptive jammers entirely. That's why we OR-fuse temporal, network-stability, spatial, and fingerprint detectors — each covers what the others miss. The architecture is published-literature-driven, not vibe."*
**Source:** Priyadarshani et al., arXiv:2403.19868 / IEEE 2024 (tier-1)

### Card 9 — Honest-gap pre-emption (R17 insider-judge)
**Trigger:** *unprompted opening, or "Are you over-claiming?"*
**Recite:** *"Three honesty gaps we own up front: no peer-reviewed source binds 3σ specifically to tactical-radio inter-arrival; no peer-reviewed source binds 5 percent CRC; no peer-reviewed source cites a numerical neighbor-radius for localized-versus-blanket discrimination. Each threshold is engineering judgment between defensible flanking citations, and tunable per deployment. We chose humility over fabrication."*

### Card 10 — Black Sea + Israel symmetry (Russia is not the only state actor)
**Trigger:** *"Is this just a Russia problem?"*
**Recite:** *"No. C4ADS documented 10,000 Russian spoofing events affecting 1,300 ships in 2017-2019 — that's the foundational baseline. But Israel has spoofed roughly 2,000 aircraft per 72 hours over Lebanon since October 2023 to defeat inbound drone geofences. NPR reported it. Mass GNSS spoofing is now a defensive doctrine across multiple allied and adversary states."*
**Source:** C4ADS 2019 + Estrin NPR 2024

---

## Bibliography (BibTeX-compatible, deduplicated)

```bibtex
% ===== TIER-1 PEER-REVIEWED =====

@inproceedings{lo_ion_2025,
  author    = {Lo, Sherman and Liu, Zixi and Ibrahim, Lyla and Chen, Yu-Hsuan and Walter, Todd},
  title     = {Observations of {GNSS} Spoofing in Russia in 2023-2024},
  booktitle = {Proceedings of the 2025 International Technical Meeting of The Institute of Navigation (ION ITM)},
  address   = {Long Beach, CA},
  organization = {Stanford SCPNT / Institute of Navigation},
  year      = {2025},
  month     = jan,
  url       = {https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_ION_ITM_2025_Russia_Spoofing.pdf},
  note      = {TIER-1 PEER-REVIEWED. Cross-routes P3 + P4 + P5. Anchors deterministic-threshold/non-ML claim (R14 mitigation).}
}

@article{rados_sensors_2024,
  author    = {Rado{\v{s}}, Katarina and Brki{\'c}, Marta and Begu{\v{s}}i{\'c}, Dinko},
  title     = {Recent Advances on Jamming and Spoofing Detection in {GNSS}},
  journal   = {Sensors},
  volume    = {24},
  number    = {13},
  pages     = {4210},
  year      = {2024},
  publisher = {MDPI},
  doi       = {10.3390/s24134210},
  url       = {https://www.mdpi.com/1424-8220/24/13/4210},
  note      = {TIER-1. Anchors FR-01 sliding-window detector — 10-epoch vs 50-epoch construction.}
}

@article{aguiar_spaceweather_2025,
  author    = {Aguiar, et al.},
  title     = {Impact of Ionospheric Scintillations on {GNSS} Availability and Precise Positioning},
  journal   = {Space Weather},
  publisher = {AGU/Wiley},
  year      = {2025},
  doi       = {10.1029/2024SW004217},
  url       = {https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024SW004217},
  note      = {TIER-1. Anchors FR-03 'blanket atmospheric' branch — kilometer-scale spatial correlation.}
}

@article{priyadarshani_jamming_2024,
  author    = {Priyadarshani, Richa and Park, Ki-Hong and Ata, Yalcin and Alouini, Mohamed-Slim},
  title     = {Jamming Intrusions in Extreme Bandwidth Communication: A Comprehensive Overview},
  journal   = {arXiv preprint / IEEE Communications Surveys \& Tutorials},
  eprint    = {2403.19868},
  year      = {2024},
  url       = {https://arxiv.org/abs/2403.19868},
  note      = {TIER-1. PER as jamming detector + R14 OR-fusion architecture justification.}
}

% ===== TIER-2 GOVERNMENT / THINK-TANK =====

@techreport{watling_stormbreak_2023,
  author      = {Watling, Jack and Reynolds, Nick},
  title       = {Stormbreak: Fighting Through Russian Defences in {Ukraine}'s 2023 Offensive},
  institution = {Royal United Services Institute (RUSI)},
  type        = {RUSI Special Report},
  year        = {2023},
  month       = sep,
  url         = {https://static.rusi.org/Stormbreak-Special-Report-web-final_0.pdf},
  note        = {TIER-2. Excalibur 70%→6% PK. CRITICAL: authors are Watling+Reynolds, NOT Bronk.}
}

@misc{patt_house_2024,
  author       = {Patt, Daniel},
  title        = {Statement Before the House Armed Services Subcommittee on Cyber, Information Technologies, and Innovation: Too Critical to Fail — Getting Software Right in an Age of Rapid Innovation},
  institution  = {Hudson Institute / U.S. House Armed Services Committee},
  year         = {2024},
  month        = {March 13},
  url          = {https://www.congress.gov/118/meeting/house/116957/witnesses/HHRG-118-AS35-Wstate-PattD-20240313.pdf},
  note         = {TIER-2 government. Cites Watling Excalibur 70%→6% verbatim. PITCH OPENER ANCHOR.}
}

@techreport{bronk_reynolds_watling_air_war_2022,
  author      = {Bronk, Justin and Reynolds, Nick and Watling, Jack},
  title       = {The Russian Air War and Ukrainian Requirements for Air Defence},
  institution = {Royal United Services Institute (RUSI)},
  type        = {RUSI Special Report},
  year        = {2022},
  month       = nov,
  url         = {https://static.rusi.org/SR-Russian-Air-War-Ukraine-web-final.pdf},
  note        = {TIER-2. Pole-21 + R-330Zh GPS-suppression baseline. THIS is the Bronk citation.}
}

@misc{rusi_jammingjdam_2023,
  author       = {Bronk, Justin and Reynolds, Nick and Watling, Jack},
  title        = {Jamming {JDAM}: The Threat to {US} Munitions from Russian Electronic Warfare},
  howpublished = {RUSI Commentary},
  year         = {2023},
  url          = {https://www.rusi.org/explore-our-research/publications/commentary/jamming-jdam-threat-us-munitions-russian-electronic-warfare}
}

@misc{rusi_competitiveew_2024,
  author       = {Royal United Services Institute},
  title        = {Competitive Electronic Warfare in Modern Land Operations},
  howpublished = {RUSI Special Report},
  year         = {2024},
  url          = {https://static.rusi.org/competitive-electronic-warfare-in-land-operations_1.pdf},
  note         = {TIER-2. ~10k drones/month attrited; FPV hit rate 40-60% → 20-30%; Excalibur ~90% accuracy reduction.}
}

@misc{odin_zhitel_2024,
  author       = {{U.S. Army TRADOC G-2 ODIN}},
  title        = {{R-330Zh Zhitel Russian Cellular Jamming and Direction Finding System}},
  howpublished = {ODIN Operational Environment Data Integration Network},
  year         = {2024},
  url          = {https://odin.tradoc.army.mil/mediawiki/index.php/R-330Zh_Zhitel_Russian_Cellular_Jamming_and_Direction_Finding_System},
  note         = {TIER-2 government. R-330Zh frequency table 100 MHz – 2 GHz, ~25 km radius.}
}

@misc{odin_pole21_2024,
  author       = {{U.S. Army TRADOC G-2 ODIN}},
  title        = {{Pole-21E Russian RF Jammer}},
  howpublished = {ODIN Operational Environment},
  year         = {2024},
  url          = {https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer},
  note         = {TIER-2 government. Pole-21 125° az × 25° el sector geometry, 25 km/module, GNSS L1/L2/L5+GLONASS.}
}

@misc{odin_borisoglebsk_2024,
  author       = {{U.S. Army TRADOC G-2 ODIN}},
  title        = {{Borisoglebsk-2 (RB-301B) Russian Amphibious Multipurpose Jamming Complex}},
  howpublished = {ODIN Operational Environment},
  year         = {2024},
  url          = {https://odin.tradoc.army.mil/mediawiki/index.php/Borisoglebsk-2_(RB-301B)_Russian_Amphibious_Multipurpose_Jamming_Complex}
}

@misc{rusi_gps_jamming_2024,
  author       = {{Royal United Services Institute}},
  title        = {Russia ramps up {GPS} jamming with airliners at risk in European sabotage campaign},
  howpublished = {RUSI News and Comment},
  year         = {2024},
  url          = {https://www.rusi.org/news-and-comment/in-the-news/russia-ramps-gps-jamming-airliners-risk-european-sabotage-campaign},
  note         = {TIER-2. Tobol Kaliningrad attribution.}
}

@techreport{c4ads_2019,
  author       = {{C4ADS}},
  title        = {Above Us Only Stars: Exposing {GPS} Spoofing in Russia and Syria},
  institution  = {Center for Advanced Defense Studies (C4ADS)},
  year         = {2019},
  url          = {https://c4ads.org/reports/above-us-only-stars/},
  note         = {TIER-2 (foundational-supporting for 2017-2019 dataset). 10k events / 1,300 vessels.}
}

% ===== TIER-4 CREDENTIALED DEFENSE JOURNALISM =====

@article{withington_krasukha_2022,
  author  = {Withington, Thomas},
  title   = {{All Yours. Krasukha, Krasukha, Krasukha, Ja, Ja!}},
  journal = {Armada International},
  year    = {2022},
  month   = mar,
  url     = {https://www.armadainternational.com/2022/03/ukraine-forces-capture-russian-electronic-warfare-system/},
  note    = {TIER-4. Krasukha-4 8.5–18 GHz X/Ku band.}
}

@misc{trevithick_glsdb_2024,
  author       = {Trevithick, Joseph},
  title        = {Have Ground Launched Small Diameter Bombs Been 'Thrown Aside' By {Ukraine}?},
  howpublished = {The War Zone (TWZ)},
  year         = {2024},
  month        = apr,
  url          = {https://www.twz.com/land/have-ground-launched-small-diameter-bombs-been-thrown-aside-by-ukraine},
  note         = {TIER-4. LaPlante CSIS quote + GLSDB 1-3m → 30-50m.}
}

@misc{trevithick_shapps_2024,
  author       = {Trevithick, Joseph},
  title        = {{GPS} Jamming Of {U.K.} Defense Secretary's Jet Highlights {Russia}'s Regional {EW} Activities},
  howpublished = {The War Zone (TWZ)},
  year         = {2024},
  month        = mar,
  url          = {https://www.twz.com/news-features/gps-jamming-of-u-k-defense-secretarys-jet-highlights-russias-regional-ew-activities}
}

@misc{wapo_jamming_2024,
  author       = {Khurshudyan, Isabelle and Stern, David L. and Lamothe, Dan},
  title        = {Russian jamming of {U.S.} weapons in {Ukraine} forces {Pentagon} to adjust},
  howpublished = {The Washington Post},
  year         = {2024},
  month        = may,
  url          = {https://www.washingtonpost.com/world/2024/05/24/russia-jamming-us-weapons-ukraine/}
}

@misc{estrin_npr_2024,
  author       = {Estrin, Daniel},
  title        = {{Israel}'s {GPS} spoofing deters strikes, disrupts planes and apps},
  howpublished = {NPR},
  year         = {2024},
  month        = apr,
  url          = {https://www.npr.org/2024/04/22/1245847903/israel-gps-spoofing}
}

@misc{mehta_hitchens_lebanon_2024,
  author  = {Mehta, Aaron and Hitchens, Theresa},
  title   = {{GPS} jamming spreads in {Lebanon}, civil aviation caught in the electronic crossfire},
  journal = {Breaking Defense},
  year    = {2024},
  month   = apr,
  url     = {https://breakingdefense.com/2024/04/gps-jamming-spreads-in-lebanon-civil-aviation-caught-in-the-electronic-crossfire-experts/}
}

@misc{hambling_ieee_2024,
  author  = {Hambling, David},
  title   = {{Ukraine}'s Autonomous Killer Drones Defeat Electronic Warfare},
  journal = {IEEE Spectrum},
  year    = {2024},
  url     = {https://spectrum.ieee.org/ukraine-killer-drones},
  note    = {TIER-4 (IEEE Spectrum). 500m FPV-operator-proximity inflection.}
}

@misc{metcalfe_flash_2024,
  author  = {Metcalfe, Charlie},
  title   = {Meet the radio-obsessed civilian shaping {Ukraine}'s drone defense},
  journal = {MIT Technology Review},
  year    = {2024},
  month   = sep,
  url     = {https://www.technologyreview.com/2024/09/12/1103833/ukraine-russia-drone-war-flash-radio-serhii-beskrestnov-social-media/},
  note    = {TIER-4. FPV-band 350-950 MHz fingerprint class.}
}

@misc{defensepost_jdam_2023,
  title        = {{Russia} Jamming {US}-Delivered 'Smart' Munitions in {Ukraine}},
  howpublished = {The Defense Post},
  year         = {2023},
  month        = apr,
  url          = {https://thedefensepost.com/2023/04/14/russia-jamming-smart-munitions-ukraine/}
}

@misc{defensepost_jamming_2023,
  title        = {{Russian} Jamming Reducing Accuracy of {US} Guided Weapons in {Ukraine}: Experts},
  howpublished = {The Defense Post},
  year         = {2023},
  month        = jul,
  url          = {https://thedefensepost.com/2023/07/04/russian-jamming-weapons-ukraine/},
  note         = {Cites CSIS Cancian on Switchblade decline; R-330Zh 25-30 km figure.}
}

@misc{armyrecognition_leer3_2022,
  author       = {{Army Recognition Editorial Staff}},
  title        = {{Russian} troops using {Leer-3} able to jam {Ukrainian} army mobile phone signals within 30 km},
  howpublished = {Army Recognition},
  year         = {2022},
  url          = {https://www.armyrecognition.com/archives/archives-land-defense/land-defense-2022/russian-troops-using-leer-3-able-to-jam-ukrainian-army-mobile-phone-signals-within-30-km}
}

@misc{armyrecognition_murmansk_2022,
  author       = {{Army Recognition Editorial Staff}},
  title        = {{Russia} deploys its most powerful jamming communication system {Murmansk-BN} in {Ukraine}},
  howpublished = {Army Recognition},
  year         = {2022},
  url          = {https://www.armyrecognition.com/military-products/army/electronic-warfare/murmansk-bn-electronic-warfare-communications-jamming-system-data}
}

@misc{globaldefence_russian_ew_2022,
  title   = {Russia's electronic warfare capabilities},
  journal = {Global Defence Technology},
  number  = {133},
  year    = {2022},
  url     = {https://defence.nridigital.com/global_defence_technology_mar22/russia_electronic_warfare}
}

@misc{eurasiantimes_shipovnik_2023,
  author       = {{EurAsian Times Editorial Staff (citing RUSI Watling and Reynolds)}},
  title        = {{Russia} 'Smashing' 330 {Ukrainian UAVs} Per Day; {UK} Report Says {Russian} Electronic Warfare 'Wreaks Havoc' On {Kyiv}},
  howpublished = {EurAsian Times},
  year         = {2023},
  url          = {https://www.eurasiantimes.com/russia-smashing-330-ukrainian-uavs-per-day-uk-report-says-russian-electronic-warfare-wreaks-havoc-on-kyiv/}
}

@misc{kyivpost_fpv_2024,
  title        = {{FPV} Drones Effective in 20-40\% of {Ukrainian} and {Russian} Strikes, Commander Says},
  howpublished = {Kyiv Post},
  year         = {2024},
  url          = {https://www.kyivpost.com/post/44059}
}

% ===== FOUNDATIONAL-SUPPORTING (PRE-2022 ALLOWED) =====

@article{osanaiye_sensors_2018,
  author    = {Osanaiye, Opeyemi and Alfa, Attahiru S. and Hancke, Gerhard P.},
  title     = {A Statistical Approach to Detect Jamming Attacks in Wireless Sensor Networks},
  journal   = {Sensors},
  volume    = {18},
  number    = {6},
  pages     = {1691},
  year      = {2018},
  publisher = {MDPI},
  doi       = {10.3390/s18061691},
  url       = {https://www.mdpi.com/1424-8220/18/6/1691},
  note      = {Foundational-supporting. EWMA-on-IAT canonical jamming detector.}
}

@misc{milstd188110d,
  title        = {{MIL-STD-188-110D}: {DoD} Interface Standard for Voice-Frequency Band Modems},
  author       = {{U.S. Department of Defense}},
  year         = {2017},
  url          = {https://everyspec.com/MIL-STD/MIL-STD-0100-0299/MIL-STD-188-110D_55856/},
  note         = {Foundational-supporting. BER acceptance 10⁻³ (fading) to 10⁻⁵ (clean).}
}

@misc{stanag4591,
  title        = {{NATO STANAG-4591} / {MELPe} Vocoder Technical Specifications},
  author       = {{NATO} and vendor documentation},
  howpublished = {melpe.org / VOCAL Technologies / Compandent},
  year         = {2023},
  url          = {https://melpe.org/},
  note         = {Foundational-supporting. 1% BER MELPe voice-intelligibility test condition.}
}

@misc{redhat_crc_threshold_2023,
  title        = {Trends - {CRC} Errors (1\% threshold guidance)},
  author       = {{Red Hat Customer Portal}},
  year         = {2023},
  url          = {https://access.redhat.com/blogs/2184921/posts/2576591}
}

@misc{5gtechworld_bler_2023,
  title        = {{BLER}: A critical parameter in cellular receiver performance},
  howpublished = {5G Technology World},
  year         = {2023},
  url          = {https://www.5gtechnologyworld.com/bler-a-critical-parameter-in-cellular-receiver-performance/},
  note         = {3GPP NR/LTE 10% BLER link-failure trigger; URLLC 10⁻⁵ to 10⁻⁹.}
}

% ===== UNVERIFIED-AUTHOR PREPRINTS (USE WITH CONFIDENCE: LOW) =====

@misc{jaguard_arxiv_2025,
  title         = {{JaGuard}: Position Error Correction of {GNSS} Jamming with Deep Temporal Graphs},
  author        = {unverified},
  year          = {2025},
  eprint        = {2509.14000},
  archivePrefix = {arXiv},
  url           = {https://arxiv.org/abs/2509.14000},
  note          = {Authors unverified — do NOT recite without manual confirmation.}
}

@misc{weakjamming_arxiv_2025,
  title         = {Weak-Jamming Detection in {IEEE 802.11} Networks},
  author        = {unverified},
  year          = {2025},
  eprint        = {2505.19633},
  archivePrefix = {arXiv},
  url           = {https://arxiv.org/abs/2505.19633},
  note          = {Authors unverified.}
}

@article{ieee_tnsm_federated_2023,
  title   = {Federated Learning-Enabled Jamming Detection and Waveform Classification for Distributed Tactical Wireless Networks},
  author  = {unverified},
  journal = {IEEE Transactions on Network and Service Management},
  year    = {2023},
  doi     = {10.1109/TNSM.2023.3271578},
  url     = {https://doi.org/10.1109/TNSM.2023.3271578},
  note    = {Authors unverified.}
}
```

---

## Verification log

> **Critical environmental constraint.** WebFetch was tool-denied across every agent run. All findings are corroborated via WebSearch snippets (which return text from source pages) plus cross-source agreement. **No URL below is "stage-cleared" until the pitch lead manually opens it in a browser.**

### Top-priority manual verification (BEFORE STAGE)

These five URLs are load-bearing — every other claim falls back to them. Open in browser, confirm the claim verbatim, lock the page reference.

| Priority | Source | URL | Claim to confirm |
|---|---|---|---|
| 1 | RUSI Stormbreak (Watling/Reynolds 2023) | https://static.rusi.org/Stormbreak-Special-Report-web-final_0.pdf | Excalibur 70% → 6%; $300K → $1.9M/hit. Confirm exact paragraph + page number. |
| 2 | Patt House Armed Services testimony (2024) | https://www.congress.gov/118/meeting/house/116957/witnesses/HHRG-118-AS35-Wstate-PattD-20240313.pdf | Patt cites Watling for the Excalibur figure. Confirm exact attribution sentence. |
| 3 | TWZ — GLSDB thrown aside (Trevithick 2024) | https://www.twz.com/land/have-ground-launched-small-diameter-bombs-been-thrown-aside-by-ukraine | LaPlante CSIS quote + 1-3m → 30-50m CEP. |
| 4 | Lo et al. ION ITM 2025 | https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_ION_ITM_2025_Russia_Spoofing.pdf | Smolensk + Black Sea + Kaliningrad multi-freq from 9 Nov 2024. Lock TIER-1 citation. |
| 5 | TRADOC ODIN Pole-21E | https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer | Pole-21 125° × 25° sector / 25 km/module / GNSS L1/L2/L5+GLONASS. |

### Full verification log (manual click required for ALL)

| Finding ID | Source | URL | WebFetch | Notes |
|---|---|---|---|---|
| P1-F1 | Osanaiye Sensors 2018 | https://www.mdpi.com/1424-8220/18/6/1691 | NO (denied) | Authors corroborated via PMC, PubMed, Semantic Scholar |
| P1-F2 | Computer Comms 2022 | https://www.sciencedirect.com/science/article/pii/S266682702200072X | NO | Authors unverified — confidence: low |
| P1-F3 | IEEE TNSM 2023 | https://doi.org/10.1109/TNSM.2023.3271578 | NO | Authors unverified |
| P1-F4 | Radoš Sensors 2024 | https://www.mdpi.com/1424-8220/24/13/4210 | NO | JSR > -10 dB + 10-vs-50 window corroborated |
| P1-F5 | JaGuard arXiv 2509.14000 | https://arxiv.org/abs/2509.14000 | NO | Power sweep -45 to -70 dBm corroborated; authors unverified |
| P1-F6 | Weak-jamming arXiv 2505.19633 | https://arxiv.org/abs/2505.19633 | NO | Topic corroborated; authors unverified |
| P1-F7 | RUSI 2024 | https://static.rusi.org/competitive-electronic-warfare-in-land-operations_1.pdf | NO | Author attribution ambiguous Watling/Bronk |
| P2-F1 | 3GPP / 5G Tech World | https://www.5gtechnologyworld.com/bler-a-critical-parameter-in-cellular-receiver-performance/ | NO | 10% BLER widely confirmed |
| P2-F2 | Red Hat | https://access.redhat.com/blogs/2184921/posts/2576591 | NO | 1% CRC commercial threshold |
| P2-F3 | NATO STANAG-4591 | https://melpe.org/ | NO | 1% BER cliff corroborated |
| P2-F4 | MIL-STD-188-110D | https://everyspec.com/MIL-STD/MIL-STD-0100-0299/MIL-STD-188-110D_55856/ | NO | DoD spec |
| P2-F5 | WaPo | https://www.washingtonpost.com/world/2024/05/24/russia-jamming-us-weapons-ukraine/ | NO | 50%→10% over 3000 rounds |
| P2-F6 | Kyiv Post | https://www.kyivpost.com/post/44059 | NO | FPV degradation |
| P2-F7 | Priyadarshani arXiv 2403.19868 | https://arxiv.org/abs/2403.19868 | NO | TIER-1 |
| P2-F8 | RUSI Jamming JDAM | https://www.rusi.org/explore-our-research/publications/commentary/jamming-jdam-threat-us-munitions-russian-electronic-warfare | NO | Bronk/Reynolds/Watling |
| P3-F1 | TRADOC ODIN Pole-21 | https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer | NO | **PRIORITY 5 — manual click required** |
| P3-F2 | Defense Post R-330Zh | https://thedefensepost.com/2023/07/04/russian-jamming-weapons-ukraine/ | NO | 25-30 km cross-corroborated |
| P3-F3 | Global Defence Tech | https://defence.nridigital.com/global_defence_technology_mar22/russia_electronic_warfare | NO | Krasukha 150-300 km |
| P3-F4 | IEEE Spectrum (Hambling) | https://spectrum.ieee.org/ukraine-killer-drones | NO | 500 m FPV inflection |
| P3-F5 | Lo et al. ION ITM 2025 | https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_ION_ITM_2025_Russia_Spoofing.pdf | NO | **PRIORITY 4 — TIER-1 lock** |
| P3-F6 | Aguiar Space Weather 2025 | https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024SW004217 | NO | TIER-1 |
| P4-F1 | TRADOC ODIN R-330Zh | https://odin.tradoc.army.mil/mediawiki/index.php/R-330Zh_Zhitel_Russian_Cellular_Jamming_and_Direction_Finding_System | NO | TIER-2 |
| P4-F2 | Withington Armada | https://www.armadainternational.com/2022/03/ukraine-forces-capture-russian-electronic-warfare-system/ | NO | Withington byline confirmed |
| P4-F3 | TRADOC ODIN Pole-21 | https://odin.t2com.army.mil/WEG/Asset/Pole-21E_Russian_RF_Jammer | NO | TIER-2 |
| P4-F4 | Army Recognition Murmansk-BN | https://www.armyrecognition.com/military-products/army/electronic-warfare/murmansk-bn-electronic-warfare-communications-jamming-system-data | NO | Russian-state imprecise |
| P4-F5 | TRADOC ODIN Borisoglebsk-2 | https://odin.tradoc.army.mil/mediawiki/index.php/Borisoglebsk-2_(RB-301B)_Russian_Amphibious_Multipurpose_Jamming_Complex | NO | TIER-2 |
| P4-F6 | Army Recognition Leer-3 | https://www.armyrecognition.com/archives/archives-land-defense/land-defense-2022/russian-troops-using-leer-3-able-to-jam-ukrainian-army-mobile-phone-signals-within-30-km | NO | Multi-corroborated |
| P4-F7 | EurAsian Times Shipovnik | https://www.eurasiantimes.com/russia-smashing-330-ukrainian-uavs-per-day-uk-report-says-russian-electronic-warfare-wreaks-havoc-on-kyiv/ | NO | RUSI underlying |
| P4-F8 | Lo et al. ION ITM 2025 | https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_ION_ITM_2025_Russia_Spoofing.pdf | NO | **PRIORITY 4** |
| P4-F9 | RUSI Tobol | https://www.rusi.org/news-and-comment/in-the-news/russia-ramps-gps-jamming-airliners-risk-european-sabotage-campaign | NO | Tier-2 |
| P4-F10 | Mehta/Hitchens BD | https://breakingdefense.com/2024/04/gps-jamming-spreads-in-lebanon-civil-aviation-caught-in-the-electronic-crossfire-experts/ | NO | Multi-corroborated |
| P4-F11 | MIT Tech Review (Metcalfe) | https://www.technologyreview.com/2024/09/12/1103833/ukraine-russia-drone-war-flash-radio-serhii-beskrestnov-social-media/ | NO | Class-level |
| P4-F12 | RUSI Stormbreak | https://static.rusi.org/Stormbreak-Special-Report-web-final_0.pdf | NO | **PRIORITY 1** — Watling+Reynolds NOT Bronk |
| P5-F1 | RUSI Stormbreak | https://static.rusi.org/Stormbreak-Special-Report-web-final_0.pdf | NO | **PRIORITY 1** |
| P5-F2 | Patt House testimony | https://www.congress.gov/118/meeting/house/116957/witnesses/HHRG-118-AS35-Wstate-PattD-20240313.pdf | NO | **PRIORITY 2** |
| P5-F3 | TWZ GLSDB (Trevithick) | https://www.twz.com/land/have-ground-launched-small-diameter-bombs-been-thrown-aside-by-ukraine | NO | **PRIORITY 3** |
| P5-F4 | Defense Post JDAM-ER | https://thedefensepost.com/2023/04/14/russia-jamming-smart-munitions-ukraine/ | NO | Leaked-source provenance |
| P5-F5 | RUSI Stormbreak | https://www.rusi.org/explore-our-research/publications/special-resources/stormbreak-fighting-through-russian-defences-ukraines-2023-offensive | NO | Qualitative GMLRS |
| P5-F6 | Defense Post Switchblade | https://thedefensepost.com/2023/07/04/russian-jamming-weapons-ukraine/ | NO | Qualitative only |
| P5-F7 | C4ADS 2019 | https://c4ads.org/reports/above-us-only-stars/ | NO | Foundational |
| P5-F8 | TWZ Shapps (Trevithick) | https://www.twz.com/news-features/gps-jamming-of-u-k-defense-secretarys-jet-highlights-russias-regional-ew-activities | NO | Multi-corroborated |
| P5-F9 | NPR Israel | https://www.npr.org/2024/04/22/1245847903/israel-gps-spoofing | NO | Multi-corroborated |
| P5-F10 | Lo et al. ION ITM 2025 | https://web.stanford.edu/group/scpnt/gpslab/pubs/papers/Lo_ION_ITM_2025_Russia_Spoofing.pdf | NO | **PRIORITY 4** |
| P5-F11 | Ukrainska Pravda Lancet | https://www.pravda.com.ua/eng/articles/2026/04/07/8029080/ | NO | Single-source — confidence: low |
| P5-F12 | United24 UMPK | https://united24media.com/latest-news/russias-glide-bombs-are-no-longer-precise-ukraines-ew-jamming-sends-them-astray-6279 | NO | Single-side — frame as "Ukrainian reporting" |

---

## Hard "do not recite numbers" warnings

These numbers are NOT corroborated enough to recite as fact on stage:

- **JDAM-ER:** Recite *"four of nine"* — NOT "44%". Sample size warning (leaked classified docs, n=9).
- **Switchblade abort rate:** **NO numeric exists in tier 1-4.** Qualitative only.
- **Lancet PK under EW:** **NO public per-strike PK.** Qualitative narrative only.
- **UMPK accuracy:** Single-side Ukrainian + one Russian milblogger. Frame as *"Ukrainian reporting indicates"*.
- **Murmansk-BN range (5,000-8,000 km):** Russian state source (KRET). Flag as Russian-state imprecise if recited.

---

## Routing decisions (for downstream artifacts)

- **`Specs/FRS.md` §2.1:** Insert P1 footnote (3σ honest framing).
- **`Specs/FRS.md` §2.2:** Insert P2 footnote (5% layered evidence base).
- **`Specs/FRS.md` §2.3:** Insert P3 footnote (500m operator-anchored).
- **`Specs/FRS.md` §2.4:** Insert P4 catalog table (Pole-21, R-330Zh, Krasukha-4 named-system fingerprints).
- **`White Paper`:** §3.5 — drop in P5 vignette draft (4 paragraphs).
- **`Demo and Pitch.md`:** Q&A index cards 1–10 (above).
- **`Risk Register.md` R14 (ML brittleness):** Add Lo ION ITM 2025 + Priyadarshani IEEE 2024 as deterministic-threshold-not-ML mitigation citations.
- **`Risk Register.md` R16 (Lattice partial-overlap):** Add Excalibur 70%→6% + GLSDB 1-3m→30-50m as evidence binary trust insufficient.
- **`Competitive Positioning.md`:** No vendor competitive evidence surfaced this run.

---

## Summary for next reviewer

**Yield:** 41 findings across 5 prompts. Tier-1 peer-reviewed: 5 (Lo ION 2025, Radoš Sensors 2024, Aguiar Space Weather 2025, Priyadarshani IEEE 2024, JaGuard arXiv 2025 preprint). Tier-2: 13 (multiple RUSI reports, Hudson Patt testimony, TRADOC ODIN profiles, C4ADS).

**Five highest-confidence stage-ready findings** (in order of pitch utility):
1. Excalibur 70%→6% (RUSI Stormbreak + Patt House testimony)
2. GLSDB 1-3m→30-50m (LaPlante via Trevithick TWZ)
3. Pole-21 125°×25°/25 km (TRADOC ODIN tier-2)
4. Lo et al. ION ITM 2025 (TIER-1 peer-reviewed Russia spoofing)
5. R-330Zh 25 km / 100 MHz–2 GHz (TRADOC ODIN + multi-source)

**Three honesty gaps owned in framing** (R17 mitigation):
1. No 2022+ source defends 3σ for tactical inter-arrival.
2. No 2022+ source binds 5% CRC for tactical waveforms.
3. No 2022+ source cites a numerical neighbor-radius for FR-03's 500m.

**Hard blocker for stage use:** WebFetch was denied for every agent run. All citations are search-snippet corroborated only. **Top 5 priority URLs (Stormbreak, Patt testimony, TWZ GLSDB, Lo ION 2025, ODIN Pole-21) must be manually opened in a browser before any number is recited or printed on a slide.**
