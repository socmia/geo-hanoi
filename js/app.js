import { foldVi } from "./normalize.js";
import { shareLink } from "./share.js";
import { POI_KINDS, poiHtml, poiMetaHtml } from "./poi-kinds.js";
import { polylabel } from "./polylabel.js";
import { streetLayer } from "./basemap.js";

const DONG_DA_MAXA = 922;
const MOBILE_MQ = window.matchMedia("(max-width: 768px)");

const $ = (id) => document.getElementById(id);
const el = {
  tdpSelect: $("tdp-select"),
  layersBtn: $("layers-btn"),
  coordBtn: $("coord-btn"),
  info: $("info"),
  infoTitle: $("info-title"),
  infoBody: $("info-body"),
  infoClose: $("info-close"),
  infoDetail: $("info-detail"),
  infoShare: $("info-share"),
  locateBtn: $("locate-btn"),
  fsBtn: $("fs-btn"),
  zoomIn: $("zoom-in"),
  zoomOut: $("zoom-out"),
  toast: $("toast"),
};

/** @type {Map<string, any>} */
const byKey = new Map();
let selectedKey = null;
let geoLayer = null;
let wardLayer = null;
let meMarker = null;
let tdpExtra = {};
/** @type {any[]} */
let pois = [];

const map = L.map("map", { zoomControl: false, maxZoom: 20, zoomSnap: 0.5, attributionControl: true }).setView([21.01, 105.825], 14);

/* ---------- basemaps: vector street map (js/basemap.js) / Esri imagery ---------- */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const RASTER = {
  map: {
    url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    options: { maxZoom: 20, maxNativeZoom: 19, attribution: "Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, OpenStreetMap contributors" },
  },
  sat: {
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    options: { maxZoom: 20, maxNativeZoom: 19, attribution: "Tiles &copy; Esri" },
  },
};
const rasterLayer = (mode) => L.tileLayer(RASTER[mode].url, RASTER[mode].options);
let basemapMode = "map";
let basemapLayer = null;
let mountSeq = 0;

async function mountBasemap(mode) {
  const seq = ++mountSeq;
  basemapMode = mode;
  const sat = mode === "sat";
  el.layersBtn.setAttribute("aria-pressed", String(sat));
  el.layersBtn.setAttribute("aria-label", sat ? "Chuyển sang bản đồ" : "Chuyển sang vệ tinh");
  const layer = sat ? rasterLayer("sat") : await streetLayer(() => rasterLayer("map"));
  if (seq !== mountSeq) return; // a newer toggle won
  if (basemapLayer) map.removeLayer(basemapLayer);
  basemapLayer = layer.addTo(map);
  basemapLayer.bringToBack?.();
}
mountBasemap("map");
el.layersBtn.addEventListener("click", () => mountBasemap(basemapMode === "map" ? "sat" : "map"));

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function featureName(props) {
  // Source names are inconsistent ("Tổ dân phố 20" vs "Tổ dân phố số 2") — derive from the number
  if (props.to_dan_pho != null && props.to_dan_pho !== "") return `Tổ dân phố số ${props.to_dan_pho}`;
  return String(props.ten || props.name || props.ten_chi_tiet || props.to_dan_pho || `Mã ${props.maxa ?? ""}`).trim();
}

function isDongDaProps(props) {
  if (Number(props.maxa) === DONG_DA_MAXA) return true;
  const blob = foldVi([props.phuong, props.ten_chi_tiet, props.name, props.ten].filter(Boolean).join(" "));
  return blob.includes("dong da") && (blob.includes("phuong") || blob.includes("to dan"));
}

