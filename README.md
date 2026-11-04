# Geo Hà Nội

Bản đồ tĩnh xã/phường Hà Nội — Leaflet + OpenStreetMap (mirror `tile.openstreetmap.de`, fallback FR/Esri), UI V1 Ấn son.

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

App chỉ vẽ TDP Đống Đa, fill trong suốt + tên trên map.

## Bổ sung thông tin xã

Sửa `data/xa-extra.json` theo `maxa` (string):

```json
{
  "922": { "ghi_chu": "Ví dụ field thêm" }
}
```

Reload trang. Field flat hiện trong card chi tiết.

## Logo

Thay `assets/logo.svg` (hoặc đổi `src` trong `index.html`).

## Test

```bash
node tests/test_normalize.mjs
```
