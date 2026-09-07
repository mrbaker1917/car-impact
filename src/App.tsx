import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
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

  const results = picks.map((vehicle) => ({
    vehicle,
    driving: drivingEmissions(vehicle, province, kmPerYear),
  }));
  const maxG = Math.max(...results.map((row) => row.driving.totalGPerKm), 1);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Car impact</h1>
        <p className="lede">
          Compare driving emissions for cars sold in Canada. Manufacturing and
          disposal come next; for now the number that changes with your
          province is on the road.
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
          {results.map(({ vehicle, driving }) => (
            <article className="card" key={vehicle.id}>
              <span className="badge">
                {fuelLabel(vehicle)}
              </span>
              <h2>{vehicleLabel(vehicle)}</h2>
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
                  style={{ width: `${(driving.tailpipeGPerKm / maxG) * 100}%` }}
                />
                <i
                  className="fuel"
                  style={{
                    width: `${(driving.fuelProductionGPerKm / maxG) * 100}%`,
                  }}
                />
                <i
                  className="electric"
                  style={{
                    width: `${(driving.electricityGPerKm / maxG) * 100}%`,
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
                  About {Math.round(driving.utilityFactor * 100)}% of kilometres
                  assumed on electricity, from NRCan’s plug-in rating.
                </div>
              )}
              <div className="later">
                <strong>Manufacture, including mining:</strong> not estimated yet
                <br />
                <strong>End of life:</strong> not estimated yet
              </div>
            </article>
          ))}
        </section>
      )}

      <p className="note">
        Vehicle list and consumption: Natural Resources Canada EnerGuide
        ratings (1995–2026). Electricity: ECCC 2026 provincial consumption
        intensities. Fuel production is a Canada-average well-to-tank estimate
        from GHGenius-style gasoline and diesel factors; it is not
        province-specific. Tailpipe grams per kilometre are NRCan’s published
        values. Heavy pickups above the EnerGuide test weight limit are absent.
      </p>
    </main>
  );
}
