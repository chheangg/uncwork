import type { Dimension, SensorType } from "@/types/cot";

export const SENSORS_BY_DIMENSION: Record<Dimension, SensorType[]> = {
  air: ["radar", "eo_ir", "sigint", "ew"],
  ground: ["radar", "eo_ir", "sigint", "seismic"],
  sea_surface: ["radar", "ais", "eo_ir"],
  sea_subsurface: ["sonar", "acoustic"],
  space: ["eo_ir", "sigint"],
  sof: ["eo_ir", "acoustic", "lidar"],
  sensor: ["radar", "eo_ir", "sigint", "acoustic", "seismic", "lidar"],
  other: ["radar", "eo_ir"],
};

const SENSOR_LABEL: Record<SensorType, string> = {
  radar: "RDR",
  sonar: "SNR",
  eo_ir: "EO/IR",
  sigint: "SIG",
  acoustic: "ACS",
  seismic: "SES",
  ais: "AIS",
  lidar: "LDR",
  ew: "EW",
  adsb: "ADS-B",
};

const SENSOR_FULL: Record<SensorType, string> = {
  radar: "Radar",
  sonar: "Sonar",
  eo_ir: "EO / IR",
  sigint: "SIGINT",
  acoustic: "Acoustic",
  seismic: "Seismic",
  ais: "AIS",
  lidar: "LIDAR",
  ew: "EW",
  adsb: "ADS-B",
};

export const sensorLabel = (s: SensorType): string => SENSOR_LABEL[s];
export const sensorFullName = (s: SensorType): string => SENSOR_FULL[s];
