export type ProvinceCode =
  | "BC"
  | "AB"
  | "SK"
  | "MB"
  | "ON"
  | "QC"
  | "NB"
  | "NS"
  | "PE"
  | "NL"
  | "YT"
  | "NT"
  | "NU";

export type Province = {
  code: ProvinceCode;
  name: string;
  /** Grams CO2e per kWh consumed, 2026. */
  gPerKwh: number;
};

/**
 * Electricity consumption intensities for calendar year 2026.
 * Environment and Climate Change Canada, Offset System emission factors.
 * https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html
 */
export const PROVINCES: Province[] = [
  { code: "BC", name: "British Columbia", gPerKwh: 18 },
  { code: "AB", name: "Alberta", gPerKwh: 438 },
  { code: "SK", name: "Saskatchewan", gPerKwh: 631 },
  { code: "MB", name: "Manitoba", gPerKwh: 2.5 },
  { code: "ON", name: "Ontario", gPerKwh: 59 },
  { code: "QC", name: "Quebec", gPerKwh: 1.9 },
  { code: "NB", name: "New Brunswick", gPerKwh: 234 },
  { code: "NS", name: "Nova Scotia", gPerKwh: 581 },
  { code: "PE", name: "Prince Edward Island", gPerKwh: 234 },
  { code: "NL", name: "Newfoundland and Labrador", gPerKwh: 17 },
  { code: "YT", name: "Yukon", gPerKwh: 74 },
  { code: "NT", name: "Northwest Territories", gPerKwh: 420 },
  { code: "NU", name: "Nunavut", gPerKwh: 800 },
];

export const DEFAULT_PROVINCE: ProvinceCode = "ON";
export const DEFAULT_KM_PER_YEAR = 20_000;

export function provinceByCode(code: ProvinceCode): Province {
  const found = PROVINCES.find((p) => p.code === code);
  if (!found) throw new Error(`Unknown province ${code}`);
  return found;
}
