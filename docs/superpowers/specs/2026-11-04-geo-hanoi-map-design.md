# Geo Hà Nội — Bản đồ xã/phường (design)

**Date:** 2026-11-04  
**Status:** Approved direction (pending user review of this written spec)  
**Visual direction:** V1 Ấn son  
**Map:** Leaflet.js + OpenStreetMap tiles

## Goal

Trang web tĩnh để xem 127 xã/phường Hà Nội trên bản đồ: tìm kiếm, chọn trên map hoặc list, xem hồ sơ đơn vị. Người dùng sẽ bổ sung field sau qua file tách geometry.

## Stack

| Layer | Choice |
|-------|--------|
| App | HTML + CSS + JS thuần (không bundler) |
| Map library | **Leaflet.js** (CDN) |
| Basemap | **OpenStreetMap** standard raster tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`) + attribution bắt buộc |
| Data geometry | `data/hanoi.geojson` (preprocess từ `mahoa_xa.6.json`) |
| Data bổ sung | `data/xa-extra.json` keyed by `maxa` |
| Serve | Mở qua static server (OSM tiles cần origin http/https; `file://` không dùng cho production local) |

**Không dùng:** Mapbox, Google Maps, React/Vite (đã chọn A).

## Architecture

```
mahoa_xa.6.json  --(scripts/build-geojson.py)-->  data/hanoi.geojson
                                                      |
index.html + css/app.css + js/app.js  <--- fetch -----+
                                                      |
                                      data/xa-extra.json (merge by maxa)
```

1. Preprocess một lần: unwrap base64 wrapper, gộp thành **một** `FeatureCollection`, mỗi feature giữ `properties` gốc + `geometry`.
2. Runtime: Leaflet map + `L.geoJSON`; style pastel theo index/`maxa`; selection = fill vàng + viền son/vàng đậm (theo mockup V1).
3. Merge: `props = { ...feature.properties, ...(xaExtra[String(maxa)] || {}) }`.

## UI (V1 Ấn son)

### Tokens

- **Color:** son `#9B1C1C`, son-deep `#6E1010`, ink `#141210`, paper `#E8EBEF`, panel `#F4F6F8`, line `#C5CCD6`, mute `#5C6570`, select-gold `#D4A017` / fill `#F3D98A`
- **Type:** Be Vietnam Pro (400–700), hỗ trợ tiếng Việt
- **Layout:** `sidebar 300px | map 1fr`; detail card absolute góc phải trên map

### Sidebar (trái)

- Header đỏ son: **logo bên trái** + chữ “Thành phố Hà Nội”
  - Logo: `<img src="assets/logo.svg" alt="">` trong header. Ship placeholder SVG vòng/ấn son; thay bằng file thật giữ nguyên path `assets/logo.svg` (PNG thì đổi path một dòng trong HTML)
- Stats TP: diện tích `3.359,8 km²`, dân số `8.718.000`, số đơn vị `127` — hardcode trong `js/app.js` (CITY config); không thêm `city.json` lần này
- Search: placeholder “Tìm xã, phường…”
- List scroll: tên + chấm màu khớp polygon; item active = nền trắng + viền trái son

### Map

- OSM tiles dưới GeoJSON overlay
- Click polygon → select
- Fit bounds Hà Nội lúc load; khi select → `fitBounds` feature (padding)

### Detail card (phải)

Khi có selection:

- Tên (`ten_chi_tiet`)
- Dân số, diện tích
- Trụ sở (`trung_tam_hc`)
- Lãnh đạo: `biThu`, `chuTichUBND`, `MTTQ`
- Sáp nhập / thông tin khác: `sat_nhap_tu` + **mọi key còn lại** từ merge (base + `xa-extra`), trừ field đã hiện và field nội bộ
- Link `link` nếu có

Đóng/bỏ chọn: click nền map (không phải feature) hoặc nút đóng nhỏ trên card.

## Search (không dấu)

- Normalize: NFD → bỏ combining marks → `đ/Đ` → `d` → lowercase → trim/collapse spaces
- Match substring trên: `ten_chi_tiet`, `maxa`, `matinhxa`, `trung_tam_hc` (đã normalize)
- Gõ lọc list realtime; Enter hoặc click item → select + zoom
- Không phân biệt hoa/thường; `dong da` khớp `Đống Đa`

## `xa-extra.json` shape

```json
{
  "922": {
    "ghi_chu": "...",
    "website": "https://..."
  }
}
```

- Key: string của `maxa`
- Value: **chỉ flat** `string | number | boolean` (bỏ qua nested object/array nếu có)
- Field trùng tên với GeoJSON properties: **extra thắng** (cho phép override)

## Interactions (đồng bộ state)

Một `selectedMaxa` (number|null):

- Map style, list active, detail card, search highlight cùng nguồn
- Đổi selection từ map click, list click, hoặc search chọn

## Files to ship

```
index.html
css/app.css
js/app.js          # map, search normalize, merge, UI
js/normalize.js    # fold Vietnamese (testable)
data/hanoi.geojson
data/xa-extra.json # seed {} hoặc vài ví dụ
assets/logo.svg    # placeholder
scripts/build-geojson.py
README.md          # chạy server + rebuild geojson + OSM attribution
designs/           # mockup giữ làm reference, không phải runtime
```

## Out of scope (lần này)

- Auth, backend, edit-in-browser
- Clustering, heatmap, print/PDF
- Offline tile pack
- Mobile drawer phức tạp kiểu app native (lần này: responsive tốt — xem mục Mobile)

## Attribution & constraints

- Hiển thị © OpenStreetMap contributors (Leaflet attribution control mặc định bật)
- Tôn trọng [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) (app nội bộ nhẹ OK; traffic lớn → tile server riêng sau)

## Mobile (bắt buộc)

Breakpoint ~768px:

- Map full viewport; nút **☰ / Danh sách** mở sidebar dạng drawer overlay (logo + stats + search + list)
- Detail card → **bottom sheet** (max-height ~55vh, scroll trong sheet), không che hết map
- Touch: polygon click OK; không hover-only
- Safe-area padding; viewport `width=device-width`; font/tap target ≥44px cho control chính

## Success criteria

1. Mở trang qua static server: thấy OSM + 127 polygon
2. Search `dong da` / `Đống Đa` / `922` đều tìm được Đống Đa
3. Click map hoặc list cùng highlight + card đủ field gốc
4. Thêm key vào `xa-extra.json` theo `maxa` → reload thấy field mới trên card
5. Logo hiện trái header; thay `assets/logo.*` là đổi được ảnh
6. Điện thoại: drawer list + bottom sheet detail dùng được, map vẫn thao tác được
