"""
Parse hoá đơn GTGT dạng PDF điện tử -> file Excel.

Cách dùng:
    python invoice_to_excel.py <file hoặc thư mục> [...] [-o ket_qua.xlsx]

Chỉ đọc PDF có lớp chữ (hoá đơn điện tử tải về) bằng pdfplumber: miễn phí, offline,
không cần API key. PDF scan (chỉ là ảnh) sẽ được báo trong sheet Loi.

Kết quả Excel gồm 3 sheet:
    ChiTiet : mỗi dòng hàng 1 dòng (kèm thông tin hoá đơn) -> dùng làm data đầu vào
    HoaDon  : mỗi hoá đơn 1 dòng (người bán, người mua, tổng tiền, kiểm tra tổng)
    Loi     : các file lỗi / cảnh báo
"""
from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

import pdfplumber
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

PDF_EXT = {".pdf"}

# ---------------------------------------------------------------- helpers


def norm(s: str | None) -> str:
    """Bỏ dấu, lower, gộp khoảng trắng -> dùng để so khớp tiêu đề cột/khoá."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"\s+", " ", s).strip().lower()


def norm_same_len(s: str) -> str:
    """Như norm() nhưng giữ nguyên độ dài chuỗi (mỗi ký tự NFC -> 1 ký tự) để dùng lại chỉ số."""
    out = []
    for c in s:
        base = [x for x in unicodedata.normalize("NFD", c) if unicodedata.category(x) != "Mn"]
        b = base[0] if base else " "
        out.append("d" if b in "đĐ" else b.lower())
    return "".join(out)


def clean(s) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def to_number(s):
    """'11.333,33' -> 11333.33 ; '595.000' -> 595000 ; '' -> None."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return s
    t = clean(s).replace(" ", "")
    if not t:
        return None
    neg = t.startswith("(") and t.endswith(")") or t.startswith("-")
    t = t.strip("()-")
    if not re.fullmatch(r"[\d.,]+", t):
        return None
    if "," in t:  # kiểu VN: . nghìn , thập phân
        t = t.replace(".", "").replace(",", ".")
    elif t.count(".") >= 1 and re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")
    try:
        v = float(t)
    except ValueError:
        return None
    v = -v if neg else v
    return int(v) if v.is_integer() else round(v, 4)


def to_rate(s):
    """'5%' -> 5 ; 'KCT' -> 'KCT'."""
    t = clean(s)
    if not t:
        return None
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*%?", t)
    if m:
        return to_number(m.group(1))
    return t


def to_date(s):
    t = clean(s)
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%y"):
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    return t or None


# ---------------------------------------------------------------- cột bảng hàng hoá

# key nội bộ -> các cách viết tiêu đề (đã norm) có thể gặp
COLUMN_SYNONYMS = {
    "stt": ["stt", "tt", "so tt", "no"],
    "ma_hang": ["ma hang", "ma hh", "ma sp", "ma vat tu", "ma hang hoa"],
    "ten_hang": ["ten hang hoa, dich vu", "ten hang hoa dich vu", "ten hang", "ten hang hoa", "ten san pham", "dien giai"],
    "so_lo": ["so lo", "lo", "lo sx", "so lo sx"],
    "han_dung": ["han dung", "hsd", "han su dung", "date"],
    "dvt": ["don vi tinh", "dvt", "don vi"],
    "so_luong": ["so luong", "sl"],
    "don_gia": ["don gia", "gia"],
    "thue_suat": ["thue suat gtgt", "thue suat", "ts", "% thue"],
    "tien_thue": ["tien thue gtgt", "tien thue", "thue gtgt"],
    "thanh_tien": ["thanh tien", "thanh tien sau thue", "tong tien", "thanh tien truoc thue"],
}


def map_header(row) -> dict[str, int] | None:
    cols = {}
    for i, cell in enumerate(row):
        n = norm(cell)
        if not n:
            continue
        for key, syns in COLUMN_SYNONYMS.items():
            if key in cols:
                continue
            if n in syns:
                cols[key] = i
                break
    if "ten_hang" in cols and ("thanh_tien" in cols or "so_luong" in cols):
        return cols
    return None


