import {
  CATALOGUE_COUNT,
  CATALOGUE_SHA256,
} from "../generated/catalogue-meta";
import type {
  BatteryChemistry,
  BatteryKwhSource,
  Powertrain,
  Vehicle,
  WeightSource,
} from "../types";

const MAX_TEXT = 240;
const MAX_CATALOGUE = 80_000;

export async function loadCatalogue(): Promise<Vehicle[]> {
  const res = await fetch("/vehicles.json");
  if (!res.ok) throw new Error("Could not load vehicle catalogue");

  const bytes = await res.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hex !== CATALOGUE_SHA256) {
    throw new Error("Vehicle catalogue failed an integrity check");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Vehicle catalogue looks damaged");
  }

  return parseCatalogue(parsed);
}

export function parseCatalogue(raw: unknown): Vehicle[] {
  if (!Array.isArray(raw)) {
    throw new Error("Vehicle catalogue looks damaged");
  }
  if (raw.length !== CATALOGUE_COUNT || raw.length > MAX_CATALOGUE) {
    throw new Error("Vehicle catalogue failed an integrity check");
  }

  const vehicles: Vehicle[] = [];
  for (const row of raw) {
    const vehicle = parseVehicle(row);
    if (!vehicle) throw new Error("Vehicle catalogue looks damaged");
    vehicles.push(vehicle);
  }
  return vehicles;
}

function parseVehicle(row: unknown): Vehicle | null {
  if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;

  const id = text(o.id);
  const make = text(o.make);
  const model = text(o.model);
  const vehicleClass = text(o.vehicleClass, true);
  const fuelCode = text(o.fuelCode, true);
  const transmission = text(o.transmission, true);
  const year = int(o.year);
  const powertrain = asPowertrain(o.powertrain);
  const weightSource = asWeightSource(o.weightSource);
  const curbWeightKg = finite(o.curbWeightKg);
  if (
    !id ||
    !make ||
    !model ||
    vehicleClass == null ||
    fuelCode == null ||
    transmission == null ||
    year == null ||
    year < 1990 ||
    year > 2040 ||
    !powertrain ||
    !weightSource ||
    curbWeightKg == null ||
    curbWeightKg <= 0
  ) {
    return null;
  }

  return {
    id,
    year,
    make,
    model,
    vehicleClass,
    powertrain,
    fuelCode,
    transmission,
    engineL: nullableFinite(o.engineL),
    motorKw: nullableFinite(o.motorKw),
    combinedLPer100: nullableFinite(o.combinedLPer100),
    combinedKwhPer100: nullableFinite(o.combinedKwhPer100),
    tailpipeGPerKm: nullableFinite(o.tailpipeGPerKm),
    electricRangeKm: nullableFinite(o.electricRangeKm),
    chargeSustainingLPer100: nullableFinite(o.chargeSustainingLPer100),
    batteryKwhHint: nullableFinite(o.batteryKwhHint),
    curbWeightKg,
    weightSource,
    weightYear: nullableInt(o.weightYear),
    batteryKwh: nullableFinite(o.batteryKwh),
    batteryKwhSource: asBatteryKwhSource(o.batteryKwhSource),
    batteryChemistry: asBatteryChemistry(o.batteryChemistry),
  };
}

function text(value: unknown, allowEmpty = false): string | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_TEXT) return null;
  if (!allowEmpty && value.length === 0) return null;
  return value;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
  const n = finite(value);
  return n != null && Number.isInteger(n) ? n : null;
}

function nullableFinite(value: unknown): number | null {
  if (value == null) return null;
  return finite(value);
}

function nullableInt(value: unknown): number | null {
  if (value == null) return null;
  return int(value);
}

function asPowertrain(value: unknown): Powertrain | null {
  return value === "ice" ||
    value === "hybrid" ||
    value === "phev" ||
    value === "bev"
    ? value
    : null;
}

function asWeightSource(value: unknown): WeightSource | null {
  return value === "cvs" || value === "class" ? value : null;
}

function asBatteryKwhSource(value: unknown): BatteryKwhSource | null {
  if (value == null) return null;
  return value === "name" || value === "range" ? value : null;
}

function asBatteryChemistry(value: unknown): BatteryChemistry | null {
  if (value == null) return null;
  return value === "nmc" || value === "lfp" ? value : null;
}
