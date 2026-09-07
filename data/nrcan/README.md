# NRCan fuel consumption ratings

English datasets from Natural Resources Canada, retrieved 2026-09-06.

- Catalogue: [Fuel consumption ratings (Open Government Portal)](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64)
- Licence: [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)
- Search UI: https://fcr-ccc.nrcan-rncan.gc.ca/en

1995–2014 values in the 5-cycle file were adjusted by NRCan from the original 2-cycle test so they can be compared with later years.

## Files

| File | What it covers | Data rows |
| --- | --- | --- |
| `my1995-2014-fuel-consumption-ratings-5-cycle.csv` | Gasoline, diesel, hybrid, other liquid fuels | 17,853 |
| `my2015-2024-fuel-consumption-ratings.csv` | Same, 2015–2024 | 10,060 |
| `my2025-fuel-consumption-ratings.csv` | Same, 2025 | 701 |
| `my2026-fuel-consumption-ratings.csv` | Same, 2026 | 597 |
| `my2012-2026-battery-electric-vehicles.csv` | Battery-electric only | 1,212 |
| `my2012-2026-plug-in-hybrid-electric-vehicles.csv` | Plug-in hybrids | 401 |
| `understanding-the-tables.xlsx` | Official column notes | — |

Battery-electric and plug-in hybrid models are **not** in the yearly fuel-consumption files. Use the dedicated BEV and PHEV CSVs.

The 2015–2024 file starts with a UTF-8 BOM on the header.

## Fuel type codes

- `X` regular gasoline
- `Z` premium gasoline
- `D` diesel
- `E` ethanol (E85)
- `B` electricity
- `N` natural gas

## Gaps for our model

These files have consumption, tailpipe CO₂, class, and (for EVs) motor power, range, and recharge time. They do **not** have curb weight, battery kWh as a dedicated column (sometimes only in the Tesla model name), or chemistry. Those still need to be joined later.