// One hue per tổ (index = số tổ - 1), same palette as the detail page
const TDP_COLORS = [
  "#1E88E5", "#43A047", "#8E24AA", "#E53935", "#FB8C00",
  "#00897B", "#F9A825", "#3949AB", "#7CB342", "#D81B60",
  "#5E35B1", "#00ACC1", "#EF6C00", "#C0CA33", "#EC407A",
  "#5C6BC0", "#FF7043", "#546E7A", "#9E9D24", "#26C6DA",
  "#FF8A65", "#8D6E63", "#66BB6A",
];
const colorForTdp = (num, i = 0) => TDP_COLORS[((Number.isFinite(Number(num)) && num != null ? Number(num) - 1 : i) + TDP_COLORS.length) % TDP_COLORS.length];
const baseStyle = (c) => ({ color: c, weight: 1.5, opacity: 1, fillColor: c, fillOpacity: 0.3, dashArray: null });
const selectedStyle = (c) => ({ color: "#3b0764", weight: 3, opacity: 1, fillColor: c, fillOpacity: 0.55, dashArray: "8 6" });


/** Toast with an optional action button (e.g. copy). */
function toast(msg, action) {
  el.toast.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.addEventListener("click", action.run);
    el.toast.appendChild(b);
  }
  el.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.toast.hidden = true), action ? 8000 : 2200);
}

/* ---------- selection + info card ---------- */
function mapPadding(withCard) {
  if (!withCard) return { paddingTopLeft: [24, 24], paddingBottomRight: [24, 24] };
  return MOBILE_MQ.matches
    ? { paddingTopLeft: [24, 24], paddingBottomRight: [24, 280] }
    : { paddingTopLeft: [40, 40], paddingBottomRight: [380, 40] };
}

function renderInfo({ props }) {
  const num = props.to_dan_pho;
  const extra = tdpExtra[String(num)] || {};
  const fmt = (v) => Number(v).toLocaleString("vi-VN");
  const counts = extra.ho_dan != null && extra.nhan_khau != null ? `${fmt(extra.ho_dan)} hộ dân · ${fmt(extra.nhan_khau)} nhân khẩu` : "";
  const phone = (p) => `<a class="lnk" href="tel:${String(p).replace(/\D/g, "")}">${escapeHtml(p)}</a>`;
  const person = (p, label) => (p?.ten
    ? `<div class="info-row"><small>${label}</small><span>${escapeHtml(p.ten)}</span>${p.dt ? phone(p.dt) : ""}</div>`
    : "");
  el.infoTitle.textContent = featureName(props);
  el.infoBody.innerHTML = [
    counts ? `<p class="info-count">${escapeHtml(counts)}</p>` : "",
    person(extra.bi_thu, "Bí thư chi bộ"),
    person(extra.to_truong, "Tổ trưởng"),
    person(extra.cskv, "Cảnh sát khu vực"),
    extra.dia_diem_sinh_hoat ? `<div class="info-row"><small>Nhà sinh hoạt cộng đồng</small><span>${escapeHtml(extra.dia_diem_sinh_hoat)}</span></div>` : "",
  ].join("");
  el.infoDetail.href = `to.html?n=${encodeURIComponent(String(num))}`;
  el.info.hidden = false;
  el.info.scrollTop = 0;
}

function focusOnLayer(layer, withCard = true) {
  const bounds = layer?.getBounds?.();
  if (!bounds?.isValid()) return;
  map.flyToBounds(bounds, { ...mapPadding(withCard), maxZoom: 18, duration: 0.4 });
}

function setSelection(key, { fly = true } = {}) {
  const entry = byKey.get(key);
  if (!entry) return clearSelection();
  selectedKey = key;
  byKey.forEach((e, k) => e.layer.setStyle(k === key ? selectedStyle(e.color) : baseStyle(e.color)));
  entry.layer.bringToFront();
  el.tdpSelect.value = key;
  document.body.classList.add("has-sel");
  renderInfo(entry);
  history.replaceState(null, "", `#tdp-${entry.props.to_dan_pho}`);
  if (fly) requestAnimationFrame(() => focusOnLayer(entry.layer));
}

