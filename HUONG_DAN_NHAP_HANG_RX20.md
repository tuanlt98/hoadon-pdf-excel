# Hướng dẫn nhập hàng trên phần mềm RX20 (từ hoá đơn GTGT)

> Tóm tắt từ video `Góc_Bàn_Phía_Sau.mp4` (bản ghi màn hình, 6 phút, trên bản demo RX20)
> và áp dụng cho hoá đơn MEDX số 01121169 ngày 27/10/2026.
> Ghi chú: phần này được rút ra từ **hình ảnh** của video, không có phần lời thoại.

---

## 1. Các bước nhập một phiếu nhập hàng (theo video)

### Bước 1 – Mở màn hình nhập hàng
- Menu trên cùng → **Nhập hàng**.
- Màn hình chia 2 phần:
  - **Bên trái**: danh sách hàng nhập (Mã hàng, Tên hàng, Đơn vị, Tổng SL, Đơn giá, Thành tiền).
  - **Bên phải**: Chi nhánh, Ngày nhập, **Nhà cung cấp**, Mã phiếu nhập (tự sinh, ví dụ `PN5009-14`),
    **Tổng tiền hàng**, **Chiết khấu**, **Tiền trả nhà cung cấp** (nút **Trả đủ**), **Tính vào công nợ**, Ghi chú,
    và nút **Lưu** (màu xanh dưới cùng).

### Bước 2 – Tìm thuốc
- Gõ tên vào ô **"Tìm hàng hoá theo mã hoặc tên"** (ví dụ `panadol`).
- Danh sách gợi ý hiện: Tên thuốc, NSX, Mã thuốc (DQG…), Số đăng ký, Đơn vị.
- Bấm chọn đúng dòng.

### Bước 3 – Nếu thuốc chưa có trong danh mục: form "Thêm thuốc nhập hàng"
Khi chọn thuốc từ danh mục quốc gia mà cửa hàng chưa có, hiện form **Thêm thuốc nhập hàng** (3 tab: Thông tin / Mô tả chi tiết / Hoa hồng):
- **Mã hàng**: tự động (ví dụ `SP50091091`), có thể sửa.
- **Tên thuốc**: tự điền.
- **Giá vốn**: giá nhập (ví dụ 500).
- **Giá bán cơ bản**: giá bán lẻ (ví dụ 600).
- **Đơn vị cơ bản**: chọn trong danh sách (viên, vỉ, chai, cái, gói…). Nên chọn **đơn vị nhỏ nhất** (viên).
- **+ Thêm đơn vị**: khai đơn vị lớn hơn và quy đổi (ví dụ Hộp = 100 viên) – cần khi hoá đơn tính theo Hộp.
- Phần dưới: **Số đăng ký, Hoạt chất, Hàm lượng, Quy cách đóng gói, Hãng sản xuất, Nước sản xuất** (các trường có `*` là bắt buộc; nếu trống có thể để `NULL`).
- Bấm **Lưu** → báo "Thêm thuốc thành công", thuốc vào danh sách nhập.

### Bước 4 – Nhập lô, hạn dùng, số lượng
- Dưới tên thuốc có ô **"Nhập lô, hạn sử dụng"** → bấm → **Thêm mới lô, hạn sử dụng**.
- Form **Thêm mới lô cho …**:
  - **Mã lô** (lấy cột *Số lô* trên hoá đơn)
  - **Hạn sử dụng** (cột *Hạn dùng*, dạng dd/mm/yyyy)
  - **Số lượng** (bắt buộc)
- Bấm **Thêm** → hiện thẻ xanh `Lô - HSD - SL: …`, cột **Tổng SL** tự cập nhật.

### Bước 5 – Đơn vị, đơn giá, chiết khấu & thuế của từng dòng
- Chọn **Đơn vị** ở cột Đơn vị (viên / hộp…). Đơn giá phải khớp với đơn vị đã chọn.
- Bấm vào **Đơn giá** của dòng → mở hộp thoại:
  - **Giá vốn** (đơn giá nhập, *chưa thuế*)
  - **Giá bán**
  - **Chiết khấu**: chọn **VNĐ** hoặc **%**
  - **Thuế suất**: chọn **VNĐ** hoặc **%**, hoặc bấm nhanh nút **VAT 10% / VAT 8% / VAT 5% / VAT 0%**
  - Bấm **Lưu**.
- Ví dụ trong video: 360 viên × 500 = 180.000 → chọn VAT 5% → Thành tiền **189.000**.
- Công thức phần mềm in ở chi tiết phiếu:
  **Thành tiền = ((Đơn giá × Số lượng) − Chiết khấu) + Thuế suất**
  → tức là **chiết khấu dòng trừ TRƯỚC thuế**, thuế tính trên phần còn lại.

