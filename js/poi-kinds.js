// POI kinds shared by the map page and the detail page (data/poi.geojson "kind").
export const POI_KINDS = {
  community: { label: "Nhà sinh hoạt cộng đồng", icon: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>' },
  school: { label: "Trường học", icon: '<path d="M3 10l9-4 9 4-9 4z"/><path d="M7 12v4c3 2 7 2 10 0v-4"/>' },
  health: { label: "Y tế", icon: '<path d="M12 5v14M5 12h14"/>' },
  office: { label: "Công sở", icon: '<path d="M6 20V4h12v16M10 8h1M13 8h1M10 12h1M13 12h1M11 20v-3h2v3"/>' },
  worship: { label: "Đình, chùa, nhà thờ", icon: '<path d="M3 9h18l-3-4H6z"/><path d="M6 9v11M18 9v11M4 20h16M10 20v-5h4v5"/>' },
  heritage: { label: "Di tích", icon: '<path d="M12 3l3 5H9z"/><path d="M10 8v10M14 8v10M6 21h12M8 18h8"/>' },
  social: { label: "Chăm sóc người cao tuổi", icon: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>' },
};

export const poiHtml = (kind) =>
  `<span class="poi poi--${kind}"><svg viewBox="0 0 24 24" aria-hidden="true">${POI_KINDS[kind].icon}</svg></span>`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Address, phone, email, website and "approximate position" note for one POI, as small HTML lines. */
export function poiMetaHtml(p) {
  const lines = [];
  if (p.address) lines.push(`<span>${esc(p.address)}</span>`);
  if (p.phone) lines.push(`<a href="tel:${esc(p.phone.replace(/[^\d+]/g, ""))}">${esc(p.phone)}</a>`);
  if (p.email) lines.push(`<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`);
  if (p.website) lines.push(`<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, ""))}</a>`);
  if (p.approx) lines.push('<em>Vị trí gần đúng theo địa chỉ</em>');
  return lines.join("");
}
