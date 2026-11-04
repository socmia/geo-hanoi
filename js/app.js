import { foldVi } from "./normalize.js";
import { shareLink } from "./share.js";

const DONG_DA_MAXA = 922;
const MOBILE_MQ = window.matchMedia("(max-width: 768px)");

const el = {
  list: document.getElementById("ward-list"),
  listView: document.getElementById("list-view"),
  listEmpty: document.getElementById("list-empty"),
  search: document.getElementById("search"),
  searchForm: document.getElementById("search-form"),
  searchClear: document.getElementById("search-clear"),
  detail: document.getElementById("detail"),
  detailBody: document.getElementById("detail-body"),
  cityUnits: document.getElementById("city-units"),
  panelTab: document.getElementById("panel-tab"),
  sheetHandle: document.getElementById("sheet-handle"),
  chips: document.getElementById("chips"),
  layersBtn: document.getElementById("layers-btn"),
  layersThumb: document.getElementById("layers-thumb"),
  layersLabel: document.getElementById("layers-label"),
  locateBtn: document.getElementById("locate-btn"),
  zoomIn: document.getElementById("zoom-in"),
  zoomOut: document.getElementById("zoom-out"),
  toast: document.getElementById("toast"),
};

/** @type {Map<string, any>} */
const byKey = new Map();
let selectedKey = null;
let geoLayer = null;
let wardLayer = null;
let pinMarker = null;
let meMarker = null;
let tdpExtra = {};
/** @type {any[]} */
let pois = [];
const poiLayers = {};

const map = L.map("map", { zoomControl: false, maxZoom: 20, zoomSnap: 0.5, attributionControl: true }).setView([21.01, 105.825], 14);

/* ---------- basemaps ---------- */
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI_ATTR = "Tiles &copy; Esri";
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const BASEMAPS = {
  map: {
    label: "Bản đồ",
    thumb: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/15/14425/26016`,
    candidates: [
      { url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 20, maxNativeZoom: 16, attribution: ESRI_ATTR } },
      { url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png", options: { maxZoom: 19, attribution: OSM_ATTR } },
      { url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 19, attribution: ESRI_ATTR } },
    ],
  },
  sat: {
    label: "Vệ tinh",
    thumb: `${ESRI}/World_Imagery/MapServer/tile/15/14425/26016`,
    candidates: [
      { url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, options: { maxZoom: 20, maxNativeZoom: 19, attribution: ESRI_ATTR } },
    ],
  },
};
let basemapMode = "map";
let basemapLayer = null;

function mountBasemap(mode, i = 0) {
  const cfg = BASEMAPS[mode].candidates[i];
  if (basemapLayer) map.removeLayer(basemapLayer);
  let errors = 0;
  const layer = L.tileLayer(cfg.url, cfg.options);
  layer.on("tileerror", () => {
    errors += 1;
    if (errors < 4 || i + 1 >= BASEMAPS[mode].candidates.length || basemapLayer !== layer) return;
    mountBasemap(mode, i + 1);
  });
  basemapLayer = layer.addTo(map);
  basemapLayer.bringToBack();
  basemapMode = mode;
  const other = mode === "map" ? "sat" : "map";
  el.layersThumb.style.backgroundImage = `url("${BASEMAPS[other].thumb}")`;
  el.layersLabel.textContent = BASEMAPS[other].label;
  el.layersBtn.setAttribute("aria-label", `Chuyển sang ${BASEMAPS[other].label.toLowerCase()}`);
  document.body.classList.toggle("basemap-sat", mode === "sat");
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

const TDP_COLORS = [
  "#1E88E5", "#43A047", "#8E24AA", "#E53935", "#FB8C00",
  "#00897B", "#F9A825", "#3949AB", "#7CB342", "#D81B60",
  "#5E35B1", "#00ACC1", "#EF6C00", "#C0CA33", "#EC407A",
  "#5C6BC0", "#FF7043", "#546E7A", "#9E9D24", "#26C6DA",
  "#FF8A65", "#8D6E63", "#66BB6A",
];

function colorForTdp(num, index = 0) {
  if (num != null && Number.isFinite(Number(num))) {
    return TDP_COLORS[(Number(num) - 1 + TDP_COLORS.length) % TDP_COLORS.length];
  }
  return TDP_COLORS[index % TDP_COLORS.length];
}

function rgba(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const baseStyle = (c) => ({ color: "#ffffff", weight: 2, opacity: 1, fillColor: c, fillOpacity: 0.3, dashArray: null });
const idleStyle = (c) => ({ color: "#ffffff", weight: 1.5, opacity: 0.8, fillColor: c, fillOpacity: 0.16, dashArray: null });
const selectedStyle = (c) => ({ color: "#D93025", weight: 4, opacity: 1, fillColor: c, fillOpacity: 0.42, dashArray: "8 6" });

const ICON = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  list: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  zoom: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
};
const svg = (name, cls = "") => `<svg ${cls ? `class="${cls}" ` : ""}viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

const POI_KINDS = {
  school: { label: "Trường học", icon: '<path d="M3 10l9-4 9 4-9 4z"/><path d="M7 12v4c3 2 7 2 10 0v-4"/>' },
  health: { label: "Y tế", icon: '<path d="M12 5v14M5 12h14"/>' },
  office: { label: "Công sở", icon: '<path d="M6 20V4h12v16M10 8h1M13 8h1M10 12h1M13 12h1M11 20v-3h2v3"/>' },
};
const poiHtml = (kind) => `<span class="poi poi--${kind}"><svg viewBox="0 0 24 24" aria-hidden="true">${POI_KINDS[kind].icon}</svg></span>`;

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.toast.hidden = true), 2200);
}

