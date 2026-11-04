"""Import Tổ dân phố polygons from Google My Maps KML → data/to-dan-pho.geojson."""
from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "to-dan-pho.geojson"
MID = "1nBY8hhne4fttYxEO0MDGp5KjxIwN86M"
KML_URL = f"https://www.google.com/maps/d/kml?mid={MID}&forcekml=1"
NS = {"kml": "http://www.opengis.net/kml/2.2"}


def fold_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def parse_coords(text: str) -> list[list[float]]:
    pts = []
    for part in (text or "").strip().split():
        bits = part.split(",")
        if len(bits) < 2:
            continue
        lon, lat = float(bits[0]), float(bits[1])
        pts.append([lon, lat])
    return pts


def ring_to_polygon(coords: list[list[float]]) -> list[list[list[float]]] | None:
    if len(coords) < 3:
        return None
    if coords[0] != coords[-1]:
        coords = coords + [coords[0]]
    if len(coords) < 4:
        return None
    return [coords]


def is_tdp_name(name: str) -> bool:
    n = fold_spaces(name).lower()
    return "tổ dân phố" in n or "to dan pho" in n


def coord_count(geom: dict) -> int:
    n = 0

    def walk(c):
        nonlocal n
        if isinstance(c[0], (int, float)):
            n += 1
            return
        for x in c:
            walk(x)

    walk(geom["coordinates"])
    return n


def bbox(geom: dict) -> tuple[float, float, float, float]:
    pts: list[list[float]] = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            pts.append(c)
            return
        for x in c:
            walk(x)

    walk(geom["coordinates"])
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    return min(lons), min(lats), max(lons), max(lats)


def near_same_bbox(a: dict, b: dict, eps: float = 1e-4) -> bool:
    ba, bb = bbox(a), bbox(b)
    return all(abs(ba[i] - bb[i]) < eps for i in range(4))


def dedupe_by_number(features: list[dict]) -> list[dict]:
    """Keep one feature per to_dan_pho; if near-duplicate geometry, keep denser ring."""
    best: dict[int | str, dict] = {}
    passthrough: list[dict] = []
    for f in features:
        num = f["properties"].get("to_dan_pho")
        if num is None:
            passthrough.append(f)
            continue
        prev = best.get(num)
        if prev is None:
            best[num] = f
            continue
        if near_same_bbox(prev["geometry"], f["geometry"]):
            if coord_count(f["geometry"]) > coord_count(prev["geometry"]):
                best[num] = f
            print(f"dedupe tổ {num}: drop near-duplicate polygon")
        else:
            # same number, different places — keep both under unique keys later
            passthrough.append(f)
            print(f"warn: tổ {num} has two different geometries; keeping both")
    return list(best.values()) + passthrough


def extract_number(name: str) -> int | None:
    m = re.search(r"(?:số\s*)?(\d+)\s*$", fold_spaces(name), flags=re.I)
    if m:
        return int(m.group(1))
    m = re.search(r"(?:số\s*)?(\d+)", fold_spaces(name), flags=re.I)
    return int(m.group(1)) if m else None


def placemark_polygons(pm: ET.Element) -> list[list[list[list[float]]]]:
    polys = []
    for poly in pm.findall(".//kml:Polygon", NS):
        outer = poly.find("./kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", NS)
        if outer is None or not (outer.text or "").strip():
            continue
        ring = ring_to_polygon(parse_coords(outer.text))
        if ring:
            polys.append(ring)
    return polys


def main() -> None:
    req = urllib.request.Request(KML_URL, headers={"User-Agent": "geo-hanoi/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        kml = r.read().decode("utf-8")

    root = ET.fromstring(kml)
    features = []
    for pm in root.findall(".//kml:Placemark", NS):
        name_el = pm.find("kml:name", NS)
        name = fold_spaces(name_el.text if name_el is not None else "")
        if not is_tdp_name(name):
            continue
        polys = placemark_polygons(pm)
        if not polys:
            continue
        desc_el = pm.find("kml:description", NS)
        desc = fold_spaces(desc_el.text if desc_el is not None else "")
        num = extract_number(name)
        props = {
            "ten": name,
            "phuong": "Đống Đa",
            "maxa": 922,
            "to_dan_pho": num,
            "nguon": "Google My Maps",
            "mid": MID,
        }
        if desc:
            props["mo_ta"] = desc
        geom = (
            {"type": "Polygon", "coordinates": polys[0]}
            if len(polys) == 1
            else {"type": "MultiPolygon", "coordinates": polys}
        )
        features.append({"type": "Feature", "properties": props, "geometry": geom})

    # My Maps đôi khi có 2 polygon trùng số (vd. tổ 6) gần như cùng bbox → giữ bản nhiều điểm hơn
    features = dedupe_by_number(features)

    features.sort(
        key=lambda f: (
            f["properties"].get("to_dan_pho") is None,
            f["properties"].get("to_dan_pho") or 0,
            f["properties"]["ten"],
        )
    )
    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({len(features)} TDP polygons)")
    for f in features:
        print("-", f["properties"]["ten"])


if __name__ == "__main__":
    main()
