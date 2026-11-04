"""Unwrap mahoa_xa.6.json → data/hanoi.geojson (one FeatureCollection)."""
from __future__ import annotations

import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "mahoa_xa.6.json"
OUT = ROOT / "data" / "hanoi.geojson"


def main() -> None:
    outer = json.loads(SRC.read_text(encoding="utf-8"))
    raw = base64.b64decode(outer["file"]["data"]).decode("utf-8")
    collections = json.loads(raw)

    features = []
    seen = set()
    for fc in collections:
        for feat in fc.get("features") or []:
            props = dict(feat.get("properties") or {})
            maxa = props.get("maxa")
            uid = str(props.get("matinhxa") or maxa)
            if uid in seen:
                continue
            seen.add(uid)
            feat_out = {
                "type": "Feature",
                "id": uid,
                "properties": props,
                "geometry": feat.get("geometry"),
            }
            if feat.get("bbox"):
                feat_out["bbox"] = feat["bbox"]
            features.append(feat_out)

    out = {"type": "FeatureCollection", "features": features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT} ({len(features)} features)")


if __name__ == "__main__":
    main()
