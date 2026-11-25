// Parse hoá đơn GTGT PDF điện tử -> object. Chạy được cả trên trình duyệt lẫn Node.
// pdfjsLib được truyền vào (để trình duyệt dùng bản CDN/vendor, Node dùng pdfjs-dist).

// ------------------------------------------------------------ helpers chuỗi / số

export function norm(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Giống norm nhưng giữ nguyên độ dài (mỗi ký tự -> 1 ký tự) để dùng lại chỉ số
function normSameLen(s) {
  let out = "";
  for (const c of s) {
    let b = c.normalize("NFD").replace(/\p{Mn}/gu, "");
    b = b ? b[0] : " ";
    out += b === "đ" || b === "Đ" ? "d" : b.toLowerCase();
  }
  return out;
}

export function clean(s) {
  return s == null ? "" : String(s).normalize("NFC").replace(/\s+/g, " ").trim();
}

// '11.333,33' -> 11333.33 ; '595.000' -> 595000 ; '' -> null
export function toNumber(s) {
  if (s == null) return null;
  if (typeof s === "number") return s;
  let t = clean(s).replace(/\s/g, "");
  if (!t) return null;
  const neg = (t.startsWith("(") && t.endsWith(")")) || t.startsWith("-");
  t = t.replace(/^[(\-]+|[)]+$/g, "");
  if (!/^[\d.,]+$/.test(t)) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  let v = parseFloat(t);
  if (Number.isNaN(v)) return null;
  if (neg) v = -v;
  return Number.isInteger(v) ? v : Math.round(v * 10000) / 10000;
}

function toRate(s) {
  const t = clean(s);
  if (!t) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  return m ? toNumber(m[1]) : t;
}

// trả về Date (UTC) hoặc chuỗi gốc nếu không nhận ra
function toDate(s) {
  const t = clean(s);
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return new Date(Date.UTC(y, mo - 1, d));
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t;
}

// ------------------------------------------------------------ cột bảng hàng hoá

const COLUMN_SYNONYMS = {
  stt: ["stt", "tt", "so tt", "no"],
  ma_hang: ["ma hang", "ma hh", "ma sp", "ma vat tu", "ma hang hoa"],
  ten_hang: ["ten hang hoa, dich vu", "ten hang hoa dich vu", "ten hang", "ten hang hoa", "ten san pham", "dien giai"],
  so_lo: ["so lo", "lo", "lo sx", "so lo sx"],
  han_dung: ["han dung", "hsd", "han su dung"],
  dvt: ["don vi tinh", "dvt", "don vi"],
  so_luong: ["so luong", "sl"],
  don_gia: ["don gia", "gia"],
  thue_suat: ["thue suat gtgt", "thue suat", "ts", "% thue"],
  tien_thue: ["tien thue gtgt", "tien thue", "thue gtgt"],
  thanh_tien: ["thanh tien", "thanh tien sau thue", "tong tien", "thanh tien truoc thue"],
};

function mapHeader(labels) {
  const cols = {};
  labels.forEach((lab, i) => {
    const n = norm(lab);
    if (!n) return;
    for (const [key, syns] of Object.entries(COLUMN_SYNONYMS)) {
      if (key in cols) continue;
      if (syns.includes(n)) { cols[key] = i; break; }
    }
  });
  return "ten_hang" in cols && ("thanh_tien" in cols || "so_luong" in cols) ? cols : null;
}

// ------------------------------------------------------------ hình học trang

async function readPage(pdfjsLib, page) {
  const vp = page.getViewport({ scale: 1 });
  const U = pdfjsLib.Util;
  const OPS = pdfjsLib.OPS;

  // chữ
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    const str = clean(it.str);
    if (!str) continue;
    const [x, yb] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const h = it.height || Math.abs(it.transform[3]) || 8;
    items.push({ str, x0: x, x1: x + it.width, yb, yc: yb - h / 2, h });
  }

  // đường kẻ (từ constructPath: rectangle mảnh, lineTo, hoặc rect được stroke)
  const hLines = [], vLines = [];
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const toVp = (x, y) => {
    const p = U.applyTransform([x, y], ctm);
    return vp.convertToViewportPoint(p[0], p[1]);
  };
  const addSeg = (a, b) => {
    const [x0, y0] = a, [x1, y1] = b;
    if (Math.abs(x1 - x0) < 1.5 && Math.abs(y1 - y0) > 3)
      vLines.push({ x: (x0 + x1) / 2, y0: Math.min(y0, y1), y1: Math.max(y0, y1) });
    else if (Math.abs(y1 - y0) < 1.5 && Math.abs(x1 - x0) > 3)
      hLines.push({ y: (y0 + y1) / 2, x0: Math.min(x0, x1), x1: Math.max(x0, x1) });
  };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], args = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = U.transform(ctm, args);
    else if (fn === OPS.constructPath) {
      const [ops, coords] = args;
      const next = ol.fnArray[i + 1];
      const stroked = next === OPS.stroke || next === OPS.closeStroke ||
        next === OPS.fillStroke || next === OPS.eoFillStroke;
      let k = 0, cur = null, start = null;
      for (const op of ops) {
        if (op === OPS.rectangle) {
          const [x, y, w, h] = coords.slice(k, k + 4); k += 4;
          const p = [toVp(x, y), toVp(x + w, y), toVp(x + w, y + h), toVp(x, y + h)];
          const W = Math.abs(p[1][0] - p[0][0]), H = Math.abs(p[3][1] - p[0][1]);
          if (W < 2.5 && H > 3) addSeg([(p[0][0] + p[1][0]) / 2, p[0][1]], [(p[0][0] + p[1][0]) / 2, p[3][1]]);
          else if (H < 2.5 && W > 3) addSeg([p[0][0], (p[0][1] + p[3][1]) / 2], [p[1][0], (p[0][1] + p[3][1]) / 2]);
          else if (stroked) { addSeg(p[0], p[1]); addSeg(p[1], p[2]); addSeg(p[2], p[3]); addSeg(p[3], p[0]); }
        } else if (op === OPS.moveTo) {
          cur = start = toVp(coords[k], coords[k + 1]); k += 2;
        } else if (op === OPS.lineTo) {
          const p = toVp(coords[k], coords[k + 1]); k += 2;
          if (cur && stroked) addSeg(cur, p);
          cur = p;
        } else if (op === OPS.curveTo) { cur = toVp(coords[k + 4], coords[k + 5]); k += 6; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { cur = toVp(coords[k + 2], coords[k + 3]); k += 4; }
        else if (op === OPS.closePath) { if (cur && start && stroked) addSeg(cur, start); cur = start; }
      }
    }
  }
  return { items, hLines, vLines, width: vp.width, height: vp.height };
}

