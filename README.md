# Hoá đơn PDF → Excel

Đọc hoá đơn GTGT dạng **PDF điện tử** và gộp thành 1 file Excel để làm data đầu vào cho tool khác.
Miễn phí, không cần API key.

## 1. Bản web (dùng mọi lúc mọi nơi)

Mở trang GitHub Pages của repo (thư mục [`docs/`](docs/)):

1. **Chọn hoá đơn**: chọn nhiều file, chọn cả thư mục, hoặc kéo-thả.
2. **Nơi lưu file Excel**: chọn thư mục trên máy (Chrome/Edge trên máy tính; trang nhớ lựa chọn cho lần sau).
   Trình duyệt khác thì file được tải về thư mục Tải về.
3. Bấm **Đọc & xuất Excel**.

**Cột bổ sung (⚙)**: lấy thêm trường không có sẵn — gõ đúng chữ in trên hoá đơn, chọn lấy ở
“Thông tin chung” (dạng `Nhãn : giá trị`) hoặc “Cột trong bảng hàng” (tiêu đề cột), chọn kiểu Chữ/Số/Ngày.
Cấu hình tự lưu trên trình duyệt; có thể lưu ra file `.json` để chia sẻ cho người khác.

Toàn bộ xử lý chạy ngay trong trình duyệt của người dùng — file PDF **không được tải lên** máy chủ nào.

Chạy thử trên máy: `python -m http.server 8765 --directory docs` rồi mở http://localhost:8765

## 2. Bản Python (chạy trên máy)

```powershell
pip install -r requirements.txt
python invoice_to_excel.py "D:\HoaDon\Thang10" -o thang10.xlsx
```

Hoặc kéo-thả file/thư mục vào `keo_tha_vao_day.bat`.

## File Excel đầu ra

- **Worksheet** (bản web, bật/tắt ở bước 2) – đúng mẫu “Danh sách đơn nhập hàng” của RX20: CHI NHÁNH, MÃ HĐ, THỜI GIAN, NHÀ CUNG CẤP, NGƯỜI NHẬP, TÊN HÀNG, MÃ HÀNG, ĐƠN VỊ, SỐ LÔ, HẠN DÙNG, SỐ LƯỢNG, ĐƠN GIÁ, GIẢM GIÁ, THUẾ SUẤT, THÀNH TIỀN. Dòng chiết khấu thương mại được chia vào GIẢM GIÁ (chưa thuế) của các mặt hàng cùng thuế suất theo tỷ lệ tiền; THÀNH TIỀN = (SL × Đơn giá − Giảm giá) × (1 + thuế suất).
- **ChiTiet** – mỗi dòng hàng 1 dòng: Ký hiệu, Số HĐ, Ngày, MST/Tên NCC, Mã đơn hàng, Mã hàng, Tên hàng, Số lô, Hạn dùng, ĐVT, SL, Đơn giá, Thuế suất, Tiền thuế, Thành tiền, Loại dòng (Hàng hoá / Chiết khấu).
- **HoaDon** – mỗi hoá đơn 1 dòng: người bán, người mua, tổng tiền theo thuế suất, cột **Kiểm tra** (tự đối chiếu tổng dòng hàng với tổng thanh toán và SL×ĐG).
- **Loi** – file lỗi (PDF scan, mẫu lạ, file hỏng) hoặc lệch tổng, cần xem lại bằng tay.

Chỉ đọc được PDF có lớp chữ (mở ra bôi đen được chữ). Dòng chiết khấu giữ số dương như in trên hoá đơn, phân biệt bằng cột "Loại dòng".

Thư viện dùng trong bản web (đã kèm trong `docs/vendor/`): [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0), [ExcelJS](https://github.com/exceljs/exceljs) (MIT).
