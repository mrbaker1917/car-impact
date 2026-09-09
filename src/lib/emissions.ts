import type { Vehicle } from "../types";
import { provinceByCode, type ProvinceCode } from "./provinces";

/**
 * Well-to-tank (fuel production) factors, grams CO2e per litre.
 * Gasoline WTT is derived from GHGenius 5.0 Ontario gasoline
 * (~20.9 g CO2e/MJ × 34.69 MJ/L). Diesel uses a similar upstream intensity
 * at diesel energy density. Tailpipe CO2 comes from NRCan, not these values.
 */
const WTT_G_PER_L: Record<string, number> = {
  X: 725,
  Z: 725,
  D: 770,
  E: 400,
  N: 450,
};

function wttPerLitre(fuelCode: string): number {
  return WTT_G_PER_L[fuelCode] ?? WTT_G_PER_L.X ?? 725;
}

export type DrivingBreakdown = {
  tailpipeGPerKm: number;
  fuelProductionGPerKm: number;
  electricityGPerKm: number;
  totalGPerKm: number;
  kgPerYear: number;
  utilityFactor: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Share of kilometres driven on electricity, inferred from NRCan's
 * utility-factor-weighted tailpipe CO2 versus charge-sustaining fuel use.
 * Falls back to electric range when tailpipe data is missing.
 */
export function plugInUtilityFactor(vehicle: Vehicle): number {
  const csL = vehicle.chargeSustainingLPer100 ?? vehicle.combinedLPer100;
  const tailpipe = vehicle.tailpipeGPerKm;
  if (csL && csL > 0 && tailpipe != null) {
    const csTailpipe = (csL / 100) * 2310;
    if (csTailpipe > 0) {
      return clamp(1 - tailpipe / csTailpipe, 0, 0.98);
    }
  }
  if (vehicle.electricRangeKm && vehicle.electricRangeKm > 0) {
    return clamp(1 - Math.exp(-vehicle.electricRangeKm / 48), 0.05, 0.95);
  }
  return 0.5;
}

export function drivingEmissions(
  vehicle: Vehicle,
  provinceCode: ProvinceCode,
  kmPerYear: number,
): DrivingBreakdown {
  const grid = provinceByCode(provinceCode).gPerKwh;
  let tailpipe = 0;
  let fuelProduction = 0;
  let electricity = 0;
  let utilityFactor: number | null = null;

  if (vehicle.powertrain === "bev") {
    const kwh = vehicle.combinedKwhPer100 ?? 0;
    electricity = (kwh / 100) * grid;
  } else if (vehicle.powertrain === "phev") {
    utilityFactor = plugInUtilityFactor(vehicle);
    const kwh = vehicle.combinedKwhPer100 ?? 0;
    const litres = vehicle.chargeSustainingLPer100 ?? vehicle.combinedLPer100 ?? 0;
    electricity = utilityFactor * (kwh / 100) * grid;
    tailpipe = vehicle.tailpipeGPerKm ?? (1 - utilityFactor) * (litres / 100) * 2310;
    fuelProduction =
      (1 - utilityFactor) * (litres / 100) * wttPerLitre(vehicle.fuelCode);
  } else {
    tailpipe = vehicle.tailpipeGPerKm ?? 0;
    const litres = vehicle.combinedLPer100 ?? 0;
    fuelProduction = (litres / 100) * wttPerLitre(vehicle.fuelCode);
  }

  const totalGPerKm = tailpipe + fuelProduction + electricity;
  return {
    tailpipeGPerKm: tailpipe,
    fuelProductionGPerKm: fuelProduction,
    electricityGPerKm: electricity,
    totalGPerKm,
    kgPerYear: (totalGPerKm * kmPerYear) / 1000,
    utilityFactor,
  };
}

export function formatKg(kg: number): string {
  if (kg < 0) return `−${formatKg(-kg)}`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg)} kg`;
}

export function formatGPerKm(g: number): string {
  if (g < 0) return `−${formatGPerKm(-g)}`;
  if (g < 10) return `${g.toFixed(1)} g/km`;
  return `${Math.round(g)} g/km`;
}
