import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BODY_TOKENS = new Set([
  "4dr",
  "5dr",
  "2dr",
  "3dr",
  "sedan",
  "coupe",
  "convertible",
  "conv",
  "suv",
  "cuv",
  "hatch",
  "hatchback",
  "wagon",
  "series",
  "minivan",
  "van",
  "pickup",
  "truck",
  "cab",
  "crewmax",
  "crew",
  "double",
  "access",
  "quad",
  "box",
  "fwd",
  "rwd",
  "awd",
  "4wd",
  "2wd",
  "sh-awd",
  "quattro",
  "xdrive",
  "4matic",
  "hybrid",
  "hev",
  "phev",
  "plugin",
  "plug-in",
  "prime",
  "ev",
  "electric",
  "turbo",
  "tfsi",
  "tdi",
]);

function num(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/,/g, "");
  if (!text || /^n\/a$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMake(make) {
  return String(make)
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\bmercedes benz\b/, "mercedes")
    .replace(/\bmercedes-benz\b/, "mercedes")
    .replace(/\bland rover\b/, "land rover")
    .trim();
}

function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[/_(),.+-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const TRIM_TOKENS = new Set([
  "base",
  "le",
  "se",
  "sel",
  "xle",
  "xse",
  "xlt",
  "limited",
  "sport",
  "touring",
  "ex",
  "lx",
  "si",
  "type",
  "spec",
  "aspec",
  "tech",
  "elite",
  "premium",
  "platinum",
  "ultimate",
  "preferred",
  "signature",
  "denali",
  "slt",
  "sr5",
  "trd",
  "plus",
]);

function nameplate(model) {
  const kept = [];
  for (const token of tokens(model)) {
    if (BODY_TOKENS.has(token) || TRIM_TOKENS.has(token)) continue;
    if (/^\d+(\.\d+)?$/.test(token)) continue;
    kept.push(token);
  }
  if (kept[0] === "model" && kept[1]) return `model ${kept[1]}`;
  if (kept[0] && kept[0].length <= 2 && kept[1] && kept[1].length <= 2) {
    return `${kept[0]} ${kept[1]}`;
  }
  return kept[0] ?? tokens(model)[0] ?? "";
}

function driveFlag(model) {
  const t = tokens(model);
  if (t.some((x) => ["awd", "4wd", "quattro", "xdrive", "4matic", "sh-awd", "sh"].includes(x))) {
    return "awd";
  }
  if (t.includes("fwd")) return "fwd";
  if (t.includes("rwd")) return "rwd";
  return "";
}

function hybridFlag(model) {
  const t = tokens(model).join(" ");
  if (/plug\s*in|phev|prime|energi/.test(t)) return "phev";
  if (/\bhybrid\b|\bhev\b/.test(t)) return "hybrid";
  if (/\bev\b|electric|e-tron|ioniq|bolt|leaf|model [3sxy]/.test(t)) return "bev";
  return "";
}

function parseMyr(raw) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  if (n >= 1970) return n;
  if (n <= 30) return 2000 + n;
  if (n < 70) return 2000 + n;
  return 1900 + n;
}

