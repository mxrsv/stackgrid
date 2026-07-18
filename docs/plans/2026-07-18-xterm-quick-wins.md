# Đợt 1 quick wins từ review xterm core

**Spec**: [xterm-core-capability-review-2026-07-18](../review/xterm-core-capability-review-2026-07-18.md) (§3 G1/G5/G6/G2.1/G9, §5 Đợt 1)
**Goal**: Lấp 6 khoảng trống chi phí thấp của lớp embedder xterm — OSC 8 hyperlink, overview ruler + NFC search, smooth scroll + contrast + scrollback setting, batching PTY phía Rust, `TERM_PROGRAM`, docs workaround Shift+Enter.
**Architecture**: Toàn bộ là option/config của `Terminal(...)` cộng vài seam đã có (`LinkClient`, settings store/schema/panel, reader thread trong `pty.rs`). Không đụng internals xterm, không addon mới. Phía Rust tách reader thành reader + emitter nối bằng mpsc channel để gom batch không thêm độ trễ.

## 1. Kết quả mong đợi

- ⌘+click lên hyperlink OSC 8 mở browser qua Tauri thay vì rơi vào `window.confirm`/`window.open` — verify bằng test `osc-link-handler.test.ts` + chạy app in `printf '\e]8;;https://example.com\e\\demo\e]8;;\e\\\n'`
- Search hiện vạch match trên overview ruler; search term NFD (gõ IME) vẫn match buffer — verify bằng test `search-bar.test.ts` (case normalize) + nhìn ruler khi search
- Cuộn mượt, chữ màu tối trên nền tối được nâng contrast, user chỉnh được scrollback trong Settings và giá trị sống qua restart — verify bằng test `settings-schema.test.ts` + thao tác panel Settings
- Output PTY dồn dập được gom batch trước khi emit sang webview, thứ tự byte không đổi — verify bằng test Rust `collect_batch` + `cargo test`
- Shell mới thấy `TERM_PROGRAM=Stackgrid` và `TERM_PROGRAM_VERSION` đúng version app — verify bằng `echo $TERM_PROGRAM $TERM_PROGRAM_VERSION` trong pane
- README ghi workaround xuống dòng trong Claude Code (Option+Enter / `\`+Enter) và các tính năng mới — verify bằng đọc lại README
- `npm test`, `npm run build`, `cargo test` (trong `src-tauri`) đều pass

## 2. Nguồn dữ liệu chuẩn

**Canonical data**: giá trị settings nằm trong settings store hiện có ([settings-store.ts](../../src/settings/settings-store.ts)); version app lấy từ `CARGO_PKG_VERSION` phía Rust; URI của link OSC 8 do xterm `OscLinkService` giữ và đưa vào `linkHandler.activate`.

**Lấy từ**: `Settings` đã validate qua [settings-schema.ts](../../src/settings/settings-schema.ts); `LinkClient` seam ([link-client.ts](../../src/terminal/link-client.ts)).

**KHÔNG lấy từ**: `window.open`/`navigator.*` cho link (WKWebView chặn popup); không hardcode version chuỗi rời cho `TERM_PROGRAM_VERSION` (lệch với bump version).

## 3. Business rules & invariants

- **Plain click thuộc về terminal**: link OSC 8 chỉ activate khi giữ ⌘, đồng bộ convention với link provider tự viết — verify bằng test case "plain click không gọi openUrl"
- **Chỉ http/https qua OSC 8**: giữ `allowNonHttpProtocols` mặc định `false`, không set — verify bằng đọc diff `pane.ts` (không có key này)
- **Batching không đổi thứ tự và không vỡ UTF-8**: mọi byte đi qua đúng một đường `collect_batch` → `take_valid_utf8` theo thứ tự đọc — verify bằng test Rust giữ nguyên bộ test `take_valid_utf8` + test mới
- **Thứ tự sự kiện exit giữ nguyên**: flush pending → `remove_session` → emit `pty:exit` → `unregister`, như trước khi refactor — verify bằng đọc diff emitter thread
- **Settings cũ không vỡ**: store thiếu `scrollback` → fallback 10000 — verify bằng test `validateSettings` với object thiếu field

## 4. Phạm vi / Ngoài phạm vi

**Làm**:

- `linkHandler` cho OSC 8 route về `LinkClient` (G1)
- `overviewRuler.width` + normalize NFC search term (G5)
- `smoothScrollDuration`, `minimumContrastRatio`, expose `scrollback` vào Settings (G6)
- Batching output PTY phía Rust (G2.1)
- `TERM_PROGRAM` + `TERM_PROGRAM_VERSION` (G9)
- README: workaround Shift+Enter + cập nhật tính năng; bump version 0.6.2

**KHÔNG làm**:

- Backpressure pause/resume PTY (G2.2 — Đợt 2)
- Shift+Enter encode, notification, kitty protocol, OSC 52/133 (Đợt 2–3)
- Bỏ `ConEmuANSI=ON` (vẫn cần cho OSC 9;4 của Claude Code — chỉ thêm định danh mới bên cạnh)
- Đổi renderer / WebGL

## 6. Các task

### Task 1: OSC 8 link handler

**File(s)**:

- [osc-link-handler.ts](../../src/terminal/osc-link-handler.ts) (mới)
- [osc-link-handler.test.ts](../../src/terminal/osc-link-handler.test.ts) (mới)

**Decision**: File mới `createOscLinkHandler(client?: LinkClient): ILinkHandler` — chỉ ⌘+click mới mở, lỗi mở link báo qua `reportPersistError` như [link-provider.ts](../../src/terminal/link-provider.ts) dòng 31-33.

**Build**:

- `activate(event, text)`: `event.metaKey` false → return; true → `client.openUrl(text).catch(err => reportPersistError(...))`; default client là `defaultLinkClient`
- Test với `createMemoryLinkClient`: (i) plain click không gọi `openUrl`; (ii) ⌘+click gọi `openUrl` đúng URI; (iii) `openUrl` reject không ném unhandled rejection

**Verify**:

- `npm test -- osc-link-handler` → 3 test pass

### Task 2: Gắn linkHandler + option render vào pane

**File(s)**:

- [pane.ts](../../src/terminal/pane.ts)

**Phụ thuộc**: Task 1

**Decision**: Thêm 4 option vào `new Terminal({...})`: `linkHandler: createOscLinkHandler()`, `overviewRuler: { width: 14 }`, `smoothScrollDuration: 125`, `minimumContrastRatio: 4.5`. Không set `allowNonHttpProtocols`.

**Build**:

- Thêm 4 option kèm comment ngắn lý do (OSC 8 fallback `window.confirm` bị WKWebView chặn; ruler cần width mới được tạo)
- Xoá comment lỗi thời "there is no overview ruler" ở [search-bar.ts](../../src/terminal/search-bar.ts) dòng 40-41

**Verify**:

- `npm run build` pass
- Chạy app: `printf '\e]8;;https://example.com\e\\demo\e]8;;\e\\\n'` rồi ⌘+click mở browser, plain click không mở; Cmd+F search thấy vạch trên ruler

### Task 3: Normalize NFC search term

**File(s)**:

- [search-bar.ts](../../src/terminal/search-bar.ts)
- [search-bar.test.ts](../../src/terminal/search-bar.test.ts)

**Decision**: Normalize một chiều `input.value.normalize("NFC")` tại cả 3 đường gọi addon (`findNext`, `findPrevious`, incremental input) qua helper cục bộ `searchTerm()`.

**Build**:

- Thêm helper và thay 3 chỗ đang đọc `input.value` truyền vào addon (giữ nguyên check chuỗi rỗng)
- Test: nhập chuỗi NFD (vd `"thôn"`) → fake `pane.search.findNext` nhận `"thôn"` NFC

**Verify**:

- `npm test -- search-bar` → pass, có test mới về NFC

### Task 4: Schema settings cho scrollback

**File(s)**:

- [settings-schema.ts](../../src/settings/settings-schema.ts)
- [settings-schema.test.ts](../../src/settings/settings-schema.test.ts)

**Decision**: `scrollback: number`, default 10000, choices cố định `SCROLLBACK_CHOICES = [1000, 5000, 10000, 50000, 100000]`; validate = số hữu hạn → clamp `[1000, 100000]` + round, không phải số → default.

**Build**:

- Thêm field vào `Settings`, `DEFAULT_SETTINGS`, export `SCROLLBACK_CHOICES`, hàm `clampScrollback(n: number): number`, nhánh validate trong `validateSettings`
- Test: thiếu field → 10000; `"abc"` → 10000; `250` → 1000; `999999` → 100000; `5000` → 5000

**Verify**:

- `npm test -- settings-schema` → pass

### Task 5: Pane áp dụng scrollback

**File(s)**:

- [pane.ts](../../src/terminal/pane.ts)

**Phụ thuộc**: Task 4

**Decision**: `new Terminal({ scrollback: initial.scrollback, ... })` thay cho hardcode `10_000`; `applySettings` set `term.options.scrollback = next.scrollback`.

**Build**:

- Thay hardcode và thêm 1 dòng trong `applySettings` cạnh fontFamily/fontSize/theme

**Verify**:

- `npm run build` pass; đổi scrollback trong Settings rồi `yes | head -3000` → số dòng cuộn ngược tôn trọng giá trị mới

### Task 6: UI Settings cho scrollback

**File(s)**:

- [settings-panel.tsx](../../src/ui/settings-panel.tsx)

**Phụ thuộc**: Task 4

**Decision**: Nút cycle trong group `behavior`, cùng pattern `cycleTabBar` (dòng 91-95): bấm nhảy tới choice kế tiếp trong `SCROLLBACK_CHOICES`, hiển thị dạng `10k lines`.

**Build**:

- Thêm `cycleScrollback` (tìm index hiện tại trong `SCROLLBACK_CHOICES`, giá trị clamp lệch choice thì coi như gần nhất phía dưới) + `ConfigRow label="Scrollback" desc="lines kept per pane"`

**Verify**:

- `npm test -- settings-panel` → pass; mở panel bấm cycle thấy giá trị đổi và persist sau restart

### Task 7: Batching output PTY phía Rust

**File(s)**:

- [pty.rs](../../src-tauri/src/pty.rs)

**Decision**: Reader thread chỉ đọc và `send(Vec<u8>)` vào `std::sync::mpsc`; emitter thread mới: `recv()` blocking lấy chunk đầu, rồi `try_recv()` drain tham lam tới cap 64 KB (`BATCH_MAX_BYTES`), gộp xong mới `take_valid_utf8` + `emit_to_owner`. Không dùng timer — batch lớn dần tự nhiên khi emit chậm hơn producer, echo tương tác đi thẳng không thêm độ trễ.

**Build**:

- Tách hàm `collect_batch(first: Vec<u8>, rx: &Receiver<Vec<u8>>, cap: usize) -> Vec<u8>` (pure với mpsc, unit-test được)
- Reader thread: giữ `read` loop, bỏ decode/emit, chỉ forward bytes; `pending` UTF-8 chuyển sang emitter
- Emitter thread: loop `recv()` → `collect_batch` → decode → emit; khi `recv()` trả `Disconnected`: flush `pending` lossy → `remove_session` → emit `pty:exit` → `unregister` (giữ nguyên thứ tự cũ)
- Test: (i) `collect_batch` gộp các chunk đã queue đúng thứ tự; (ii) dừng ở cap — queue 3 chunk 30 KB, cap 64 KB → lấy 2 chunk đầu, chunk 3 còn lại trong rx; (iii) queue rỗng → trả nguyên `first`

**Verify**:

- `cargo test` (trong `src-tauri`) → toàn bộ pass gồm 3 test mới + bộ `take_valid_utf8` cũ
- Chạy app: `cat` file lớn vài MB — output hiển thị đủ, không đứng hình

### Task 8: TERM_PROGRAM + TERM_PROGRAM_VERSION

**File(s)**:

- [pty.rs](../../src-tauri/src/pty.rs)

**Decision**: Trong `spawn_shell` cạnh `TERM`/`COLORTERM`: `cmd.env("TERM_PROGRAM", "Stackgrid")` + `cmd.env("TERM_PROGRAM_VERSION", env!("CARGO_PKG_VERSION"))`, không điều kiện platform; giữ `ConEmuANSI=ON` và bổ sung comment: định danh riêng để theo dõi bỏ spoof dần.

**Build**:

- Thêm 2 dòng env + sửa comment khối ConEmu

**Verify**:

- `cargo test` pass; pane mới chạy `echo $TERM_PROGRAM $TERM_PROGRAM_VERSION` → `Stackgrid 0.6.2`

### Task 9: README + bump version 0.6.2

**File(s)**:

- [README.md](../../README.md)
- [package.json](../../package.json)
- [tauri.conf.json](../../src-tauri/tauri.conf.json)
- [Cargo.toml](../../src-tauri/Cargo.toml)

**Phụ thuộc**: Task 1-8

**Decision**: Bump 0.6.1 → 0.6.2 cả 3 file version; README cập nhật 4 chỗ: mục "Cmd+click a path or URL" thêm hyperlink OSC 8; mục "Search & scrollback" thêm ruler + scrollback setting; mục "Keyboard shortcuts" thêm ghi chú Shift+Enter chưa phân biệt được (giới hạn xterm) — trong Claude Code dùng Option+Enter hoặc `\` rồi Enter để xuống dòng; mục "Settings" thêm dòng Scrollback.

**Build**:

- Sửa 3 file version cùng chuỗi `0.6.2`
- Viết 4 đoạn README nêu trên

**Verify**:

- `grep -rn "0\.6\.2" package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml` → 3 dòng
- `npm run build` + `cargo test` pass lần cuối
