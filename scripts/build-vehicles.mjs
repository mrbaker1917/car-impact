import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { enrichVehicles } from "./cvs-join.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nrcanDir = path.join(root, "data", "nrcan");

const ICE_FILES = [
  "my1995-2014-fuel-consumption-ratings-5-cycle.csv",
  "my2015-2024-fuel-consumption-ratings.csv",
  "my2025-fuel-consumption-ratings.csv",
  "my2026-fuel-consumption-ratings.csv",
];

function num(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/,/g, "");
  if (!text || /^n\/a$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadCsv(filename) {
  const text = await readFile(path.join(nrcanDir, filename), "utf8");
  return parse(text.replace(/^\uFEFF/, ""), {
    columns: (header) => header.map((h) => String(h).trim()),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function parseChargeDepleting(field) {
  if (!field) return { kwh: null, litres: null };
  const text = String(field);
  const kwhMatch = text.match(/([\d.]+)\s*kWh/i);
  const litreMatch = text.match(/\+\s*([\d.]+)\s*L/i);
  return {
    kwh: kwhMatch ? Number(kwhMatch[1]) : null,
    litres: litreMatch ? Number(litreMatch[1]) : 0,
  };
}

function batteryHint(model) {
  const match = String(model).match(/\((\d+(?:\.\d+)?)\s*kWh\)/i);
  return match ? Number(match[1]) : null;
}

function isHybridName(model) {
  return /\b(hybrid|hev)\b/i.test(model) && !/plug-?\s*in/i.test(model);
}

function rowId(parts) {
  return parts.map((p) => String(p ?? "").trim()).join("|");
}

const vehicles = [];
const seen = new Set();

function add(vehicle) {
  if (seen.has(vehicle.id)) return;
  seen.add(vehicle.id);
  vehicles.push(vehicle);
}

for (const file of ICE_FILES) {
  const rows = await loadCsv(file);
  for (const row of rows) {
    const year = num(row["Model year"]);
    const make = row.Make?.trim();
    const model = row.Model?.trim();
    if (!year || !make || !model) continue;
    add({
      id: rowId([
        year,
        make,
        model,
        row.Transmission,
        row["Fuel type"],
        row["Engine size (L)"],
      ]),
      year,
      make,
      model,
      vehicleClass: row["Vehicle class"]?.trim() ?? "",
      powertrain: isHybridName(model) ? "hybrid" : "ice",
      fuelCode: String(row["Fuel type"] ?? "").replace("*", "").trim(),
      transmission: row.Transmission?.trim() ?? "",
      engineL: num(row["Engine size (L)"]),
      motorKw: null,
      combinedLPer100: num(row["Combined (L/100 km)"]),
      combinedKwhPer100: null,
      tailpipeGPerKm: num(row["CO2 emissions (g/km)"]),
      electricRangeKm: null,
      chargeSustainingLPer100: null,
      batteryKwhHint: batteryHint(model),
    });
  }
}

for (const row of await loadCsv("my2012-2026-battery-electric-vehicles.csv")) {
  const year = num(row["Model year"]);
  const make = row.Make?.trim();
  const model = row.Model?.trim();
  if (!year || !make || !model) continue;
  add({
    id: rowId([year, make, model, row.Transmission, "B", row["Motor (kW)"]]),
    year,
    make,
    model,
    vehicleClass: row["Vehicle class"]?.trim() ?? "",
    powertrain: "bev",
    fuelCode: "B",
    transmission: row.Transmission?.trim() ?? "",
    engineL: null,
    motorKw: num(row["Motor (kW)"]),
    combinedLPer100: null,
    combinedKwhPer100: num(row["Combined (kWh/100 km)"]),
    tailpipeGPerKm: num(row["CO2 emissions (g/km)"]) ?? 0,
    electricRangeKm: num(row["Range (km)"]),
    chargeSustainingLPer100: null,
    batteryKwhHint: batteryHint(model),
  });
}

for (const row of await loadCsv(
  "my2012-2026-plug-in-hybrid-electric-vehicles.csv",
)) {
  const year = num(row["Model year"]);
  const make = row.Make?.trim();
  const model = row.Model?.trim();
  if (!year || !make || !model) continue;
  const cd = parseChargeDepleting(row["Combined Le/100 km"]);
  add({
    id: rowId([
      year,
      make,
      model,
      row.Transmission,
      row["Fuel type 2"] || row["Fuel type 1"],
      row["Engine size (L)"],
    ]),
    year,
    make,
    model,
    vehicleClass: row["Vehicle class"]?.trim() ?? "",
    powertrain: "phev",
    fuelCode: String(row["Fuel type 2"] ?? "Z")
      .replace("*", "")
      .trim(),
    transmission: row.Transmission?.trim() ?? "",
    engineL: num(row["Engine size (L)"]),
    motorKw: num(row["Motor (kW)"]),
    combinedLPer100: num(row["Combined (L/100 km)"]),
    combinedKwhPer100: cd.kwh,
    tailpipeGPerKm: num(row["CO2 emissions (g/km)"]),
    electricRangeKm: num(row["Range 1 (km)"]),
    chargeSustainingLPer100: num(row["Combined (L/100 km)"]),
    batteryKwhHint: batteryHint(model),
  });
}

vehicles.sort(
  (a, b) =>
    b.year - a.year ||
    a.make.localeCompare(b.make) ||
    a.model.localeCompare(b.model),
);

const { vehicles: enriched, cvsCount } = await enrichVehicles(vehicles, root);

const json = JSON.stringify(enriched);
const sha256 = createHash("sha256").update(json).digest("hex");

await mkdir(path.join(root, "public"), { recursive: true });
await writeFile(path.join(root, "public", "vehicles.json"), json);

await mkdir(path.join(root, "src", "generated"), { recursive: true });
await writeFile(
  path.join(root, "src", "generated", "catalogue-meta.ts"),
  [
    "// Generated by scripts/build-vehicles.mjs — do not edit.",
    `export const CATALOGUE_SHA256 = "${sha256}";`,
    `export const CATALOGUE_COUNT = ${enriched.length};`,
    "",
  ].join("\n"),
);

const counts = enriched.reduce((acc, v) => {
  acc[v.powertrain] = (acc[v.powertrain] ?? 0) + 1;
  return acc;
}, {});
const cvsWeights = enriched.filter((v) => v.weightSource === "cvs").length;
const withPack = enriched.filter((v) => v.batteryKwh != null).length;

console.log(
  `Wrote ${enriched.length} vehicles`,
  counts,
  `→ public/vehicles.json`,
);
console.log(
  `Curb weight: ${cvsWeights} from CVS (${cvsCount} CVS rows), ${
    enriched.length - cvsWeights
  } class average`,
);
console.log(`Battery pack estimate: ${withPack} BEV/PHEV`);