/** Mini SVG of a polygon's shape for the detail hero. */
function shapeSvg(feature, color) {
  const g = feature.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const k = Math.cos((21.01 * Math.PI) / 180);
  const pts = polys.flatMap((p) => p[0]).map(([x, y]) => [x * k, -y]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const s = 1000 / Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
  const d = polys
    .map((p) => "M" + p[0].map(([x, y]) => `${((x * k - x0) * s).toFixed(1)},${((-y - y0) * s).toFixed(1)}`).join(" ") + "Z")
    .join("");
  const w = (Math.max(...xs) - x0) * s, h = (Math.max(...ys) - y0) * s;
  return `<svg class="shape" viewBox="-30 -30 ${w + 60} ${h + 60}" role="img" aria-label="Hình dạng ranh giới">
    <path d="${d}" fill="${rgba(color, 0.28)}" stroke="${color}" stroke-width="${(w + h) / 260}" stroke-linejoin="round"/></svg>`;
}

/* ---------- layout state ---------- */
function mapPadding() {
  if (MOBILE_MQ.matches) {
    const sheet = el.detail.closest(".panel").getBoundingClientRect().height;
    return { paddingTopLeft: [24, 190], paddingBottomRight: [24, sheet + 24] };
  }
  const left = document.body.classList.contains("panel-collapsed") ? 0 : 408;
  return { paddingTopLeft: [left + 40, 70], paddingBottomRight: [80, 40] };
}

function setCollapsed(collapsed) {
  document.body.classList.toggle("panel-collapsed", collapsed);
  el.panelTab.setAttribute("aria-expanded", String(!collapsed));
  el.panelTab.setAttribute("aria-label", collapsed ? "Mở bảng bên" : "Thu gọn bảng bên");
}
el.panelTab.addEventListener("click", () => setCollapsed(!document.body.classList.contains("panel-collapsed")));

/* ---------- mobile bottom sheet: drag between peek / half / full ---------- */
const SHEET_STATES = ["peek", "half", "full"];
let sheetState = "half";

function setSheet(state) {
  sheetState = state;
  document.body.classList.toggle("sheet-peek", state === "peek");
  document.body.classList.toggle("sheet-full", state === "full");
  document.body.style.removeProperty("--sheet-h");
  el.sheetHandle.setAttribute("aria-label", state === "full" ? "Thu nhỏ bảng" : "Mở rộng bảng");
  el.sheetHandle.setAttribute("aria-expanded", String(state !== "peek"));
}

function sheetHeights() {
  const panel = el.detail.closest(".panel");
  const probe = (cls) => {
    const prev = sheetState;
    setSheet(cls);
    const h = panel.getBoundingClientRect().height;
    setSheet(prev);
    return h;
  };
  return { peek: probe("peek"), half: probe("half"), full: probe("full") };
}

(function initSheetDrag() {
  const panel = el.detail.closest(".panel");
  let drag = null;
  panel.addEventListener("pointerdown", (e) => {
    if (!MOBILE_MQ.matches) return;
    const grip = e.target.closest(".sheet-handle, .list-hd, .d-head");
    if (!grip || e.target.closest("button:not(.sheet-handle), a, input")) return;
    drag = { y0: e.clientY, h0: panel.getBoundingClientRect().height, moved: false, id: e.pointerId };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      document.body.classList.add("sheet-dragging"); // no transition, so probes read final heights
      drag.snaps = sheetHeights();
    }
    const h = Math.min(drag.snaps.full, Math.max(drag.snaps.peek, drag.h0 - dy));
    document.body.style.setProperty("--sheet-h", `${h}px`);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    document.body.classList.remove("sheet-dragging");
    const h = panel.getBoundingClientRect().height;
    const flick = e.clientY - d.y0;
    let next = SHEET_STATES.reduce((a, b) => (Math.abs(d.snaps[b] - h) < Math.abs(d.snaps[a] - h) ? b : a));
    // a quick flick moves one step even if it didn't pass the midpoint
    if (next === sheetState && Math.abs(flick) > 40) {
      const i = SHEET_STATES.indexOf(sheetState) + (flick > 0 ? -1 : 1);
      next = SHEET_STATES[Math.max(0, Math.min(2, i))];
    }
    setSheet(next);
    el.sheetHandle.dataset.dragged = "1";
    setTimeout(() => delete el.sheetHandle.dataset.dragged, 0);
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
})();

el.sheetHandle.addEventListener("click", () => {
  if (el.sheetHandle.dataset.dragged) return;
  // tap cycles: peek → half → full → half
  setSheet(sheetState === "peek" ? "half" : sheetState === "half" ? "full" : "half");
});

/* ---------- detail ---------- */
function renderDetail(entry) {
  const { props, color, feature } = entry;
  const name = featureName(props);
  const num = props.to_dan_pho;
  const extra = tdpExtra[String(num)] || {};
  const detailHref = num != null && num !== "" ? `to.html?n=${encodeURIComponent(String(num))}` : null;
  const inTdp = pois.filter((p) => p.properties.to_dan_pho === num);
  const sections = Array.isArray(extra.sections) ? extra.sections.filter((s) => s && (s.title || s.body)) : [];
  const introHtml = [
    extra.gioi_thieu ? escapeHtml(extra.gioi_thieu) : "",
    ...sections.map((s) => `<h4>${escapeHtml(s.title || "")}</h4>${escapeHtml(s.body || "")}`),
  ].filter(Boolean).join("\n");

  el.detailBody.innerHTML = `
    <div class="d-hero">
      ${shapeSvg(feature, color)}
      <button type="button" class="d-back" data-act="back" aria-label="Quay lại danh sách">${svg("back")}</button>
    </div>
    <div class="d-head">
      <div>
        <h2>${escapeHtml(name)}</h2>
        <p>Tổ dân phố · Phường ${escapeHtml(props.phuong || "Đống Đa")}, Hà Nội</p>
      </div>
      <button type="button" class="d-close-m" data-act="back" aria-label="Đóng">${svg("close")}</button>
    </div>
    <div class="detail-actions">
      ${detailHref ? `<a class="act btn-primary" href="${escapeHtml(detailHref)}"><span class="act-ic">${svg("list")}</span>Chi tiết</a>` : ""}
      <button type="button" class="act" data-act="zoom"><span class="act-ic">${svg("zoom")}</span>Phóng tới</button>
      <button type="button" class="act" data-act="share"><span class="act-ic">${svg("share")}</span>Chia sẻ</button>    </div>
    <div class="tabs" role="tablist">
      <button type="button" class="tab" role="tab" id="tab-ov" aria-controls="tp-ov" aria-selected="true">Tổng quan</button>
      <button type="button" class="tab" role="tab" id="tab-in" aria-controls="tp-in" aria-selected="false">Giới thiệu</button>
      <button type="button" class="tab" role="tab" id="tab-ct" aria-controls="tp-ct" aria-selected="false">Liên hệ</button>
    </div>
    <div class="tab-panel" id="tp-ov" role="tabpanel" aria-labelledby="tab-ov">
      <div class="row">${svg("pin")}<span class="row-text">Phường ${escapeHtml(props.phuong || "Đống Đa")}, Hà Nội</span></div>
      ${props.mo_ta ? `<div class="row">${svg("layers")}<span class="row-text">${escapeHtml(props.mo_ta)}<small>Gộp từ các tổ cũ</small></span></div>` : ""}
      ${extra.ghi_chu ? `<div class="row">${svg("list")}<span class="row-text">${escapeHtml(extra.ghi_chu)}<small>Ghi chú</small></span></div>` : ""}    </div>
    <div class="tab-panel" id="tp-in" role="tabpanel" aria-labelledby="tab-in" hidden>
      ${introHtml ? `<div class="prose">${introHtml}</div>` : `<p class="prose muted">Chưa có giới thiệu cho tổ này.</p>`}
    </div>
    <div class="tab-panel" id="tp-ct" role="tabpanel" aria-labelledby="tab-ct" hidden>
      ${extra.lien_he ? `<div class="row">${svg("phone")}<span class="row-text">${escapeHtml(extra.lien_he)}</span></div>` : `<div class="row">${svg("user")}<span class="row-text"><span class="muted">Chưa cập nhật thông tin liên hệ.</span></span></div>`}
    </div>
    <section class="d-sec"><h3>Địa điểm trong tổ</h3>
      ${inTdp.length
        ? `<ul class="poi-list">${inTdp.map((p) => `<li data-poi-idx="${pois.indexOf(p)}">${poiHtml(p.properties.kind)}<span>${escapeHtml(p.properties.name)}</span></li>`).join("")}</ul>`
        : '<p class="d-empty">Chưa ghi nhận trường học, cơ sở y tế hay công sở nào trong tổ này.</p>'}
    </section>
  `;
  el.detail.hidden = false;
  el.listView.hidden = true;
  el.detail.scrollTop = 0;
}

el.detailBody.addEventListener("click", async (e) => {
  const t = /** @type {HTMLElement} */ (e.target);
  const act = t.closest("[data-act]")?.getAttribute("data-act");
  const tab = t.closest(".tab");
  const poiLi = t.closest("[data-poi-idx]");
  if (act === "back") clearSelection();
  else if (act === "zoom") focusOnLayer(byKey.get(selectedKey)?.layer);
  else if (act === "share") {
    const url = location.href.split("#")[0] + `#tdp-${byKey.get(selectedKey)?.props.to_dan_pho}`;
    await shareLink(url, byKey.get(selectedKey)?.name || document.title, toast);
  } else if (tab) {
    el.detailBody.querySelectorAll(".tab").forEach((b) => {
      const on = b === tab;
      b.setAttribute("aria-selected", String(on));
      document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
    });
  } else if (poiLi) {
    const p = pois[Number(poiLi.getAttribute("data-poi-idx"))];
    const [lng, lat] = p.geometry.coordinates;
    if (MOBILE_MQ.matches) setSheet("peek"); // uncover the map so the place is visible
    map.flyTo([lat, lng], Math.max(map.getZoom(), 18), { duration: 0.4 });
    p.marker?.openTooltip();
  }
});

function focusOnLayer(layer) {
  if (!layer?.getBounds) return;
  const bounds = layer.getBounds();
  if (!bounds.isValid()) return;
  map.flyToBounds(bounds, { ...mapPadding(), maxZoom: 18, duration: 0.4 });
}

function setPin(latlng) {
  const icon = L.divIcon({
    className: "pin",
    html: '<svg width="30" height="42" viewBox="-15 -42 30 42" aria-hidden="true"><path d="M0,0 C-3,-9 -14,-17 -14,-28 A14,14 0 1 1 14,-28 C14,-17 3,-9 0,0Z" fill="#EA4335" stroke="#B31412"/><circle cx="0" cy="-28" r="5" fill="#B31412"/></svg>',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
  if (pinMarker) pinMarker.setLatLng(latlng);
  else pinMarker = L.marker(latlng, { icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
}

function setSelection(key, { fly = true } = {}) {
  const entry = byKey.get(key);
  if (!entry) return clearSelection();
  selectedKey = key;
  byKey.forEach((e, k) => {
    const active = k === key;
    e.li.classList.toggle("active", active);
    e.layer.setStyle(active ? selectedStyle(e.color) : idleStyle(e.color));
  });
  entry.layer.bringToFront();
  document.body.classList.add("has-sel");
  setSheet("half");
  renderDetail(entry);
  setPin(entry.layer.getCenter());
  history.replaceState(null, "", `#tdp-${entry.props.to_dan_pho}`);
  if (fly) requestAnimationFrame(() => focusOnLayer(entry.layer));
}

function clearSelection() {
  selectedKey = null;
  byKey.forEach((e) => {
    e.li.classList.remove("active");
    e.layer.setStyle(baseStyle(e.color));
  });
  document.body.classList.remove("has-sel");
  if (sheetState === "full") setSheet("half");
  el.detail.hidden = true;
  el.listView.hidden = false;
  if (pinMarker) { map.removeLayer(pinMarker); pinMarker = null; }
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

/* ---------- search ---------- */
/**
 * Every token must match. A number matches the tổ number as a prefix ("2" → 2, 20–23),
 * or an old tổ number in mo_ta exactly ("38" → the tổ merged from 38, not 38A).
 */
function matchesSearch(entry, query) {
  const needle = foldVi(query);
  if (!needle) return true;
  const num = String(entry.props.to_dan_pho ?? "");
  return needle.split(/\s+/).filter(Boolean).every((tok) => {
    if (/^\d+[a-z]?$/.test(tok)) {
      return num.startsWith(tok) || new RegExp(`(?:^|\\D)${tok}(?:[^\\da-z]|$)`).test(entry.extraBlob);
    }
    return entry.searchBlob.includes(tok);
  });
}

function applyFilter(q) {
  let shown = 0;
  byKey.forEach((entry) => {
    const match = matchesSearch(entry, q);
    entry.li.classList.toggle("hidden", !match);
    if (match) shown += 1;
  });
  el.listEmpty.hidden = shown > 0;
  el.cityUnits.textContent = q.trim() ? `${shown} kết quả` : `${byKey.size} tổ dân phố · Đống Đa`;
  el.searchClear.hidden = !q;
}

el.search.addEventListener("input", () => {
  if (selectedKey) clearSelection();
  applyFilter(el.search.value);
});
el.searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const first = [...byKey.entries()].find(([, x]) => !x.li.classList.contains("hidden"));
  if (first) setSelection(first[0]);
  el.search.blur();
});
el.searchClear.addEventListener("click", () => {
  el.search.value = "";
  applyFilter("");
  el.search.focus();
});

/* ---------- chips & controls ---------- */
el.chips.addEventListener("click", (e) => {
  const chip = /** @type {HTMLElement} */ (e.target).closest(".chip");
  if (!chip) return;
  const on = chip.getAttribute("aria-pressed") !== "true";
  chip.setAttribute("aria-pressed", String(on));
  const kind = chip.dataset.poi;
  if (kind && poiLayers[kind]) on ? poiLayers[kind].addTo(map) : map.removeLayer(poiLayers[kind]);
  if (chip.dataset.layer === "tdp" && geoLayer) on ? geoLayer.addTo(map) : map.removeLayer(geoLayer);
});

el.zoomIn.addEventListener("click", () => map.zoomIn());
el.zoomOut.addEventListener("click", () => map.zoomOut());
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

map.on("click", () => clearSelection());
const syncPoiZoom = () => map.getContainer().classList.toggle("pois-far", map.getZoom() < 15);
map.on("zoomend", syncPoiZoom);
syncPoiZoom();
window.addEventListener("resize", () => map.invalidateSize());

/* ---------- data ---------- */
function bindLabel(layer, props) {
  layer.bindTooltip(props.to_dan_pho != null ? `TDP số ${props.to_dan_pho}` : featureName(props), {
    permanent: true, direction: "center", className: "poly-label", opacity: 1, interactive: false,
  });
  const sync = () => layer.getTooltip()?.getElement?.()?.classList.toggle("poly-label--dim", map.getZoom() < 15);
  layer.on("add", () => { sync(); map.on("zoomend", sync); });
  layer.on("remove", () => map.off("zoomend", sync));
}

function addListItem(key, props, name, color) {
  const li = document.createElement("li");
  li.setAttribute("role", "button");
  li.tabIndex = 0;
  li.innerHTML = `<span class="tdp-thumb" style="background:${rgba(color, 0.22)};border-color:${color}">${escapeHtml(String(props.to_dan_pho ?? ""))}</span>
    <span class="li-text"><span class="li-name"></span><span class="li-sub"></span></span>${svg("chev", "chev")}`;
  li.querySelector(".li-name").textContent = name;
  li.querySelector(".li-sub").textContent = props.mo_ta || `Phường ${props.phuong || "Đống Đa"}, Hà Nội`;
  li.addEventListener("click", () => setSelection(key));
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelection(key); }
  });
  el.list.appendChild(li);
  return li;
}

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
      bindLabel(layer, props);
      const li = addListItem(key, props, name, color);
      const searchBlob = foldVi([name, props.phuong, props.mo_ta].filter(Boolean).join(" "));
      const extraBlob = foldVi(props.mo_ta || "");
      byKey.set(key, { key, feature, layer, props, name, li, searchBlob, extraBlob, color });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelection(key);
      });
    },
  }).addTo(map);
  return byKey.size;
}

