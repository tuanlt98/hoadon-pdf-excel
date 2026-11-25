// Tạo file Excel (3 sheet: ChiTiet, HoaDon, Loi) bằng ExcelJS (được truyền vào).
import { isDiscount } from "./parser.js?v=7";

const ITEM_COLUMNS = [
  ["File", (inv) => inv.file],
  ["Ký hiệu", (inv) => inv.ky_hieu],
  ["Số HĐ", (inv) => inv.so_hd],
  ["Ngày HĐ", (inv) => inv.ngay_hd],
  ["MST NCC", (inv) => inv.mst_ncc],
  ["Tên NCC", (inv) => inv.ten_ncc],
  ["Mã đơn hàng", (inv) => inv.ma_don_hang],
  ["STT", (inv, it) => it.stt],
  ["Loại dòng", (inv, it) => (isDiscount(it) ? "Chiết khấu" : "Hàng hoá")],
  ["Mã hàng", (inv, it) => it.ma_hang],
  ["Tên hàng", (inv, it) => it.ten_hang],
  ["Số lô", (inv, it) => it.so_lo],
  ["Hạn dùng", (inv, it) => it.han_dung],
  ["ĐVT", (inv, it) => it.dvt],
  ["Số lượng", (inv, it) => it.so_luong],
  ["Đơn giá", (inv, it) => it.don_gia],
  ["Thuế suất (%)", (inv, it) => it.thue_suat],
  ["Tiền thuế", (inv, it) => it.tien_thue],
  ["Thành tiền", (inv, it) => it.thanh_tien],
];

const INVOICE_COLUMNS = [
  ["File", "file"], ["Kiểm tra", "kiem_tra"],
  ["Ký hiệu", "ky_hieu"], ["Số HĐ", "so_hd"], ["Ngày HĐ", "ngay_hd"], ["MCQT", "mcqt"], ["Mã tra cứu", "ma_tra_cuu"],
  ["Tên NCC", "ten_ncc"], ["MST NCC", "mst_ncc"], ["Địa chỉ NCC", "dia_chi_ncc"], ["Địa chỉ xuất kho", "dia_chi_xuat_kho"],
  ["STK NCC", "stk_ncc"], ["Email NCC", "email_ncc"], ["ĐT NCC", "dt_ncc"],
  ["Mã đặt hàng", "ma_dat_hang"], ["Mã đơn hàng", "ma_don_hang"],
  ["Người mua", "nguoi_mua"], ["Đơn vị mua", "ten_don_vi_mua"], ["MST mua", "mst_mua"], ["Địa chỉ mua", "dia_chi_mua"],
  ["HTTT", "httt"], ["Số dòng hàng", "so_dong"],
  ["Tổng tiền hàng", "tong_tien_hang"], ["Tổng tiền thuế", "tong_tien_thue"], ["Tổng thanh toán", "tong_thanh_toan"],
  ["Tiền hàng 5%", "tien_hang_5"], ["Thuế 5%", "tien_thue_5"],
  ["Tiền hàng 8%", "tien_hang_8"], ["Thuế 8%", "tien_thue_8"],
  ["Tiền hàng 10%", "tien_hang_10"], ["Thuế 10%", "tien_thue_10"],
  ["Số tiền bằng chữ", "bang_chu"],
];

const TEXT_COLS = new Set(["Số HĐ", "MST NCC", "MST mua", "Mã hàng", "Số lô", "STK NCC", "ĐT NCC", "Mã đặt hàng", "Mã đơn hàng"]);

function fillSheet(ws, headers, rows, textCols = TEXT_COLS) {
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r.map((v) => (v === "" || v === undefined ? null : v)));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  head.alignment = { vertical: "middle", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    let w = h.length;
    for (const r of rows) {
      const v = r[i];
      if (v != null) w = Math.max(w, v instanceof Date ? 10 : String(v).length);
    }
    col.width = Math.min(Math.max(10, w + 2), 60);
    col.eachCell({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum === 1) return;
      const v = cell.value;
      if (textCols.has(h)) cell.numFmt = "@";
      else if (v instanceof Date) cell.numFmt = "dd/mm/yyyy";
      else if (typeof v === "number" && h !== "STT" && h !== "Thuế suất (%)")
        cell.numFmt = Number.isInteger(v) ? "#,##0" : "#,##0.00";
    });
  });
}

// tên các cột có sẵn (để hiện cho người dùng biết)
export const BUILTIN_COLUMNS = {
  ChiTiet: ITEM_COLUMNS.map((c) => c[0]),
  HoaDon: INVOICE_COLUMNS.map((c) => c[0]),
};

