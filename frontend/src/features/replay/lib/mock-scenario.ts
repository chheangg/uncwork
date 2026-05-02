import type { CotEvent } from "@/types/cot";
import { enrichCot } from "@/lib/cot";
import { PRESET_BBOX } from "@/config/constants";

// Generate a 2-minute mock scenario with interesting events
export const generateMockScenario = (): CotEvent[] => {
  const events: CotEvent[] = [];
  const startTime = Date.now() - 120_000; // 2 minutes ago
  const { west, east, south, north } = PRESET_BBOX;

  const centerLon = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const spanLon = east - west;
  const spanLat = north - south;

  // Scenario: 3 aircraft on patrol, 1 develops issues
  const aircraft = [
    {
      uid: "replay-alpha",
      callsign: "ALPHA-01",
      startLat: centerLat - spanLat * 0.2,
      startLon: centerLon - spanLon * 0.3,
      vLat: 0.0002,
      vLon: 0.0003,
      healthDecay: 0.004, // Stays healthy
    },
    {
      uid: "replay-bravo",
      callsign: "BRAVO-02",
      startLat: centerLat + spanLat * 0.1,
      startLon: centerLon,
      vLat: -0.0001,
      vLon: 0.0002,
      healthDecay: 0.015, // Degrades over time
    },
    {
      uid: "replay-charlie",
      callsign: "CHARLIE-03",
      startLat: centerLat - spanLat * 0.1,
      startLon: centerLon + spanLon * 0.3,
      vLat: 0.0001,
      vLon: -0.0002,
      healthDecay: 0.003, // Stays healthy
    },
  ];

  // Ground sensors (static)
  const sensors = [
    {
      uid: "replay-sensor-01",
      lat: centerLat + spanLat * 0.2,
      lon: centerLon - spanLon * 0.2,
      sensorType: "radar" as const,
      healthDecay: 0.002,
    },
    {
      uid: "replay-sensor-02",
      lat: centerLat + spanLat * 0.25,
      lon: centerLon + spanLon * 0.25,
      sensorType: "eo" as const,
      healthDecay: 0.001,
    },
  ];

  // Generate events every 2 seconds for 2 minutes (60 events per track)
  const tickCount = 60;
  const tickMs = 2000;

  for (let i = 0; i < tickCount; i++) {
    const time = startTime + i * tickMs;
    const timeStr = new Date(time).toISOString();
    const staleStr = new Date(time + 60_000).toISOString();

    // Aircraft events
    for (const ac of aircraft) {
      const lat = ac.startLat + ac.vLat * i;
      const lon = ac.startLon + ac.vLon * i;
      const health = Math.max(0.1, 0.95 - ac.healthDecay * i);
      const ce = 180 - health * 178;
      const le = 300 - health * 298;

      events.push(
        enrichCot({
          uid: ac.uid,
          cotType: "a-f-A-M-F",
          sensorType: "adsb",
          time: timeStr,
          start: timeStr,
          staleAt: staleStr,
          lat,
          lon,
          hae: 5000 + Math.sin(i * 0.3) * 500,
          ce,
          le,
          callsign: ac.callsign,
          remarks: `patrol ${ac.callsign}`,
        }),
      );
    }

    // Sensor events
    for (const sensor of sensors) {
      const health = Math.max(0.2, 0.9 - sensor.healthDecay * i);
      const ce = 180 - health * 178;
      const le = 300 - health * 298;

      events.push(
        enrichCot({
          uid: sensor.uid,
          cotType: "a-f-X-S-R",
          sensorType: sensor.sensorType,
          time: timeStr,
          start: timeStr,
          staleAt: staleStr,
          lat: sensor.lat,
          lon: sensor.lon,
          hae: 10,
          ce,
          le,
          remarks: `${sensor.sensorType} station`,
        }),
      );
    }
  }

  return events;
};