async function loadPois() {
  const geo = await fetch("data/poi.geojson", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  pois = (geo?.features || []).filter((f) => POI_KINDS[f.properties?.kind]);
  Object.keys(POI_KINDS).forEach((kind) => {
    poiLayers[kind] = L.layerGroup().addTo(map);
  });
  pois.forEach((p) => {
    const [lng, lat] = p.geometry.coordinates;
    const kind = p.properties.kind;
    const icon = L.divIcon({ className: "", html: poiHtml(kind), iconSize: [24, 24], iconAnchor: [12, 12] });
    p.marker = L.marker([lat, lng], { icon, title: p.properties.name, riseOnHover: true })
      .bindTooltip(escapeHtml(p.properties.name), { direction: "top", offset: [0, -12], className: "poi-tip" })
      .addTo(poiLayers[kind]);
  });
}

async function fetchDongDaWard() {
  const geo = await fetch("data/hanoi.geojson", { cache: "no-store" }).then((r) => r.json());
  return (geo.features || []).find((f) => Number(f.properties?.maxa) === DONG_DA_MAXA) || null;
}

async function boot() {
  tdpExtra = await fetch("data/tdp-extra.json", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));

  const ward = await fetchDongDaWard().catch(() => null);
  if (ward) wardLayer = L.geoJSON(ward, { interactive: false, style: { opacity: 0, fillOpacity: 0 } });
  const dongDaBounds = wardLayer?.getBounds();

  const count = await loadTdpLayer().catch(() => 0);
  el.cityUnits.textContent = count ? `${count} tổ dân phố · Đống Đa` : "Phường Đống Đa";
  await loadPois();

  map.invalidateSize();
  // Fit the TDP polygons themselves (tighter than the ward outline in hanoi.geojson)
  const bounds = (geoLayer?.getBounds().isValid() && geoLayer.getBounds()) || (dongDaBounds?.isValid() && dongDaBounds);
  if (bounds) map.fitBounds(bounds, { ...mapPadding(), maxZoom: 17, animate: false });

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
  el.list.innerHTML = `<li style="color:var(--mute)">Không tải được dữ liệu. Chạy static server từ thư mục gốc project.</li>`;
});
