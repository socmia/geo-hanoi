// Street basemap shared by the map page and the detail mini-map.
// OpenFreeMap vector tiles (MapLibre via maplibre-gl-leaflet) so we can drop place-name and POI labels:
// they still carry pre-2025 ward/district names ("Phường Quang Trung", "Quận Đống Đa"). Raster tiles bake
// those names in, so a raster layer is only the fallback when WebGL or the style is unavailable.
const OFM_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const OFM_ATTR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> &middot; Dữ liệu &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

let stylePromise = null;

const hasWebGL = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};

function loadStyle() {
  stylePromise ??= fetch(OFM_STYLE)
    .then((r) => { if (!r.ok) throw new Error(`style ${r.status}`); return r.json(); })
    .then((style) => {
      style.layers = style.layers.filter((l) => l["source-layer"] !== "place" && l["source-layer"] !== "poi");
      // The style labels in Latin transliteration/English ("Lang Road"); show the Vietnamese name instead.
      style.layers.forEach((l) => {
        if (l.layout?.["text-field"] && JSON.stringify(l.layout["text-field"]).includes("name:latin")) {
          l.layout["text-field"] = ["coalesce", ["get", "name:vi"], ["get", "name"], ["get", "name:latin"]];
        }
      });
      return style;
    })
    .catch((err) => { stylePromise = null; throw err; });
  return stylePromise;
}

/** Resolves to a Leaflet layer: the vector street map, or `fallback()` (a raster layer) if it cannot load. */
export async function streetLayer(fallback) {
  if (L.maplibreGL && hasWebGL()) {
    try {
      return L.maplibreGL({ style: await loadStyle(), attribution: OFM_ATTR, interactive: false });
    } catch (err) {
      console.warn("vector basemap unavailable, using raster", err);
    }
  }
  return fallback();
}