# ---------------------------------------------------------------- header (người bán / người mua)

SELLER_KEYS = {
    "don vi ban hang": "ten_ncc",
    "ma so thue": "mst_ncc",
    "dia chi xuat kho": "dia_chi_xuat_kho",
    "dia chi": "dia_chi_ncc",
    "so tai khoan": "stk_ncc",
    "email": "email_ncc",
    "dien thoai": "dt_ncc",
    "fax": "fax_ncc",
    "ma dat hang": "ma_dat_hang",
    "ma don hang": "ma_don_hang",
}
BUYER_KEYS = {
    "ho ten nguoi mua hang": "nguoi_mua",
    "ten don vi": "ten_don_vi_mua",
    "dia chi": "dia_chi_mua",
    "ma so thue": "mst_mua",
    "hinh thuc thanh toan": "httt",
    "so tai khoan": "stk_mua",
}


def parse_kv_lines(lines: list[str], keymap: dict[str, str]) -> dict[str, str]:
    """Dòng dạng 'Khoá : giá trị  Khoá2 : giá trị2'. Dòng không có khoá = nối vào khoá trước."""
    out: dict[str, str] = {}
    keys_sorted = sorted(keymap, key=len, reverse=True)
    last = None
    for line in lines:
        src = unicodedata.normalize("NFC", line)
        nline = norm_same_len(src)
        # tìm tất cả vị trí khoá trong dòng
        hits = []
        for k in keys_sorted:
            pat = r"(?:^|\s)(" + r"\s+".join(map(re.escape, k.split())) + r")\s*(?:\([^)]*\))?\s*:"
            for m in re.finditer(pat, nline):
                s = m.start(1)
                if any(h[0] <= s < h[1] for h in hits):
                    continue
                hits.append((s, m.end(), k))
        hits.sort()
        if not hits:
            if last and src.strip():
                out[last] = (out.get(last, "") + " " + src.strip()).strip()
            continue
        for i, (s, e, k) in enumerate(hits):
            end = hits[i + 1][0] if i + 1 < len(hits) else len(src)
            val = src[e:end].strip(" :")
            field = keymap[k]
            if field not in out or not out[field]:
                out[field] = val
            last = field
    return out


def group_lines(words) -> list[str]:
    lines: list[list] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) < 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [" ".join(x["text"] for x in sorted(ln, key=lambda w: w["x0"])) for ln in lines]


def parse_parties(page) -> dict[str, str]:
    seller_hit = page.search(r"Đơn vị bán hàng\s*:")
    buyer_hit = page.search(r"Họ tên người mua hàng")
    stt_hit = page.search(r"\bSTT\b")
    if not seller_hit or not buyer_hit:
        return {}
    y0 = seller_hit[0]["top"] - 2
    y1 = stt_hit[0]["top"] - 1 if stt_hit else page.height
    xb = buyer_hit[0]["x0"] - 1
    words = [w for w in page.extract_words(use_text_flow=False) if y0 <= w["top"] < y1]
    left = [w for w in words if w["x0"] < xb]
    right = [w for w in words if w["x0"] >= xb]
    info = parse_kv_lines(group_lines(left), SELLER_KEYS)
    info.update(parse_kv_lines(group_lines(right), BUYER_KEYS))
    return info


def parse_parties_fallback(text: str) -> dict[str, str]:
    """Khi không tách được 2 cột: lấy theo thứ tự xuất hiện."""
    info = {}
    m = re.search(r"Đơn vị bán hàng\s*:\s*(.+)", text)
    if m:
        info["ten_ncc"] = m.group(1).strip()
    msts = re.findall(r"Mã số thuế\s*(?:\([^)]*\))?\s*:\s*([\d\-\s]{9,20})", text)
    if msts:
        info["mst_ncc"] = msts[0].strip()
    if len(msts) > 1:
        info["mst_mua"] = msts[1].strip()
    for pat, key in [
        (r"Họ tên người mua hàng\s*:\s*(.+)", "nguoi_mua"),
        (r"Tên đơn vị\s*:\s*(.+)", "ten_don_vi_mua"),
        (r"Hình thức thanh toán\s*:\s*(.+)", "httt"),
    ]:
        m = re.search(pat, text)
        if m:
            info[key] = m.group(1).strip()
    return info


