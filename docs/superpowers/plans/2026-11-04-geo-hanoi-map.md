# Geo Hà Nội Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang tĩnh Leaflet + OSM hiển thị 127 xã/phường Hà Nội (UI V1), search bỏ dấu, xa-extra.json, mobile drawer + bottom sheet.

**Architecture:** Preprocess `mahoa_xa.6.json` → `data/hanoi.geojson`. Runtime fetch GeoJSON + `xa-extra.json`, merge by `maxa`, một state `selectedMaxa` sync map/list/card.

**Tech Stack:** HTML/CSS/JS, Leaflet CDN, OSM tiles, Python 3 preprocess.

## Global Constraints

- Visual: V1 Ấn son tokens trong spec
- Map: Leaflet + `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` + attribution
- Search: NFD + strip marks + đ→d, match tên/mã
- Extra: `data/xa-extra.json` flat, extra thắng
- Mobile ≤768px: drawer list + bottom sheet detail
- No bundler; no React

---

### Task 1: Normalize + preprocess

**Files:**
- Create: `js/normalize.js`, `tests/test_normalize.html`, `scripts/build-geojson.py`, `data/hanoi.geojson`, `data/xa-extra.json`

- [x] `foldVi(s)` + `tests/test_normalize.mjs`
- [x] `build-geojson.py` → `data/hanoi.geojson` (dedupe)
- [x] Seed `xa-extra.json` `{}`

### Task 2: Shell UI V1 + mobile

- [x] Layout sidebar | map | detail; logo trái header
- [x] `@media (max-width:768px)` drawer + bottom sheet + menu button

### Task 3: App logic

- [x] Leaflet + OSM + GeoJSON
- [x] Search foldVi + sync selection
- [x] Detail + xa-extra merge
- [x] README

### Task 4: Verify

- [x] Search `dong da` → Đống Đa
- [x] Mobile 390: nút Danh sách + bottom sheet
