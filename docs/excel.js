// Tạo file Excel (3 sheet: ChiTiet, HoaDon, Loi) bằng ExcelJS (được truyền vào).
import { isDiscount } from "./parser.js";

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

// extras: cấu hình trường bổ sung (xem parser.js). Trường "header" -> cả 2 sheet, trường "table" -> ChiTiet.
export async function buildExcel(ExcelJS, invoices, errors, extras = []) {
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
  fillSheet(wb.addWorksheet("ChiTiet"), itemCols.map((c) => c[0]),
    invoices.flatMap((inv) => inv.items.map((it) => itemCols.map(([, f]) => f(inv, it)))), textCols);
  fillSheet(wb.addWorksheet("HoaDon"), invCols.map((c) => c[0]),
    invoices.map((inv) => invCols.map(([, f]) => f(inv))), textCols);
  fillSheet(wb.addWorksheet("Loi"), ["File", "Lỗi / cảnh báo"],
    errors.length ? errors : [["", "Không có lỗi"]]);
  return wb.xlsx.writeBuffer();
}
