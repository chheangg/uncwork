import { useCallback, useEffect, useState } from "react";
import { httpUrl } from "@/config/env";

export type ScenarioList = {
  active: string;
  available: string[];
  speed: number;
  speed_min: number;
  speed_max: number;
  paused: boolean;
};

const REFRESH_MS = 2000;

// Polls the listener for the active scenario + speed multiplier and
// the list of available scenarios on disk. Includes setters that
// POST changes; the sender picks them up via its own poller and
// adjusts on the next tick (and emits a reset signal on scenario
// change so the frontend clears).
export const useScenarios = (): {
  list: ScenarioList | null;
  setActive: (name: string) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  restart: () => Promise<void>;
  pending: string | null;
  error: string | null;
} => {
  const [list, setList] = useState<ScenarioList | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(httpUrl("/scenarios"));
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as ScenarioList;
      setList(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh();
    const id = window.setInterval(() => {
      if (cancelled) return;
      refresh();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh]);

  const setActive = useCallback(
    async (name: string) => {
      setPending(name);
      try {
        const res = await fetch(httpUrl("/scenarios/active"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`status ${res.status}: ${text}`);
        }
        const data = (await res.json()) as ScenarioList;
        setList(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const setSpeed = useCallback(async (speed: number) => {
    // Optimistic update so the slider knob tracks the user's hand.
    setList((prev) => (prev ? { ...prev, speed } : prev));
    try {
      const res = await fetch(httpUrl("/scenarios/speed"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`status ${res.status}: ${text}`);
      }
      const data = (await res.json()) as ScenarioList;
      setList(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const restart = useCallback(async () => {
    try {
      const res = await fetch(httpUrl("/scenarios/restart"), {
        method: "POST",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`status ${res.status}: ${text}`);
      }
      const data = (await res.json()) as ScenarioList;
      setList(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setPaused = useCallback(async (paused: boolean) => {
    setList((prev) => (prev ? { ...prev, paused } : prev));
    try {
      const res = await fetch(httpUrl("/scenarios/paused"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`status ${res.status}: ${text}`);
      }
      const data = (await res.json()) as ScenarioList;
      setList(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return { list, setActive, setSpeed, setPaused, restart, pending, error };
};
