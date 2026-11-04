# Geo Hà Nội

Bản đồ tĩnh xã/phường Hà Nội — Leaflet + OpenStreetMap (mirror `tile.openstreetmap.de`, fallback FR/Esri), UI V1 Ấn son.

## Chạy

```bash
python scripts/build-geojson.py   # khi cập nhật mahoa_xa.6.json
python -m http.server 8080
```

Mở http://127.0.0.1:8080

## Tổ dân phố (Đống Đa)

Thả GeoJSON vào `data/to-dan-pho.geojson`. Mỗi feature:

- `properties.ten` (hoặc `name`) — hiện nhãn trên map
- `properties.phuong` chứa “Đống Đa” **hoặc** `maxa: 922` — để lọc đúng phường

App chỉ vẽ TDP Đống Đa, fill trong suốt + tên. Chưa có file → tạm hiện ranh phường Đống Đa.

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