### Bước 6 – Chọn / thêm nhà cung cấp
- Ô **Nhà cung cấp** bên phải → tìm theo tên.
- Chưa có thì bấm **Thêm mới** → form **Thêm nhà cung cấp**: **Tên nhà cung cấp\***, **Điện thoại\***, Email, Công ty, Địa chỉ, Ghi chú, Tỉnh/Thành, Quận/Huyện, Phường/Xã, **Mã số thuế** → **Lưu**.
- Tên NCC không được trùng (báo lỗi "Đã tồn tại tên NCC này").
- Mẹo: nên nhập Mã số thuế của NCC để dễ đối chiếu hoá đơn sau này.

### Bước 7 – Thanh toán & lưu
- **Tổng tiền hàng**: tự tính (đã gồm thuế).
- **Chiết khấu** (cấp phiếu): giảm trừ trên tổng.
- **Tiền trả nhà cung cấp**: bấm **Trả đủ** nếu trả hết; nhập ít hơn thì phần còn lại vào **Tính vào công nợ**.
- **Mã phiếu nhập**: có thể sửa (nên ghi số hoá đơn để dễ tra).
- Bấm nút **Lưu** (xanh, cuối cột phải) → "Lưu thành công".

### Bước 8 – Kiểm tra sau khi lưu
- **Giao dịch → Hoá đơn nhập**: thấy phiếu (Ngày nhập, NCC, Tổng tiền, Đã trả, Trạng thái *Hoàn thành*).
  Bấm vào để xem chi tiết: Mã hàng, Tên, Lô–HSD–SL, Tổng SL, Đơn giá, Chiết khấu, Thuế suất, Thành tiền.
  Các nút: **Hoàn thành, Liên thông** (đẩy lên Dược Quốc Gia), **Gỡ liên thông, Xoá**.
- **Hàng hoá → Sản phẩm**: xem Giá vốn, Giá bán, **Tồn kho** (tab Thẻ kho, Tồn kho theo lô).
- Video còn thử bán 10 viên ở **Bán hàng** → tồn kho giảm từ 360 còn 350.

---

## 2. Áp dụng cho hoá đơn MEDX số 01121169 (27/10/2026)

### Thông tin trên hoá đơn

| Trường | Giá trị |
|---|---|
| Nhà cung cấp | CÔNG TY CP DƯỢC PHẨM MEDX – MST 0315393315 |
| Ký hiệu / Số HĐ | 1C26TMD / 01121169 |
| Ngày | 27/10/2026 |
| Dòng 1 | Mã 88088 – **Kacerin cetirizine 10mg khapharco (h/100v)** – Lô **5260926** – HD **01/10/2029** – ĐVT **Hộp** (10 vỉ × 10 viên) – SL **50** – Đơn giá **11.333,33** (chưa VAT) – VAT **5%** – Thành tiền **595.000** |
| Dòng 2 | **Chiết khấu thương mại** – 7.142,86 (chưa VAT) + VAT 5% 357,14 = **7.500** |
| Tiền hàng chịu thuế 5% (đã trừ CK) | 559.523,81 |
| Thuế GTGT 5% | 27.976,19 |
| **Tổng thanh toán** | **587.500** |

> Lưu ý: "Chiết khấu thương mại" **không phải là một mặt hàng** – không tìm thuốc tên đó để nhập.
> Nó là khoản **giảm trừ** cho dòng Kacerin.

### Các bước nhập

1. **Nhập hàng** → Nhà cung cấp: chọn **MEDX** (chưa có thì Thêm mới, ghi MST 0315393315).
2. Ngày nhập: **27/10/2026**. Mã phiếu nhập: có thể sửa thành `01121169` cho dễ đối chiếu.
3. Tìm **Kacerin** (hoặc cetirizine khapharco) → chọn.
   - Nếu chưa có trong danh mục: đơn vị cơ bản = **viên**, **+ Thêm đơn vị** `Hộp = 100 viên` (có thể thêm `Vỉ = 10 viên`).
4. Chọn đơn vị dòng = **Hộp**.
5. Nhập lô: Mã lô **5260926**, Hạn **01/10/2029**, Số lượng **50** → Thêm.
6. Bấm vào Đơn giá → hộp thoại:
   - Giá vốn: **11333,33** (giá *chưa thuế* / hộp)
   - Giá bán: theo giá bán của nhà thuốc
   - **Chiết khấu: chọn VNĐ, nhập `7142,86`** (số chiết khấu *chưa thuế*)
   - Thuế suất: bấm **VAT 5%**
   - Lưu.
7. Kiểm tra cột **Thành tiền** = **587.500** (làm tròn có thể lệch vài đồng):
   (11.333,33 × 50 − 7.142,86) × 1,05 = 559.523,64 × 1,05 ≈ **587.500** ✔
8. Ô **Chiết khấu** bên phải (cấp phiếu) để **0** – đã trừ ở dòng rồi, đừng trừ 2 lần.
9. **Tổng tiền hàng** phải = **587.500** = số "Tổng cộng tiền thanh toán" trên hoá đơn.
10. Bấm **Trả đủ** (hoặc để vào công nợ nếu chưa trả) → **Lưu**.

### Nếu Thành tiền ra sai
- **Ra khoảng 220.000** (quá thấp): ô Chiết khấu của dòng đang tính **theo từng đơn vị** → nhập lại
  `7142,86 ÷ 50 = 142,86`.
