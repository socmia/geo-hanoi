import { foldVi } from "./normalize.js";

const CITY = {
  areaLabel: "3.359,8 km²",
  popLabel: "8.718.000",
};

const DONG_DA_MAXA = 922;

const KNOWN = new Set([
  "ten_chi_tiet",
  "dan_so",
  "dien_tich",
  "trung_tam_hc",
  "biThu",
  "chuTichUBND",
  "MTTQ",
  "sat_nhap_tu",
  "link",
  "maxa",
  "matinhxa",
  "ten",
  "name",
  "phuong",
  "to_dan_pho",
]);

const el = {
  list: document.getElementById("ward-list"),
  search: document.getElementById("search"),
  detail: document.getElementById("detail"),
  detailBody: document.getElementById("detail-body"),
  menuBtn: document.getElementById("menu-btn"),
  backdrop: document.getElementById("backdrop"),
  cityArea: document.getElementById("city-area"),
  cityPop: document.getElementById("city-pop"),
  cityUnits: document.getElementById("city-units"),
  layerNote: document.getElementById("layer-note"),
};

el.cityArea.textContent = CITY.areaLabel;
el.cityPop.textContent = CITY.popLabel;

/** @type {Map<string, any>} */
const byKey = new Map();
let selectedKey = null;
let geoLayer = null;
let maskLayer = null;
let wardLayer = null;
let mode = "tdp"; // tdp | wards

const map = L.map("map", {
  zoomControl: true,
  maxZoom: 20,
}).setView([21.01, 105.825], 14);

// tile.openstreetmap.org often returns empty images to some clients.
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const basemapCandidates = [
  {
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: OSM_ATTR },
  },
  {
    url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    options: { maxZoom: 20, subdomains: "abc", attribution: OSM_ATTR },
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    },
  },
];

let basemapIndex = 0;
let basemapErrors = 0;

function mountBasemap(i) {
  basemapIndex = i;
  basemapErrors = 0;
  const cfg = basemapCandidates[i];
  const layer = L.tileLayer(cfg.url, cfg.options);
  layer.on("tileerror", () => {
    basemapErrors += 1;
    if (basemapErrors < 4) return;
    if (basemapIndex + 1 >= basemapCandidates.length) return;
    map.removeLayer(layer);
    mountBasemap(basemapIndex + 1);
  });
  layer.addTo(map);
  return layer;
}

mountBasemap(0);

function featureName(props) {
  return String(
    props.ten || props.name || props.ten_chi_tiet || props.to_dan_pho || `Mã ${props.maxa ?? ""}`
  ).trim();
}

function isDongDaProps(props) {
  const maxa = Number(props.maxa);
  if (maxa === DONG_DA_MAXA) return true;
  const blob = foldVi([props.phuong, props.ten_chi_tiet, props.name, props.ten].filter(Boolean).join(" "));
  return blob.includes("dong da") && (blob.includes("phuong") || blob.includes("to dan"));
}

/** Mỗi tổ một màu — list dot + viền + fill transparent cùng hue */
const TDP_COLORS = [
  "#e53935", "#d81b60", "#8e24aa", "#5e35b1", "#3949ab",
  "#1e88e5", "#039be5", "#00acc1", "#00897b", "#43a047",
  "#7cb342", "#c0ca33", "#fdd835", "#ffb300", "#fb8c00",
  "#f4511e", "#6d4c41", "#546e7a", "#ec407a", "#ab47bc",
  "#42a5f5", "#26a69a", "#9ccc65",
];

function colorForTdp(num, index = 0) {
  if (num != null && Number.isFinite(Number(num))) {
    return TDP_COLORS[(Number(num) - 1 + TDP_COLORS.length) % TDP_COLORS.length];
  }
  return TDP_COLORS[index % TDP_COLORS.length];
}

function baseStyle(color) {
  return {
    color,
    weight: 2.5,
    opacity: 1,
    fillColor: color,
    fillOpacity: 0.28,
  };
}

/** Khi đang chọn 1 tổ: các tổ khác làm mờ */
function idleStyle(color) {
  return {
    color,
    weight: 1.5,
    opacity: 0.5,
    fillColor: color,
    fillOpacity: 0.08,
  };
}