function uniqSorted(vals, tol = 2) {
  const out = [];
  for (const v of [...vals].sort((a, b) => a - b)) {
    if (!out.length || v - out[out.length - 1] > tol) out.push(v);
  }
  return out;
}

function groupLines(items, tol = 3) {
  const lines = [];
  for (const it of [...items].sort((a, b) => a.yb - b.yb || a.x0 - b.x0)) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.yb - it.yb) < tol) last.items.push(it);
    else lines.push({ yb: it.yb, items: [it] });
  }
  return lines.map((l) => l.items.sort((a, b) => a.x0 - b.x0).map((i) => i.str).join(" "));
}

const center = (it) => (it.x0 + it.x1) / 2;

function colIndex(bounds, x) {
  for (let i = 0; i < bounds.length - 1; i++) if (x >= bounds[i] && x < bounds[i + 1]) return i;
  return -1;
}

// ------------------------------------------------------------ bảng hàng hoá trên 1 trang

function parseTable(pg) {
  const { items, hLines, vLines } = pg;
  const stt = items.find((it) => norm(it.str) === "stt") ||
    items.find((it) => norm(it.str).startsWith("ten hang"));
  if (!stt) return null;

  // dải header: giữa 2 đường kẻ ngang bao quanh chữ STT
  const nearX = (l) => l.x0 <= stt.x1 + 5 && l.x1 >= stt.x0 - 5;
  const above = hLines.filter((l) => l.y < stt.yc - 1 && nearX(l)).map((l) => l.y);
  const below = hLines.filter((l) => l.y > stt.yc + 1 && nearX(l)).map((l) => l.y);
  let top = above.length ? Math.max(...above) : stt.yc - 10;
  let bottom = below.length ? Math.min(...below) : stt.yc + 10;
  const mid = (top + bottom) / 2;

  // ranh giới cột: các đường kẻ dọc cắt qua dải header
  let bounds = uniqSorted(vLines.filter((l) => l.y0 <= mid && l.y1 >= mid).map((l) => l.x));
  const headItems = items.filter((it) => it.yc > top && it.yc < bottom);

  if (bounds.length < 4) {
    // không có đường kẻ: suy từ vị trí chữ tiêu đề (kém chính xác hơn)
    const clusters = [];
    for (const it of [...headItems].sort((a, b) => a.x0 - b.x0)) {
      const c = clusters.find((c) => it.x0 < c.x1 && it.x1 > c.x0);
      if (c) { c.x0 = Math.min(c.x0, it.x0); c.x1 = Math.max(c.x1, it.x1); }
      else clusters.push({ x0: it.x0, x1: it.x1 });
    }
    clusters.sort((a, b) => a.x0 - b.x0);
    bounds = [0];
    for (let i = 0; i < clusters.length - 1; i++) bounds.push((clusters[i].x1 + clusters[i + 1].x0) / 2);
    bounds.push(pg.width);
  }

  const labels = Array(bounds.length - 1).fill("");
  for (const it of [...headItems].sort((a, b) => a.yb - b.yb || a.x0 - b.x0)) {
    const ci = colIndex(bounds, center(it));
    if (ci >= 0) labels[ci] = (labels[ci] + " " + it.str).trim();
  }
  const cols = mapHeader(labels);
  if (!cols) return null;

  const x0 = bounds[0], x1 = bounds[bounds.length - 1];
  const body = items.filter((it) => it.yc > bottom && center(it) >= x0 && center(it) <= x1);

  // dải dòng: các đường kẻ ngang bên dưới header
  let rowYs = uniqSorted(hLines.filter((l) => l.y > bottom + 1 && l.x0 <= x0 + 5 && l.x1 >= x0 + 20).map((l) => l.y));
  let bands = [];
  let prev = bottom;
  for (const y of rowYs) { bands.push([prev, y]); prev = y; }
  if (!bands.length) {
    // không có đường kẻ ngang: mỗi dòng neo theo ô STT có số
    const sttCol = cols.stt;
    const anchors = body.filter((it) => colIndex(bounds, center(it)) === sttCol && /^\d+$/.test(it.str))
      .map((it) => it.yc).sort((a, b) => a - b);
    const stop = body.find((it) => /^tong cong/.test(norm(it.str)));
    const end = stop ? stop.yc - 1 : Math.max(...body.map((i) => i.yc), bottom) + 1;
    anchors.forEach((a, i) => {
      const lo = i === 0 ? bottom : (anchors[i - 1] + a) / 2;
      const hi = i === anchors.length - 1 ? end : (a + anchors[i + 1]) / 2;
      bands.push([lo, hi]);
    });
    if (stop) bands.push([stop.yc - 1, stop.yc + 1]);
  }

  const rows = [];
  let totals = null;
  for (const [lo, hi] of bands) {
    const inBand = body.filter((it) => it.yc > lo && it.yc <= hi);
    if (!inBand.length) continue;
    const cells = Array(bounds.length - 1).fill("");
    for (const it of inBand.sort((a, b) => a.yb - b.yb || a.x0 - b.x0)) {
      const ci = colIndex(bounds, center(it));
      if (ci >= 0) cells[ci] = (cells[ci] + " " + it.str).trim();
    }
    const all = norm(inBand.map((i) => i.str).join(" "));
    if (all.includes("tong cong")) {
      const g = (k) => (k in cols ? toNumber(cells[cols[k]]) : null);
      totals = { tong_tien_hang: g("don_gia"), tong_tien_thue: g("tien_thue"), tong_thanh_toan: g("thanh_tien") };
      break;
    }
    if (all.startsWith("so tien viet bang chu")) break;
    if (mapHeader(cells)) continue; // header lặp
    const get = (k) => (k in cols ? clean(cells[cols[k]]) : "");
    if (!get("ten_hang")) continue;
    rows.push({
      stt: toNumber(get("stt")) ?? get("stt"),
      ma_hang: get("ma_hang"),
      ten_hang: get("ten_hang"),
      so_lo: get("so_lo"),
      han_dung: toDate(get("han_dung")),
      dvt: get("dvt"),
      so_luong: toNumber(get("so_luong")),
      don_gia: toNumber(get("don_gia")),
      thue_suat: toRate(get("thue_suat")),
      tien_thue: toNumber(get("tien_thue")),
      thanh_tien: toNumber(get("thanh_tien")),
    });
  }
  return { rows, totals, headerTop: top };
}

