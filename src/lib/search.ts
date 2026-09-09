import type { Vehicle } from "../types";

function matchesTerm(haystack: string, term: string): boolean {
  if (term.length <= 2) {
    return new RegExp(`(?:^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(
      haystack,
    );
  }
  return haystack.includes(term);
}

export function searchVehicles(vehicles: Vehicle[], query: string): Vehicle[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { vehicle: Vehicle; score: number }[] = [];
  for (const vehicle of vehicles) {
    const haystack =
      `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.vehicleClass}`.toLowerCase();
    if (!terms.every((term) => matchesTerm(haystack, term))) continue;

    const makeModel = `${vehicle.make} ${vehicle.model}`.toLowerCase();
    let score = vehicle.year;
    if (makeModel.startsWith(query.trim().toLowerCase())) score += 1000;
    if (vehicle.make.toLowerCase().startsWith(terms[0] ?? "")) score += 200;
    scored.push({ vehicle, score });
  }

  scored.sort((a, b) => b.score - a.score || a.vehicle.model.localeCompare(b.vehicle.model));
  return scored.slice(0, 25).map((row) => row.vehicle);
}