def parse_meta(text: str) -> dict:
    meta = {}
    pats = {
        "ky_hieu": r"Ký hiệu\s*(?:\([^)]*\))?\s*:\s*([A-Z0-9]+)",
        "so_hd": r"Số\s*(?:\(No\.?\))?\s*:\s*(\d{1,8})\b",
        "mcqt": r"MCQT\s*:\s*([A-Z0-9]+)",
        "ma_tra_cuu": r"mã tra cứu\s*:\s*([A-Za-z0-9]+)",
        "bang_chu": r"Số tiền viết bằng chữ\s*:\s*(.+)",
    }
    for k, p in pats.items():
        m = re.search(p, text, re.IGNORECASE if k == "ma_tra_cuu" else 0)
        if m:
            meta[k] = m.group(1).strip()
    m = re.search(r"Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", text)
    if m:
        d, mo, y = map(int, m.groups())
        meta["ngay_hd"] = datetime(y, mo, d).date()
    # tổng theo thuế suất
    for rate in ("0", "5", "8", "10"):
        m = re.search(rf"Tổng tiền hàng chịu thuế {rate}%\s*:\s*([\d.,]+)", text)
        if m:
            meta[f"tien_hang_{rate}"] = to_number(m.group(1))
        m = re.search(rf"Tổng tiền thuế GTGT {rate}%\s*:\s*([\d.,]+)", text)
        if m:
            meta[f"tien_thue_{rate}"] = to_number(m.group(1))
    m = re.search(r"Tổng tiền hàng không chịu thuế\s*:\s*([\d.,]+)", text)
    if m:
        meta["tien_hang_kct"] = to_number(m.group(1))
    return meta


# ---------------------------------------------------------------- PDF có lớp chữ


def parse_text_pdf(path: Path) -> dict:
    """Trả về dict hoá đơn; báo lỗi nếu PDF không có chữ / không thấy bảng hàng."""
    with pdfplumber.open(path) as pdf:
        full_text = "\n".join((p.extract_text() or "") for p in pdf.pages)
        if len(full_text.strip()) < 50:
            raise RuntimeError("PDF không có lớp chữ (PDF scan/ảnh) - cần tải bản PDF điện tử gốc hoặc nhập tay")
        items, totals = [], {}
        for page in pdf.pages:
            for table in page.extract_tables():
                cols = None
                for row in table:
                    if cols is None:
                        cols = map_header(row)
                        continue
                    first = norm(row[0])
                    if first.startswith("tong cong") or "tong cong tien thanh toan" in norm(" ".join(clean(c) for c in row if c)):
                        totals = {
                            "tong_tien_hang": to_number(row[cols["don_gia"]]) if "don_gia" in cols else None,
                            "tong_tien_thue": to_number(row[cols["tien_thue"]]) if "tien_thue" in cols else None,
                            "tong_thanh_toan": to_number(row[cols["thanh_tien"]]) if "thanh_tien" in cols else None,
                        }
                        cols = None
                        continue
                    if map_header(row):  # header lặp lại ở trang sau
                        continue
                    get = lambda k: clean(row[cols[k]]) if k in cols and cols[k] < len(row) else ""
                    if not get("ten_hang"):
                        continue
                    items.append({
                        "stt": to_number(get("stt")) or get("stt"),
                        "ma_hang": get("ma_hang"),
                        "ten_hang": get("ten_hang"),
                        "so_lo": get("so_lo"),
                        "han_dung": to_date(get("han_dung")),
                        "dvt": get("dvt"),
                        "so_luong": to_number(get("so_luong")),
                        "don_gia": to_number(get("don_gia")),
                        "thue_suat": to_rate(get("thue_suat")),
                        "tien_thue": to_number(get("tien_thue")),
                        "thanh_tien": to_number(get("thanh_tien")),
                    })
        if not items:
            raise RuntimeError("không nhận ra bảng hàng hoá (mẫu hoá đơn lạ) - gửi file mẫu để bổ sung")
        info = parse_parties(pdf.pages[0]) or parse_parties_fallback(full_text)
    inv = {**parse_meta(full_text), **info, **totals, "items": items, "nguon": "PDF text"}
    return inv