// ------------------------------------------------------------ người bán / người mua

const SELLER_KEYS = {
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
};
const BUYER_KEYS = {
  "ho ten nguoi mua hang": "nguoi_mua",
  "ten don vi": "ten_don_vi_mua",
  "dia chi": "dia_chi_mua",
  "ma so thue": "mst_mua",
  "hinh thuc thanh toan": "httt",
  "so tai khoan": "stk_mua",
};

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function parseKvLines(lines, keymap) {
  const out = {};
  const keys = Object.keys(keymap).sort((a, b) => b.length - a.length);
  let last = null;
  for (const line of lines) {
    const src = line.normalize("NFC");
    const nline = normSameLen(src);
    const hits = [];
    for (const k of keys) {
      const re = new RegExp("(?:^|\\s)(" + k.split(" ").map(escapeRe).join("\\s+") + ")\\s*(?:\\([^)]*\\))?\\s*:", "g");
      let m;
      while ((m = re.exec(nline))) {
        const s = m.index + m[0].indexOf(m[1]);
        if (hits.some((h) => h[0] <= s && s < h[1])) continue;
        hits.push([s, m.index + m[0].length, k]);
      }
    }
    hits.sort((a, b) => a[0] - b[0]);
    if (!hits.length) {
      if (last && src.trim()) out[last] = ((out[last] || "") + " " + src.trim()).trim();
      continue;
    }
    hits.forEach(([s, e, k], i) => {
      const end = i + 1 < hits.length ? hits[i + 1][0] : src.length;
      const val = src.slice(e, end).replace(/^[\s:]+|[\s:]+$/g, "");
      const f = keymap[k];
      if (!out[f]) out[f] = val;
      last = f;
    });
  }
  return out;
}

