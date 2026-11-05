"""Generate docs/phuong-dong-da-23-tdp.md from data/tdp-extra.json (stdlib only)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
d = json.loads((ROOT / "data" / "tdp-extra.json").read_text(encoding="utf-8"))
fmt = lambda n: f"{n:,}".replace(",", ".")
cell = lambda s: str(s).replace("|", "\\|")
who = lambda p: f"{cell(p['ten'])} – {p['dt']}" if p and p.get("ten") else "Đang cập nhật"
tos = sorted((k for k in d if not k.startswith("_")), key=int)
ph = d["_phuong"]

L = ["# Phường Đống Đa – 23 tổ dân phố", "", "## Liên hệ cấp phường", ""]
u, t = ph["ubnd"], ph["tiep_cong_dan"]
L += [f"- **{u['ten']}**: {u['dia_chi']}",
      f"  - Điện thoại: {', '.join(u['dien_thoai'])}", f"  - Email: {u['email']}",
      f"- **{t['ten']}**: {t['dia_chi']}", f"  - Điện thoại: {', '.join(t['dien_thoai'])}", ""]
L += ["## Nhà sinh hoạt cộng đồng số", "", d["_chung"]["gioi_thieu"], ""]
L += ["## Tổng hợp", "", "| Tổ | Hộ dân | Nhân khẩu | Nhà sinh hoạt cộng đồng |", "|---:|---:|---:|---|"]
L += [f"| {k} | {fmt(d[k]['ho_dan'])} | {fmt(d[k]['nhan_khau'])} | {cell(d[k]['dia_diem_sinh_hoat'])} |" for k in tos]
L += [f"| **Tổng** | **{fmt(sum(d[k]['ho_dan'] for k in tos))}** | **{fmt(sum(d[k]['nhan_khau'] for k in tos))}** | |", ""]
L += ["## Danh bạ", "", "| Tổ | Bí thư chi bộ | Tổ trưởng | Cảnh sát khu vực |", "|---:|---|---|---|"]
L += [f"| {k} | {who(d[k].get('bi_thu'))} | {who(d[k].get('to_truong'))} | {who(d[k].get('cskv'))} |" for k in tos]
L += ["", "## Ghi chú", ""]
notes = [f"- Tổ {k}: {d[k]['ghi_chu']}" for k in tos if d[k].get("ghi_chu")]
L += notes or ["- Không có."]
out = ROOT / "docs" / "phuong-dong-da-23-tdp.md"
out.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"wrote {out.name} ({len(tos)} to)")
