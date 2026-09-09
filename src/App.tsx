import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  batteryCaption,
  embodiedEmissions,
  LIFETIME_KM,
  weightCaption,
} from "./lib/embodied";
import {
  drivingEmissions,
  formatGPerKm,
  formatKg,
} from "./lib/emissions";
import {
  DEFAULT_KM_PER_YEAR,
  DEFAULT_PROVINCE,
  PROVINCES,
  type ProvinceCode,
} from "./lib/provinces";
import { searchVehicles } from "./lib/search";
import { fuelLabel, type Vehicle } from "./types";

const MAX_PICKS = 3;

function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function barWidth(value: number, max: number): string {
  return `${max > 0 ? (value / max) * 100 : 0}%`;
}

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<Vehicle[]>([]);
  const [province, setProvince] = useState<ProvinceCode>(DEFAULT_PROVINCE);
  const [kmPerYear, setKmPerYear] = useState(DEFAULT_KM_PER_YEAR);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/vehicles.json")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load vehicle catalogue");
        return res.json();
      })
      .then(setVehicles)
      .catch((err: Error) => setError(err.message));
  }, []);

  const matches = useMemo(
    () => searchVehicles(vehicles, query),
    [vehicles, query],
  );

  function addVehicle(vehicle: Vehicle) {
    setPicks((current) => {
      if (current.some((item) => item.id === vehicle.id)) return current;
      if (current.length >= MAX_PICKS) return current;
      return [...current, vehicle];
    });
    setQuery("");
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const chosen = matches[activeIndex];
      if (chosen) addVehicle(chosen);
    }
  }

  const results = picks.map((vehicle) => {
    const driving = drivingEmissions(vehicle, province, kmPerYear);
    const manufacture = embodiedEmissions(vehicle);
    const drivingLifetimeKg = (driving.totalGPerKm * LIFETIME_KM) / 1000;
    return {
      vehicle,
      driving,
      manufacture,
      drivingLifetimeKg,
      lifetimeKg: manufacture.totalKg + drivingLifetimeKg,
    };
  });
  const maxDriveG = Math.max(...results.map((row) => row.driving.totalGPerKm), 1);
  const maxBuildKg = Math.max(...results.map((row) => row.manufacture.totalKg), 1);
  const maxLifeKg = Math.max(...results.map((row) => row.lifetimeKg), 1);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Car impact</h1>
        <p className="lede">
          Compare mining, factory, and driving emissions for cars sold in
          Canada. Switch province to see how the grid changes the rest of the
          story. End of life is still to come.
        </p>
      </header>

      <div className="controls">
        <label className="search">
          Search make, model, or year
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKey}
            placeholder="2024 RAV4 Hybrid"
            autoComplete="off"
            disabled={picks.length >= MAX_PICKS}
          />
          {query && matches.length > 0 && (
            <div className="results" role="listbox">
              {matches.map((vehicle, index) => (
                <button
                  key={vehicle.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addVehicle(vehicle)}
                >
                  <div className="result-title">{vehicleLabel(vehicle)}</div>
                  <div className="result-meta">
                    {fuelLabel(vehicle)} · {vehicle.vehicleClass}
                    {vehicle.engineL ? ` · ${vehicle.engineL} L` : ""}
                    {vehicle.transmission ? ` · ${vehicle.transmission}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </label>
        <label>
          Province
          <select
            value={province}
            onChange={(event) =>
              setProvince(event.target.value as ProvinceCode)
            }
          >
            {PROVINCES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          km / year
          <input
            type="number"
            min={1000}
            max={80000}
            step={1000}
            value={kmPerYear}
            onChange={(event) =>
              setKmPerYear(Number(event.target.value) || DEFAULT_KM_PER_YEAR)
            }
          />
        </label>
      </div>

      <div className="picks">
        {picks.length === 0 && (
          <span className="empty-picks">
            Add up to three cars to compare.
          </span>
        )}
        {picks.map((vehicle) => (
          <span className="chip" key={vehicle.id}>
            {vehicleLabel(vehicle)}
            <button
              type="button"
              aria-label={`Remove ${vehicleLabel(vehicle)}`}
              onClick={() =>
                setPicks((current) =>
                  current.filter((item) => item.id !== vehicle.id),
                )
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {error && <p className="note">{error}</p>}

      {results.length > 0 && (
        <section className="compare">
          {results.map(
            ({ vehicle, driving, manufacture, drivingLifetimeKg, lifetimeKg }) => {
              const pack = batteryCaption(vehicle);
              const buildShare = lifetimeKg > 0 ? manufacture.totalKg / lifetimeKg : 0;
              return (
                <article className="card" key={vehicle.id}>
                  <span className="badge">{fuelLabel(vehicle)}</span>
                  <h2>{vehicleLabel(vehicle)}</h2>
                  <div className="result-meta">
                    {weightCaption(vehicle)}
                    {pack ? ` · ${pack}` : ""}
                  </div>

                  <div className="stat">
                    {formatKg(driving.kgPerYear)}
                    <span>
                      {formatGPerKm(driving.totalGPerKm)} while driving, including
                      fuel and electricity production
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <i
                      className="tailpipe"
                      style={{
                        width: barWidth(driving.tailpipeGPerKm, maxDriveG),
                      }}
                    />
                    <i
                      className="fuel"
                      style={{
                        width: barWidth(driving.fuelProductionGPerKm, maxDriveG),
                      }}
                    />
                    <i
                      className="electric"
                      style={{
                        width: barWidth(driving.electricityGPerKm, maxDriveG),
                      }}
                    />
                  </div>
                  <div className="legend">
                    <span>
                      <b className="tailpipe" />
                      Tailpipe {formatGPerKm(driving.tailpipeGPerKm)}
                    </span>
                    <span>
                      <b className="fuel" />
                      Fuel production {formatGPerKm(driving.fuelProductionGPerKm)}
                    </span>
                    <span>
                      <b className="electric" />
                      Electricity {formatGPerKm(driving.electricityGPerKm)}
                    </span>
                  </div>
                  {driving.utilityFactor != null && (
                    <div className="result-meta">
                      About {Math.round(driving.utilityFactor * 100)}% of
                      kilometres assumed on electricity, from NRCan’s plug-in
                      rating.
                    </div>
                  )}

                  <div className="stat manufacture-stat">
                    {formatKg(manufacture.totalKg)}
                    <span>
                      to build, {formatGPerKm(manufacture.gPerKm)} over{" "}
                      {LIFETIME_KM.toLocaleString("en-CA")} km
                    </span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    {manufacture.slices.map((slice) => (
                      <i
                        key={slice.id}
                        className={slice.id}
                        style={{ width: barWidth(slice.kg, maxBuildKg) }}
                      />
                    ))}
                  </div>
                  <div className="legend">
                    {manufacture.slices.map((slice) => (
                      <span key={slice.id}>
                        <b className={slice.id} />
                        {slice.label} {formatKg(slice.kg)}
                      </span>
                    ))}
                  </div>

                  <div className="lifetime">
                    <strong>
                      {formatKg(lifetimeKg)} over{" "}
                      {LIFETIME_KM.toLocaleString("en-CA")} km
                    </strong>
                    <span>
                      {Math.round(buildShare * 100)}% from building the car,{" "}
                      {formatKg(drivingLifetimeKg)} from driving
                    </span>
                    <div className="bar" aria-hidden="true">
                      <i
                        className="build"
                        style={{
                          width: barWidth(manufacture.totalKg, maxLifeKg),
                        }}
                      />
                      <i
                        className="drive"
                        style={{
                          width: barWidth(drivingLifetimeKg, maxLifeKg),
                        }}
                      />
                    </div>
                  </div>

                  <div className="later">
                    <strong>End of life:</strong> not estimated yet
                  </div>
                </article>
              );
            },
          )}
        </section>
      )}

      <p className="note">
        Vehicle list and consumption: Natural Resources Canada EnerGuide
        ratings (1995–2026). Curb weight: Transport Canada Canadian Vehicle
        Specifications when the nameplate matches, otherwise a class average.
        Battery kilowatt-hours are estimated from electric range × wall energy
        use, or taken from the model name when it includes a pack size.
        Materials and factory grams are parametric GREET-style factors (steel,
        aluminum, copper, other materials, NMC or LFP pack, and a generic
        assembly add-on), not a plant-specific LCA. Electricity: ECCC 2026
        provincial consumption intensities. Fuel production is a Canada-average
        well-to-tank estimate. Tailpipe grams per kilometre are NRCan’s
        published values. Heavy pickups above the EnerGuide test weight limit
        are absent.
      </p>
    </main>
  );
}
