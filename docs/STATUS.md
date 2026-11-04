# STATUS — detail

_Last updated: 2026-11-04_

## ✅ Done
- Map page redesigned in a Google Maps style (mock approved on the design canvas "Đống Đa Map Redesign"):
  - Desktop: left panel (408px) with red brand header (`assets/header-bg.webp`), search pill, list of 23 tổ → detail card (shape preview, actions Chi tiết / Phóng tới / Chia sẻ, tabs Tổng quan / Giới thiệu / Liên hệ, places in the tổ — always shown, with an empty state). Collapse tab on the panel edge.
  - Mobile (≤768px): brand header + floating search, chips row, bottom sheet (list → detail; tap the handle to expand).
  - Map: chips for Tổ dân phố / Trường học / Y tế / Công sở / Số tổ; selected tổ = red dashed outline + red pin, others dimmed; layers button toggles light map ↔ satellite (Esri); locate + zoom controls; `#tdp-<n>` deep links (also on hashchange).
- `scripts/fetch_poi.py` → `data/poi.geojson`: 42 POIs (22 school, 7 health, 13 office) inside the TDP polygons, deduped by kind+name.
- Detail page `to.html` redesigned to match (approved mock): red header, static mini Leaflet map with POIs, Giới thiệu / Liên hệ cards, side column Thông tin (area computed from polygon) / Địa điểm trong tổ (always shown). Own stylesheet `css/to.css`.
- Removed "Bản đồ gốc" action, "Tổ lân cận" sections and the "Số tổ" info row (user request).
- Removed the old Hà Nội ward/xã mode and city stats from the UI (only Đống Đa TDP shown).

## 🔄 Currently Working On
- Nothing in flight.

## ⚠️ Known Issues
- OSM POI names still carry pre-merger ward names (e.g. "UBND phường Nam Đồng") — that is OSM data, not ours.
- `tdp-extra.json` is mostly empty → Giới thiệu / Liên hệ tabs show placeholders.
- `css/app.css` is now unused (kept for reference); delete when sure.
- `designs/` holds older static mocks (v1–v3), unused by the app.

## 🎯 Next Steps
- Fill `data/tdp-extra.json` per tổ (gioi_thieu, to_truong, dien_thoai, dia_diem_sinh_hoat, sections).
- Optionally curate `data/poi.geojson` by hand (add missing schools/offices, fix names).

## 📜 Key Files
- `index.html`, `css/map.css`, `js/app.js` — map page
- `scripts/fetch_poi.py`, `scripts/import_mymaps_tdp.py` — data import
- `tests/e2e/map-selection.spec.js` — Playwright checks

## 🗣️ Handoff Notes
- Fit-on-load uses the TDP polygon bounds (tighter than the ward outline in `hanoi.geojson`); `zoomSnap: 0.5`.
- Map padding accounts for the side panel / bottom sheet (`mapPadding()` in `app.js`).
