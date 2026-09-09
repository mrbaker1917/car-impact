export type Powertrain = "ice" | "hybrid" | "phev" | "bev";
export type WeightSource = "cvs" | "class";
export type BatteryChemistry = "nmc" | "lfp";
export type BatteryKwhSource = "name" | "range";

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  vehicleClass: string;
  powertrain: Powertrain;
  fuelCode: string;
  transmission: string;
  engineL: number | null;
  motorKw: number | null;
  combinedLPer100: number | null;
  combinedKwhPer100: number | null;
  tailpipeGPerKm: number | null;
  electricRangeKm: number | null;
  chargeSustainingLPer100: number | null;
  batteryKwhHint: number | null;
  curbWeightKg: number;
  weightSource: WeightSource;
  weightYear: number | null;
  batteryKwh: number | null;
  batteryKwhSource: BatteryKwhSource | null;
  batteryChemistry: BatteryChemistry | null;
};

export const POWERTRAIN_LABEL: Record<Powertrain, string> = {
  ice: "Combustion",
  hybrid: "Hybrid",
  phev: "Plug-in hybrid",
  bev: "Battery electric",
};

export function fuelLabel(vehicle: Vehicle): string {
  if (vehicle.powertrain === "bev") return POWERTRAIN_LABEL.bev;
  if (vehicle.powertrain === "phev") return POWERTRAIN_LABEL.phev;
  if (vehicle.powertrain === "hybrid") return POWERTRAIN_LABEL.hybrid;
  switch (vehicle.fuelCode) {
    case "D":
      return "Diesel";
    case "E":
      return "Flex-fuel";
    case "N":
      return "Natural gas";
    default:
      return "Gasoline";
  }
}
