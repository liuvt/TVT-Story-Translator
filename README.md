# TVT Story Translator – Extension dịch truyện & chuẩn TTS

**Chrome Extension Manifest V3**, sử dụng side panel, chạy trên hầu hết trang web thông thường và xử lý bằng OpenAI Responses API.

## Tính năng

- Nhấp biểu tượng Extension để mở panel bên cạnh website. Bôi đen văn bản rồi chọn **Đoạn đã chọn**; hoặc dùng chuột phải → **TVT: Dịch / hiệu đính đoạn được chọn**.
- **Lấy bài viết** thử nhận diện `article`, `main`, `chapter-content` (trang quá nhiều quảng cáo nên chọn thủ công để đảm bảo độ chính xác).
- **Dịch → Việt → TTS**, **chỉ hiệu đính ASR/TTS**, **biên tập lại theo phong cách**. Mặc định có 3 preset: TTS giữ nguyên nội dung; Độc Sĩ / Diêm Vương Sống; Cao Dương hiệu đính ASR.
- Cho phép xem và chỉnh từng preset phong cách trực tiếp trong Cài đặt, nhập quy tắc phong cách riêng, từ điển sửa tên nhân vật và ghi chú cho từng lần chạy.
- Chia yêu cầu dài theo các đoạn nhỏ; xử lý tuần tự; kết quả của các đoạn hoàn tất được giữ lại khi API lỗi. Có nút **Tiếp tục** và **Dừng**.
- Chỉnh văn bản kết quả tại chỗ, sao chép, xuất `.txt` **UTF-8 BOM** hoặc chia mỗi `.txt` tối đa **50.000 ký tự**, tương thích luồng chuẩn bị văn bản cho TVT Team TTS.

## Cài đặt trên Windows/Chrome

1. Giải nén `TVT-Story-Translator.zip` thành một thư mục cố định, ví dụ `D:\\Tools\\TVT-Story-Translator`.
2. Mở Google Chrome và truy cập `chrome://extensions`.
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)**.
4. Nhấn **Tải tiện ích đã giải nén (Load unpacked)**, chọn thư mục chứa `manifest.json`.
5. Ghim biểu tượng **TVT Story Translator** lên thanh Chrome (nếu muốn).
6. Nhấn biểu tượng → biểu tượng ⚙ → nhập **OpenAI API key** từ https://platform.openai.com/api-keys → **Lưu cài đặt**.
7. Quay lại panel, chọn chế độ, preset. Bôi đen truyện và nhấn **Đoạn đã chọn**, hoặc nhấp chuột phải chọn extension.
8. Nhấn **Bắt đầu xử lý**, kiểm tra đầu ra và nhấn **Xuất TXT** hoặc **TXT ≤50k**.

> **Lưu ý:** API OpenAI tính phí riêng; đăng ký ChatGPT Plus/Pro không đồng nghĩa có tín dụng API. Model mặc định là `gpt-6-luna` (có thể đổi thành một model mà API key của bạn được cấp quyền). Chưa cung cấp API key thì bạn vẫn có thể dùng công cụ trích văn bản và xuất TXT thủ công, nhưng không dịch bằng AI được.

## Bảo mật

- Extension **không chứa API key có sẵn**. Khóa được người dùng nhập ở phần Cài đặt.
- Mặc định, API key chỉ lưu trong `chrome.storage.session`, không lưu qua các lần khởi động mới. Khi bật **Lưu API key trên máy**, khóa sẽ lưu bằng `chrome.storage.local`, **không được mã hóa riêng**; tránh dùng máy chung.
- Văn bản chỉ gửi tới API OpenAI khi người dùng nhấn nút xử lý. `store:false` được đặt trong yêu cầu API.
- Không yêu cầu quyền đọc tất cả website (`<all_urls>`). Chỉ sử dụng quyền `activeTab` sau thao tác chủ động; host permission giới hạn `https://api.openai.com/*`.
- Không hỗ trợ trực tiếp trang bị Chrome hạn chế chạy script (`chrome://`, Chrome Web Store, và một số iframe cross-origin). Hãy copy/dán khi gặp lỗi.
- **Lưu ý production:** Khóa API trong extension phía client vẫn có thể bị đọc bởi phần mềm hay extension độc hại chạy với quyền người dùng. Nếu triển khai cho nhiều tài khoản, nên xây dựng backend xác thực và proxy OpenAI thay vì phân phối API key trong client.

## Về bộ nhớ ChatGPT và giới hạn kỹ thuật

Extension **không truy cập trực tiếp Memory, hội thoại ChatGPT hoặc gói ChatGPT Plus của người dùng**. Các preset được khai báo trực tiếp trong source `core.js`; quy tắc riêng có thể dán vào Cài đặt. Điều này giúp cho phong cách xử lý nhất quán, dù chạy ngoài ChatGPT.

Prompt yêu cầu không cắt/tóm tắt/tự thêm nội dung, nhưng model AI vẫn có thể sai hoặc bỏ sót; đặc biệt với chương dài, cần đối chiếu kết quả và văn bản gốc. Các phần được dịch tách biệt có thể khác đôi chút về cách dịch tên riêng; bật từ điển và kiểm tra thủ công sẽ giúp giảm lỗi. Tính năng trích văn bản trang web bị giới hạn 250.000 ký tự/lần; người dùng có thể dán văn bản dài hơn nếu cần (chú ý chi phí API).

Đầu ra TXT chỉ là văn bản, **không sinh MP3 hoặc SRT đồng bộ theo âm thanh**. Muốn có SRT chính xác, cần tạo trong quá trình render audio hoặc forced alignment.

## Cấu trúc

- `manifest.json`: khai báo Manifest V3, quyền, sidepanel, API host.
- `background.js`: nút toolbar và menu chuột phải.
- `panel.html`, `panel.js`, `ui.css`: giao diện và xử lý text bằng OpenAI Responses API.
- `options.html`, `options.js`: API key, model, phong cách, từ điển.
- `core.js`: prompt preset, chia văn bản, định dạng TXT, xử lý phản hồi.
- `tests/core.test.js`: kiểm tra không làm mất ký tự khi chia văn bản, preset, token output, dictionary.

## Kiểm thử phát triển

Máy có Node.js 20+ chạy:

```bash
npm test
```

Chạy kiểm tra cú pháp:

```bash
node --check background.js
node --check panel.js
node --check options.js
node --check core.js
```

Không có `npm install`, không dùng CDN/script ngoài, không có dependency runtime.

## Phạm vi bản 1.0

- Đây là **Chrome Extension**, không phải plugin/tiện ích được tích hợp vào chính mã nguồn website. Có thể cấu hình giới hạn trên một domain cụ thể nếu cần triển khai riêng.
- Chưa tích hợp **TVT Team TTS** API / chuyển thẳng sang render MP3; cần nhập TXT qua webapp TTS.
- Chưa làm máy chủ proxy bảo vệ API key. Bản này phù hợp dùng **cá nhân trên máy riêng** hoặc thử nghiệm.
