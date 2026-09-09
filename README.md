# Car impact (Canada)

Compare the environmental cost of cars sold in Canada: mining and manufacturing, driving, and end of life.

Driving emissions use [NRCan EnerGuide ratings](https://open.canada.ca/data/en/dataset/98f1a129-f628-4ce4-b24d-6f16bf24dd64) and provincial electricity intensity. Curb weight comes from [Transport Canada CVS](https://open.canada.ca/data/en/dataset/913f8940-036a-45f2-a5f2-19bde76c1252) when the nameplate matches, otherwise a class average. Battery size is estimated from range × energy use. Materials and factory assembly are parametric GREET-style factors, not a plant audit. Disposal is not modelled yet.

## Run locally

```bash
npm install
npm run dev
```

This rebuilds `public/vehicles.json` from the CSVs in `data/nrcan/`, then starts the app.
