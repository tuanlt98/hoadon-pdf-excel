// Đọc hoá đơn điện tử XML theo chuẩn Tổng cục Thuế (TT78, thẻ <HDon>) -> cùng dạng object như parser.js.
// Không dùng DOMParser để chạy được cả trên trình duyệt lẫn Node.
import { norm, clean, castValue } from "./parser.js?v=7";

// ------------------------------------------------------------ XML -> cây {tag, text, kids}
const ENT = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);

function parseXml(src) {
  src = src.replace(/^﻿/, "").replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, "");
  const root = { tag: "#root", text: "", kids: [] };
  const stack = [root];
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w:.-]+)[^>]*?(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] != null) top.text += m[1];
    else if (m[5] != null) top.text += decode(m[5]);
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else {
      const node = { tag: m[3].replace(/^.*:/, ""), text: "", kids: [] };
      top.kids.push(node);
      if (!m[4]) stack.push(node);
    }
  }
  return root;
}

const kid = (n, tag) => n?.kids.find((k) => k.tag === tag);
const kids = (n, tag) => (n ? n.kids.filter((k) => k.tag === tag) : []);
const path = (n, ...tags) => tags.reduce((a, t) => kid(a, t), n);
const txt = (n, ...tags) => clean(path(n, ...tags)?.text) || "";
const num = (n, ...tags) => {
  const t = txt(n, ...tags);
  if (!t) return null;
  const v = parseFloat(t.replace(/,/g, ""));
  return Number.isNaN(v) ? null : Math.round(v * 10000) / 10000;
};
function find(n, tag) {
  if (!n) return null;
  if (n.tag === tag) return n;
  for (const k of n.kids) { const r = find(k, tag); if (r) return r; }
  return null;
}

// <TTKhac><TTin><TTruong>X</TTruong><DLieu>Y</DLieu></TTin>... -> {X: Y}
function ttKhac(n) {
  const out = {};
  for (const t of kids(kid(n, "TTKhac"), "TTin")) {
    const k = txt(t, "TTruong");
    if (k && !(k in out)) out[k] = txt(t, "DLieu");
  }
  return out;
}

const rate = (s) => {
  const m = clean(s).match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  return m ? parseFloat(m[1].replace(",", ".")) : clean(s) || null; // "KCT", "KKKNT" giữ nguyên chữ
};

function toDate(s) {
  const t = clean(s);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}

// Số lô / hạn dùng: mỗi phần mềm hoá đơn ghi 1 kiểu trong <TTKhac> của dòng hàng
const LOT_KEYS = /^(lotno|lot|batch|batchno|solo|so_lo|solosx|lohang|lo)$/i;
const EXP_KEYS = /^(expirydate|expiry|expdate|expiredate|exp|hsd|handung|han_dung|hansudung)$/i;

function lotAndExpiry(extra) {
  let so_lo = "", han_dung = null;
  for (const [k, v] of Object.entries(extra)) {
    const kk = k.replace(/[\s-]/g, "");
    if (!so_lo && LOT_KEYS.test(kk)) so_lo = v;
    if (!han_dung && EXP_KEYS.test(kk)) han_dung = toDate(v) || v || null;
  }
  // vd Hilo: Extra01 = số lô, Extra02 = hạn dùng (không đặt tên) -> đoán theo dạng dữ liệu
  if (!so_lo || !han_dung) {
    const generic = Object.entries(extra).filter(([k, v]) => /^extra\d+$/i.test(k) && v && v !== "0");
    for (const [, v] of generic) {
      const d = toDate(v);
      if (d && !han_dung) han_dung = d;
      else if (!d && !so_lo && /^[\w./-]{2,20}$/.test(v)) so_lo = v;
    }
  }
  return { so_lo, han_dung };
}