function clearSelection() {
  selectedKey = null;
  byKey.forEach((e) => e.layer.setStyle(baseStyle(e.color)));
  el.tdpSelect.value = "";
  el.info.hidden = true;
  document.body.classList.remove("has-sel");
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

el.tdpSelect.addEventListener("change", () => setSelection(el.tdpSelect.value));
el.infoClose.addEventListener("click", clearSelection);
el.infoShare.addEventListener("click", () => {
  const e = byKey.get(selectedKey);
  if (e) shareLink(`${location.href.split("#")[0]}#tdp-${e.props.to_dan_pho}`, e.name, toast);
});

/* ---------- map tools ---------- */
let picking = false;
function setPicking(on) {
  picking = on;
  el.coordBtn.setAttribute("aria-pressed", String(on));
  map.getContainer().classList.toggle("picking", on);
  if (on) toast("Bấm vào bản đồ để lấy tọa độ");
}
el.coordBtn.addEventListener("click", () => setPicking(!picking));

function pickCoords({ lat, lng }) {
  const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  setPicking(false);
  toast(text, {
    label: "Sao chép",
    run: () => navigator.clipboard.writeText(text).then(() => toast("Đã sao chép tọa độ"), () => toast(text)),
  });
}

el.zoomIn.addEventListener("click", () => map.zoomIn());
el.zoomOut.addEventListener("click", () => map.zoomOut());
if (!document.documentElement.requestFullscreen) el.fsBtn.hidden = true; // e.g. iOS Safari
el.fsBtn.addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()));
el.locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) return toast("Trình duyệt không hỗ trợ định vị");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const ll = [coords.latitude, coords.longitude];
      const icon = L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18] });
      if (meMarker) meMarker.setLatLng(ll);
      else meMarker = L.marker(ll, { icon, interactive: false }).addTo(map);
      map.flyTo(ll, Math.max(map.getZoom(), 17), { duration: 0.5 });
    },
    () => toast("Không lấy được vị trí"),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

map.on("click", (e) => (picking ? pickCoords(e.latlng) : clearSelection()));
const syncZoomClasses = () => {
  const z = map.getZoom();
  const c = map.getContainer();
  c.classList.toggle("pois-far", z < 15);
  c.classList.toggle("labels-far", z < 15);
};
map.on("zoomend", syncZoomClasses);
syncZoomClasses();
window.addEventListener("resize", () => map.invalidateSize());

/* ---------- data ---------- */
async function loadTdpLayer() {
  const res = await fetch("data/to-dan-pho.geojson", { cache: "no-store" });
  if (!res.ok) return 0;
  const geo = await res.json();
  const use = (geo.features || [])
    .filter((f) => isDongDaProps(f.properties || {}))
    .sort((a, b) => Number(a.properties.to_dan_pho) - Number(b.properties.to_dan_pho));

  let i = 0;
  geoLayer = L.geoJSON({ type: "FeatureCollection", features: use }, {
    onEachFeature(feature, layer) {
      const idx = i++;
      const key = `tdp-${idx}`;
      const props = { ...(feature.properties || {}) };
      const name = featureName(props);
      const color = colorForTdp(props.to_dan_pho, idx);
      layer.setStyle(baseStyle(color));
      const text = props.to_dan_pho != null ? `Tổ dân phố ${props.to_dan_pho}` : name;
      layer.bindTooltip(`<span class="tag" style="border-left-color:${color}">${escapeHtml(text)}</span>`, {
        permanent: true, direction: "center", className: "poly-label", opacity: 1, interactive: false,
      });
      byKey.set(key, { key, feature, layer, props, name, color });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (picking) pickCoords(e.latlng);
        else setSelection(key);
      });
      const opt = new Option(name, key);
      el.tdpSelect.add(opt);
    },
  }).addTo(map);
  // Leaflet centres a polygon tooltip on the area centroid, which falls outside concave tổ (e.g. Tổ 18
  // sat inside Tổ 19). Re-open each label at the interior point farthest from the edge instead.
  byKey.forEach(({ feature, layer }) => {
    const [x, y] = polylabel(largestPolygon(feature.geometry));
    layer.openTooltip(L.latLng(y, x));
  });
  return byKey.size;
}

/** Rings of the polygon with the largest outer ring (MultiPolygon → its main part). */
function largestPolygon(geom) {
  const polys = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
  const area = (r) => Math.abs(r.reduce((a, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return a + x1 * y2 - x2 * y1; }, 0));
  return polys.reduce((best, p) => (area(p[0]) > area(best[0]) ? p : best));
}

