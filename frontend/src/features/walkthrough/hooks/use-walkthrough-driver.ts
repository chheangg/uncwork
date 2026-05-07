import { useEffect, useRef } from "react";
import { useScenarios } from "@/features/scenarios";
import { useViewStateStore } from "@/stores/view-state";
import { scriptFor, type Stop } from "../lib/scripts";
import { useWalkthroughStore } from "../store";

const TICK_MS = 250;

/**
 * Walkthrough driver. Runs once at the app root.
 *
 * Responsibilities:
 *  1. Reset walkthrough state when the active scenario changes.
 *  2. While in `walkthrough` mode and not paused, advance an internal
 *     elapsedSec counter (paused time does not count).
 *  3. When elapsedSec crosses the next stop's `atSec`, fly the camera
 *     to that stop's focus and call `setPaused(true)` on the backend.
 *     The popup component reads `heldOnStopIdx` from the store.
 *  4. When the user clicks ▶ on the popup, the popup calls
 *     `setPaused(false)` + advances `nextStopIdx`. Driver resumes
 *     ticking elapsedSec.
 *
 * In `full` mode the driver does nothing; the operator just watches
 * the scenario play through without auto-pauses.
 */
export const useWalkthroughDriver = () => {
  const { list, setPaused, restart } = useScenarios();
  const setView = useViewStateStore((s) => s.set);

  const mode = useWalkthroughStore((s) => s.mode);
  const nextStopIdx = useWalkthroughStore((s) => s.nextStopIdx);
  const heldOnStopIdx = useWalkthroughStore((s) => s.heldOnStopIdx);
  const setHeld = useWalkthroughStore((s) => s.setHeldOnStopIdx);
  const addElapsed = useWalkthroughStore((s) => s.addElapsed);
  const resetForScenario = useWalkthroughStore((s) => s.resetForScenario);

  const active = list?.active ?? null;
  const paused = list?.paused ?? false;

  // One-shot: when the app first hears back from /scenarios and the
  // operator is in walkthrough mode, restart the scenario so stop 1
  // lands on frame 0 instead of mid-loop state. Skipped in full mode.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    if (!list) return;
    initRef.current = true;
    if (mode === "walkthrough") {
      resetForScenario();
      setPaused(false);
      restart();
    }
  }, [list, mode, resetForScenario, setPaused, restart]);

  // Reset + unpause every time the active scenario flips. Without
  // the unpause, switching scenarios while held on a popup leaves
  // the new scenario silently paused (sender skips its tick), which
  // looks like the app froze.
  const prevActiveRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveRef.current === null) {
      prevActiveRef.current = active;
      return;
    }
    if (prevActiveRef.current !== active) {
      prevActiveRef.current = active;
      resetForScenario();
      setPaused(false);
    }
  }, [active, resetForScenario, setPaused]);

  // Driver tick: only runs in walkthrough mode, only when not paused
  // and not currently held on a stop. Advances elapsed seconds and
  // checks for the next trigger.
  useEffect(() => {
    if (mode !== "walkthrough") return;
    if (paused) return;
    if (heldOnStopIdx !== null) return;
    if (!active) return;

    const stops = scriptFor(active);
    if (nextStopIdx >= stops.length) return;

    const id = window.setInterval(() => {
      // Read latest values in case the store changed between intervals.
      const { elapsedSec, nextStopIdx: idx, heldOnStopIdx: held } =
        useWalkthroughStore.getState();
      if (held !== null) return;
      const next: Stop | undefined = stops[idx];
      if (!next) return;

      // Scale wall-clock advance by the current playback speed so
      // stops fire at the same *scenario* time regardless of slider.
      const speed = list?.speed ?? 1;
      const delta = (TICK_MS / 1000) * speed;
      const newElapsed = elapsedSec + delta;
      addElapsed(delta);
      if (newElapsed >= next.atSec) {
        // Trigger: fly camera, hold, ask backend to pause.
        setView({
          longitude: next.focus.longitude,
          latitude: next.focus.latitude,
          zoom: next.focus.zoom,
          pitch: next.focus.pitch ?? 45,
          bearing: next.focus.bearing ?? 0,
        });
        setHeld(idx);
        setPaused(true);
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [
    mode,
    paused,
    heldOnStopIdx,
    active,
    nextStopIdx,
    list,
    addElapsed,
    setHeld,
    setView,
    setPaused,
  ]);
};
