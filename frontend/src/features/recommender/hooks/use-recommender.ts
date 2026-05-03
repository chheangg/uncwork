import { useMemo } from "react";
import type { TrackPath } from "@/lib/track-path";

export type Recommendation = {
  priority: "low" | "medium" | "high";
  summary: string;
  actions: string[];
};

export const useRecommender = (track: TrackPath | null): Recommendation | null => {
  return useMemo(() => {
    if (!track) return null;

    const { status, confInt, callsign, uid } = track.latest;
    const label = callsign ?? uid;

    if (status === "offline") {
      return {
        priority: "high",
        summary: `${label} is offline. Verify comms link and re-establish contact.`,
        actions: ["Re-ping unit", "Check relay node", "Escalate to ops"],
      };
    }
    if (status === "critical") {
      return {
        priority: "high",
        summary: `${label} reporting critical signal quality (${(confInt * 100).toFixed(0)}%). Immediate review required.`,
        actions: ["Verify antenna alignment", "Switch to backup channel", "Request status report"],
      };
    }
    if (status === "degraded") {
      return {
        priority: "medium",
        summary: `${label} link degraded (${(confInt * 100).toFixed(0)}% confidence). Monitor closely.`,
        actions: ["Check interference sources", "Increase transmission power", "Log for review"],
      };
    }
    return {
      priority: "low",
      summary: `${label} nominal (${(confInt * 100).toFixed(0)}% confidence). No action required.`,
      actions: ["Continue monitoring"],
    };
  }, [track]);
};
