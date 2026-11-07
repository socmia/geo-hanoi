"""Fetch schools, health facilities and government offices inside Đống Đa TDP boundaries.

Source: OpenStreetMap via the Overpass API. Output: data/poi.geojson, then
data/poi-curation.json is applied (removals, renames, hand-placed points).
(Point features with properties: kind = school|health|office, name, osm).

    python scripts/fetch_poi.py
"""
import json
import pathlib
import urllib.parse
import urllib.request

import curate_poi

ROOT = pathlib.Path(__file__).resolve().parent.parent
TDP = ROOT / "data" / "to-dan-pho.geojson"
OUT = ROOT / "data" / "poi.geojson"
ENDPOINT = "https://overpass-api.de/api/interpreter"

KINDS = {
    "school": [("amenity", "school"), ("amenity", "kindergarten"), ("amenity", "college"), ("amenity", "university")],
    "health": [("amenity", "hospital"), ("amenity", "clinic"), ("amenity", "doctors"), ("healthcare", "hospital"), ("healthcare", "clinic")],
    "office": [("amenity", "townhall"), ("office", "government"), ("amenity", "police")],
}


def rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def inside(x, y, ring):
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]
        xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def main():
    tdp = json.loads(TDP.read_text(encoding="utf-8"))
    polys = [(f["properties"].get("to_dan_pho"), rings(f["geometry"])) for f in tdp["features"]]
    xs = [c[0] for _, rs in polys for r in rs for c in r]
    ys = [c[1] for _, rs in polys for r in rs for c in r]
    bbox = f"{min(ys)},{min(xs)},{max(ys)},{max(xs)}"

    parts = []
    for pairs in KINDS.values():
        for k, v in pairs:
            parts.append(f'nwr["{k}"="{v}"]({bbox});')
    query = f"[out:json][timeout:60];({''.join(parts)});out center tags;"
    req = urllib.request.Request(
        ENDPOINT,
        data=urllib.parse.urlencode({"data": query}).encode(),
        headers={"User-Agent": "geo-hanoi-poi-fetch/1.0"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        elements = json.load(r)["elements"]

    features, seen = [], set()
    for el in elements:
        tags = el.get("tags", {})
        lon = el.get("lon", el.get("center", {}).get("lon"))
        lat = el.get("lat", el.get("center", {}).get("lat"))
        if lon is None or lat is None:
            continue
        kind = next((name for name, pairs in KINDS.items() if any(tags.get(k) == v for k, v in pairs)), None)
        tdp_num = next((n for n, rs in polys if any(inside(lon, lat, r) for r in rs)), None)
        if kind is None or tdp_num is None:
            continue
        name = tags.get("name:vi") or tags.get("name") or ""
        key = (kind, name)  # same place mapped as node + way → keep one
        if not name or key in seen:
            continue
        seen.add(key)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
            "properties": {
                "kind": kind,
                "name": name,
                "to_dan_pho": tdp_num,
                "osm": f"{el['type']}/{el['id']}",
            },
        })

    features.sort(key=lambda f: (f["properties"]["kind"], f["properties"]["name"]))
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=1), encoding="utf-8")
    counts = {k: sum(f["properties"]["kind"] == k for f in features) for k in KINDS}
    print(f"wrote {OUT.relative_to(ROOT)}: {len(features)} POIs {counts}")
    curate_poi.main()  # re-apply hand edits (data/poi-curation.json)


if __name__ == "__main__":
    main()
