import { useEffect, useState } from "react";

export const useAnimatedSeconds = (intervalMs: number = 33): number => {
  const [t, setT] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now() / 1000), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return t;
};
