const TDP_COLORS = [
  "#1E88E5", "#43A047", "#8E24AA", "#E53935", "#FB8C00",
  "#00897B", "#F9A825", "#3949AB", "#7CB342", "#D81B60",
  "#5E35B1", "#00ACC1", "#EF6C00", "#C0CA33", "#EC407A",
  "#5C6BC0", "#FF7043", "#546E7A", "#9E9D24", "#26C6DA",
  "#FF8A65", "#8D6E63", "#66BB6A",
];

function colorForTdp(num) {
  if (num != null && Number.isFinite(Number(num))) {
    return TDP_COLORS[(Number(num) - 1 + TDP_COLORS.length) % TDP_COLORS.length];
  }
  return TDP_COLORS[0];
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paramN() {
  const n = new URLSearchParams(location.search).get("n");
  return n == null || n === "" ? null : String(n);
}

function emptyCard(title, hint) {
  return `<section class="card"><h2>${escapeHtml(title)}</h2><p class="empty">${escapeHtml(hint)}</p></section>`;
}

function sectionCard(title, body) {
  if (!body) return emptyCard(title, "Chưa có nội dung — bổ sung trong data/tdp-extra.json");
  return `<section class="card"><h2>${escapeHtml(title)}</h2><div class="body">${escapeHtml(body)}</div></section>`;
}

async function boot() {
  const root = document.getElementById("page");
  const status = document.getElementById("status");
  const n = paramN();

  if (n == null) {
    status.textContent = "Thiếu tham số ?n= (số tổ dân phố).";
    return;
  }

  const [geo, extra] = await Promise.all([
    fetch("data/to-dan-pho.geojson", { cache: "no-store" }).then((r) => r.json()),
    fetch("data/tdp-extra.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
  ]);

  const feature = (geo.features || []).find(
    (f) => String(f.properties?.to_dan_pho) === n
  );

  if (!feature) {
    status.textContent = `Không tìm thấy tổ dân phố số ${n}.`;
    return;
  }

  const props = feature.properties || {};
  const more = extra[n] || extra[String(Number(n))] || {};
  const name = props.ten || `Tổ dân phố số ${n}`;
  const color = colorForTdp(props.to_dan_pho);
  const mapHref = `index.html#tdp-${encodeURIComponent(n)}`;

  document.title = `${name} · Đống Đa`;

  const sections = Array.isArray(more.sections) ? more.sections : [];
  const sectionHtml = sections.length
    ? sections
        .map((s) => sectionCard(s.title || "Mục", s.body || ""))
        .join("")
    : [
        sectionCard("Giới thiệu", more.gioi_thieu || more.mo_ta_dai || ""),
        sectionCard("Liên hệ", more.lien_he || ""),
        sectionCard("Ghi chú", more.ghi_chu || ""),
      ].join("");

  root.innerHTML = `
    <div class="topbar">
      <a class="back" href="index.html">← Bản đồ</a>
      <a class="btn btn-ghost" href="${escapeHtml(mapHref)}" style="min-height:36px;padding:0 0.85rem;font-size:0.85rem">Mở trên bản đồ</a>
    </div>
    <header class="hero">
      <div class="hero-swatch" style="background:${escapeHtml(color)}" aria-hidden="true"></div>
      <div>
        <h1>${escapeHtml(name)}</h1>
        <p>Phường ${escapeHtml(props.phuong || "Đống Đa")} · Tổ ${escapeHtml(String(props.to_dan_pho ?? n))}</p>
      </div>
    </header>
    <section class="card">
      <h2>Thông tin bản đồ</h2>
      <div class="kv">
        <div><span>Số tổ</span><strong>${escapeHtml(String(props.to_dan_pho ?? n))}</strong></div>
        <div><span>Phường</span><strong>${escapeHtml(props.phuong || "—")}</strong></div>
        <div><span>Mã xã</span><strong>${escapeHtml(String(props.maxa ?? "—"))}</strong></div>
        ${
          props.mo_ta
            ? `<div><span>Ghi chú KML</span><strong>${escapeHtml(props.mo_ta)}</strong></div>`
            : ""
        }
      </div>
    </section>
    ${sectionHtml}
  `;
}

boot().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Không tải được dữ liệu.";
});
