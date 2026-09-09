import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadCvsIndex,
  matchCvsWeight,
  nameplate,
  rowsFor,
  pickMatch,
  normalizeMake,
} from "./cvs-join.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { cvs, cvsIndex } = await loadCvsIndex(root);

const vehiclesPath = path.join(root, "public", "vehicles.json");
let vehicles;
try {
  vehicles = JSON.parse(await readFile(vehiclesPath, "utf8"));
} catch {
  throw new Error("Run npm run data first to build public/vehicles.json");
}

const results = {
  exactYearCore: 0,
  generationCore: 0,
  nearbyCore: 0,
  anyCore: 0,
  none: 0,
};

const byPowertrain = {};
const byYearBucket = { "1995-2010": [0, 0], "2011-2023": [0, 0], "2024-2026": [0, 0] };
const misses = [];
const hits = [];

for (const vehicle of vehicles) {
  const make = normalizeMake(vehicle.make);
  const core = nameplate(vehicle.model);
  const rows = rowsFor(make, core, cvsIndex);
  const assigned = matchCvsWeight(vehicle, cvsIndex);
  const any = pickMatch(vehicle, rows);

  let strategy = "none";
  if (assigned?.strategy === "exactYearCore") {
    strategy = "exactYearCore";
    results.exactYearCore += 1;
  } else if (assigned?.strategy === "generationCore") {
    strategy = "generationCore";
    results.generationCore += 1;
  } else if (assigned?.strategy === "nearbyCore") {
    strategy = "nearbyCore";
    results.nearbyCore += 1;
  } else if (any) {
    strategy = "anyCore";
    results.anyCore += 1;
  } else {
    results.none += 1;
    if (misses.length < 25) {
      misses.push(`${vehicle.year} ${vehicle.make} ${vehicle.model} (core="${core}")`);
    }
  }

  const match = assigned ?? (strategy === "anyCore" ? any : null);
  const pt = vehicle.powertrain;
  byPowertrain[pt] ??= { total: 0, matched: 0 };
  byPowertrain[pt].total += 1;
  if (assigned) byPowertrain[pt].matched += 1;

  const bucket =
    vehicle.year <= 2010 ? "1995-2010" : vehicle.year <= 2023 ? "2011-2023" : "2024-2026";
  byYearBucket[bucket][0] += 1;
  if (assigned) byYearBucket[bucket][1] += 1;

  if (assigned && hits.length < 8) {
    hits.push(
      `${vehicle.year} ${vehicle.make} ${vehicle.model} → ${assigned.year} ${assigned.model} (${assigned.kg} kg) [${strategy}]`,
    );
  }
}

const battery = { withRangeAndUse: 0, withNameHint: 0, bevPhev: 0, withPack: 0 };
for (const vehicle of vehicles) {
  if (vehicle.powertrain !== "bev" && vehicle.powertrain !== "phev") continue;
  battery.bevPhev += 1;
  if (vehicle.batteryKwhHint) battery.withNameHint += 1;
  if (vehicle.electricRangeKm && vehicle.combinedKwhPer100) battery.withRangeAndUse += 1;
  if (vehicle.batteryKwh) battery.withPack += 1;
}

function pct(part, whole) {
  return whole ? `${((100 * part) / whole).toFixed(1)}%` : "n/a";
}

const total = vehicles.length;
const assigned = results.exactYearCore + results.generationCore + results.nearbyCore;

console.log("CVS unique make/model/year with weight:", cvs.length);
console.log("EnerGuide vehicles:", total);
console.log("");
console.log("Join used for mining (exact year or generation ≤ 8 years):");
console.log("  exact year + core name:", results.exactYearCore, pct(results.exactYearCore, total));
console.log("  generation (MYR ≤ year, ≤ 8 yr):", results.generationCore, pct(results.generationCore, total));
console.log("  nearby nameplate (±8 yr):", results.nearbyCore, pct(results.nearbyCore, total));
console.log("  assigned CVS weight:", assigned, pct(assigned, total));
console.log("  leftover same-nameplate, far year:", results.anyCore, pct(results.anyCore, total));
console.log("  no nameplate match:", results.none, pct(results.none, total));
console.log("");
console.log("By powertrain (CVS assigned):");
for (const [key, value] of Object.entries(byPowertrain)) {
  console.log(`  ${key}: ${value.matched}/${value.total} ${pct(value.matched, value.total)}`);
}
console.log("");
console.log("By EnerGuide year:");
for (const [key, [all, hit]] of Object.entries(byYearBucket)) {
  console.log(`  ${key}: ${hit}/${all} ${pct(hit, all)}`);
}
console.log("");
console.log("Battery (BEV + PHEV):");
console.log("  with range and kWh/100 km:", battery.withRangeAndUse, pct(battery.withRangeAndUse, battery.bevPhev));
console.log("  with kWh in model name:", battery.withNameHint, pct(battery.withNameHint, battery.bevPhev));
console.log("  pack kWh on catalogue:", battery.withPack, pct(battery.withPack, battery.bevPhev));
console.log("");
console.log("Sample hits:");
for (const line of hits) console.log(" ", line);
console.log("Sample misses:");
for (const line of misses) console.log(" ", line);
