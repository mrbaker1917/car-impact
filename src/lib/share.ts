import {
  DEFAULT_KM_PER_YEAR,
  DEFAULT_PROVINCE,
  PROVINCES,
  type ProvinceCode,
} from "./provinces";

const MIN_KM = 1000;
const MAX_KM = 80_000;

export type ShareState = {
  ids: string[];
  province: ProvinceCode;
  kmPerYear: number;
};

export function parseShare(search: string): ShareState {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const ids = params
    .getAll("cars")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);

  const prov = params.get("prov");
  const province = PROVINCES.some((item) => item.code === prov)
    ? (prov as ProvinceCode)
    : DEFAULT_PROVINCE;

  const kmParam = params.get("km");
  const kmRaw = kmParam == null || kmParam === "" ? Number.NaN : Number(kmParam);
  const kmPerYear = Number.isFinite(kmRaw)
    ? Math.min(MAX_KM, Math.max(MIN_KM, Math.round(kmRaw)))
    : DEFAULT_KM_PER_YEAR;

  return { ids, province, kmPerYear };
}

export function shareQuery(state: ShareState): string {
  const params = new URLSearchParams();
  for (const id of state.ids) params.append("cars", id);
  if (state.ids.length > 0 || state.province !== DEFAULT_PROVINCE) {
    params.set("prov", state.province);
  }
  if (state.ids.length > 0 || state.kmPerYear !== DEFAULT_KM_PER_YEAR) {
    params.set("km", String(state.kmPerYear));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function writeShare(state: ShareState): string {
  const next = `${window.location.pathname}${shareQuery(state)}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) history.replaceState(null, "", next);
  return `${window.location.origin}${next}`;
}