// TChat: 1 hàng hoá, 2 khuyến mại, 3 chiết khấu thương mại, 4 ghi chú
export function parseInvoiceXml(text, extras = []) {
  const root = parseXml(text);
  const hd = find(root, "HDon");
  const dl = kid(hd, "DLHDon");
  if (!dl) throw new Error("Không phải file XML hoá đơn điện tử (thiếu thẻ HDon/DLHDon)");
  const tc = kid(dl, "TTChung"), nd = kid(dl, "NDHDon");
  const ban = kid(nd, "NBan"), mua = kid(nd, "NMua"), tt = kid(nd, "TToan");

  const items = [];
  for (const h of kids(kid(nd, "DSHHDVu"), "HHDVu")) {
    const tchat = num(h, "TChat");
    if (tchat === 4) continue; // dòng ghi chú
    const ex = ttKhac(h);
    const thue_suat = rate(txt(h, "TSuat"));
    const truoc = num(h, "ThTien"); // thành tiền chưa thuế (đã trừ chiết khấu dòng)
    const vat = ex.VATAmount != null && ex.VATAmount !== "" ? parseFloat(ex.VATAmount)
      : truoc != null && typeof thue_suat === "number" ? Math.round(truoc * thue_suat) / 100 : null;
    const ten = txt(h, "THHDVu");
    items.push({
      extra: Object.fromEntries(extras.filter((e) => e.where === "table").map((e) => [e.name, pick(h, ex, e)])),
      stt: num(h, "STT"),
      tchat,
      ma_hang: txt(h, "MHHDVu"),
      ten_hang: tchat === 3 && !norm(ten).includes("chiet khau") ? "Chiết khấu thương mại: " + ten : ten,
      ...lotAndExpiry(ex),
      dvt: txt(h, "DVTinh"),
      so_luong: num(h, "SLuong"),
      don_gia: num(h, "DGia"),
      chiet_khau: num(h, "STCKhau") || 0, // chiết khấu ngay trên dòng hàng (chưa thuế)
      thue_suat,
      tien_thue: vat,
      tien_truoc_thue: truoc,
      thanh_tien: truoc,
    });
  }
  if (!items.length) throw new Error("XML không có dòng hàng hoá");

  const inv = {
    nguon: "XML",
    ky_hieu: txt(tc, "KHMSHDon") + txt(tc, "KHHDon"),
    so_hd: txt(tc, "SHDon"),
    ngay_hd: toDate(txt(tc, "NLap")),
    mcqt: txt(hd, "MCCQT"),
    httt: txt(tc, "HTTToan"),
    ten_ncc: txt(ban, "Ten"), mst_ncc: txt(ban, "MST"), dia_chi_ncc: txt(ban, "DChi"),
    dt_ncc: txt(ban, "SDThoai"), email_ncc: txt(ban, "DCTDTu"),
    stk_ncc: [txt(ban, "STKNHang"), txt(ban, "TNHang")].filter(Boolean).join(" - "),
    ten_don_vi_mua: txt(mua, "Ten"), nguoi_mua: txt(mua, "HVTNMHang"), mst_mua: txt(mua, "MST"), dia_chi_mua: txt(mua, "DChi"),
    tong_tien_hang: num(tt, "TgTCThue"),
    tong_tien_thue: num(tt, "TgTThue"),
    tong_thanh_toan: num(tt, "TgTTTBSo"),
    bang_chu: txt(tt, "TgTTTBChu"),
    items,
  };
  for (const l of kids(kid(tt, "THTTLTSuat"), "LTSuat")) {
    const r = rate(txt(l, "TSuat"));
    if (typeof r === "number") { inv[`tien_hang_${r}`] = num(l, "ThTien"); inv[`tien_thue_${r}`] = num(l, "TThue"); }
  }
  // mã đơn hàng: vài phần mềm ghi trong TTKhac (vd "SOBD38388582")
  const allEx = { ...ttKhac(tc), ...ttKhac(dl) };
  const so = Object.values(allEx).find((v) => /^SO[A-Z]*\d{4,}$/.test(v));
  if (so) inv.ma_don_hang = so;

  // chiết khấu thương mại tổng (TTCKTMai) mà không có dòng chiết khấu riêng -> thêm 1 dòng để chia
  const ckTong = num(tt, "TTCKTMai");
  if (ckTong > 0 && !items.some((it) => it.tchat === 3))
    items.push({ extra: {}, stt: null, tchat: 3, ma_hang: "", ten_hang: "Chiết khấu thương mại", so_lo: "", han_dung: null,
      dvt: "", so_luong: null, don_gia: null, chiet_khau: 0, thue_suat: null, tien_thue: null, tien_truoc_thue: ckTong, thanh_tien: ckTong });

  // trường bổ sung "thông tin chung": tìm theo tên thẻ hoặc tên trường TTKhac
  inv.extra = {};
  const missing = [];
  const flat = { ...flatten(dl), ...allEx, ...ttKhac(tt), ...ttKhac(ban), ...ttKhac(mua) };
  for (const e of extras.filter((e) => e.where !== "table")) {
    const key = Object.keys(flat).find((k) => norm(k) === norm(e.label));
    inv.extra[e.name] = key ? castValue(flat[key], e.type) : null;
    if (!key) missing.push(e.label);
  }
  inv.thieu_truong = missing.length ? "Không thấy: " + missing.join(", ") : "";
  inv.so_dong = items.length;
  return inv;
}

function pick(h, ex, e) {
  const key = Object.keys(ex).find((k) => norm(k) === norm(e.label));
  if (key) return castValue(ex[key], e.type);
  const n = h.kids.find((k) => norm(k.tag) === norm(e.label));
  return n ? castValue(n.text, e.type) : null;
}

function flatten(n, out = {}) {
  for (const k of n.kids) {
    if (k.kids.length) flatten(k, out);
    else if (!(k.tag in out) && clean(k.text)) out[k.tag] = clean(k.text);
  }
  return out;
}