function parseParties(pg, headerTop) {
  const { items } = pg;
  const seller = items.find((it) => /^don vi ban hang\s*:/.test(norm(it.str)) && it.yc < headerTop);
  const buyer = items.find((it) => norm(it.str).startsWith("ho ten nguoi mua hang") && it.yc < headerTop);
  if (!seller || !buyer) return null;
  const xb = buyer.x0 - 1;
  const zone = items.filter((it) => it.yc >= seller.yc - 2 && it.yc < headerTop);
  return {
    ...parseKvLines(groupLines(zone.filter((i) => i.x0 < xb)), SELLER_KEYS),
    ...parseKvLines(groupLines(zone.filter((i) => i.x0 >= xb)), BUYER_KEYS),
  };
}

function parsePartiesFallback(text) {
  const info = {};
  const g = (re) => { const m = text.match(re); return m ? m[1].trim() : undefined; };
  info.ten_ncc = g(/Đơn vị bán hàng\s*:\s*(.+)/);
  const msts = [...text.matchAll(/Mã số thuế\s*(?:\([^)]*\))?\s*:\s*([\d\- ]{9,20})/g)].map((m) => m[1].trim());
  if (msts[0]) info.mst_ncc = msts[0];
  if (msts[1]) info.mst_mua = msts[1];
  info.nguoi_mua = g(/Họ tên người mua hàng\s*:\s*(.+)/);
  info.ten_don_vi_mua = g(/Tên đơn vị\s*:\s*(.+)/);
  info.httt = g(/Hình thức thanh toán\s*:\s*(.+)/);
  return info;
}

