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
import { compareInsight } from "./lib/insight";
import {
  DEFAULT_KM_PER_YEAR,
  PROVINCES,
  provinceByCode,
  type ProvinceCode,
} from "./lib/provinces";
import { loadCatalogue } from "./lib/catalogue";
import { searchVehicles } from "./lib/search";
import { parseShare, writeShare } from "./lib/share";
import { resolveStarterPair, STARTER_PAIR } from "./lib/starters";
import { CompareStrip } from "./CompareStrip";
import { NavLink, SiteLink } from "./NavLink";
import { TitleBanner } from "./TitleBanner";
import { fuelLabel, type Vehicle } from "./types";

const MAX_PICKS = 3;

function vehicleLabel(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

function barWidth(value: number, max: number): string {
  return `${max > 0 ? (value / max) * 100 : 0}%`;
}

function Stage({
  title,
  featured,
  children,
}: {
  title: string;
  featured?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={featured ? "stage featured" : "stage"}>
      <h3 className="stage-title">{title}</h3>
      {children}
    </section>
  );
}

export default function App() {
  const initialShare = parseShare(window.location.search);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<Vehicle[]>([]);
  const [province, setProvince] = useState<ProvinceCode>(initialShare.province);
  const [kmPerYear, setKmPerYear] = useState(initialShare.kmPerYear);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [catalogueReady, setCatalogueReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCatalogue()
      .then((list) => {
        setVehicles(list);
        const byId = new Map(list.map((vehicle) => [vehicle.id, vehicle]));
        const restored = initialShare.ids
          .map((id) => byId.get(id))
          .filter((vehicle): vehicle is Vehicle => vehicle != null);
        if (restored.length) setPicks(restored);
        setCatalogueReady(true);
      })
      .catch((err: Error) => {
        setError(err.message);
        setCatalogueReady(true);
      });
  }, []);

  useEffect(() => {
    if (!catalogueReady) return;
    writeShare({
      ids: picks.map((vehicle) => vehicle.id),
      province,
      kmPerYear,
    });
  }, [catalogueReady, picks, province, kmPerYear]);

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

  function copyShare() {
    const href = writeShare({
      ids: picks.map((vehicle) => vehicle.id),
      province,
      kmPerYear,
    });
    void navigator.clipboard.writeText(href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
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
  const insight = compareInsight(
    results.map((row) => ({
      label: vehicleLabel(row.vehicle),
      lifetimeKg: row.lifetimeKg,
    })),
    provinceByCode(province).name,
  );
  const starterPair = catalogueReady ? resolveStarterPair(vehicles) : null;

  return (
    <>
      <TitleBanner />
      <main className="page">
      <header className="masthead">
        <p className="lede">
          Compare mining, factory, driving, and end-of-life emissions for cars
          sold in Canada. Switch province to see how the grid changes the rest
          of the story.
        </p>
        <p className="masthead-links">
          <NavLink to="/details" className="text-link">
            Details
          </NavLink>
          <SiteLink className="text-link" />
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

      {catalogueReady && picks.length === 0 && (
        <div className="empty-state">
          <p>Add up to three cars to compare. Search above, or start here:</p>
          {starterPair && (
            <button
              type="button"
              className="starter"
              onClick={() => setPicks(starterPair)}
            >
              <span className="starter-title">{STARTER_PAIR.label}</span>
              <span className="starter-meta">{STARTER_PAIR.detail}</span>
            </button>
          )}
        </div>
      )}

      {(!catalogueReady || picks.length > 0) && (
        <div className="picks">
          {!catalogueReady && (
            <span className="empty-picks">Loading the vehicle catalogue…</span>
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
          {picks.length > 0 && (
            <button type="button" className="share-link" onClick={copyShare}>
              {copied ? "Copied link" : "Copy link"}
            </button>
          )}
        </div>
      )}

      {error && <p className="note">{error}</p>}

      {results.length > 0 && (
        <CompareStrip
          rows={results}
          maxLifeKg={maxLifeKg}
          insight={insight}
        />
      )}

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

                  <Stage featured title="Total emissions over the car's life">
                    <div className="stat">
                      {formatKg(lifetimeKg)}
                      <span>
                        CO₂e over {LIFETIME_KM.toLocaleString("en-CA")} km
                      </span>
                    </div>
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
                    <div className="legend">
                      <span>
                        <b className="build" />
                        Vehicle after recycling {formatKg(vehicleCycleKg)}
                      </span>
                      <span>
                        <b className="drive" />
                        Driving {formatKg(drivingLifetimeKg)}
                      </span>
                    </div>
                    <div className="result-meta">
                      {Math.round(buildShare * 100)}% from building and
                      disposing of the car, after recycling
                    </div>
                  </Stage>

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
                </article>
              );
            },
          )}
        </section>
      )}

      <p className="note">
        <NavLink to="/details" className="text-link">
          Details
        </NavLink>
      </p>
    </main>
    </>
  );
}