async function loadCsv(filePath) {
  const text = await readFile(filePath, "utf8");
  return parse(text.replace(/^\uFEFF/, ""), {
    columns: (header) => header.map((h) => String(h).trim()),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function rowKey(make, model, year) {
  return `${make}|${model}|${year}`;
}

const cvsDir = path.join(root, "data", "cvs");
const files = (await readdir(cvsDir))
  .filter((name) => name.endsWith("_en.csv"))
  .sort();

const cvsByKey = new Map();
for (const file of files) {
  const fileYear = Number(file.slice(0, 4));
  const rows = await loadCsv(path.join(cvsDir, file));
  for (const row of rows) {
    const make = normalizeMake(row.MAKE ?? row.Make);
    const model = String(row.MODEL ?? row.Model ?? "").trim();
    const kg = num(row.CW ?? row["CW"]);
    const year = parseMyr(row.MYR) ?? fileYear;
    if (!make || !model || kg == null) continue;
    cvsByKey.set(rowKey(make, model, year), {
      make,
      model,
      year,
      kg,
      core: nameplate(model),
      drive: driveFlag(model),
      hybrid: hybridFlag(model),
      file: fileYear,
    });
  }
}

const cvs = [...cvsByKey.values()];
const cvsIndex = new Map();
for (const row of cvs) {
  const key = `${row.make}|${row.core}`;
  if (!cvsIndex.has(key)) cvsIndex.set(key, []);
  cvsIndex.get(key).push(row);
}
for (const list of cvsIndex.values()) {
  list.sort((a, b) => a.year - b.year || a.kg - b.kg);
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
    }
  }
  return rows[a.length][b.length];
}

function rowsFor(make, core) {
  const exact = cvsIndex.get(`${make}|${core}`);
  if (exact?.length) return exact;
  if (!core || core.length < 6 || /\d/.test(core)) return [];
  const fuzzy = [];
  for (const [key, list] of cvsIndex) {
    if (!key.startsWith(`${make}|`)) continue;
    const other = key.slice(make.length + 1);
    if (editDistance(core, other) === 1) fuzzy.push(...list);
  }
  return fuzzy;
}

const vehiclesPath = path.join(root, "public", "vehicles.json");
let vehicles;
try {
  vehicles = JSON.parse(await readFile(vehiclesPath, "utf8"));
} catch {
  throw new Error("Run npm run data first to build public/vehicles.json");
}

function pickMatch(vehicle, rows) {
  if (!rows?.length) return null;
  const drive = driveFlag(vehicle.model);
  const hybrid = vehicle.powertrain === "phev" ? "phev" : vehicle.powertrain === "bev" ? "bev" : vehicle.powertrain === "hybrid" ? "hybrid" : hybridFlag(vehicle.model);

  const scored = rows.map((row) => {
    let score = 0;
    if (drive && row.drive === drive) score += 3;
    if (hybrid && row.hybrid === hybrid) score += 4;
    if (!hybrid && !row.hybrid) score += 1;
    const yearGap = Math.abs(row.year - vehicle.year);
    score -= Math.min(yearGap, 20) * 0.1;
    return { row, score, yearGap };
  });
  scored.sort((a, b) => b.score - a.score || a.yearGap - b.yearGap);
  return scored[0]?.row ?? null;
}

const results = {
  exactYearCore: 0,
  generationCore: 0,
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
  const rows = rowsFor(make, core);
  const sameYear = rows.filter((row) => row.year === vehicle.year);
  const generation = rows.filter(
    (row) => row.year <= vehicle.year && vehicle.year - row.year <= 8,
  );

  let match = null;
  let strategy = "none";
  if (pickMatch(vehicle, sameYear)) {
    match = pickMatch(vehicle, sameYear);
    strategy = "exactYearCore";
    results.exactYearCore += 1;
  } else if (pickMatch(vehicle, generation)) {
    match = pickMatch(vehicle, generation);
    strategy = "generationCore";
    results.generationCore += 1;
  } else if (pickMatch(vehicle, rows)) {
    match = pickMatch(vehicle, rows);
    strategy = "anyCore";
    results.anyCore += 1;
  } else {
    results.none += 1;
    if (misses.length < 25) {
      misses.push(`${vehicle.year} ${vehicle.make} ${vehicle.model} (core="${core}")`);
    }
  }

  const pt = vehicle.powertrain;
  byPowertrain[pt] ??= { total: 0, matched: 0 };
  byPowertrain[pt].total += 1;
  if (match) byPowertrain[pt].matched += 1;

  const bucket =
    vehicle.year <= 2010 ? "1995-2010" : vehicle.year <= 2023 ? "2011-2023" : "2024-2026";
  byYearBucket[bucket][0] += 1;
  if (match) byYearBucket[bucket][1] += 1;

  if (match && hits.length < 8) {
    hits.push(
      `${vehicle.year} ${vehicle.make} ${vehicle.model} → ${match.year} ${match.model} (${match.kg} kg) [${strategy}]`,
    );
  }
}

const battery = { withRangeAndUse: 0, withNameHint: 0, bevPhev: 0 };
for (const vehicle of vehicles) {
  if (vehicle.powertrain !== "bev" && vehicle.powertrain !== "phev") continue;
  battery.bevPhev += 1;
  if (vehicle.batteryKwhHint) battery.withNameHint += 1;
  if (vehicle.electricRangeKm && vehicle.combinedKwhPer100) battery.withRangeAndUse += 1;
}

function pct(part, whole) {
  return whole ? `${((100 * part) / whole).toFixed(1)}%` : "n/a";
}

const total = vehicles.length;
const matched = total - results.none;

console.log("CVS unique make/model/year with weight:", cvs.length);
console.log("EnerGuide vehicles:", total);
console.log("");
console.log("Join strategies (first match wins):");
console.log("  exact year + core name:", results.exactYearCore, pct(results.exactYearCore, total));
console.log("  generation (MYR <= year):", results.generationCore, pct(results.generationCore, total));
console.log("  any year, same core:", results.anyCore, pct(results.anyCore, total));
console.log("  unmatched:", results.none, pct(results.none, total));
console.log("  any weight assigned:", matched, pct(matched, total));
console.log("");
console.log("By powertrain:");
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
console.log("");
console.log("Sample hits:");
for (const line of hits) console.log(" ", line);
console.log("Sample misses:");
for (const line of misses) console.log(" ", line);
