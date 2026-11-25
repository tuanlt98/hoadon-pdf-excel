import * as pdfjsLib from "./vendor/pdf.min.js";
import { parseInvoicePdf, validate, detectFields, norm } from "./parser.js?v=4";
import { buildExcel, BUILTIN_COLUMNS } from "./excel.js?v=4";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.js", import.meta.url).href;
const PDF_OPTS = {
  cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
  cMapPacked: true,
  isEvalSupported: false,
};

const $ = (id) => document.getElementById(id);
const files = []; // {file, path, status, inv, error}
let outDir = null; // FileSystemDirectoryHandle
const canPickDir = "showDirectoryPicker" in window;

// ------------------------------------------------------------ danh sách file

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const fmt = (n) => (typeof n === "number" ? n.toLocaleString("vi-VN") : "");

function addFiles(list) {
  let added = 0;
  for (const { file, path } of list) {
    if (!/\.pdf$/i.test(file.name)) continue;
    const key = `${path}|${file.size}|${file.lastModified}`;
    if (files.some((f) => f.key === key)) continue;
    files.push({ file, path, key, status: "wait" });
    added++;
  }
  render();
  return added;
}

function render() {
  const tb = $("list").querySelector("tbody");
  if (!files.length) {
    tb.innerHTML = '<tr class="empty"><td colspan="7">Chưa có file nào</td></tr>';
  } else {
    tb.innerHTML = files.map((f, i) => {
      let st = '<span class="st-wait">Chờ</span>';
      if (f.status === "run") st = '<span class="st-wait">Đang đọc…</span>';
      else if (f.status === "ok") st = '<span class="st-ok">OK</span>';
      else if (f.status === "warn") st = `<span class="st-warn" title="${esc(f.inv.kiem_tra)}">Lệch: ${esc(f.inv.kiem_tra)}</span>`;
      else if (f.status === "err") st = `<span class="st-err">Lỗi: ${esc(f.error)}</span>`;
      const inv = f.inv || {};
      return `<tr><td>${i + 1}</td><td class="file">${esc(f.path)}</td><td>${st}</td>
        <td>${esc(inv.so_hd)}</td><td>${esc(inv.ten_ncc)}</td>
        <td class="num">${inv.items ? inv.items.length : ""}</td><td class="num">${fmt(inv.tong_thanh_toan)}</td></tr>`;
    }).join("");
  }
  $("clearBtn").disabled = !files.length;
  $("runBtn").disabled = !files.length;
}

$("pickFiles").addEventListener("change", (e) => {
  addFiles([...e.target.files].map((f) => ({ file: f, path: f.name })));
  e.target.value = "";
});
$("pickFolder").addEventListener("change", (e) => {
  const n = addFiles([...e.target.files].map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
  if (!n) alert("Không tìm thấy file PDF mới nào trong thư mục này.");
  e.target.value = "";
});
$("clearBtn").addEventListener("click", () => { files.length = 0; $("progress").textContent = ""; render(); });

// kéo-thả (cả thư mục)
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: prefix + file.name });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const ch of batch) await walkEntry(ch, prefix + entry.name + "/", out);
    } while (batch.length);
  }
}

drop.addEventListener("drop", async (e) => {
  e.preventDefault();
  const out = [];
  const entries = [...e.dataTransfer.items].map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
  if (entries.length) for (const en of entries) await walkEntry(en, "", out);
  else for (const f of e.dataTransfer.files) out.push({ file: f, path: f.name });
  addFiles(out);
});

// ------------------------------------------------------------ cấu hình cột bổ sung

const CFG_KEY = "hoadon-extras";
let extras = [];
try { extras = JSON.parse(localStorage.getItem(CFG_KEY) || "[]"); } catch { extras = []; }

const validExtras = () => extras.filter((e) => e.name.trim() && e.label.trim());
function saveExtras() {
  localStorage.setItem(CFG_KEY, JSON.stringify(extras));
  const n = validExtras().length;
  $("extraCount").textContent = n ? `${n} trường` : "";
}

function renderExtras() {
  const tb = $("extraTable").querySelector("tbody");
  if (!extras.length) {
    tb.innerHTML = '<tr class="empty"><td colspan="5">Chưa có trường bổ sung — bấm “+ Thêm trường”.</td></tr>';
  } else {
    tb.innerHTML = extras.map((e, i) => `<tr data-i="${i}">
      <td><input data-k="name" value="${esc(e.name)}" placeholder="vd: Mã KH"></td>
      <td><input data-k="label" value="${esc(e.label)}" placeholder="vd: Mã khách hàng"></td>
      <td><select data-k="where">
        <option value="header"${e.where !== "table" ? " selected" : ""}>Thông tin chung</option>
        <option value="table"${e.where === "table" ? " selected" : ""}>Cột trong bảng hàng</option></select></td>
      <td><select data-k="type">
        <option value="text"${e.type === "text" ? " selected" : ""}>Chữ</option>
        <option value="number"${e.type === "number" ? " selected" : ""}>Số</option>
        <option value="date"${e.type === "date" ? " selected" : ""}>Ngày</option></select></td>
      <td><button class="icon-btn" data-del="${i}" title="Xoá trường này" type="button">✕</button></td></tr>`).join("");
  }
  saveExtras();
}

