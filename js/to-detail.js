// Detail page for one tổ dân phố: to.html?n=<to_dan_pho>
import { shareLink } from "./share.js";
import { POI_KINDS, poiHtml, poiMetaHtml } from "./poi-kinds.js";
import { streetLayer } from "./basemap.js";

const TDP_COLORS = [
  "#1E88E5", "#43A047", "#8E24AA", "#E53935", "#FB8C00",
  "#00897B", "#F9A825", "#3949AB", "#7CB342", "#D81B60",
  "#5E35B1", "#00ACC1", "#EF6C00", "#C0CA33", "#EC407A",
  "#5C6BC0", "#FF7043", "#546E7A", "#9E9D24", "#26C6DA",
  "#FF8A65", "#8D6E63", "#66BB6A",
];

const ICON = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  home: '<path d="M3 10l9-6 9 6M5 9v11h14V9M10 20v-6h4v6"/>',
  note: '<path d="M4 5h16M4 12h16M4 19h10"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

function colorForTdp(num) {
  if (num != null && Number.isFinite(Number(num))) {
    return TDP_COLORS[(Number(num) - 1 + TDP_COLORS.length) % TDP_COLORS.length];
  }
  return TDP_COLORS[0];
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paramN() {
  const n = new URLSearchParams(location.search).get("n");
  return n == null || n === "" ? null : String(n);
}

/** Planar area (m²) on a local equirectangular projection — fine at ward scale. */
function areaM2(geometry) {
  const R = 6371008.8;
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let total = 0;
  for (const poly of polys) {
    poly.forEach((ring, i) => {
      const lat0 = (ring.reduce((s, c) => s + c[1], 0) / ring.length) * (Math.PI / 180);
      const pts = ring.map(([x, y]) => [x * (Math.PI / 180) * R * Math.cos(lat0), y * (Math.PI / 180) * R]);
      let a = 0;
      for (let j = 0; j < pts.length; j++) {
        const [x1, y1] = pts[j];
        const [x2, y2] = pts[(j + 1) % pts.length];
        a += x1 * y2 - x2 * y1;
      }
      total += (i === 0 ? 1 : -1) * Math.abs(a / 2); // holes subtract
    });
  }
  return total;
}

function formatArea(m2) {
  return `≈ ${(m2 / 10000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2200);
}

function contactRow(icon, value, label) {
  return `<div class="row">${svg(icon)}<span class="row-text">${
    value ? escapeHtml(value) : '<span class="muted">Đang cập nhật</span>'
  }<small>${escapeHtml(label)}</small></span></div>`;
}

const phoneLink = (p) => `<a class="lnk" href="tel:${String(p).replace(/\D/g, "")}">${escapeHtml(p)}</a>`;

/** Person row: name + role label + tel link; "Đang cập nhật" when the name is missing. */
function personRow(p, label) {
  if (!p?.ten) return contactRow("user", "", label);
  return `<div class="row">${svg("user")}<span class="row-text"><span>${escapeHtml(p.ten)}</span><small>${escapeHtml(label)}</small>${p.dt ? phoneLink(p.dt) : ""}</span></div>`;
}

function mountMiniMap(geo, feature, color, inTdp) {
  const map = L.map("mini-map", {
    zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, tap: false, zoomSnap: 0.25,
  });
  streetLayer(() => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 20, maxNativeZoom: 16, attribution: "© OpenStreetMap · Esri",
  })).then((layer) => layer.addTo(map).bringToBack?.());
  L.geoJSON(geo, {
    interactive: false,
    filter: (f) => f !== feature,
    style: (f) => ({ color: "#fff", weight: 1.5, fillColor: colorForTdp(f.properties?.to_dan_pho), fillOpacity: 0.14 }),
  }).addTo(map);
  const sel = L.geoJSON(feature, {
    interactive: false,
    style: { color: "#D93025", weight: 3, dashArray: "8 6", fillColor: color, fillOpacity: 0.35 },
  }).addTo(map);
  inTdp.forEach((p) => {
    const [lng, lat] = p.geometry.coordinates;
    L.marker([lat, lng], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: "map-poi", html: poiHtml(p.properties.kind), iconSize: [24, 24], iconAnchor: [12, 12] }),
    }).addTo(map);
  });
  map.fitBounds(sel.getBounds(), { padding: [28, 28], maxZoom: 18 });
}

async function boot() {
  const root = document.getElementById("page");
  const status = document.getElementById("status");
  const n = paramN();

  if (n == null) {
    status.textContent = "Thiếu tham số ?n= (số tổ dân phố).";
    return;
  }

  const [geo, extra, poiGeo] = await Promise.all([
    fetch("data/to-dan-pho.geojson", { cache: "no-store" }).then((r) => r.json()),
    fetch("data/tdp-extra.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch("data/poi.geojson", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const features = geo.features || [];
  const feature = features.find((f) => String(f.properties?.to_dan_pho) === n);
  if (!feature) {
    status.textContent = `Không tìm thấy tổ dân phố số ${n}.`;
    return;
  }

  const props = feature.properties || {};
  const num = props.to_dan_pho ?? n;
  const more = extra[n] || extra[String(Number(n))] || {};
  const name = `Tổ dân phố số ${num}`; // source "ten" is inconsistent ("Tổ dân phố 20")
  const color = colorForTdp(num);
  const mapHref = `index.html#tdp-${encodeURIComponent(n)}`;
  const inTdp = (poiGeo?.features || []).filter(
    (p) => POI_KINDS[p.properties?.kind] && String(p.properties.to_dan_pho) === String(num)
  );
  const sections = Array.isArray(more.sections) ? more.sections.filter((s) => s && (s.title || s.body)) : [];
  const fmt = (v) => Number(v).toLocaleString("vi-VN");
  const stat = (v, label) => `<div class="stat"><strong>${v == null || v === "" ? '<em>Đang cập nhật</em>' : escapeHtml(String(v))}</strong><span>${label}</span></div>`;
  const area = areaM2(feature.geometry);
  const statsHtml = stat(area ? formatArea(area) : null, "Diện tích") + stat(more.ho_dan != null ? fmt(more.ho_dan) : null, "Hộ dân") + stat(more.nhan_khau != null ? fmt(more.nhan_khau) : null, "Nhân khẩu");
  const intro = more.gioi_thieu || more.mo_ta_dai || extra._chung?.gioi_thieu;
  const { ubnd, tiep_cong_dan: tcd } = extra._phuong || {};
  const org = (o, extraHtml = "") => o
    ? `<div class="row">${svg("pin")}<span class="row-text"><span>${escapeHtml(o.ten || "")}</span><small>${escapeHtml(o.dia_chi || "")}</small>${(o.dien_thoai || []).map(phoneLink).join("")}${extraHtml}</span></div>`
    : "";
  const introHtml = [
    intro ? escapeHtml(intro) : "",
    ...sections.map((s) => `<h3>${escapeHtml(s.title || "")}</h3>${escapeHtml(s.body || "")}`),
  ].filter(Boolean).join("\n");

  document.title = `${name} · Phường Đống Đa`;
  document.getElementById("back-link").href = mapHref;

  root.innerHTML = `
    <div class="col-main">
      <section class="card hero">
        <div class="mini-map" id="mini-map" role="img" aria-label="Bản đồ ranh giới ${escapeHtml(name)}"></div>
        <div class="hero-body">
          <div>
            <h1>${escapeHtml(name)}</h1>
            <p class="hero-sub">Tổ dân phố · Phường ${escapeHtml(props.phuong || "Đống Đa")}, Hà Nội</p>
          </div>
          <div class="stats">${statsHtml}</div>
          <div class="actions">
            <a class="btn btn-primary" href="${escapeHtml(mapHref)}">${svg("pin")}Xem trên bản đồ</a>
            <button type="button" class="btn" id="share-btn">${svg("share")}Chia sẻ</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Giới thiệu</h2>
        ${introHtml ? `<div class="prose">${introHtml}</div>` : '<p class="muted">Thông tin giới thiệu về tổ đang được cập nhật.</p>'}
      </section>

      <div class="contact-grid">
        <section class="card rows">
          <h2>Liên hệ</h2>
          ${personRow(more.bi_thu, "Bí thư chi bộ")}
          ${personRow(more.to_truong, "Tổ trưởng")}
          ${personRow(more.cskv, "Cảnh sát khu vực")}
          ${contactRow("home", more.dia_diem_sinh_hoat, "Nhà sinh hoạt cộng đồng")}
          ${more.lien_he ? contactRow("phone", more.lien_he, "Liên hệ") : ""}
          ${more.ghi_chu ? `<div class="row">${svg("note")}<span class="row-text">${escapeHtml(more.ghi_chu)}<small>Ghi chú</small></span></div>` : ""}
        </section>
        <section class="card rows">
          <h2>UBND phường</h2>
          ${org(ubnd, ubnd?.email ? `<a class="lnk" href="mailto:${escapeHtml(ubnd.email)}">${escapeHtml(ubnd.email)}</a>` : "")}
          ${org(tcd)}
          ${!(ubnd || tcd) ? '<p class="muted pad">Thông tin đang được cập nhật.</p>' : ""}
        </section>
      </div>
    </div>

    <aside class="col-side">
      <section class="card places" id="places">
        <h2>Địa điểm trong tổ</h2>
        ${inTdp.length
          ? inTdp.map((p) => `<div class="place">${poiHtml(p.properties.kind)}<span class="place-text"><span>${escapeHtml(p.properties.name)}</span><small>${POI_KINDS[p.properties.kind].label}</small><span class="place-meta">${poiMetaHtml(p.properties)}</span></span></div>`).join("")
          : '<p class="muted">Chưa ghi nhận địa điểm nào trong tổ này.</p>'}
      </section>
    </aside>
  `;

  document.getElementById("share-btn").addEventListener("click", () => shareLink(location.href, name, toast));

  mountMiniMap(geo, feature, color, inTdp);
}

boot().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Không tải được dữ liệu.";
});
