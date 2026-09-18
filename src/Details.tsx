import { useEffect } from "react";
import { NavLink } from "./NavLink";

export default function Details() {
  useEffect(() => {
    document.title = "Details — Environmental Impact of Cars — Canada";
    return () => {
      document.title = "Environmental Impact of Cars — Canada";
    };
  }, []);

  return (
    <main className="page doc">
      <header className="masthead">
        <p className="masthead-links">
          <NavLink to="/" className="text-link">
            Compare cars
          </NavLink>
        </p>
        <h1>Details</h1>
        <p className="lede">
          How the comparison is built: what each card stage means, where the
          numbers come from, and what they leave out.
        </p>
      </header>

      <div className="doc-body">
        <h2>What the cards show</h2>
        <p>Each car has the same stages, in this order:</p>
        <ol>
          <li>
            <strong>Total emissions over the car’s life</strong> — mining +
            building + driving + disposal, minus the recycling credit, over a
            fixed <strong>250,000 km</strong>.
          </li>
          <li>
            <strong>Mining</strong> — materials in the glider and, for plug-ins
            and EVs, the battery pack.
          </li>
          <li>
            <strong>Building</strong> — a generic factory / paint add-on.
          </li>
          <li>
            <strong>Operation</strong> — <strong>this year’s</strong> driving at
            the km/year you set (default 20,000), including tailpipe, fuel
            production, and electricity.
          </li>
          <li>
            <strong>Disposal</strong> — shredding and residue as a{" "}
            <strong>cost</strong>, then <strong>Recycling credit</strong> as a
            separate offset against the build.
          </li>
        </ol>
        <p>
          With two or three cars, a sentence above the cards states the lifetime
          comparison in the selected province (for example that an EV has about
          a quarter the emissions of a hybrid in Ontario, and about half in
          Alberta).
        </p>
        <p>
          Lifetime totals use 250,000 km, so one-time stages can sit next to
          driving. That distance does <strong>not</strong> change when you
          change km/year; km/year only changes the Operation line.
        </p>

        <h2>Data sources</h2>
        <p>
          All government files in this project are used under the{" "}
          <a href="https://open.canada.ca/en/open-government-licence-canada">
            Open Government Licence – Canada
          </a>
          .
        </p>

        <h3>Vehicle list, fuel use, and tailpipe CO₂</h3>
        <p>
          <a href="https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64">
            Natural Resources Canada EnerGuide fuel consumption ratings
          </a>
          , English CSVs in <code>data/nrcan/</code>, retrieved 2026-09-06
          (model years 1995–2026).
        </p>
        <ul>
          <li>
            Gasoline, diesel, and hybrid rows come from the yearly
            fuel-consumption files.
          </li>
          <li>
            Battery-electric and plug-in hybrid rows come from the dedicated BEV
            and PHEV files (they are not in the yearly ICE tables).
          </li>
          <li>
            1995–2014 figures are NRCan’s 5-cycle-adjusted values, so they can
            be compared with later years.
          </li>
          <li>
            Tailpipe grams per kilometre are NRCan’s published numbers, not
            recalculated here.
          </li>
        </ul>
        <p>
          Official search UI:{" "}
          <a href="https://fcr-ccc.nrcan-rncan.gc.ca/en">
            EnerGuide fuel consumption ratings
          </a>
          .
        </p>

        <h3>Curb weight</h3>
        <p>
          <a href="https://open.canada.ca/data/en/dataset/913f8940-036a-45f2-a5f2-19bde76c1252">
            Transport Canada Canadian Vehicle Specifications (CVS)
          </a>
          , English yearly files in <code>data/cvs/</code> (<code>CW</code> is
          kilograms), retrieved 2026-09-08.
        </p>
        <p>
          EnerGuide and CVS use different model strings. The join matches make +
          nameplate, then reuses a generation’s weight (CVS <code>MYR</code>)
          for later years when needed. About <strong>91%</strong> of 2011–2023
          EnerGuide rows get a CVS weight; about <strong>69%</strong> of the
          full 1995–2026 catalogue. The rest use a{" "}
          <strong>class-average</strong> weight, labelled on the card.
        </p>

        <h3>Electricity (driving, by province)</h3>
        <p>
          <a href="https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html">
            Environment and Climate Change Canada
          </a>{" "}
          Offset System <strong>2026 consumption</strong> intensities, grams
          CO₂e per kWh. Default province is Ontario.
        </p>

        <h3>Fuel production (well-to-tank)</h3>
        <p>
          Canada-average well-to-tank factors. Gasoline is derived from GHGenius
          5.0 Ontario gasoline (~20.9 g CO₂e/MJ × 34.69 MJ/L). Diesel uses a
          similar upstream intensity at diesel energy density. Tailpipe CO₂ is
          still NRCan, not these factors.
        </p>

        <h3>Mining, factory, disposal, recycling</h3>
        <p>
          Parametric <strong>GREET-style</strong> factors: steel, aluminum,
          copper, other materials, NMC or LFP pack production, a generic
          assembly add-on, shredding/residue, and scrap credits. These are
          typical North American intensities, not a Canadian plant or recycler
          audit.
        </p>
        <p>
          Battery kilowatt-hours: taken from the model name when it includes a
          pack size; otherwise estimated as electric range × wall kWh/100 km ×
          0.88 (charge efficiency) × 1.1 (nominal vs usable). Chemistry defaults
          to NMC, except LFP for Tesla RWD / standard-range names, BYD, and
          names that say LFP.
        </p>

        <h2>Limitations</h2>
        <p>
          Treat the tonnes as <strong>order-of-magnitude comparisons</strong>,
          not a sticker you could audit against one factory.
        </p>
        <ul>
          <li>
            <strong>Not a vehicle-specific LCA.</strong> Material splits and
            factory grams are class-level factors. Two cars of the same weight
            and powertrain get similar mining numbers even if one is built on a
            cleaner grid.
          </li>
          <li>
            <strong>Battery size and chemistry are mostly inferred.</strong> Only
            a small share of EVs put kWh in the EnerGuide model name. LFP vs NMC
            is a name heuristic.
          </li>
          <li>
            <strong>Weight coverage is incomplete.</strong> New nameplates,
            BMW-style numbered trims vs CVS <code>3 SERIES</code>, CVS typos,
            and cars last measured more than eight years ago often fall back to
            a class average.
          </li>
          <li>
            <strong>Lifetime is a round 250,000 km.</strong> Real survival,
            km/year, and second owners vary. Operation on the card is this
            year’s driving; it is not that lifetime scaled to your km/year.
          </li>
          <li>
            <strong>Plug-in hybrids</strong> use an inferred utility factor
            (share of km on electricity) from NRCan’s composite tailpipe vs
            charge-sustaining fuel use, not your charging habits.
          </li>
          <li>
            <strong>Disposal is a cost; recycling is a credit.</strong> They are
            not netted into “throwing the car away is negative emissions.”
            Canada has no national end-of-life vehicle law. Second-life packs
            and export of used vehicles are not modelled.
          </li>
          <li>
            <strong>Scrap credits are conservative</strong> relative to
            primary-metal intensities so recycled content already in the build
            is not double-counted.
          </li>
          <li>
            <strong>No manufacturer suggested retail price.</strong> EnerGuide
            and CVS do not include MSRP.
          </li>
          <li>
            <strong>Heavy pickups</strong> above the EnerGuide test weight limit
            are absent.
          </li>
          <li>
            <strong>No used-car remaining-life mode.</strong> The mining and
            factory totals assume a new vehicle’s full build.
          </li>
          <li>
            <strong>Catalogue integrity.</strong> The app SHA-256-pins{" "}
            <code>vehicles.json</code> at build time and refuses a swapped file.
            That does not encrypt the (public) data; it only detects tampering
            of that one file.
          </li>
        </ul>
        <p>About 30,800 vehicle rows are in the built catalogue.</p>
      </div>
    </main>
  );
}