// ------------------------------------------------------------ mẫu nhập hàng RX20 ("Mau-nhap-hang.xlsx", sheet "Data nhap hang")
// [tiêu đề, độ rộng, màu nền: vàng = bắt buộc, xanh = cần cho liên thông Dược Quốc Gia, xám = không bắt buộc]
const Y = "FFFFF2CC", B = "FFDDEBF7", G = "FFF2F2F2";
const RX20_COLUMNS = [
  ["Mã thuốc (*)", 18, Y], ["Tên thuốc (*)", 34, Y], ["Đơn vị tính (*)", 14, Y], ["Số lượng hàng trong lô (*)", 16, Y],
  ["Giá vốn (*)", 14, Y], ["Nhà cung cấp (*)", 26, Y],
  ["Số lô", 16, B], ["Hạn sử dụng", 18, B], ["Số đăng ký", 16, B], ["Hoạt chất", 30, B], ["Hàm lượng", 24, B],
  ["Hãng sản xuất", 28, B], ["Nước sản xuất", 16, B], ["Quy cách đóng gói", 26, B], ["Nhóm", 20, B],
  ["Giá bán", 14, G], ["Vị trí thuốc", 14, G], ["Số lượng cảnh báo", 16, G], ["Ghi chú", 20, G], ["Đường dùng", 16, G],
  ["Giảm giá", 12, G], ["Loại giảm(%,vnd)", 16, G], ["Mã nhập hàng", 16, G], ["Ngày nhập hàng", 18, G],
];
const RX20_NOTE = "(*) Cột nền vàng là BẮT BUỘC. Cột nền xanh cần cho liên thông Dược Quốc Gia (thuốc quản lý theo lô phải có Số lô và Hạn sử dụng). " +
  "Cột nền xám không bắt buộc — Giá bán để trống thì lấy bằng giá vốn + 10%. Xem sheet \"Vi du\" để biết cách điền.";