$("extraTable").addEventListener("input", (ev) => {
  const k = ev.target.dataset.k, tr = ev.target.closest("tr");
  if (!k || !tr) return;
  extras[+tr.dataset.i][k] = ev.target.value;
  saveExtras();
});
// gõ "Chữ trên hoá đơn" mà để trống tên cột -> tự lấy làm tên cột
$("extraTable").addEventListener("change", (ev) => {
  const tr = ev.target.closest("tr");
  if (ev.target.dataset.k !== "label" || !tr) return;
  const e = extras[+tr.dataset.i];
  if (!e.name.trim() && e.label.trim()) {
    e.name = e.label.trim().replace(/:$/, "");
    tr.querySelector('[data-k="name"]').value = e.name;
    saveExtras();
  }
});
$("extraTable").addEventListener("click", (ev) => {
  const d = ev.target.dataset.del;
  if (d !== undefined) { extras.splice(+d, 1); renderExtras(); renderDetected(); }
});
$("addExtra").addEventListener("click", () => {
  extras.push({ name: "", label: "", where: "header", type: "text" });
  renderExtras();
  $("extraTable").querySelector("tbody tr:last-child input").focus();
});
$("exportCfg").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ version: 1, extras: validExtras() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "cau_hinh_hoa_don.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});
$("importCfg").addEventListener("change", async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = Array.isArray(data) ? data : data.extras;
    if (!Array.isArray(list)) throw new Error("không đúng định dạng");
    extras = list.map((e) => ({
      name: String(e.name ?? ""), label: String(e.label ?? ""),
      where: e.where === "table" ? "table" : "header",
      type: ["number", "date"].includes(e.type) ? e.type : "text",
    }));
    renderExtras();
    $("extraBox").open = true;
  } catch (e) {
    alert("Không đọc được file cấu hình: " + e.message);
  }
});
renderExtras();

// danh sách cột có sẵn
$("builtinCols").innerHTML = Object.entries(BUILTIN_COLUMNS).map(([sheet, cols]) =>
  `<div><b>Sheet ${sheet}:</b> ${cols.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>`).join("");

// ------------------------------------------------------------ dò trường trên hoá đơn

let detected = [];
const isAdded = (d) => extras.some((e) => norm(e.label) === norm(d.label) && (e.where === "table") === (d.where === "table"));

function guessType(v) {
  const t = String(v || "").trim();
  if (/^\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4}$/.test(t) || /tháng.*năm/i.test(t)) return "date";
  if (/^-?[\d.,]+%?$/.test(t) && !/^0\d/.test(t) && /[.,]|^\d{1,6}$/.test(t)) return "number";
  return "text";
}

function renderDetected() {
  const tb = $("detectTable").querySelector("tbody");
  tb.innerHTML = detected.map((d, i) => {
    const act = d.builtIn ? '<span class="have">Đã có sẵn</span>'
      : isAdded(d) ? '<span class="have">✓ Đã thêm</span>'
      : `<button class="btn small" data-add="${i}" type="button">+ Thêm</button>`;
    return `<tr><td>${d.where === "table" ? "Bảng hàng" : "Thông tin chung"}</td><td>${esc(d.label)}</td>
      <td class="val">${esc(d.value) || "<i>(trống)</i>"}</td><td>${act}</td></tr>`;
  }).join("");
}

$("detectTable").addEventListener("click", (ev) => {
  const i = ev.target.dataset.add;
  if (i === undefined) return;
  const d = detected[+i];
  extras.push({ name: d.label, label: d.label, where: d.where, type: guessType(d.value) });
  renderExtras();
  renderDetected();
});

async function runDetect(file, name) {
  $("detectInfo").textContent = `Đang dò ${name}…`;
  try {
    const r = await detectFields(pdfjsLib, new Uint8Array(await file.arrayBuffer()), PDF_OPTS);
    detected = [
      ...r.header.map((d) => ({ ...d, where: "header" })),
      ...r.table.map((d) => ({ ...d, where: "table" })),
    ].sort((a, b) => a.builtIn - b.builtIn);
    renderDetected();
    $("detectBox").hidden = false;
    const free = detected.filter((d) => !d.builtIn).length;
    $("detectInfo").textContent = `Dò từ file “${name}”: ${detected.length} trường, ${free} trường chưa có sẵn.`;
  } catch (e) {
    $("detectInfo").textContent = "Không dò được: " + e.message;
  }
}

