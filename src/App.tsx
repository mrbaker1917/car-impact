import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  batteryCaption,
  disposalCaption,
  disposalEmissions,
  embodiedEmissions,
  LIFETIME_KM,
  recyclingCaption,
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

function Stage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stage">
      <h3 className="stage-title">{title}</h3>
      {children}
    </section>
  );
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
    const disposal = disposalEmissions(vehicle);
    const drivingLifetimeKg = (driving.totalGPerKm * LIFETIME_KM) / 1000;
    const vehicleCycleKg = manufacture.totalKg + disposal.netKg;
    return {
      vehicle,
      driving,
      manufacture,
      disposal,
      drivingLifetimeKg,
      vehicleCycleKg,
      lifetimeKg: vehicleCycleKg + drivingLifetimeKg,
    };
  });
  const maxDriveG = Math.max(...results.map((row) => row.driving.totalGPerKm), 1);
  const maxMiningKg = Math.max(...results.map((row) => row.manufacture.miningKg), 1);
  const maxFactoryKg = Math.max(...results.map((row) => row.manufacture.factoryKg), 1);
  const maxProcessKg = Math.max(...results.map((row) => row.disposal.processKg), 1);
  const maxCreditKg = Math.max(
    ...results.map((row) => Math.abs(row.disposal.creditKg)),
    1,
  );
  const maxLifeKg = Math.max(...results.map((row) => row.lifetimeKg), 1);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Car impact</h1>
        <p className="lede">
          Compare mining, factory, driving, and end-of-life emissions for cars
          sold in Canada. Switch province to see how the grid changes the rest
          of the story.
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
            ({
              vehicle,
              driving,
              manufacture,
              disposal,
              drivingLifetimeKg,
              vehicleCycleKg,
              lifetimeKg,
            }) => {
              const pack = batteryCaption(vehicle);
              const buildShare = lifetimeKg > 0 ? vehicleCycleKg / lifetimeKg : 0;
              return (
                <article className="card" key={vehicle.id}>
                  <span className="badge">{fuelLabel(vehicle)}</span>
                  <h2>{vehicleLabel(vehicle)}</h2>
                  <div className="result-meta">
                    {weightCaption(vehicle)}
                    {pack ? ` · ${pack}` : ""}
                  </div>

                  <Stage title="Mining">
                    <div className="stat">
                      {formatKg(manufacture.miningKg)}
                      <span>
                        CO₂e from materials, {formatGPerKm(manufacture.miningGPerKm)}{" "}
                        over {LIFETIME_KM.toLocaleString("en-CA")} km
                      </span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      {manufacture.miningSlices.map((slice) => (
                        <i
                          key={slice.id}
                          className={slice.id}
                          style={{ width: barWidth(slice.kg, maxMiningKg) }}
                        />
                      ))}
                    </div>
                    <div className="legend">
                      {manufacture.miningSlices.map((slice) => (
                        <span key={slice.id}>
                          <b className={slice.id} />
                          {slice.label} {formatKg(slice.kg)}
                        </span>
                      ))}
                    </div>
                  </Stage>

                  <Stage title="Building">
                    <div className="stat">
                      {formatKg(manufacture.factoryKg)}
                      <span>
                        CO₂e from the factory,{" "}
                        {formatGPerKm(manufacture.factoryGPerKm)} over{" "}
                        {LIFETIME_KM.toLocaleString("en-CA")} km
                      </span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      {manufacture.factorySlices.map((slice) => (
                        <i
                          key={slice.id}
                          className={slice.id}
                          style={{ width: barWidth(slice.kg, maxFactoryKg) }}
                        />
                      ))}
                    </div>
                    <div className="legend">
                      {manufacture.factorySlices.map((slice) => (
                        <span key={slice.id}>
                          <b className={slice.id} />
                          {slice.label} {formatKg(slice.kg)}
                        </span>
                      ))}
                    </div>
                  </Stage>

                  <Stage title="Operation">
                    <div className="stat">
                      {formatKg(driving.kgPerYear)}
                      <span>
                        CO₂e this year, {formatGPerKm(driving.totalGPerKm)} while
                        driving, including fuel and electricity production
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
                  </Stage>

                  <Stage title="Disposal">
                    <div className="stat">
                      {formatKg(disposal.processKg)}
                      <span>
                        CO₂e to dispose, {formatGPerKm(disposal.processGPerKm)}{" "}
                        over {LIFETIME_KM.toLocaleString("en-CA")} km
                      </span>
                    </div>
                    <div className="result-meta">{disposalCaption()}</div>
                    <div className="bar" aria-hidden="true">
                      {disposal.processSlices.map((slice) => (
                        <i
                          key={slice.id}
                          className={slice.id}
                          style={{
                            width: barWidth(slice.kg, maxProcessKg),
                          }}
                        />
                      ))}
                    </div>
                    <div className="legend">
                      {disposal.processSlices.map((slice) => (
                        <span key={slice.id}>
                          <b className={slice.id} />
                          {slice.label} {formatKg(slice.kg)}
                        </span>
                      ))}
                    </div>
                    <p className="stage-kicker">Recycling credit</p>
                    <div className="stat">
                      {formatKg(disposal.creditKg)}
                      <span>
                        CO₂e offset against mining,{" "}
                        {formatGPerKm(disposal.creditGPerKm)} over{" "}
                        {LIFETIME_KM.toLocaleString("en-CA")} km
                      </span>
                    </div>
                    <div className="result-meta">{recyclingCaption(vehicle)}</div>
                    <div className="bar" aria-hidden="true">
                      {disposal.creditSlices.map((slice) => (
                        <i
                          key={slice.id}
                          className={slice.id}
                          style={{
                            width: barWidth(Math.abs(slice.kg), maxCreditKg),
                          }}
                        />
                      ))}
                    </div>
                    <div className="legend">
                      {disposal.creditSlices.map((slice) => (
                        <span key={slice.id}>
                          <b className={slice.id} />
                          {slice.label} {formatKg(slice.kg)}
                        </span>
                      ))}
                    </div>
                  </Stage>

                  <Stage title="Whole life">
                    <div className="lifetime">
                      <strong>
                        {formatKg(lifetimeKg)} CO₂e over{" "}
                        {LIFETIME_KM.toLocaleString("en-CA")} km
                      </strong>
                      <span>
                        {Math.round(buildShare * 100)}% from the vehicle after
                        recycling, {formatKg(drivingLifetimeKg)} from driving
                      </span>
                      <div className="bar" aria-hidden="true">
                        <i
                          className="build"
                          style={{
                            width: barWidth(Math.max(vehicleCycleKg, 0), maxLifeKg),
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
                  </Stage>
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
        assembly add-on), not a plant-specific LCA. Disposal is the cost of
        shredding and residue. Recycling is a separate credit against the
        build (steel, aluminum, copper, and a smaller pack credit for LFP
        than NMC). Canada has no national ELV law; second-life packs and
        export are not modelled. Electricity: ECCC 2026
        provincial consumption intensities. Fuel production is a Canada-average
        well-to-tank estimate. Tailpipe grams per kilometre are NRCan’s
        published values. Heavy pickups above the EnerGuide test weight limit
        are absent.
      </p>
    </main>
  );
}
