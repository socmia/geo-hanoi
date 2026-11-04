# STATUS — detail

_Last updated: 2026-11-04_

## ✅ Done
- Map page redesigned in a Google Maps style (mock approved on the design canvas "Đống Đa Map Redesign"):
  - Desktop: left panel (408px) with red brand header (`assets/header-bg.webp`), search pill, list of 23 tổ → detail card (shape preview, actions Chi tiết / Phóng tới / Chia sẻ / Bản đồ gốc, tabs Tổng quan / Giới thiệu / Liên hệ, places in the tổ, nearest tổ). Collapse tab on the panel edge.
  - Mobile (≤768px): brand header + floating search, chips row, bottom sheet (list → detail; tap the handle to expand).
  - Map: chips for Tổ dân phố / Trường học / Y tế / Công sở / Số tổ; selected tổ = red dashed outline + red pin, others dimmed; layers button toggles light map ↔ satellite (Esri); locate + zoom controls; `#tdp-<n>` deep links (also on hashchange).
- `scripts/fetch_poi.py` → `data/poi.geojson`: 42 POIs (22 school, 7 health, 13 office) inside the TDP polygons, deduped by kind+name.
- Removed the old Hà Nội ward/xã mode and city stats from the UI (only Đống Đa TDP shown).

## 🔄 Currently Working On
- Nothing in flight.

## ⚠️ Known Issues
- OSM POI names still carry pre-merger ward names (e.g. "UBND phường Nam Đồng") — that is OSM data, not ours.
- `tdp-extra.json` is mostly empty → Giới thiệu / Liên hệ tabs show placeholders.
- `to.html` still uses the old glass style (`css/app.css`); not restyled yet.
- `designs/` holds older static mocks (v1–v3), unused by the app.

## 🎯 Next Steps
- Fill `data/tdp-extra.json` (gioi_thieu, lien_he, sections) per tổ.
- Restyle `to.html` to match the new map page.
- Optionally curate `data/poi.geojson` by hand (add missing schools/offices, fix names).

## 📜 Key Files
- `index.html`, `css/map.css`, `js/app.js` — map page
- `scripts/fetch_poi.py`, `scripts/import_mymaps_tdp.py` — data import
- `tests/e2e/map-selection.spec.js` — Playwright checks

## 🗣️ Handoff Notes
- Fit-on-load uses the TDP polygon bounds (tighter than the ward outline in `hanoi.geojson`); `zoomSnap: 0.5`.
- Map padding accounts for the side panel / bottom sheet (`mapPadding()` in `app.js`).