- **Ra 595.000**: chưa nhập chiết khấu hoặc chưa bấm Lưu trong hộp thoại.
- **Không nhập được số lẻ** (11.333,33): nhập 11333 / 7143 và chấp nhận lệch vài đồng, hoặc dùng cách B dưới đây.

### Cách B (đơn giản, khi chỉ cần khớp tổng tiền)
- Ở dòng Kacerin: Giá vốn 11.333,33, VAT 5%, **không** nhập chiết khấu → Thành tiền 595.000.
- Ở ô **Chiết khấu** bên phải (cấp phiếu): nhập **7.500** (số *đã gồm thuế*, vì Tổng tiền hàng ở đây đã gồm VAT).
- Tổng còn **587.500**.
- Nhược điểm: giá vốn từng hộp không phản ánh chiết khấu (lãi gộp báo cáo sẽ thấp hơn thực tế một chút).
  → **Nên dùng cách A** (chiết khấu theo dòng) khi hoá đơn chỉ có 1 mặt hàng hoặc ghi rõ CK cho mặt hàng nào.

### Hoá đơn nhiều mặt hàng + 1 dòng chiết khấu chung

**Trước hết xem hoá đơn ghi chiết khấu cho mặt hàng nào:**
- Dòng chiết khấu ghi rõ tên/mã mặt hàng, hoặc nằm ngay dưới một mặt hàng → nhập hết vào ô chiết khấu **của mặt hàng đó**.
- Chỉ ghi chung "Chiết khấu thương mại" → **chia theo tỷ lệ tiền hàng** (cách A) hoặc trừ cả cục ở cấp phiếu (cách B).

**Cách A – chia theo tỷ lệ (giá vốn từng thuốc đúng nhất)**

Công thức cho mỗi mặt hàng:

> CK của mặt hàng = CK chưa VAT × (Tiền hàng chưa VAT của mặt hàng ÷ Tổng tiền hàng chưa VAT)

Chỉ chia cho các mặt hàng **cùng thuế suất** với dòng chiết khấu (dòng CK 5% thì chỉ chia cho các thuốc 5%).

Ví dụ: giả sử hoá đơn có thêm thuốc B: 20 hộp × 15.000 (VAT 5%), chiết khấu chung vẫn 7.142,86 chưa VAT (7.500 gồm VAT):

| Mặt hàng | Tiền hàng chưa VAT | Tỷ lệ | CK nhập vào dòng (VNĐ) | Thành tiền trong RX20 |
|---|---|---|---|---|
| Kacerin 50 × 11.333,33 | 566.666,67 | 65,38% | **4.670,33** | (566.666,67 − 4.670,33) × 1,05 = 590.096 |
| Thuốc B 20 × 15.000 | 300.000,00 | 34,62% | **2.472,53** | (300.000 − 2.472,53) × 1,05 = 312.404 |
| **Cộng** | 866.666,67 | 100% | **7.142,86** | **902.500** |

Kiểm tra: (866.666,67 − 7.142,86) × 1,05 = **902.500**, đúng bằng tổng thanh toán. Mẹo: tính CK cho các dòng trước, dòng cuối lấy *tổng CK trừ các dòng đã tính* để không bị lệch do làm tròn.

**Cách B – trừ ở cấp phiếu (nhanh)**
- Các dòng thuốc nhập bình thường, không chiết khấu.
- Ô **Chiết khấu** bên phải = **7.500** (số đã gồm VAT, lấy ở cột Thành tiền của dòng chiết khấu).
- Tổng tiền hàng 917.500 − 7.500 = **902.500**.
- Nhược điểm: giá vốn từng thuốc hơi cao hơn thực tế.

**Khi có nhiều thuế suất** (ví dụ thuốc 5% và thực phẩm chức năng 8%) thường sẽ có dòng chiết khấu riêng cho mỗi mức thuế. Chia dòng CK 5% cho các mặt hàng 5% và dòng CK 8% cho các mặt hàng 8%.

---

## 3. Bảng đối chiếu nhanh: Hoá đơn → RX20

| Trên hoá đơn | Nhập vào RX20 |
|---|---|
| Đơn vị bán hàng + MST | Nhà cung cấp |
| Số HĐ | Mã phiếu nhập (tuỳ chọn) |
| Ngày hoá đơn | Ngày nhập |
| Tên hàng hoá | Tìm hàng / Thêm thuốc |
| Số lô | Mã lô |
| Hạn dùng | Hạn sử dụng |
| Đơn vị tính | Cột Đơn vị (phải có đơn vị quy đổi tương ứng) |
| Số lượng | Số lượng của lô |
| Đơn giá (chưa VAT) | Giá vốn |
| Thuế suất GTGT | Thuế suất (nút VAT 5%/8%/10%/0%) |
| Dòng "Chiết khấu thương mại" (số chưa VAT) | Chiết khấu (VNĐ) của dòng hàng |
| Tổng cộng tiền thanh toán | Phải khớp **Tổng tiền hàng** trước khi Lưu |
