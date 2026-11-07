"""Apply data/poi-curation.json to data/poi.geojson (idempotent).

remove: drop features whose 'osm' id is listed.
rename: overwrite name (and any other given fields) by 'osm' id.
add:    insert or replace hand-placed points keyed by 'id'.

    python scripts/curate_poi.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
POI = ROOT / "data" / "poi.geojson"
CURATION = ROOT / "data" / "poi-curation.json"


def apply(features, cur):
    drop = {r["osm"] for r in cur.get("remove", [])}
    renames = {r["osm"]: r for r in cur.get("rename", [])}
    added = {a["id"] for a in cur.get("add", [])}
    out = []
    for f in features:
        p = f["properties"]
        if p.get("osm") in drop or p.get("id") in added or p.get("osm") in added:
            continue
        r = renames.get(p.get("osm"))
        if r:
            p.update({k: v for k, v in r.items() if k != "osm"})
        out.append(f)
    for a in cur.get("add", []):
        props = {k: v for k, v in a.items() if k not in ("lat", "lng")}
        out.append({"type": "Feature", "properties": props,
                    "geometry": {"type": "Point", "coordinates": [a["lng"], a["lat"]]}})
    out.sort(key=lambda f: (f["properties"].get("to_dan_pho") or 0, f["properties"]["kind"], f["properties"]["name"]))
    return out


def main():
    geo = json.loads(POI.read_text(encoding="utf-8"))
    cur = json.loads(CURATION.read_text(encoding="utf-8"))
    geo["features"] = apply(geo["features"], cur)
    POI.write_text(json.dumps(geo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(geo['features'])} POIs -> {POI.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