const detectPicker = Object.assign(document.createElement("input"), { type: "file", accept: ".pdf,application/pdf" });
detectPicker.addEventListener("change", () => {
  const f = detectPicker.files[0];
  detectPicker.value = "";
  if (f) runDetect(f, f.name);
});
$("detectBtn").addEventListener("click", () => {
  if (files.length) runDetect(files[0].file, files[0].path);
  else detectPicker.click(); // chưa chọn file nào ở bước 1 -> cho chọn 1 file mẫu
});

// ------------------------------------------------------------ thư mục lưu (nhớ giữa các lần mở trang)

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("hoadon-excel", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kv(key, value) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", value === undefined ? "readonly" : "readwrite");
    const st = tx.objectStore("kv");
    const r = value === undefined ? st.get(key) : value === null ? st.delete(key) : st.put(value, key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function renderOut() {
  if (!canPickDir) {
    $("pickOut").hidden = true;
    $("outInfo").innerHTML = "Trình duyệt này không hỗ trợ chọn thư mục lưu — file sẽ được tải về thư mục <b>Tải về (Downloads)</b>. " +
      "Dùng Chrome hoặc Edge trên máy tính để chọn được thư mục lưu.";
    return;
  }
  $("resetOut").hidden = !outDir;
  $("outInfo").innerHTML = outDir
    ? `Đang lưu vào thư mục: <b>${esc(outDir.name)}</b>`
    : "Chưa chọn — file sẽ được tải về thư mục <b>Tải về (Downloads)</b> của trình duyệt.";
}

$("pickOut").addEventListener("click", async () => {
  try {
    outDir = await window.showDirectoryPicker({ id: "hoadon-out", mode: "readwrite" });
    await kv("outDir", outDir);
  } catch (e) {
    if (e.name !== "AbortError") alert("Không chọn được thư mục: " + e.message);
  }
  renderOut();
});
$("resetOut").addEventListener("click", async () => { outDir = null; await kv("outDir", null); renderOut(); });

const savedName = localStorage.getItem("hoadon-fileName");
if (savedName) $("fileName").value = savedName;
$("addTime").checked = localStorage.getItem("hoadon-addTime") !== "0";
$("fileName").addEventListener("change", () => localStorage.setItem("hoadon-fileName", $("fileName").value));
$("addTime").addEventListener("change", () => localStorage.setItem("hoadon-addTime", $("addTime").checked ? "1" : "0"));

if (canPickDir) {
  kv("outDir").then((h) => { if (h) outDir = h; renderOut(); }).catch(() => renderOut());
} else renderOut();

// ------------------------------------------------------------ xuất

function outName() {
  let base = ($("fileName").value || "hoa_don").trim().replace(/\.xlsx$/i, "").replace(/[\\/:*?"<>|]/g, "_");
  if ($("addTime").checked) {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    base += `_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  return base + ".xlsx";
}

async function saveFile(blob, name) {
  if (outDir) {
    const fh = await outDir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return `Đã lưu ${name} vào thư mục “${outDir.name}”`;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return `Đã tải về ${name}`;
}

$("runBtn").addEventListener("click", async () => {
  // xin quyền ghi thư mục ngay khi bấm (trình duyệt yêu cầu thao tác người dùng)
  if (outDir) {
    try {
      const perm = await outDir.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        alert("Chưa được cấp quyền ghi vào thư mục đã chọn — file sẽ được tải về thư mục Tải về.");
        outDir = null; renderOut();
      }
    } catch { outDir = null; renderOut(); }
  }

  $("runBtn").disabled = $("clearBtn").disabled = true;
  const cfg = validExtras();
  const invoices = [], errors = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    $("progress").textContent = `Đang đọc ${i + 1}/${files.length}…`;
    f.status = "run"; f.inv = null; f.error = null; render();
    try {
      const data = new Uint8Array(await f.file.arrayBuffer());
      const inv = await parseInvoicePdf(pdfjsLib, data, PDF_OPTS, cfg);
      inv.file = f.path;
      inv.kiem_tra = validate(inv);
      f.inv = inv;
      f.status = inv.kiem_tra === "OK" ? "ok" : "warn";
      if (inv.kiem_tra !== "OK") errors.push([f.path, inv.kiem_tra]);
      if (inv.thieu_truong) errors.push([f.path, inv.thieu_truong]);
      invoices.push(inv);
    } catch (e) {
      f.status = "err";
      f.error = /Invalid PDF|password/i.test(e.message) ? "File hỏng hoặc có mật khẩu" : e.message;
      errors.push([f.path, f.error]);
    }
    render();
  }

  try {
    $("progress").textContent = "Đang tạo file Excel…";
    const buf = await buildExcel(window.ExcelJS, invoices, errors, cfg);
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const msg = await saveFile(blob, outName());
    $("progress").textContent = `${msg} — ${invoices.length} hoá đơn, ${errors.length} lỗi/cảnh báo.`;
  } catch (e) {
    $("progress").textContent = "Lỗi khi lưu Excel: " + e.message;
  }
  $("runBtn").disabled = $("clearBtn").disabled = false;
});

render();