const ddmmyyyy = (d) => d instanceof Date
  ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`
  : d || null;

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// tiền hàng chưa thuế của 1 dòng
function preTax(it) {
  if (it.so_luong != null && it.don_gia != null) return it.so_luong * it.don_gia;
  if (it.tien_truoc_thue != null) return it.tien_truoc_thue;
  if (it.thanh_tien != null) {
    if (it.tien_thue != null) return it.thanh_tien - it.tien_thue;
    return it.thanh_tien / (1 + (it.thue_suat || 0) / 100);
  }
  return 0;
}

// "Hộp 10 vỉ x 10 viên nén" -> "Hộp"; "Chai 100ml" -> "Chai"; "Viên" -> "Viên"
export function shortUnit(dvt) {
  const s = String(dvt || "").trim();
  const m = s.match(/^([^\d(]+?)\s*[\d(]/);
  return m ? m[1].trim() : s;
}

// Chia dòng chiết khấu (chưa thuế) vào các dòng hàng cùng thuế suất theo tỷ lệ tiền hàng.
// Dòng cuối lấy phần còn lại để tổng không lệch do làm tròn.
export function allocateDiscounts(inv) {
  const goods = inv.items.filter((it) => !isDiscount(it));
  const ck = new Map(goods.map((it) => [it, it.chiet_khau || 0])); // chiết khấu ghi sẵn trên dòng (XML)
  for (const d of inv.items.filter(isDiscount)) {
    const amount = Math.abs(preTax(d));
    let group = goods.filter((it) => (it.thue_suat ?? null) === (d.thue_suat ?? null));
    if (!group.length) group = goods; // không có hàng cùng thuế suất -> chia cho tất cả
    const total = group.reduce((s, it) => s + preTax(it), 0);
    let left = round(amount);
    group.forEach((it, i) => {
      const part = i === group.length - 1 ? left : round(total ? amount * preTax(it) / total : amount / group.length);
      ck.set(it, round(ck.get(it) + part));
      left = round(left - part);
    });
  }
  return goods.map((it) => {
    const giam = ck.get(it);
    const rate = it.thue_suat || 0;
    return { it, giam, thanhTien: Math.round((preTax(it) - giam) * (1 + rate / 100)) };
  });
}

// opts.giaVon: "sau_thue" (mặc định) = (thành tiền sau thuế, đã trừ chiết khấu) ÷ SL -> tổng phiếu khớp tiền trả NCC
//              "truoc_thue" = đơn giá chưa thuế, chiết khấu ghi vào Giảm giá (vnd) — mẫu không có cột thuế nên thuế bị bỏ
//              "sau_thue_ck" = đơn giá × (1 + thuế), chiết khấu (đã gồm thuế) ghi vào Giảm giá (vnd)
function addRx20Sheet(wb, invoices, opts, errors) {
  const ws = wb.addWorksheet("Data nhap hang");
  ws.columns = RX20_COLUMNS.map(([, width]) => ({ width }));
  ws.mergeCells(1, 1, 1, RX20_COLUMNS.length);
  const note = ws.getCell(1, 1);
  note.value = RX20_NOTE;
  note.font = { bold: true, color: { argb: "FFC00000" } };
  ws.getRow(1).height = 22;
  const head = ws.getRow(2);
  head.height = 32;
  RX20_COLUMNS.forEach(([h, , fill], i) => {
    const c = head.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    c.alignment = { wrapText: true, vertical: "middle" };
    c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  ws.views = [{ state: "frozen", ySplit: 2 }];

  const mode = opts.giaVon || "sau_thue";
  for (const inv of invoices) {
    const lines = allocateDiscounts(inv);
    if (lines.length > 100) errors.push([inv.file, `Hoá đơn ${inv.so_hd} có ${lines.length} mặt hàng — RX20 chỉ nhận tối đa 100 sản phẩm/đơn`]);
    for (const { it, giam, thanhTien } of lines) {
      const q = it.so_luong, rate = typeof it.thue_suat === "number" ? it.thue_suat : 0;
      let giaVon, giamGia = null;
      if (mode === "truoc_thue") { giaVon = it.don_gia; giamGia = giam ? round(giam) : null; }
      else if (mode === "sau_thue_ck") {
        giaVon = it.don_gia != null ? round(it.don_gia * (1 + rate / 100)) : null;
        giamGia = giam ? Math.round(giam * (1 + rate / 100)) : null;
      } else giaVon = q ? round(thanhTien / q) : null;
      if (!it.ma_hang) errors.push([inv.file, `HĐ ${inv.so_hd}: “${it.ten_hang}” không có mã hàng — cần điền Mã thuốc trước khi tải lên RX20`]);
      const dvt = shortUnit(it.dvt);
      const row = Array(RX20_COLUMNS.length).fill(null);
      Object.assign(row, {
        0: it.ma_hang || null, 1: it.ten_hang || null, 2: dvt || null, 3: q ?? null, 4: giaVon ?? null, 5: inv.ten_ncc || null,
        6: it.so_lo || null, 7: ddmmyyyy(it.han_dung),
        13: it.dvt && it.dvt !== dvt ? it.dvt : null, // "Hộp 10 vỉ x 10 viên nén" -> Quy cách đóng gói
        20: giamGia, 21: giamGia ? "vnd" : null,
        22: inv.so_hd || null, 23: ddmmyyyy(inv.ngay_hd),
      });
      const r = ws.addRow(row);
      for (const c of [1, 7, 8, 23, 24]) r.getCell(c).numFmt = "@";
    }
  }
}

// extras: cấu hình trường bổ sung (xem parser.js). Trường "header" -> cả 2 sheet, trường "table" -> ChiTiet.
// opts.rx20: {giaVon} -> thêm sheet đầu tiên "Data nhap hang" đúng mẫu nhập hàng của RX20.
export async function buildExcel(ExcelJS, invoices, errors, extras = [], opts = {}) {
  extras = extras.filter((e) => e && String(e.name || "").trim() && String(e.label || "").trim());
  const used = new Set([...ITEM_COLUMNS, ...INVOICE_COLUMNS].map((c) => c[0]));
  const colName = (e) => (used.has(e.name.trim()) ? e.name.trim() + " (bổ sung)" : e.name.trim());
  const textCols = new Set([...TEXT_COLS, ...extras.filter((e) => (e.type || "text") === "text").map(colName)]);
  const headerEx = extras.filter((e) => e.where !== "table");

  const itemCols = [
    ...ITEM_COLUMNS,
    ...extras.map((e) => [colName(e), (inv, it) => (e.where === "table" ? it.extra?.[e.name] : inv.extra?.[e.name])]),
  ];
  const invCols = [
    ...INVOICE_COLUMNS.map(([h, k]) => [h, (inv) => inv[k]]),
    ...headerEx.map((e) => [colName(e), (inv) => inv.extra?.[e.name]]),
  ];
  if (extras.length) invCols.splice(2, 0, ["Trường không thấy", (inv) => inv.thieu_truong]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Hoá đơn PDF → Excel";
  if (opts.rx20) addRx20Sheet(wb, invoices, opts.rx20, errors);
  fillSheet(wb.addWorksheet("ChiTiet"), itemCols.map((c) => c[0]),
    invoices.flatMap((inv) => inv.items.map((it) => itemCols.map(([, f]) => f(inv, it)))), textCols);
  fillSheet(wb.addWorksheet("HoaDon"), invCols.map((c) => c[0]),
    invoices.map((inv) => invCols.map(([, f]) => f(inv))), textCols);
  fillSheet(wb.addWorksheet("Loi"), ["File", "Lỗi / cảnh báo"],
    errors.length ? errors : [["", "Không có lỗi"]]);
  return wb.xlsx.writeBuffer();
}
