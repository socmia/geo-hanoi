# Geo Hà Nội

Bản đồ tổ dân phố Đống Đa — Leaflet + OpenStreetMap, UI glass (Apple-style).

**Live:** https://socmia.github.io/geo-hanoi/  
**Repo:** https://github.com/socmia/geo-hanoi

## Chạy local

```bash
python scripts/build-geojson.py   # khi cập nhật mahoa_xa.6.json
python -m http.server 8080
```

Mở http://127.0.0.1:8080

## Tổ dân phố (Đống Đa)

Nguồn: [Google My Maps — Bản đồ đống đa](https://www.google.com/maps/d/u/0/viewer?mid=1nBY8hhne4fttYxEO0MDGp5KjxIwN86M)

```bash
python scripts/import_mymaps_tdp.py   # tải KML → data/to-dan-pho.geojson
```

Mỗi tổ một màu pastel; chọn tổ → sheet chi tiết → **Xem chi tiết tổ** mở `to.html?n=<số>`.

## Trang chi tiết tổ

- URL: `to.html?n=1` (n = `to_dan_pho`)
- Nội dung mở rộng: `data/tdp-extra.json` theo key số tổ:

```json
{
  "1": {
    "gioi_thieu": "…",
    "lien_he": "…",
    "ghi_chu": "…",
    "sections": [{ "title": "Lịch sử", "body": "…" }]
  }
}
```

Để trống thì trang hiện placeholder — bổ sung sau không cần đổi HTML.

## Bổ sung thông tin xã (legacy)

Sửa `data/xa-extra.json` theo `maxa` (string). Field flat merge vào props.

## Logo

Thay `assets/logo.svg` (hoặc đổi `src` trong `index.html`).

## Test

```bash
node tests/test_normalize.mjs
npm install
npx playwright test
```