function selectedStyle(color) {
  return {
    color,
    weight: 6,
    opacity: 1,
    fillColor: color,
    fillOpacity: 0.45,
  };
}

function maskStyle() {
  return {
    stroke: false,
    fillColor: "#1a1a1a",
    fillOpacity: 0.48,
    interactive: false,
  };
}

/** GeoJSON mask: thế giới có lỗ = địa giới phường → làm mờ ngoài Đống Đa */
function maskFeatureFromWard(wardFeature) {
  const WORLD = [
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90],
    [-180, 90],
  ];
  const geom = wardFeature.geometry;
  let outers = [];
  if (geom?.type === "Polygon") outers = [geom.coordinates[0]];
  else if (geom?.type === "MultiPolygon") outers = geom.coordinates.map((p) => p[0]);

  const holes = outers
    .filter((ring) => ring && ring.length >= 4)
    .map((ring) => {
      const hole = ring.map((c) => [...c]);
      // lỗ cần chiều ngược outer (GeoJSON)
      hole.reverse();
      return hole;
    });

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [WORLD, ...holes] },
  };
}

function formatPop(v) {
  if (v == null || v === "") return "—";
  const n = Number(String(v).replace(/\s/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("vi-VN");
}

function mergeProps(feature, extra) {
  const base = { ...(feature.properties || {}) };
  const maxa = String(base.maxa ?? "");
  return { ...base, ...(extra[maxa] || {}) };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function shortLabel(props, name) {
  const n = props.to_dan_pho;
  if (n != null && n !== "") return `Tổ ${n}`;
  return name.replace(/^Tổ dân phố\s*(số\s*)?/i, "Tổ ").trim() || name;
}

function bindLabel(layer, name, props = {}) {
  layer.bindTooltip(shortLabel(props, name), {
    permanent: true,
    direction: "center",
    className: "poly-label",
    opacity: 1,
  });
}

function renderDetail(props) {
  const name = featureName(props);
  const extras = Object.entries(props).filter(
    ([k, v]) => !KNOWN.has(k) && v != null && v !== "" && typeof v !== "object"
  );

  const hasWardMeta = props.dan_so != null || props.dien_tich != null;

  el.detailBody.innerHTML = `
    <div class="detail-hd">
      <h2>${escapeHtml(name)}</h2>
      <button type="button" class="close" id="detail-close-inner" aria-label="Đóng">×</button>
    </div>
    ${
      hasWardMeta
        ? `<div class="metrics">
      <div><small>Dân số</small><b>${escapeHtml(formatPop(props.dan_so))}</b></div>
      <div><small>Diện tích (km²)</small><b>${escapeHtml(String(props.dien_tich ?? "—"))}</b></div>
    </div>`
        : ""
    }
    ${
      props.trung_tam_hc
        ? `<div class="block"><div class="label">Trụ sở</div>${escapeHtml(props.trung_tam_hc)}</div>`
        : ""
    }
    ${
      props.biThu || props.chuTichUBND || props.MTTQ
        ? `<div class="block">
      <div class="label">Lãnh đạo</div>
      <div class="leaders">
        <div><span>Bí thư</span><strong>${escapeHtml(props.biThu || "—")}</strong></div>
        <div><span>Chủ tịch UBND</span><strong>${escapeHtml(props.chuTichUBND || "—")}</strong></div>
        <div><span>MTTQ</span><strong>${escapeHtml(props.MTTQ || "—")}</strong></div>
      </div>
    </div>`
        : ""
    }
    <div class="block">
      ${props.sat_nhap_tu ? `<div class="label">Sáp nhập từ</div><p class="merge">${escapeHtml(props.sat_nhap_tu)}</p>` : ""}
      ${extras
        .map(
          ([k, v]) =>
            `<div class="extra-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`
        )
        .join("")}
    </div>
    ${
      props.link
        ? `<a class="link" href="${escapeAttr(props.link)}" target="_blank" rel="noopener">Trang tin ${escapeHtml(name)}</a>`
        : ""
    }
  `;
  document.getElementById("detail-close-inner")?.addEventListener("click", clearSelection);
  el.detail.classList.add("open");
}

function focusOnLayer(layer) {
  if (!layer?.getBounds) return;
  const bounds = layer.getBounds();
  if (!bounds.isValid()) return;

  // Card chi tiết đè lên map (absolute) — không trừ 300px padding phải
  // (trước đây làm flyToBounds zoom tụt, tổ chỉ chiếm ~1/5 màn hình).
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const pad = mobile ? L.point(20, 72) : L.point(28, 28);
  const zoom = Math.min(map.getBoundsZoom(bounds, false, pad), map.getMaxZoom());
  map.flyTo(bounds.getCenter(), zoom, { duration: 0.45 });
}

function setSelection(key, { fly = true } = {}) {
  selectedKey = key;
  byKey.forEach((entry, k) => {
    const active = k === key;
    entry.li.classList.toggle("active", active);
    if (!entry.visible) return;
    const c = entry.color;
    entry.layer?.setStyle?.(active ? selectedStyle(c) : idleStyle(c));
    if (active) entry.layer.bringToFront();
  });

  const entry = byKey.get(key);
  if (!entry) {
    el.detail.classList.remove("open");
    return;
  }
  renderDetail(entry.props);
  if (fly) focusOnLayer(entry.layer);
  closeDrawer();
}

function clearSelection() {
  selectedKey = null;
  byKey.forEach((entry) => {
    entry.li.classList.remove("active");
    if (entry.visible) entry.layer?.setStyle?.(baseStyle(entry.color));
  });
  el.detail.classList.remove("open");
}

function matchesSearch(blob, query) {
  const needle = foldVi(query);
  if (!needle) return true;
  // Mỗi token phải khớp; số phải đúng số (tránh "1" khớp "10")
  return needle.split(/\s+/).filter(Boolean).every((tok) => {
    if (/^\d+$/.test(tok)) {
      return new RegExp(`(?:^|\\D)${tok}(?:\\D|$)`).test(blob);
    }
    return blob.includes(tok);
  });
}

function applyFilter(q) {
  byKey.forEach((entry) => {
    const match = matchesSearch(entry.searchBlob, q);
    entry.li.classList.toggle("hidden", !entry.visible || !match);
  });
}

function openDrawer() {
  document.body.classList.add("drawer-open");
  el.menuBtn.setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  document.body.classList.remove("drawer-open");
  el.menuBtn.setAttribute("aria-expanded", "false");
}

el.menuBtn.addEventListener("click", () => {
  if (document.body.classList.contains("drawer-open")) closeDrawer();
  else openDrawer();
});
el.backdrop.addEventListener("click", closeDrawer);

el.search.addEventListener("input", () => applyFilter(el.search.value));
el.search.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const first = [...byKey.entries()].find(([, x]) => !x.li.classList.contains("hidden"));
  if (first) setSelection(first[0]);
});

map.on("click", () => clearSelection());
window.addEventListener("resize", () => map.invalidateSize());

function clearLayers() {
  [geoLayer, maskLayer, wardLayer].forEach((layer) => {
    if (layer) map.removeLayer(layer);
  });
  geoLayer = null;
  maskLayer = null;
  wardLayer = null;
  byKey.clear();
  el.list.innerHTML = "";
  selectedKey = null;
  el.detail.classList.remove("open");
}

async function fetchDongDaWard() {
  const geo = await fetch("data/hanoi.geojson", { cache: "no-store" }).then((r) => r.json());
  return (geo.features || []).find((f) => Number(f.properties?.maxa) === DONG_DA_MAXA) || null;
}

/** Chỉ mask ngoài Đống Đa — không vẽ polygon phường */
function applyDongDaMask(wardFeature) {
  if (!wardFeature) return null;
  maskLayer = L.geoJSON(maskFeatureFromWard(wardFeature), {
    style: maskStyle,
    interactive: false,
  }).addTo(map);
  // bounds ẩn để fit lúc load (không vẽ ranh phường)
  wardLayer = L.geoJSON(wardFeature, {
    style: { opacity: 0, fillOpacity: 0, interactive: false },
    interactive: false,
  });
  // không addTo(map) — chỉ lấy bounds
  return wardLayer.getBounds();
}

function addFeature(feature, extra, key, opts = {}) {
  const props = mergeProps(feature, extra);
  const name = featureName(props);
  const colorDot = opts.dot || colorForTdp(props.to_dan_pho);

  const li = document.createElement("li");
  li.innerHTML = `<i class="dot" style="background:${colorDot}"></i><span></span>`;
  li.querySelector("span").textContent = name;
  li.addEventListener("click", () => setSelection(key));
  el.list.appendChild(li);

  const searchBlob = foldVi([name, props.maxa, props.matinhxa, props.phuong].filter(Boolean).join(" "));

  return { props, name, li, searchBlob, visible: true, color: colorDot };
}

async function loadTdpLayer(extra) {
  const res = await fetch("data/to-dan-pho.geojson", { cache: "no-store" });
  if (!res.ok) return null;
  const geo = await res.json();
  const all = geo.features || [];
  const use = all.filter((f) => isDongDaProps(f.properties || {}));
  if (!use.length) return { count: 0, totalInFile: all.length };

  let i = 0;
  geoLayer = L.geoJSON({ type: "FeatureCollection", features: use }, {
    style(feature) {
      return baseStyle(colorForTdp(feature.properties?.to_dan_pho, i));
    },
    onEachFeature(feature, layer) {
      const idx = i++;
      const key = `tdp-${idx}`;
      const color = colorForTdp(feature.properties?.to_dan_pho, idx);
      const meta = addFeature(feature, extra, key, { dot: color });
      bindLabel(layer, meta.name, meta.props);
      layer.setStyle(baseStyle(color));
      byKey.set(key, { feature, layer, ...meta, color });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelection(key);
      });
    },
  }).addTo(map);

  return { count: byKey.size, totalInFile: all.length };
}

async function boot() {
  const extra = await fetch("data/xa-extra.json", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({}));

  clearLayers();

  const ward = await fetchDongDaWard().catch(() => null);
  const dongDaBounds = applyDongDaMask(ward);

  const tdp = await loadTdpLayer(extra).catch(() => null);

  if (tdp && tdp.count > 0) {
    mode = "tdp";
    el.cityUnits.textContent = `${tdp.count} tổ dân phố · Đống Đa`;
    el.layerNote.textContent =
      "Các tổ dân phố Đống Đa (mỗi tổ một màu). Ngoài phường bị làm mờ.";
    el.search.placeholder = "Tìm tổ dân phố…";
  } else {
    mode = "ward-fallback";
    el.cityUnits.textContent = "Phường Đống Đa";
    el.layerNote.textContent =
      "Chưa có Tổ dân phố trong data/to-dan-pho.geojson.";
    el.search.placeholder = "Tìm…";
  }

  const bounds =
    (dongDaBounds?.isValid?.() && dongDaBounds) ||
    (geoLayer?.getBounds?.().isValid?.() && geoLayer.getBounds());
  if (bounds) {
    const pad = L.point(28, 28);
    const zoom = Math.min(map.getBoundsZoom(bounds, false, pad), map.getMaxZoom());
    map.fitBounds(bounds, { padding: [pad.x, pad.y], maxZoom: zoom });
  }
  requestAnimationFrame(() => map.invalidateSize());

  // Expose for Playwright / manual QA
  window.__GEO_TEST__ = {
    map,
    byKey,
    dongDaBounds,
    colorForTdp,
    getSelectedKey: () => selectedKey,
    selectByLabel(text) {
      const hit = [...byKey.entries()].find(([, e]) =>
        (e.props?.ten || e.name || "").includes(text)
      );
      if (!hit) throw new Error(`not found: ${text}`);
      setSelection(hit[0]);
      return hit[0];
    },
    awaitMoveEnd() {
      return new Promise((resolve) => {
        map.once("moveend", () => resolve({
          zoom: map.getZoom(),
          center: map.getCenter(),
          bounds: map.getBounds(),
        }));
      });
    },
  };
}

boot().catch((err) => {
  console.error(err);
  el.list.innerHTML =
    `<li style="padding:1rem;color:var(--son)">Không tải được dữ liệu. Chạy static server từ thư mục gốc project.</li>`;
});
