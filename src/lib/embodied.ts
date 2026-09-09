import type { BatteryChemistry, Vehicle } from "../types";

/** Assumed lifetime used only to put manufacture next to driving (g/km). */
export const LIFETIME_KM = 250_000;

/**
 * Cradle-to-gate GHG intensities, kg CO2e per kg of material.
 * Automotive recycled-content mix, GREET 2 / typical North American values.
 */
const INTENSITY = {
  steel: 2.3,
  aluminum: 8.6,
  copper: 4.5,
  other: 2.8,
} as const;

/**
 * Pack-level battery production, kg CO2e per kWh of nominal capacity.
 * NMC811-like vs LFP; includes cells, pack hardware, and cathode metals.
 * Assembly electricity is a global average, not a Canadian gigafactory.
 */
const BATTERY_KG_PER_KWH: Record<BatteryChemistry, number> = {
  nmc: 80,
  lfp: 55,
};

const PACK_KG_PER_KWH: Record<BatteryChemistry, number> = {
  nmc: 6.5,
  lfp: 8,
};

/** Vehicle assembly / paint, independent of the bill of materials. */
const FACTORY_BASE_KG = 500;
const FACTORY_PER_KG = 0.25;

type GliderShare = {
  steel: number;
  aluminum: number;
  copper: number;
  other: number;
};

const GLIDER_SHARE: Record<Vehicle["powertrain"], GliderShare> = {
  ice: { steel: 0.62, aluminum: 0.09, copper: 0.015, other: 0.275 },
  hybrid: { steel: 0.6, aluminum: 0.1, copper: 0.02, other: 0.28 },
  phev: { steel: 0.58, aluminum: 0.12, copper: 0.025, other: 0.275 },
  bev: { steel: 0.55, aluminum: 0.14, copper: 0.035, other: 0.275 },
};

/**
 * ELV recovery rates for a scrapped light-duty vehicle in Canada.
 * Steel and aluminum are magnetic/eddy-current separated; copper wiring
 * and plastics mostly stay in shredder residue. Not a legal mandate:
 * Canada has no national ELV law.
 */
const RECOVERY = {
  steel: 0.9,
  aluminum: 0.85,
  copper: 0.6,
  other: 0.05,
} as const;

/**
 * Avoided GHG per kg recovered, beyond the recycled-content mix already
 * in the build number. Smaller than primary-metal intensities so scrap
 * is not double-counted. Steel ~EAF vs remaining BF-BOF; aluminum remelt
 * vs remaining primary; copper scrap vs remaining concentrate.
 */
const SCRAP_CREDIT = {
  steel: 1.2,
  aluminum: 6,
  copper: 2.5,
} as const;

const SHRED_BASE_KG = 80;
const SHRED_PER_KG = 0.05;
const RESIDUE_KG_PER_KG = 0.25;

/**
 * Net battery-recycling credit, kg CO2e per kWh, after process energy.
 * NMC recovers nickel and cobalt; LFP mostly aluminum, copper, and some lithium.
 * Assumes hydrometallurgy / Call2Recycle-style recycle, not second life.
 */
const BATTERY_RECYCLE_CREDIT: Record<BatteryChemistry, number> = {
  nmc: 22,
  lfp: 8,
};

export const CHEMISTRY_LABEL: Record<BatteryChemistry, string> = {
  nmc: "NMC",
  lfp: "LFP",
};

export type ManufactureSlice = {
  id: "steel" | "aluminum" | "copper" | "battery" | "other" | "factory";
  label: string;
  kg: number;
};

export type DisposalSlice = {
  id: "scrap" | "batteryRecycle" | "process";
  label: string;
  kg: number;
};

export type ManufactureBreakdown = {
  curbWeightKg: number;
  weightSource: Vehicle["weightSource"];
  gliderKg: number;
  batteryKwh: number | null;
  batteryChemistry: BatteryChemistry | null;
  steelKg: number;
  aluminumKg: number;
  copperKg: number;
  otherKg: number;
  batteryKg: number;
  factoryKg: number;
  totalKg: number;
  gPerKm: number;
  slices: ManufactureSlice[];
};

export type DisposalBreakdown = {
  scrapKg: number;
  batteryKg: number;
  processKg: number;
  netKg: number;
  gPerKm: number;
  slices: DisposalSlice[];
};

type MaterialBill = {
  gliderKg: number;
  steelMass: number;
  aluminumMass: number;
  copperMass: number;
  otherMass: number;
  packKwh: number | null;
  chemistry: BatteryChemistry | null;
};