async function loadPois() {
  const geo = await fetch("data/poi.geojson", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  pois = (geo?.features || []).filter((f) => POI_KINDS[f.properties?.kind]);
  pois.forEach((p) => {
    const [lng, lat] = p.geometry.coordinates;
    const icon = L.divIcon({ className: "", html: poiHtml(p.properties.kind), iconSize: [24, 24], iconAnchor: [12, 12] });
    p.marker = L.marker([lat, lng], { icon, title: p.properties.name, riseOnHover: true })
      .bindTooltip(escapeHtml(p.properties.name), { direction: "top", offset: [0, -12], className: "poi-tip" })
      .bindPopup(poiPopupHtml(p.properties), { className: "poi-pop", offset: [0, -8], maxWidth: 280 })
      .addTo(map);
  });
}

function poiPopupHtml(props) {
  return `<strong>${escapeHtml(props.name)}</strong><small>${POI_KINDS[props.kind].label}${props.to_dan_pho ? ` · Tổ dân phố ${props.to_dan_pho}` : ""}</small>${poiMetaHtml(props)}`;
}

function renderLegend() {
  const list = document.getElementById("legend-list");
  if (!list) return;
  if (MOBILE_MQ.matches) document.getElementById("legend").open = false; // keep the map clear on phones
  const present = new Set(pois.map((p) => p.properties.kind));
  list.insertAdjacentHTML("beforeend", Object.entries(POI_KINDS)
    .filter(([kind]) => present.has(kind))
    .map(([kind, k]) => `<li>${poiHtml(kind)}${k.label}</li>`).join(""));
}

async function fetchDongDaWard() {
  const geo = await fetch("data/hanoi.geojson", { cache: "no-store" }).then((r) => r.json());
  return (geo.features || []).find((f) => Number(f.properties?.maxa) === DONG_DA_MAXA) || null;
}

async function boot() {
  tdpExtra = await fetch("data/tdp-extra.json", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));

  const ward = await fetchDongDaWard().catch(() => null);
  if (ward) {
    wardLayer = L.geoJSON(ward, {
      interactive: false,
      style: { color: "#10b981", weight: 3, opacity: 0.9, fillColor: "#a7f3d0", fillOpacity: 0.25 },
    }).addTo(map);
  }
  const dongDaBounds = wardLayer?.getBounds();

  await loadTdpLayer().catch(() => 0);
  await loadPois();
  renderLegend();

  map.invalidateSize();
  // Fit the TDP polygons themselves (tighter than the ward outline in hanoi.geojson)
  const bounds = (geoLayer?.getBounds().isValid() && geoLayer.getBounds()) || (dongDaBounds?.isValid() && dongDaBounds);
  if (bounds) map.fitBounds(bounds, { ...mapPadding(false), maxZoom: 17, animate: false });

  const selectFromHash = () => {
    const hash = location.hash.match(/^#tdp-(.+)$/);
    const hit = hash && [...byKey.entries()].find(([, e]) => String(e.props?.to_dan_pho) === hash[1]);
    if (hit && hit[0] !== selectedKey) setSelection(hit[0]);
  };
  selectFromHash();
  window.addEventListener("hashchange", selectFromHash);

  // Expose for Playwright / manual QA
  window.__GEO_TEST__ = {
    map,
    byKey,
    pois,
    dongDaBounds,
    colorForTdp,
    getSelectedKey: () => selectedKey,
    selectByLabel(text) {
      const hit = [...byKey.entries()].find(([, e]) => (e.props?.ten || e.name || "").includes(text));
      if (!hit) throw new Error(`not found: ${text}`);
      setSelection(hit[0]);
      return hit[0];
    },
    awaitMoveEnd(timeoutMs = 4000) {
      return new Promise((resolve) => {
        const done = () => resolve({ zoom: map.getZoom(), center: map.getCenter(), bounds: map.getBounds() });
        const t = setTimeout(() => { map.off("moveend", onEnd); done(); }, timeoutMs);
        function onEnd() { clearTimeout(t); done(); }
        map.once("moveend", onEnd);
      });
    },
  };
}

boot().catch((err) => {
  console.error(err);
  toast("Không tải được dữ liệu. Chạy static server từ thư mục gốc project.");
});
