Quy trình triển khai Bản đồ số 23 tổ dân phố – Phường Đống Đa được trình bày theo 5 bước. Tài liệu chỉ ghi nhận những gì ứng dụng và dữ liệu hiện có trong kho mã nguồn; các thông tin chủ dự án cần cung cấp được đánh dấu bằng ký hiệu 👉 và tổng hợp ở mục cuối.

BƯỚC 1: Chuẩn bị pháp lý, xác định yêu cầu và lựa chọn công nghệ

Bước này đặt nền móng cho kiến trúc của ứng dụng bản đồ số.
• Cơ sở pháp lý và đơn vị vận hành:
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: số, ngày ban hành và nội dung quyết định của UBND phường về triển khai bản đồ số tổ dân phố]
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: đơn vị quản lý, vận hành ứng dụng]
• Mục tiêu: Xây dựng bản đồ số 23 tổ dân phố của phường Đống Đa để xem ranh giới, số liệu và thông tin liên hệ của từng tổ, dùng được trên điện thoại và máy tính mà không cần cài đặt.
• Các lớp dữ liệu đang quản lý:
	• Ranh giới 23 tổ dân phố và đường viền ranh giới phường.
	• 68 địa điểm gắn với tổ nơi điểm đó nằm: 23 nhà sinh hoạt cộng đồng (vị trí gần đúng theo địa chỉ), 20 trường học, 6 cơ sở y tế, 7 công sở, 10 đình/chùa/đền/nhà thờ, 1 di tích (Gò Đống Đa), 1 cơ sở chăm sóc người cao tuổi.
	• Thông tin quản lý theo tổ: số hộ dân, số nhân khẩu, nhà sinh hoạt cộng đồng, Bí thư chi bộ, Tổ trưởng, Cảnh sát khu vực; thông tin liên hệ UBND phường và Ban Tiếp công dân.
• Công nghệ đã chọn:
	• Trang web tĩnh (HTML/CSS/JavaScript), thư viện bản đồ Leaflet 1.9.4, phông chữ Roboto; không có bước biên dịch và không có máy chủ riêng.
	• Bản đồ nền vector OpenFreeMap (MapLibre GL, dữ liệu OpenStreetMap), đã ẩn nhãn địa danh và điểm quan tâm để không hiện tên phường, quận cũ; ảnh vệ tinh Esri World Imagery; không sử dụng ô bản đồ của Google.
	• Công bố qua GitHub Pages (https://socmia.github.io/geo-hanoi/) và nhúng vào Google Sites của phường (https://sites.google.com/view/phuongdongda).

BƯỚC 2: Thu thập dữ liệu

Dữ liệu trong ứng dụng đến từ các nguồn có sẵn, được nhập bằng tập lệnh hoặc nhập tay vào tệp dữ liệu.
• Ranh giới tổ dân phố: nhập từ bản đồ Google My Maps "Bản đồ đống đa" bằng scripts/import_mymaps_tdp.py (tải KML, giữ các đối tượng có tên "Tổ dân phố").
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: đơn vị và thời điểm lập bản đồ Google My Maps nguồn]
• Viền ranh giới phường: lấy từ data/hanoi.geojson (sinh bằng scripts/build-geojson.py).
• Địa điểm công cộng: lấy từ OpenStreetMap qua Overpass API bằng scripts/fetch_poi.py, chỉ giữ các điểm nằm trong ranh giới tổ; sau đó áp dữ liệu rà soát của phường trong data/poi-curation.json (bỏ, đổi tên, thêm điểm) bằng scripts/curate_poi.py.
• Số liệu và liên hệ theo tổ: do phường cung cấp, nhập vào data/tdp-extra.json; toàn phường có 24.639 hộ dân và 82.435 nhân khẩu (tổng của 23 tổ). Số hộ và nhân khẩu chỉ ở mức tổng hợp cấp tổ; không lưu dữ liệu cá nhân của người dân. Họ tên và số điện thoại của Bí thư, Tổ trưởng, Cảnh sát khu vực là dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) và đang được công bố.
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: cơ quan cung cấp và thời điểm chốt số liệu hộ dân, nhân khẩu]

BƯỚC 3: Xử lý, chuẩn hóa và xây dựng cơ sở dữ liệu

