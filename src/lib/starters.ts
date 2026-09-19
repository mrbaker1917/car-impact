import type { Vehicle } from "../types";

export type StarterSpec = {
  year: number;
  make: string;
  model: string;
};

export const STARTER_PAIR = {
  label: "2024 Model Y vs 2024 RAV4 Hybrid",
  detail: "Tesla Long Range AWD · Toyota Hybrid AWD",
  cars: [
    { year: 2024, make: "Tesla", model: "Model Y Long Range AWD" },
    { year: 2024, make: "Toyota", model: "RAV4 Hybrid AWD" },
  ] as const satisfies readonly StarterSpec[],
};

export function findNamedVehicle(
  vehicles: Vehicle[],
  spec: StarterSpec,
): Vehicle | undefined {
  return vehicles.find(
    (vehicle) =>
      vehicle.year === spec.year &&
      vehicle.make.toLowerCase() === spec.make.toLowerCase() &&
      vehicle.model === spec.model,
  );
}

export function resolveStarterPair(vehicles: Vehicle[]): Vehicle[] | null {
  const found: Vehicle[] = [];
  for (const spec of STARTER_PAIR.cars) {
    const vehicle = findNamedVehicle(vehicles, spec);
    if (!vehicle) return null;
    found.push(vehicle);
  }
  return found;
}