# ---------------------------------------------------------------- kiểm tra & xuất Excel


def is_discount(item) -> bool:
    return "chiet khau" in norm(item.get("ten_hang"))


def validate(inv) -> str:
    notes = []
    total = inv.get("tong_thanh_toan")
    s = 0
    for it in inv["items"]:
        v = it.get("thanh_tien") or 0
        s += -v if is_discount(it) and v > 0 else v
    if total is not None and abs(s - total) > 2:
        notes.append(f"Tổng dòng hàng {s:,.0f} ≠ tổng thanh toán {total:,.0f}")
    for it in inv["items"]:
        q, p = it.get("so_luong"), it.get("don_gia")
        tt, thue = it.get("thanh_tien"), it.get("tien_thue") or 0
        if isinstance(q, (int, float)) and isinstance(p, (int, float)) and isinstance(tt, (int, float)):
            # Thành tiền có thể là trước thuế hoặc sau thuế
            if min(abs(q * p - tt), abs(q * p + thue - tt)) > max(2, 0.001 * abs(tt)):
                notes.append(f"Dòng {it.get('stt')}: SL×ĐG không khớp thành tiền")
    return "; ".join(notes) or "OK"


ITEM_COLUMNS = [
    ("File", lambda inv, it: inv["file"]),
    ("Ký hiệu", lambda inv, it: inv.get("ky_hieu")),
    ("Số HĐ", lambda inv, it: inv.get("so_hd")),
    ("Ngày HĐ", lambda inv, it: inv.get("ngay_hd")),
    ("MST NCC", lambda inv, it: inv.get("mst_ncc")),
    ("Tên NCC", lambda inv, it: inv.get("ten_ncc")),
    ("Mã đơn hàng", lambda inv, it: inv.get("ma_don_hang")),
    ("STT", lambda inv, it: it.get("stt")),
    ("Loại dòng", lambda inv, it: "Chiết khấu" if is_discount(it) else "Hàng hoá"),
    ("Mã hàng", lambda inv, it: it.get("ma_hang")),
    ("Tên hàng", lambda inv, it: it.get("ten_hang")),
    ("Số lô", lambda inv, it: it.get("so_lo")),
    ("Hạn dùng", lambda inv, it: it.get("han_dung")),
    ("ĐVT", lambda inv, it: it.get("dvt")),
    ("Số lượng", lambda inv, it: it.get("so_luong")),
    ("Đơn giá", lambda inv, it: it.get("don_gia")),
    ("Thuế suất (%)", lambda inv, it: it.get("thue_suat")),
    ("Tiền thuế", lambda inv, it: it.get("tien_thue")),
    ("Thành tiền", lambda inv, it: it.get("thanh_tien")),
]

INVOICE_COLUMNS = [
    ("File", "file"), ("Nguồn đọc", "nguon"), ("Kiểm tra", "kiem_tra"),
    ("Ký hiệu", "ky_hieu"), ("Số HĐ", "so_hd"), ("Ngày HĐ", "ngay_hd"), ("MCQT", "mcqt"), ("Mã tra cứu", "ma_tra_cuu"),
    ("Tên NCC", "ten_ncc"), ("MST NCC", "mst_ncc"), ("Địa chỉ NCC", "dia_chi_ncc"), ("Địa chỉ xuất kho", "dia_chi_xuat_kho"),
    ("STK NCC", "stk_ncc"), ("Email NCC", "email_ncc"), ("ĐT NCC", "dt_ncc"),
    ("Mã đặt hàng", "ma_dat_hang"), ("Mã đơn hàng", "ma_don_hang"),
    ("Người mua", "nguoi_mua"), ("Đơn vị mua", "ten_don_vi_mua"), ("MST mua", "mst_mua"), ("Địa chỉ mua", "dia_chi_mua"),
    ("HTTT", "httt"), ("Số dòng hàng", "so_dong"),
    ("Tổng tiền hàng", "tong_tien_hang"), ("Tổng tiền thuế", "tong_tien_thue"), ("Tổng thanh toán", "tong_thanh_toan"),
    ("Tiền hàng 5%", "tien_hang_5"), ("Thuế 5%", "tien_thue_5"),
    ("Tiền hàng 8%", "tien_hang_8"), ("Thuế 8%", "tien_thue_8"),
    ("Tiền hàng 10%", "tien_hang_10"), ("Thuế 10%", "tien_thue_10"),
    ("Số tiền bằng chữ", "bang_chu"),
]