Dữ liệu được tổ chức thành các tệp, không dùng cơ sở dữ liệu máy chủ.
• Tổ chức dữ liệu: các tệp GeoJSON/JSON trong thư mục data/ (to-dan-pho.geojson, hanoi.geojson, poi.geojson, tdp-extra.json); tọa độ theo thứ tự [kinh độ, vĩ độ] (WGS84).
• Làm sạch dữ liệu: loại bản trùng, đóng vòng đa giác, gán số tổ từ tên đối tượng, loại địa điểm trùng theo loại và tên, gán từng địa điểm vào tổ chứa nó.
• Diện tích: tính trực tiếp trong trình duyệt từ đa giác ranh giới, hiển thị dạng "≈ N ha"; đây là số ước tính.
• Thuộc tính hiển thị khi chọn một tổ: tên tổ, số hộ dân, số nhân khẩu, Bí thư chi bộ, Tổ trưởng, Cảnh sát khu vực, nhà sinh hoạt cộng đồng. Trường chưa có dữ liệu hiển thị "Đang cập nhật".
• Tài liệu tổng hợp docs/phuong-dong-da-23-tdp.md được sinh từ tệp JSON bằng scripts/gen_tdp_doc.py.

BƯỚC 4: Phát triển phần mềm và giao diện

Giao diện gồm hai trang web tĩnh: trang bản đồ (index.html, css/map.css, js/app.js) và trang chi tiết tổ (to.html, css/to.css, js/to-detail.js).
• Trang bản đồ:
	• Thanh công cụ: bộ lọc Phường và Tổ dân phố, "Lớp dữ liệu" (bản đồ/vệ tinh), "Lấy tọa độ" (bấm vào bản đồ để hiện và sao chép vĩ độ, kinh độ), vị trí của tôi, toàn màn hình, phóng to/thu nhỏ.
	• Mỗi tổ một màu, nhãn "Tổ dân phố N" hiển thị từ mức thu phóng 15; điểm trường học, y tế, cơ quan.
• Thẻ thông tin tổ: số hộ, nhân khẩu và các liên hệ; số điện thoại bấm gọi một chạm; nút "Chia sẻ" (liên kết dạng #tdp-N) và "Xem chi tiết".
• Trang chi tiết to.html?n=N: bản đồ nhỏ của tổ, diện tích, số hộ, nhân khẩu, phần giới thiệu, liên hệ (kèm UBND phường, Ban Tiếp công dân) và danh sách địa điểm trong tổ.
• Giao diện thích ứng màn hình máy tính và điện thoại. Đây là trang xem công khai: mọi người dùng thấy cùng một nội dung ở cấp tổ (ranh giới, địa điểm công cộng, liên hệ), số điện thoại cán bộ hiển thị công khai.
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: xác nhận được phép công bố số điện thoại Bí thư, Tổ trưởng, Cảnh sát khu vực]

BƯỚC 5: Thử nghiệm và đưa vào vận hành

• Kiểm thử tự động: 16 kịch bản Playwright (npx playwright test, tests/e2e/map-selection.spec.js) kiểm tra tải đủ 23 tổ, vị trí khởi tạo, màu và nhãn từng tổ, chọn tổ và thẻ thông tin, liên kết điện thoại khớp tdp-extra.json, liên kết trực tiếp #tdp-N, chuyển lớp vệ tinh, lấy tọa độ, hiển thị địa điểm, trang chi tiết, bố cục máy tính và điện thoại.
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: kết quả chạy thử tại tổ dân phố và ý kiến góp ý của người dùng]
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: kế hoạch hoặc kết quả tập huấn, tài liệu hướng dẫn sử dụng]
• Triển khai: đẩy mã lên nhánh main, quy trình GitHub Actions (.github/workflows/pages.yml) tự triển khai lên GitHub Pages; trang Google Sites nhúng tự cập nhật theo.
• Cập nhật dữ liệu hiện nay: (1) sửa data/tdp-extra.json hoặc chạy tập lệnh làm mới (fetch_poi.py, import_mymaps_tdp.py); (2) chạy scripts/gen_tdp_doc.py để sinh lại tài liệu; (3) chạy npx playwright test; (4) đẩy lên main.
	👉 [CHƯA CÓ THÔNG TIN – chủ dự án bổ sung: quy chế cập nhật dữ liệu (ai đề xuất, ai duyệt, tần suất)]

Mục cần chủ dự án bổ sung
- [ ] Căn cứ pháp lý: quyết định của UBND phường về triển khai bản đồ số
- [ ] Đơn vị quản lý, vận hành ứng dụng
- [ ] Đơn vị và thời điểm lập bản đồ Google My Maps nguồn
- [ ] Cơ quan cung cấp và thời điểm chốt số liệu hộ dân, nhân khẩu
- [ ] Xác nhận công bố số điện thoại cán bộ
- [ ] Kết quả chạy thử và góp ý của người dùng
- [ ] Tập huấn, tài liệu hướng dẫn sử dụng
- [ ] Quy chế cập nhật dữ liệu
