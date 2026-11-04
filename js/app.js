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

// Carto CDN đòi API key → Esri Light Gray (miễn phí). Overscale sau z16.
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI_ATTR = "Tiles &copy; Esri";
const basemapCandidates = [
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 20, maxNativeZoom: 16, attribution: ESRI_ATTR },
  },
  {
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: OSM_ATTR },
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 19, attribution: ESRI_ATTR },
  },
];

let basemapIndex = 0;
let basemapErrors = 0;
/** @type {L.TileLayer | null} */
let basemapLayer = null;

function mountBasemap(i) {
  basemapIndex = i;
  basemapErrors = 0;
  const cfg = basemapCandidates[i];
  if (basemapLayer) map.removeLayer(basemapLayer);
  const layer = L.tileLayer(cfg.url, cfg.options);
  basemapLayer = layer;
  layer.on("tileerror", () => {
    basemapErrors += 1;
    if (basemapErrors < 4) return;
    if (basemapIndex + 1 >= basemapCandidates.length) return;
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

/** Màu bão hòa — dễ tách trên nền xám nhạt */
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

function darkenHex(hex, amount = 0.35) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function baseStyle(color) {
  return {
    color: "#ffffff",
    weight: 3,
    opacity: 1,
    fillColor: color,
    fillOpacity: 0.72,
  };
}

/** Khi đang chọn 1 tổ: các tổ khác làm mờ */
function idleStyle(color) {
  return {
    color: "#ffffff",
    weight: 2,
    opacity: 0.85,
    fillColor: color,
    fillOpacity: 0.32,
  };
}

function selectedStyle(color) {
  return {
    color: "#111111",
    weight: 5,
    opacity: 1,
    fillColor: color,
    fillOpacity: 0.88,
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
  const tip = layer.getTooltip();
  const syncLabelZoom = () => {
    const elTip = tip?.getElement?.();
    if (!elTip) return;
    elTip.classList.toggle("poly-label--dim", map.getZoom() < 15);
  };
  layer.on("add", () => {
    syncLabelZoom();
    map.on("zoomend", syncLabelZoom);
  });
  layer.on("remove", () => map.off("zoomend", syncLabelZoom));
}

function renderDetail(props) {
  const name = featureName(props);
  const extras = Object.entries(props).filter(
    ([k, v]) =>
      !KNOWN.has(k) &&
      k !== "mo_ta" &&
      k !== "nguon" &&
      k !== "mid" &&
      v != null &&
      v !== "" &&
      typeof v !== "object"
  );

  const hasWardMeta = props.dan_so != null || props.dien_tich != null;
  const tdpNum = props.to_dan_pho;
  const detailHref =
    tdpNum != null && tdpNum !== "" ? `to.html?n=${encodeURIComponent(String(tdpNum))}` : null;

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
      props.phuong
        ? `<div class="block"><div class="label">Phường</div>${escapeHtml(props.phuong)}</div>`
        : ""
    }
    ${
      props.mo_ta
        ? `<div class="block"><div class="label">Ghi chú bản đồ</div><p class="merge">${escapeHtml(props.mo_ta)}</p></div>`
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
    ${
      props.sat_nhap_tu || extras.length
        ? `<div class="block">
      ${props.sat_nhap_tu ? `<div class="label">Sáp nhập từ</div><p class="merge">${escapeHtml(props.sat_nhap_tu)}</p>` : ""}
      ${extras
        .map(
          ([k, v]) =>
            `<div class="extra-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong></div>`
        )
        .join("")}
    </div>`
        : ""
    }
    <div class="detail-actions">
      ${
        detailHref
          ? `<a class="btn btn-primary" href="${escapeAttr(detailHref)}">Xem chi tiết tổ</a>`
          : ""
      }
      ${
        props.link
          ? `<a class="btn btn-ghost" href="${escapeAttr(props.link)}" target="_blank" rel="noopener">Trang tin ${escapeHtml(name)}</a>`
          : ""
      }
    </div>
  `;
  document.getElementById("detail-close-inner")?.addEventListener("click", clearSelection);
  el.detail.classList.add("open");
}

function focusOnLayer(layer) {
  if (!layer?.getBounds) return;
  const bounds = layer.getBounds();
  if (!bounds.isValid()) return;

  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const pad = mobile ? [48, 24] : [36, 36];
  map.flyToBounds(bounds, {
    padding: pad,
    maxZoom: 18,
    duration: 0.4,
  });
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

/** Bounds phường để fit lúc load — không vẽ polygon / mask tối (style như ảnh tham chiếu) */
function boundsFromWard(wardFeature) {
  if (!wardFeature) return null;
  wardLayer = L.geoJSON(wardFeature, {
    style: { opacity: 0, fillOpacity: 0, interactive: false },
    interactive: false,
  });
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
  const dongDaBounds = boundsFromWard(ward);

  const tdp = await loadTdpLayer(extra).catch(() => null);

  if (tdp && tdp.count > 0) {
    mode = "tdp";
    el.cityUnits.textContent = `${tdp.count} tổ dân phố · Đống Đa`;
    el.layerNote.textContent =
      "Bản đồ tổ dân phố Đống Đa — mỗi tổ một màu (kiểu bản đồ hành chính).";
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

  const hash = location.hash.match(/^#tdp-(.+)$/);
  if (hash) {
    const n = hash[1];
    const hit = [...byKey.entries()].find(([, e]) => String(e.props?.to_dan_pho) === n);
    if (hit) setSelection(hit[0], { fly: true });
  }

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
    awaitMoveEnd(timeoutMs = 4000) {
      return new Promise((resolve) => {
        const done = () =>
          resolve({
            zoom: map.getZoom(),
            center: map.getCenter(),
            bounds: map.getBounds(),
          });
        const t = setTimeout(() => {
          map.off("moveend", onEnd);
          done();
        }, timeoutMs);
        function onEnd() {
          clearTimeout(t);
          done();
        }
        map.once("moveend", onEnd);
      });
    },
  };
}

boot().catch((err) => {
  console.error(err);
  el.list.innerHTML =
    `<li style="padding:1rem;color:var(--mute)">Không tải được dữ liệu. Chạy static server từ thư mục gốc project.</li>`;
});