function parseMeta(text) {
  const meta = {};
  const pats = {
    ky_hieu: /Ký hiệu\s*(?:\([^)]*\))?\s*:\s*([A-Z0-9]+)/,
    so_hd: /Số\s*(?:\(No\.?\))?\s*:\s*(\d{1,8})\b/,
    mcqt: /MCQT\s*:\s*([A-Z0-9]+)/,
    ma_tra_cuu: /mã tra cứu\s*:\s*([A-Za-z0-9]+)/i,
    bang_chu: /Số tiền viết bằng chữ\s*:\s*(.+)/,
  };
  for (const [k, re] of Object.entries(pats)) {
    const m = text.match(re);
    if (m) meta[k] = m[1].trim();
  }
  const d = text.match(/Ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/);
  if (d) meta.ngay_hd = new Date(Date.UTC(+d[3], +d[2] - 1, +d[1]));
  for (const r of ["0", "5", "8", "10"]) {
    let m = text.match(new RegExp(`Tổng tiền hàng chịu thuế ${r}%\\s*:\\s*([\\d.,]+)`));
    if (m) meta[`tien_hang_${r}`] = toNumber(m[1]);
    m = text.match(new RegExp(`Tổng tiền thuế GTGT ${r}%\\s*:\\s*([\\d.,]+)`));
    if (m) meta[`tien_thue_${r}`] = toNumber(m[1]);
  }
  return meta;
}

// ------------------------------------------------------------ kiểm tra

export function isDiscount(it) { return norm(it.ten_hang).includes("chiet khau"); }

export function validate(inv) {
  const notes = [];
  let s = 0;
  for (const it of inv.items) {
    const v = it.thanh_tien || 0;
    s += isDiscount(it) && v > 0 ? -v : v;
  }
  const total = inv.tong_thanh_toan;
  if (total != null && Math.abs(s - total) > 2)
    notes.push(`Tổng dòng hàng ${s.toLocaleString("vi-VN")} ≠ tổng thanh toán ${total.toLocaleString("vi-VN")}`);
  for (const it of inv.items) {
    const { so_luong: q, don_gia: p, thanh_tien: tt } = it;
    const thue = it.tien_thue || 0;
    if ([q, p, tt].every((v) => typeof v === "number")) {
      if (Math.min(Math.abs(q * p - tt), Math.abs(q * p + thue - tt)) > Math.max(2, 0.001 * Math.abs(tt)))
        notes.push(`Dòng ${it.stt}: SL×ĐG không khớp thành tiền`);
    }
  }
  return notes.join("; ") || "OK";
}

// ------------------------------------------------------------ entry

export async function parseInvoicePdf(pdfjsLib, data, opts = {}) {
  const doc = await pdfjsLib.getDocument({ data, ...opts }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push(await readPage(pdfjsLib, await doc.getPage(i)));

    const allText = pages.map((pg) => groupLines(pg.items).join("\n")).join("\n");
    if (allText.replace(/\s/g, "").length < 50)
      throw new Error("PDF không có lớp chữ (PDF scan/ảnh) - cần bản PDF điện tử gốc hoặc nhập tay");

    let items = [], totals = {}, firstHeaderTop = null;
    for (const pg of pages) {
      const t = parseTable(pg);
      if (!t) continue;
      if (firstHeaderTop == null) firstHeaderTop = t.headerTop;
      items = items.concat(t.rows);
      if (t.totals) totals = t.totals;
    }
    if (!items.length) throw new Error("Không nhận ra bảng hàng hoá (mẫu hoá đơn lạ)");

    const parties = parseParties(pages[0], firstHeaderTop ?? pages[0].height) || parsePartiesFallback(allText);
    const inv = { ...parseMeta(allText), ...parties, ...totals, items };
    inv.so_dong = items.length;
    inv.kiem_tra = validate(inv);
    return inv;
  } finally {
    doc.destroy();
  }
}
