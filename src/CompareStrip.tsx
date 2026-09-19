import { LIFETIME_KM } from "./lib/embodied";
import { formatKg } from "./lib/emissions";
import { fuelLabel, type Vehicle } from "./types";

function barWidth(value: number, max: number): string {
  return `${max > 0 ? (value / max) * 100 : 0}%`;
}

export type CompareStripRow = {
  vehicle: Vehicle;
  lifetimeKg: number;
  vehicleCycleKg: number;
  drivingLifetimeKg: number;
};

function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

export function CompareStrip({
  rows,
  maxLifeKg,
  insight,
}: {
  rows: CompareStripRow[];
  maxLifeKg: number;
  insight: string | null;
}) {
  if (rows.length === 0) return null;

  return (
    <section
      className="compare-strip"
      aria-label="Total emissions over the car’s life"
    >
      <h2>Total emissions over {LIFETIME_KM.toLocaleString("en-CA")} km</h2>
      {insight && (
        <p className="insight" aria-live="polite">
          {insight}
        </p>
      )}
      <ul className="compare-strip-list">
        {rows.map((row) => (
          <li className="compare-strip-row" key={row.vehicle.id}>
            <div className="compare-strip-name">
              <span className="badge">{fuelLabel(row.vehicle)}</span>
              {vehicleLabel(row.vehicle)}
            </div>
            <div className="bar compare-strip-bar" aria-hidden="true">
              <i
                className="build"
                style={{
                  width: barWidth(Math.max(row.vehicleCycleKg, 0), maxLifeKg),
                }}
              />
              <i
                className="drive"
                style={{
                  width: barWidth(row.drivingLifetimeKg, maxLifeKg),
                }}
              />
            </div>
            <div className="compare-strip-stat">
              {formatKg(row.lifetimeKg)}
              <span>CO₂e</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="legend compare-strip-legend">
        <span>
          <b className="build" />
          Vehicle after recycling
        </span>
        <span>
          <b className="drive" />
          Driving
        </span>
      </div>
    </section>
  );
}
