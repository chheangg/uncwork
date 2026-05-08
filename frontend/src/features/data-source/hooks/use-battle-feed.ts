import { useEffect, useRef } from "react";
import { useDataSourceStore } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";
import {
  emitFromBattleUnit,
  seedBattle,
  stepBattle,
  type BattleUnit,
} from "@/mock/battle-sim";

const TICK_MS = 500;
const TICK_SEC = TICK_MS / 1000;

/**
 * Free-form battle simulator feed. When the source flips to "battle",
 * seed a fresh roster of friendlies + hostiles and tick the rules
 * engine every 500 ms, pushing one CoT event per unit per tick into
 * the events store. Cleared on switch out so the next battle starts
 * fresh and stale units don't leak into other modes.
 */
export const useBattleFeed = () => {
  const source = useDataSourceStore((s) => s.source);
  const upsertMany = useEventStore((s) => s.upsertMany);
  const clear = useEventStore((s) => s.clear);
  const unitsRef = useRef<BattleUnit[]>([]);

  useEffect(() => {
    if (source !== "battle") return;
    clear();
    unitsRef.current = seedBattle();
    upsertMany(unitsRef.current.map(emitFromBattleUnit));

    const id = window.setInterval(() => {
      unitsRef.current = stepBattle(unitsRef.current, TICK_SEC);
      upsertMany(unitsRef.current.map(emitFromBattleUnit));
    }, TICK_MS);

    return () => {
      window.clearInterval(id);
      unitsRef.current = [];
      clear();
    };
  }, [source, upsertMany, clear]);
};
