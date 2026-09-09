# Canadian Vehicle Specifications (curb weight)

English CSVs from Transport Canada, retrieved 2026-09-08.

- Catalogue: [Canadian Vehicle Specifications (Open Government Portal)](https://open.canada.ca/data/en/dataset/913f8940-036a-45f2-a5f2-19bde76c1252)
- Licence: [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
- `CW` is curb weight in kilograms
- `MYR` is the model-year the dimensions were compiled for (two-digit), not necessarily the file year

Each yearly file is a snapshot of the then-current fleet. A 2022 file still contains a Camry last measured in 2017 (`MYR` 17). The 2023 file is a small addendum of new/updated rows, not a full replacement.

Match rates from `npm run data && node scripts/measure-cvs-join.mjs` (2026-09-09):

- 3,917 unique CVS make/model/year rows with a weight
- The catalogue uses a CVS weight when the nameplate matches in the same year, the same generation (MYR ≤ vehicle year, ≤ 8 years), or a nearby spec (±8 years)
- **91%** of EnerGuide 2011–2023 rows get a CVS weight
- **69%** of the full 1995–2026 catalogue; the rest use a class-average weight, labelled on the card
- **100%** of BEVs and PHEVs get a pack-size estimate from range × wall kWh/100 km (only 1.4% have kWh in the model name)

Unmatched rows are mostly new nameplates (Tonale, i5, Integra with `CW` listed as N/A), BMW numbered trims (`330i` vs `3 SERIES`), CVS typos (`GUILIA`), and cars last measured more than eight years ago.

