import { useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";

export type AugmentedEvent = CotEvent & {
  recentlyAffected: boolean;
  lastIncidentStatus?: LinkStatus;
};

const AFFECTED_WINDOW_S = 30;
const PURGE_AFTER_S = 90;

type Memory = { lastAffectedAt: number; lastStatus: LinkStatus };
const HISTORY = new Map<string, Memory>();

export const useAffectedAugment = (events: CotEvent[]): AugmentedEvent[] =>
  useMemo(() => {
    if (events.length === 0) {
      HISTORY.clear();
      return [];
    }

    const t = Date.now() / 1000;
    const out: AugmentedEvent[] = [];
    const liveUids = new Set<string>();

    for (const e of events) {
      liveUids.add(e.uid);
      if (e.status !== "healthy") {
        HISTORY.set(e.uid, { lastAffectedAt: t, lastStatus: e.status });
      }
      const memory = HISTORY.get(e.uid);
      const recentlyAffected =
        !!memory &&
        e.status === "healthy" &&
        t - memory.lastAffectedAt < AFFECTED_WINDOW_S;
      out.push({
        ...e,
        recentlyAffected,
        lastIncidentStatus: memory?.lastStatus,
      });
    }

    for (const [uid, mem] of HISTORY) {
      if (!liveUids.has(uid) && t - mem.lastAffectedAt > PURGE_AFTER_S) {
        HISTORY.delete(uid);
      }
    }

    return out;
  }, [events]);