TEXT_COLS = {"Số HĐ", "MST NCC", "MST mua", "Mã hàng", "Số lô", "STK NCC", "ĐT NCC", "Mã đặt hàng", "Mã đơn hàng"}


def write_sheet(ws, headers, rows):
    ws.append(headers)
    for r in rows:
        ws.append(r)
    head_fill = PatternFill("solid", fgColor="1F4E78")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = head_fill
        c.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for i, h in enumerate(headers, 1):
        letter = get_column_letter(i)
        width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows if r[i - 1] is not None] or [10])
        ws.column_dimensions[letter].width = min(max(10, width + 2), 60)
        for cell in ws[letter][1:]:
            if hasattr(cell.value, "year"):
                cell.number_format = "DD/MM/YYYY"
            elif isinstance(cell.value, float):
                cell.number_format = "#,##0.00"
            elif isinstance(cell.value, int) and h not in ("STT",):
                cell.number_format = "#,##0"
            if h in TEXT_COLS:
                cell.number_format = "@"


def write_excel(invoices, errors, out: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "ChiTiet"
    write_sheet(ws, [h for h, _ in ITEM_COLUMNS],
                [[f(inv, it) for _, f in ITEM_COLUMNS] for inv in invoices for it in inv["items"]])
    ws2 = wb.create_sheet("HoaDon")
    write_sheet(ws2, [h for h, _ in INVOICE_COLUMNS],
                [[inv.get(k) for _, k in INVOICE_COLUMNS] for inv in invoices])
    ws3 = wb.create_sheet("Loi")
    write_sheet(ws3, ["File", "Lỗi / cảnh báo"], errors or [["", "Không có lỗi"]])
    wb.save(out)


# ---------------------------------------------------------------- main


def collect_files(inputs) -> list[Path]:
    files = []
    for x in inputs:
        p = Path(x)
        if p.is_dir():
            files += sorted(f for f in p.rglob("*") if f.suffix.lower() in PDF_EXT)
        elif p.is_file() and p.suffix.lower() in PDF_EXT:
            files.append(p)
        elif p.is_file():
            print(f"[bỏ qua] không phải PDF: {x}")
        else:
            print(f"[bỏ qua] không tìm thấy: {x}")
    return files


def main():
    ap = argparse.ArgumentParser(description="Parse hoá đơn PDF -> Excel")
    ap.add_argument("inputs", nargs="+", help="file PDF hoặc thư mục chứa PDF")
    ap.add_argument("-o", "--output", help="file Excel đầu ra (mặc định: hoa_don_<thời gian>.xlsx)")
    args = ap.parse_args()

    files = collect_files(args.inputs)
    if not files:
        sys.exit("Không có file nào để xử lý.")
    out = Path(args.output or f"hoa_don_{datetime.now():%Y%m%d_%H%M%S}.xlsx")

    invoices, errors = [], []
    for i, f in enumerate(files, 1):
        print(f"[{i}/{len(files)}] {f.name} ... ", end="", flush=True)
        try:
            inv = parse_text_pdf(f)
            inv["file"] = f.name
            inv["so_dong"] = len(inv["items"])
            inv["kiem_tra"] = validate(inv)
            if inv["kiem_tra"] != "OK":
                errors.append([f.name, inv["kiem_tra"]])
            invoices.append(inv)
            print(f"{inv['so_dong']} dòng hàng | {inv['nguon']} | {inv['kiem_tra']}")
        except Exception as e:  # noqa: BLE001
            print(f"LỖI: {e}")
            errors.append([f.name, str(e)])

    write_excel(invoices, errors, out)
    print(f"\nĐã ghi {out.resolve()}  ({len(invoices)} hoá đơn, {len(errors)} lỗi/cảnh báo)")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
