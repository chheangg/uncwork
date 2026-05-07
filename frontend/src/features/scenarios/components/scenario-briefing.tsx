import { useEffect, useState } from "react";
import { useScenarios } from "../hooks/use-scenarios";

type Step = {
  title: string;
  body: string;
};

// Per-scenario walkthrough text. Each step is a self-contained card;
// users page through with PREV / NEXT. Keep wording plain — these are
// the only on-map words a first-time observer will read, so they need
// to land without jargon. Add new scenarios by adding a key here.
const STEPS: Record<string, Step[]> = {
  uav: [
    {
      title: "Setup",
      body: "Hostile drones penetrate friendly airspace near Donetsk. Three friendly ground teams (Team 1, Team 2, Team 3) and a friendly fixed-wing (Eagle 1) sit on Officer Adam's C2 board. Team 1 is operating an EW system to jam the incoming hostile drone.",
    },
    {
      title: "What Team 1 looks like on the wire",
      body: "Running that EW shows up on Team 1's own radio: drop, dup, corrupt, reorder. The FR-04 classifier scores the live wire shape against its catalog of known jammer signatures and surfaces the closest match — the exact tag depends on the live shape, but it lands on Team 1 with HIGH confidence.",
    },
    {
      title: "Trust score · the algorithm",
      body: "Every sender carries an effective trust score: an exponential moving average of frame quality, then a one-way neighbor-drag pass. For each sender, the algorithm scans every other sender within 500 m and pulls the score down toward the worst neighbor in range. Better neighbors don't lift bad ones — drag is one-way.",
    },
    {
      title: "Team 3 · collateral via the blast radius",
      body: "Team 3 sits ~250 m from Team 1, well inside the 500 m radius. Team 3's own wire is clean, but the neighbor pass catches Team 1 and drags Team 3's effective trust into LOW. Team 3's score drop is the second piece of information — it tells Adam Team 3 is collateral, even with no fingerprint of its own.",
    },
    {
      title: "Team 2 + Eagle 1 · out of range",
      body: "Team 2 sits ~2.5 km from Team 1, outside the 500 m radius — no drag, trust stays HIGH. Eagle 1 is in the sky, relayed through Team 2, so it inherits Team 2's clean trust. Both stay HIGH while Team 1 and Team 3 sit LOW.",
    },
    {
      title: "How this helps the commander",
      body: "Without this surface, Adam sees one team with bad comms and assumes the rest are fine. With it, he sees a fingerprint over Team 1 and a LOW trust score on Team 3 — same map, two pieces of evidence, telling him exactly which feeds to act on and which to discount before he commits.",
    },
  ],
  maneuver: [
    {
      title: "The operation",
      body: "Team 1 and Team 2 are in an operation under the watch of Officer Adam, who is overseeing via the C2 console to engage an enemy position.",
    },
    {
      title: "Fire and maneuver",
      body: "Team 1 and Team 2 execute a fire-and-maneuver: Team 1 suppresses, Team 2 flanks. Team 1 begins the assault. Team 2 moves to the flanking position. Both keep constant comms with each other and with Adam.",
    },
    {
      title: "Interference",
      body: "As Team 2 approaches the flank, Team 1 and Adam experience interference with Team 2's link. Team 2's trust score drops into LOW. Team 2 fires a GPS-guided missile at the enemy position — but it misses, despite prime target acquisition conditions.",
    },
    {
      title: "Failure",
      body: "The flanking maneuver is unsuccessful. Team 1 and Team 2 both take casualties and withdraw from the assault.",
    },
    {
      title: "What Adam didn't see",
      body: "The opposing force had active jamming systems running the entire time. The same EW affected Team 2's missile guidance and caused the interference of Team 2's comms with every allied element — leading directly to the failure of the assault.",
    },
    {
      title: "What the FR-04 surface would have shown",
      body: "A red fingerprint badge over Team 2 the moment the jammer locks on. The classifier scores the live wire shape against the catalog of known jammer signatures and surfaces the closest match (the exact tag depends on the live shape — it can be any of them). Team 2's trust collapses into LOW in real time; Team 1's drags down with it via FR-03 neighbor drag.",
    },
    {
      title: "How this helps the commander",
      body: "Adam now sees three pieces of evidence — fingerprint over Team 2, Team 2's trust LOW, Team 1's trust dragging — within seconds of the jammer lighting up. He pulls the missile launch, repositions Team 2, calls in EW support. Same teams, same enemy, the operation survives. That is the difference this view makes.",
    },
  ],
};

const stepsFor = (scenario: string): Step[] =>
  STEPS[scenario] ?? [
    {
      title: scenario.toUpperCase(),
      body: "No briefing available for this scenario yet.",
    },
  ];

export const ScenarioBriefing = () => {
  const { list } = useScenarios();
  const active = list?.active ?? null;
  const [stepIdx, setStepIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Reset the walkthrough whenever the active scenario flips so the
  // operator always lands on step 1 of the new scenario.
  useEffect(() => {
    setStepIdx(0);
    setDismissed(false);
  }, [active]);

  if (!active || dismissed) return null;
  const steps = stepsFor(active);
  const step = steps[stepIdx]!;
  const total = steps.length;
  const isLast = stepIdx === total - 1;
  const isFirst = stepIdx === 0;

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-[420px] -translate-x-1/2 border border-white/40 bg-black/85 p-3 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)]">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/20 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {step.title}
        </span>
        <span className="text-[9px] tabular-nums text-white/60">
          {stepIdx + 1} / {total}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/95">
        {step.body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="border border-white/30 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/70 hover:bg-white/10"
        >
          dismiss
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="border border-white/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/15 disabled:text-white/30"
          >
            ← prev
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="border border-white bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white/85"
            >
              done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(total - 1, i + 1))}
              className="border border-white bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-white/85"
            >
              next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
