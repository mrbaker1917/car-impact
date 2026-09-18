# Cars Environmental Impact

A Canada-first comparison of **full-lifecycle greenhouse gases** for cars sold here: mining and materials, factory assembly, driving, disposal, and a separate recycling credit.

Search any make, model, or year in the EnerGuide catalogue (1995–2026), compare up to three cars, and switch **province** to see how the electricity grid changes the story. Shared links keep the cars, province, and kilometres per year in the URL.

This is a parametric estimate for comparing nameplates, not a plant-by-plant life-cycle assessment and not MIT CarbonCounter’s US totals.

## Run locally

You need [Node.js](https://nodejs.org/) 22 (or a current LTS) and npm.

```bash
npm install
npm run dev
```

That rebuilds `public/vehicles.json` from the CSVs in `data/nrcan/` and `data/cvs/`, then starts the app at [http://localhost:5173/](http://localhost:5173/).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run data` | Rebuild the vehicle catalogue and its SHA-256 pin |
| `npm run build` | Catalogue + typecheck + production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |

The generated catalogue is gitignored. A production host (for example Netlify) should run `npm run build` so the JSON is created on the server. `netlify.toml` already sets that up.

## What the cards show

Each car has the same stages, in this order:

1. **Total emissions over the car’s life** — mining + building + driving + disposal, minus the recycling credit, over a fixed **250,000 km**.
2. **Mining** — materials in the glider and, for plug-ins and EVs, the battery pack.
3. **Building** — a generic factory / paint add-on.
4. **Operation** — **this year’s** driving at the km/year you set (default 20,000), including tailpipe, fuel production, and electricity.
5. **Disposal** — shredding and residue as a **cost**, then **Recycling credit** as a separate offset against the build.

With two or three cars, a sentence above the cards states the lifetime comparison in the selected province (for example that an EV is about a quarter of a hybrid in Ontario, and about half in Alberta).

Lifetime totals use 250,000 km so one-time stages can sit next to driving. That distance does **not** change when you change km/year; km/year only changes the Operation line.

## Data sources

All government files in this repo are used under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

### Vehicle list, fuel use, and tailpipe CO₂

[Natural Resources Canada EnerGuide fuel consumption ratings](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64), English CSVs in `data/nrcan/`, retrieved 2026-09-06 (model years 1995–2026).

- Gasoline, diesel, and hybrid rows come from the yearly fuel-consumption files.
- Battery-electric and plug-in hybrid rows come from the dedicated BEV and PHEV files (they are not in the yearly ICE tables).
- 1995–2014 figures are NRCan’s 5-cycle-adjusted values, so they can be compared with later years.
- Tailpipe grams per kilometre are NRCan’s published numbers, not recalculated here.

Official search UI: [EnerGuide fuel consumption ratings](https://fcr-ccc.nrcan-rncan.gc.ca/en).

### Curb weight

[Transport Canada Canadian Vehicle Specifications (CVS)](https://open.canada.ca/data/en/dataset/913f8940-036a-45f2-a5f2-19bde76c1252), English yearly files in `data/cvs/` (`CW` is kilograms), retrieved 2026-09-08.

EnerGuide and CVS use different model strings. The join matches make + nameplate, then reuses a generation’s weight (CVS `MYR`) for later years when needed. About **91%** of 2011–2023 EnerGuide rows get a CVS weight; about **69%** of the full 1995–2026 catalogue. The rest use a **class-average** weight, labelled on the card.

### Electricity (driving, by province)

[Environment and Climate Change Canada](https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html) Offset System **2026 consumption** intensities, grams CO₂e per kWh, in `src/lib/provinces.ts`. Default province is Ontario.

### Fuel production (well-to-tank)

Canada-average well-to-tank factors in `src/lib/emissions.ts`. Gasoline is derived from GHGenius 5.0 Ontario gasoline (~20.9 g CO₂e/MJ × 34.69 MJ/L). Diesel uses a similar upstream intensity at diesel energy density. Tailpipe CO₂ is still NRCan, not these factors.

### Mining, factory, disposal, recycling

Parametric **GREET-style** factors in `src/lib/embodied.ts`: steel, aluminum, copper, other materials, NMC or LFP pack production, a generic assembly add-on, shredding/residue, and scrap credits. These are typical North American intensities, not a Canadian plant or recycler audit.

Battery kilowatt-hours: taken from the model name when it includes a pack size; otherwise estimated as electric range × wall kWh/100 km × 0.88 (charge efficiency) × 1.1 (nominal vs usable). Chemistry defaults to NMC, except LFP for Tesla RWD / standard-range names, BYD, and names that say LFP.

## Limitations

Treat the tonnes as **order-of-magnitude comparisons**, not a sticker you could audit against one factory.

- **Not a vehicle-specific LCA.** Material splits and factory grams are class-level factors. Two cars of the same weight and powertrain get similar mining numbers even if one is built on a cleaner grid.
- **Battery size and chemistry are mostly inferred.** Only a small share of EVs put kWh in the EnerGuide model name. LFP vs NMC is a name heuristic.
- **Weight coverage is incomplete.** New nameplates, BMW-style numbered trims vs CVS `3 SERIES`, CVS typos, and cars last measured more than eight years ago often fall back to a class average.
- **Lifetime is a round 250,000 km.** Real survival, km/year, and second owners vary. Operation on the card is this year’s driving; it is not that lifetime scaled to your km/year.
- **Plug-in hybrids** use an inferred utility factor (share of km on electricity) from NRCan’s composite tailpipe vs charge-sustaining fuel use, not your charging habits.
- **Disposal is a cost; recycling is a credit.** They are not netted into “throwing the car away is negative emissions.” Canada has no national end-of-life vehicle law. Second-life packs and export of used vehicles are not modelled.
- **Scrap credits are conservative** relative to primary-metal intensities so recycled content already in the build is not double-counted.
- **No manufacturer suggested retail price.** EnerGuide and CVS do not include MSRP.
- **Heavy pickups** above the EnerGuide test weight limit are absent.
- **No used-car remaining-life mode.** The mining and factory totals assume a new vehicle’s full build.
- **Catalogue integrity.** The app SHA-256-pins `vehicles.json` at build time and refuses a swapped file. That does not encrypt the (public) data; it only detects tampering of that one file.

About **30,800** vehicle rows are in the built catalogue.
