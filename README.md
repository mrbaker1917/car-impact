# Car impact (Canada)

Compare the environmental cost of cars sold in Canada: mining and manufacturing, driving, and end of life.

Driving emissions use [NRCan EnerGuide ratings](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64) and provincial electricity intensity. Manufacturing and disposal will be modeled separately.

## Run locally

```bash
npm install
npm run dev
```

This rebuilds `public/vehicles.json` from the CSVs in `data/nrcan/`, then starts the app.
