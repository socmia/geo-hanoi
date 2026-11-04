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
let mode = "tdp"; // tdp | wards

const map = L.map("map", { zoomControl: true }).setView([21.01, 105.825], 14);

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

/** Transparent outline — OSM remains readable */
function baseStyle() {
  return {
    color: "#9b1c1c",
    weight: 2,
    opacity: 0.9,
    fillColor: "#9b1c1c",
    fillOpacity: 0.04,
  };
}

function selectedStyle() {
  return {
    color: "#c45c00",
    weight: 2.5,
    opacity: 1,
    fillColor: "#f0a05a",
    fillOpacity: 0.12,
  };
}

function dimStyle() {
  return {
    color: "#9aa3ad",
    weight: 0.8,
    opacity: 0.35,
    fillColor: "#9aa3ad",
    fillOpacity: 0.02,
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

function setSelection(key, { fly = true } = {}) {
  selectedKey = key;
  byKey.forEach((entry, k) => {
    const active = k === key;
    entry.li.classList.toggle("active", active);
    if (!entry.visible) return;
    entry.layer?.setStyle?.(active ? selectedStyle() : baseStyle());
    if (active) entry.layer.bringToFront();
  });

  const entry = byKey.get(key);
  if (!entry) {
    el.detail.classList.remove("open");
    return;
  }
  renderDetail(entry.props);
  if (fly && entry.layer?.getBounds) {
    map.fitBounds(entry.layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
  }
  closeDrawer();
}

function clearSelection() {
  selectedKey = null;
  byKey.forEach((entry) => {
    entry.li.classList.remove("active");
    if (entry.visible) entry.layer?.setStyle?.(baseStyle());
  });
  el.detail.classList.remove("open");
}

function applyFilter(q) {
  const needle = foldVi(q);
  byKey.forEach((entry) => {
    const match = !needle || entry.searchBlob.includes(needle);
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
  if (geoLayer) {
    map.removeLayer(geoLayer);
    geoLayer = null;
  }
  byKey.clear();
  el.list.innerHTML = "";
  selectedKey = null;
  el.detail.classList.remove("open");
}

function addFeature(feature, extra, key, opts = {}) {
  const props = mergeProps(feature, extra);
  const name = featureName(props);
  const colorDot = opts.dot || "#9b1c1c";

  const li = document.createElement("li");
  li.innerHTML = `<i class="dot" style="background:${colorDot}"></i><span></span>`;
  li.querySelector("span").textContent = name;
  li.addEventListener("click", () => setSelection(key));
  el.list.appendChild(li);

  const searchBlob = foldVi([name, props.maxa, props.matinhxa, props.phuong].filter(Boolean).join(" "));

  return { props, name, li, searchBlob, visible: true };
}

async function loadTdpLayer(extra) {
  const res = await fetch("data/to-dan-pho.geojson", { cache: "no-store" });
  if (!res.ok) return null;
  const geo = await res.json();
  const all = geo.features || [];
  const features = all.filter((f) => isDongDaProps(f.properties || {}));
  // If file has features but none tagged Đống Đa, and all look like TDP, keep those with no phuong filter miss — prefer explicit filter
  const use = features.length ? features : all.filter((f) => {
    // empty file → nothing
    return false;
  });

  if (!use.length) return { count: 0, totalInFile: all.length };

  let i = 0;
  geoLayer = L.geoJSON({ type: "FeatureCollection", features: use }, {
    style: () => baseStyle(),
    onEachFeature(feature, layer) {
      const key = `tdp-${i++}`;
      const meta = addFeature(feature, extra, key);
      bindLabel(layer, meta.name, meta.props);
      layer.setStyle(baseStyle());
      byKey.set(key, { feature, layer, ...meta });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelection(key);
      });
    },
  }).addTo(map);

  return { count: byKey.size, totalInFile: all.length };
}

async function loadDongDaWardOnly(extra) {
  const geo = await fetch("data/hanoi.geojson", { cache: "no-store" }).then((r) => r.json());
  const features = (geo.features || []).filter((f) => Number(f.properties?.maxa) === DONG_DA_MAXA);
  let i = 0;
  geoLayer = L.geoJSON({ type: "FeatureCollection", features }, {
    style: () => baseStyle(),
    onEachFeature(feature, layer) {
      const key = `ward-${i++}`;
      const meta = addFeature(feature, extra, key);
      bindLabel(layer, meta.name, meta.props);
      layer.setStyle(baseStyle());
      byKey.set(key, { feature, layer, ...meta });
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelection(key);
      });
    },
  }).addTo(map);
}

async function boot() {
  const extra = await fetch("data/xa-extra.json", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({}));

  clearLayers();
  const tdp = await loadTdpLayer(extra).catch(() => null);

  if (tdp && tdp.count > 0) {
    mode = "tdp";
    el.cityUnits.textContent = `${tdp.count} tổ dân phố · Đống Đa`;
    el.layerNote.textContent = "Đang hiện Tổ dân phố thuộc phường Đống Đa (fill trong suốt).";
    el.search.placeholder = "Tìm tổ dân phố…";
  } else {
    mode = "ward-fallback";
    await loadDongDaWardOnly(extra);
    el.cityUnits.textContent = "Phường Đống Đa";
    const emptyMsg =
      tdp && tdp.totalInFile === 0
        ? "Chưa có dữ liệu Tổ dân phố. Thêm polygon vào data/to-dan-pho.geojson (lọc Đống Đa). Tạm hiện ranh phường."
        : "File to-dan-pho.geojson chưa có feature thuộc Đống Đa. Tạm hiện ranh phường.";
    el.layerNote.textContent = emptyMsg;
    el.search.placeholder = "Tìm…";
  }

  if (geoLayer?.getLayers?.().length) {
    map.fitBounds(geoLayer.getBounds(), { padding: [36, 36], maxZoom: 15 });
  }
  requestAnimationFrame(() => map.invalidateSize());
}

boot().catch((err) => {
  console.error(err);
  el.list.innerHTML =
    `<li style="padding:1rem;color:var(--son)">Không tải được dữ liệu. Chạy static server từ thư mục gốc project.</li>`;
});
