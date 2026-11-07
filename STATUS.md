# Geo Hà Nội — STATUS (entry point)

Read this first, then `docs/STATUS.md` for the living detail.

- **Branch:** `main` (push to `main` deploys GitHub Pages: https://socmia.github.io/geo-hanoi/)
- **What:** static map of the 23 tổ dân phố of Phường Đống Đa (Hà Nội), plus `to.html?n=<số>` detail page
- **Stack:** plain HTML/CSS/ES modules + Leaflet 1.9.4 (CDN), no build step; Python scripts for data; Playwright e2e
- **Code:** `index.html` + `css/map.css` + `js/app.js` (map page) · `to.html` + `css/to.css` + `js/to-detail.js` (detail page)
- **Data:** `data/to-dan-pho.geojson` (boundaries, from Google My Maps) · `data/poi.geojson` (OSM POIs + hand curation from `data/poi-curation.json`) · `data/tdp-extra.json` (hand-written intro/contact per tổ)

## Gotchas
- `css/map.css` (map) and `css/to.css` (detail) share tokens by copy; `css/app.css` is legacy/unused.
- POI markers and polygon labels hide below zoom 15 (`.pois-far`, `.labels-far`).
- Basemap is OpenFreeMap vector via maplibre-gl-leaflet (`js/basemap.js`); place/POI label layers are stripped (old ward names). Never switch back to Esri street raster as default.
- Edit POIs in `data/poi-curation.json`, then `python scripts/curate_poi.py` (do not hand-edit `poi.geojson`).
- Local preview server runs on 8081 (`.claude/launch.json`); Playwright owns 8080. Two `http.server 8080` processes on Windows share the port and make tests hang randomly.
- Bump the `?v=` query on `app.js` / `map.css` in `index.html` after edits (Pages caches).
- Tests read `window.__GEO_TEST__` and IDs `#tdp-select`, `#info`, `#info-title`, `#info-detail`, `#info-close`, `#clear-filter`, `#layers-btn`, `#coord-btn`.
- Hand off only after a fresh green `npx playwright test` in the same session (never leave verification to the user).

## Run
```bash
python -m http.server 8080      # open http://127.0.0.1:8080
npx playwright test             # 16 e2e checks
python scripts/fetch_poi.py     # refresh POIs from OpenStreetMap (+ curation)
```