function materialBill(vehicle: Vehicle): MaterialBill {
  const chemistry = vehicle.batteryChemistry;
  const packKwh = vehicle.batteryKwh;
  const packMass =
    chemistry && packKwh != null ? packKwh * PACK_KG_PER_KWH[chemistry] : 0;
  const gliderKg = Math.max(vehicle.curbWeightKg - packMass, vehicle.curbWeightKg * 0.55);
  const share = GLIDER_SHARE[vehicle.powertrain];
  return {
    gliderKg,
    steelMass: gliderKg * share.steel,
    aluminumMass: gliderKg * share.aluminum,
    copperMass: gliderKg * share.copper,
    otherMass: gliderKg * share.other,
    packKwh,
    chemistry,
  };
}

export function embodiedEmissions(vehicle: Vehicle): ManufactureBreakdown {
  const bill = materialBill(vehicle);
  const steelKg = bill.steelMass * INTENSITY.steel;
  const aluminumKg = bill.aluminumMass * INTENSITY.aluminum;
  const copperKg = bill.copperMass * INTENSITY.copper;
  const otherKg = bill.otherMass * INTENSITY.other;
  const batteryKg =
    bill.chemistry && bill.packKwh != null
      ? bill.packKwh * BATTERY_KG_PER_KWH[bill.chemistry]
      : 0;
  const factoryKg = FACTORY_BASE_KG + FACTORY_PER_KG * vehicle.curbWeightKg;
  const totalKg = steelKg + aluminumKg + copperKg + otherKg + batteryKg + factoryKg;

  const slices: ManufactureSlice[] = (
    [
      { id: "steel", label: "Steel", kg: steelKg },
      { id: "aluminum", label: "Aluminum", kg: aluminumKg },
      { id: "copper", label: "Copper", kg: copperKg },
      { id: "other", label: "Other materials", kg: otherKg },
      { id: "battery", label: "Battery metals", kg: batteryKg },
      { id: "factory", label: "Factory", kg: factoryKg },
    ] as const
  ).filter((slice) => slice.kg >= 1);

  return {
    curbWeightKg: vehicle.curbWeightKg,
    weightSource: vehicle.weightSource,
    gliderKg: Math.round(bill.gliderKg),
    batteryKwh: bill.packKwh,
    batteryChemistry: bill.chemistry,
    steelKg,
    aluminumKg,
    copperKg,
    otherKg,
    batteryKg,
    factoryKg,
    totalKg,
    gPerKm: (totalKg * 1000) / LIFETIME_KM,
    slices,
  };
}

export function disposalEmissions(vehicle: Vehicle): DisposalBreakdown {
  const bill = materialBill(vehicle);
  const scrapKg = -(
    bill.steelMass * RECOVERY.steel * SCRAP_CREDIT.steel +
    bill.aluminumMass * RECOVERY.aluminum * SCRAP_CREDIT.aluminum +
    bill.copperMass * RECOVERY.copper * SCRAP_CREDIT.copper
  );
  const unrecoveredOther = bill.otherMass * (1 - RECOVERY.other);
  const processKg =
    SHRED_BASE_KG +
    SHRED_PER_KG * vehicle.curbWeightKg +
    unrecoveredOther * RESIDUE_KG_PER_KG;
  const batteryKg =
    bill.chemistry && bill.packKwh != null
      ? -(bill.packKwh * BATTERY_RECYCLE_CREDIT[bill.chemistry])
      : 0;
  const netKg = scrapKg + batteryKg + processKg;

  const slices: DisposalSlice[] = (
    [
      { id: "scrap", label: "Scrap metals", kg: scrapKg },
      { id: "batteryRecycle", label: "Battery recycle", kg: batteryKg },
      { id: "process", label: "Shredding and residue", kg: processKg },
    ] as const
  ).filter((slice) => Math.abs(slice.kg) >= 1);

  return {
    scrapKg,
    batteryKg,
    processKg,
    netKg,
    gPerKm: (netKg * 1000) / LIFETIME_KM,
    slices,
  };
}

export function weightCaption(vehicle: Vehicle): string {
  const kg = `${vehicle.curbWeightKg.toLocaleString("en-CA")} kg`;
  if (vehicle.weightSource === "class") {
    return `${kg} (class average)`;
  }
  if (vehicle.weightYear && vehicle.weightYear !== vehicle.year) {
    return `${kg} (${vehicle.weightYear} spec)`;
  }
  return kg;
}

export function batteryCaption(vehicle: Vehicle): string | null {
  if (vehicle.batteryKwh == null || !vehicle.batteryChemistry) return null;
  const chem = CHEMISTRY_LABEL[vehicle.batteryChemistry];
  const assumed = `${chem} assumed`;
  if (vehicle.batteryKwhSource === "name") {
    return `${vehicle.batteryKwh} kWh pack, ${assumed}`;
  }
  return `~${vehicle.batteryKwh} kWh pack, ${assumed}`;
}

export function disposalCaption(vehicle: Vehicle): string {
  if (vehicle.powertrain === "bev" || vehicle.powertrain === "phev") {
    return "assumed scrapped; pack recycled, not reused";
  }
  return "assumed scrapped and shredded";
}
