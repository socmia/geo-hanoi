# Geo Hà Nội — STATUS (entry point)

Read this first, then `docs/STATUS.md` for the living detail.

- **Branch:** `main` (push to `main` deploys GitHub Pages: https://socmia.github.io/geo-hanoi/)
- **What:** static map of the 23 tổ dân phố of Phường Đống Đa (Hà Nội), plus `to.html?n=<số>` detail page
- **Stack:** plain HTML/CSS/ES modules + Leaflet 1.9.4 (CDN), no build step; Python scripts for data; Playwright e2e
- **Code:** `index.html` + `css/map.css` + `js/app.js` (map page) · `to.html` + `css/app.css` + `js/to-detail.js` (detail page)
- **Data:** `data/to-dan-pho.geojson` (boundaries, from Google My Maps) · `data/poi.geojson` (schools/health/offices, from OSM) · `data/tdp-extra.json` (hand-written intro/contact per tổ)

## Gotchas
- `css/map.css` is only for `index.html`; `to.html` still uses `css/app.css` — don't merge them blindly.
- POI markers hide below zoom 15 (`.pois-far`), even when their chip is on.
- Bump the `?v=` query on `app.js` / `map.css` in `index.html` after edits (Pages caches).
- Tests read `window.__GEO_TEST__` and IDs `#search`, `#ward-list`, `#city-units`, `.detail-actions .btn-primary`.

## Run
```bash
python -m http.server 8080      # open http://127.0.0.1:8080
npx playwright test             # 9 e2e checks
python scripts/fetch_poi.py     # refresh POIs from OpenStreetMap
```
