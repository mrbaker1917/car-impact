import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

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

/** Wall-to-battery charging efficiency. NRCan kWh/100 km is AC energy from the wall. */
export const CHARGE_EFFICIENCY = 0.88;
/** Nominal pack is larger than usable energy (thermal/longevity buffer). */
export const NOMINAL_PACK_FACTOR = 1.1;
const GENERATION_YEARS = 8;

export function num(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/,/g, "");
  if (!text || /^n\/a$/i.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeMake(make) {
  return String(make)
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\bmercedes benz\b/, "mercedes")
    .replace(/\bmercedes-benz\b/, "mercedes")
    .replace(/\bland rover\b/, "land rover")
    .trim();
}

export function tokens(text) {
  return String(text)
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[/_(),.+-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function nameplate(model) {
  const kept = [];
  for (const token of tokens(model)) {
    if (BODY_TOKENS.has(token) || TRIM_TOKENS.has(token)) continue;
    if (/^\d+(\.\d+)?$/.test(token)) {
      if (kept[kept.length - 1] === "model") kept.push(token);
      continue;
    }
    kept.push(token);
  }
  if (kept[0] === "model" && kept[1]) return `model ${kept[1]}`;
  if (kept[0] && kept[0].length <= 2 && kept[1] && kept[1].length <= 2) {
    return `${kept[0]} ${kept[1]}`;
  }
  return kept[0] ?? tokens(model)[0] ?? "";
}

export function driveFlag(model) {
  const t = tokens(model);
  if (t.some((x) => ["awd", "4wd", "quattro", "xdrive", "4matic", "sh-awd", "sh"].includes(x))) {
    return "awd";
  }
  if (t.includes("fwd")) return "fwd";
  if (t.includes("rwd")) return "rwd";
  return "";
}

export function hybridFlag(model) {
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

export function classFamily(vehicleClass) {
  const text = String(vehicleClass).toLowerCase();
  if (text.includes("pickup")) return "pickup";
  if (text.includes("sport utility") || text.includes("suv")) return "suv";
  if (text.includes("minivan") || text.includes("van")) return "van";
  if (text.includes("station")) return "wagon";
  if (text.includes("two-seater") || text.includes("minicompact")) return "sports";
  if (text.includes("full-size")) return "fullsize";
  if (text.includes("mid-size")) return "midsize";
  if (text.includes("compact") || text.includes("subcompact")) return "compact";
  return "other";
}

export function inferBatteryChemistry(vehicle) {
  if (vehicle.powertrain !== "bev" && vehicle.powertrain !== "phev") return null;
  const make = String(vehicle.make).toLowerCase();
  const model = String(vehicle.model).toLowerCase();
  if (/\blfp\b|blade/.test(model)) return "lfp";
  if (make === "byd" || make.includes("wuling")) return "lfp";
  if (make === "tesla") {
    if (/\brwd\b|standard range|\bsr\b|\bsr\+/.test(model)) return "lfp";
  }
  return "nmc";
}

export function estimateBattery(vehicle) {
  if (vehicle.powertrain !== "bev" && vehicle.powertrain !== "phev") {
    return { kwh: null, source: null, usableKwh: null };
  }
  const hint = vehicle.batteryKwhHint;
  let usable = null;
  if (vehicle.electricRangeKm && vehicle.combinedKwhPer100) {
    usable =
      (vehicle.electricRangeKm * vehicle.combinedKwhPer100) / 100 * CHARGE_EFFICIENCY;
  }
  const fromRange = usable != null ? usable * NOMINAL_PACK_FACTOR : null;
  if (hint && fromRange) {
    if (hint >= usable) {
      return { kwh: round1(hint), source: "name", usableKwh: round1(usable) };
    }
    return { kwh: round1(fromRange), source: "range", usableKwh: round1(usable) };
  }
  if (hint) return { kwh: round1(hint), source: "name", usableKwh: null };
  if (fromRange) {
    return { kwh: round1(fromRange), source: "range", usableKwh: round1(usable) };
  }
  return { kwh: null, source: null, usableKwh: null };
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function rowKey(make, model, year) {
  return `${make}|${model}|${year}`;
}

export async function loadCvsIndex(root) {
  const cvsDir = path.join(root, "data", "cvs");
  const files = (await readdir(cvsDir))
    .filter((name) => name.endsWith("_en.csv"))
    .sort();

  const cvsByKey = new Map();
  for (const file of files) {
    const fileYear = Number(file.slice(0, 4));
    const text = await readFile(path.join(cvsDir, file), "utf8");
    const rows = parse(text.replace(/^\uFEFF/, ""), {
      columns: (header) => header.map((h) => String(h).trim()),
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });
    for (const row of rows) {
      const make = normalizeMake(row.MAKE ?? row.Make);
      const model = String(row.MODEL ?? row.Model ?? "").trim();
      const kg = num(row.CW ?? row.CW);
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
  return { cvs, cvsIndex };
}

export function rowsFor(make, core, cvsIndex) {
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

export function pickMatch(vehicle, rows) {
  if (!rows?.length) return null;
  const drive = driveFlag(vehicle.model);
  const hybrid =
    vehicle.powertrain === "phev"
      ? "phev"
      : vehicle.powertrain === "bev"
        ? "bev"
        : vehicle.powertrain === "hybrid"
          ? "hybrid"
          : hybridFlag(vehicle.model);

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

export function matchCvsWeight(vehicle, cvsIndex) {
  const make = normalizeMake(vehicle.make);
  const core = nameplate(vehicle.model);
  const rows = rowsFor(make, core, cvsIndex);
  const sameYear = rows.filter((row) => row.year === vehicle.year);
  const generation = rows.filter(
    (row) => row.year <= vehicle.year && vehicle.year - row.year <= GENERATION_YEARS,
  );

  const exact = pickMatch(vehicle, sameYear);
  if (exact) return { ...exact, strategy: "exactYearCore" };
  const gen = pickMatch(vehicle, generation);
  if (gen) return { ...gen, strategy: "generationCore" };
  const nearby = pickMatch(
    vehicle,
    rows.filter((row) => Math.abs(row.year - vehicle.year) <= GENERATION_YEARS),
  );
  if (nearby) return { ...nearby, strategy: "nearbyCore" };
  return null;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function bucketMedian(map, key, minN) {
  const list = map.get(key);
  if (!list || list.length < minN) return null;
  return median(list);
}

export async function enrichVehicles(vehicles, root) {
  const { cvs, cvsIndex } = await loadCvsIndex(root);
  const matches = vehicles.map((vehicle) => matchCvsWeight(vehicle, cvsIndex));

  const byClass = new Map();
  const byFamily = new Map();
  const byPowertrain = new Map();
  const allKg = [];

  for (let i = 0; i < vehicles.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const vehicle = vehicles[i];
    const family = classFamily(vehicle.vehicleClass);
    push(byClass, vehicle.vehicleClass || "unknown", match.kg);
    push(byFamily, family, match.kg);
    push(byPowertrain, vehicle.powertrain, match.kg);
    allKg.push(match.kg);
  }

  const globalMedian = median(allKg) ?? 1600;

  const enriched = vehicles.map((vehicle, i) => {
    const match = matches[i];
    const family = classFamily(vehicle.vehicleClass);
    const classKg =
      bucketMedian(byClass, vehicle.vehicleClass || "unknown", 8) ??
      bucketMedian(byFamily, family, 8) ??
      bucketMedian(byPowertrain, vehicle.powertrain, 8) ??
      globalMedian;
    const battery = estimateBattery(vehicle);
    const chemistry = inferBatteryChemistry(vehicle);

    if (match) {
      return {
        ...vehicle,
        curbWeightKg: Math.round(match.kg),
        weightSource: "cvs",
        weightYear: match.year,
        batteryKwh: battery.kwh,
        batteryKwhSource: battery.source,
        batteryChemistry: chemistry,
      };
    }
    return {
      ...vehicle,
      curbWeightKg: Math.round(classKg),
      weightSource: "class",
      weightYear: null,
      batteryKwh: battery.kwh,
      batteryKwhSource: battery.source,
      batteryChemistry: chemistry,
    };
  });

  return { vehicles: enriched, cvsCount: cvs.length };
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
