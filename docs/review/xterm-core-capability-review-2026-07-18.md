# Review năng lực xterm.js 6 — Stackgrid với vai trò embedder

- **Ngày**: 2026-07-18 (bản hợp nhất — thay thế draft cùng ngày lúc 13:58 của session song song; các điểm khác biệt giữa hai bản đã được phân xử bằng cách đọc lại source, ghi chú tại §7)
- **Phạm vi**: toàn bộ source `@xterm/xterm` 6.0.0 (`node_modules/@xterm/xterm/src/`) + addons đang cài (`addon-fit` 0.11, `addon-search` 0.16, `addon-unicode-graphemes` 0.4), đối chiếu với cách Stackgrid đang nhúng (`src/terminal/`, `src/lib/`, `src-tauri/`)
- **Phương pháp**: 5 trục audit song song (keyboard, protocol, rendering, tiện ích, hiệu năng); mọi kết luận có/không đều đọc source thật và trích dẫn `file:line`; các trích dẫn then chốt được xác minh chéo lần hai
- **Môi trường ràng buộc**: Tauri 2 WKWebView trên macOS (không phải Chromium); IME tiếng Việt phải tiếp tục hoạt động (`macOptionIsMeta: false`, `webkit-ime-fix.ts` chiếm slot duy nhất của `attachCustomKeyEventHandler`)
- **Liên quan**: `docs/review/findings-xterm-core-2026-07-18.md` (Shift+Enter / kitty keyboard protocol — không lặp lại ở đây, chỉ bổ sung)
- **Trạng thái**: chỉ review — chưa sửa dòng code nào

Ký hiệu phân loại khoảng trống: **(a)** chỉ cần bật option · **(b)** addon chính thức · **(c)** tự implement qua public hooks (kể cả cần command Rust mới) · **(d)** cần fork/patch core. Effort S (<1 ngày) / M (vài ngày) / L (tuần+); giá trị cho use case agent CLI: Cao/Trung/Thấp.

---

## 1. Tóm tắt điều hành

xterm.js 6 với tư cách VT engine là **đủ** cho Stackgrid: DOM render, mouse SGR, bracketed paste, DEC 2026 synchronized output, DA1/DA2, OSC title/colors/hyperlink, grapheme addon. Khoảng trống so với iTerm2/Ghostty không nằm ở "thiếu option" mà ở lớp **embedder protocol** — đúng lớp mà VS Code cũng tự làm: keyboard hiện đại (Shift+Enter / kitty protocol), shell integration (OSC 133), notification (OSC 9 / bell), clipboard (OSC 52), flow control.

**Ba phát hiện đáng tiền nhất:**

1. **OSC 8 hyperlink là lỗ hổng UX đang chảy máu.** xterm tự động đăng ký `OscLinkProvider` cho mọi Terminal (`CoreBrowserTerminal.ts:160`); vì Stackgrid không set option `linkHandler`, click vào hyperlink OSC 8 (agent CLI in ngày càng nhiều) rơi vào fallback `window.confirm()` + `window.open()` (`OscLinkProvider.ts:114-129`) — thứ WKWebView thường chặn hoặc mở popup vô chủ. Fix = 1 option trỏ về `link-client.ts` sẵn có. **(a), S, Cao.**
2. **Write path không có flow control dù xterm 6 hỗ trợ sẵn.** `term.write(data, callback)` là cơ chế backpressure chuẩn (VS Code dùng), nhưng `pane.ts:178` gọi `write` không callback và Rust emit mỗi `read()` 8KB một Tauri event không gom (`pty.rs:167-193`). Agent xả hàng MB → nguy cơ phình bộ nhớ tới `DISCARD_WATERMARK` 50MB rồi **ném Error mất dữ liệu** (`WriteBuffer.ts:104-106`), input lag. **(c), S+M, Cao.**
3. **Nhiều "gap" hoá ra không phải gap** — DEC 2026 đã built-in đầy đủ kèm timeout an toàn; bracketed paste bật mặc định; copy đã tự trim trailing whitespace; cursor pane mất focus đã thành outline; wheel trong alt-screen tự thành arrow keys. §4 liệt kê đủ để roadmap không tốn công vào thứ đã có.

Stackgrid đã đi đúng hướng embedder ở nhiều chỗ: graphemes addon, ⌘+click links tự viết (tránh phá mouse mode của TUI), OSC 9;4 parse thuần ở `src/lib/`, IME fix WKWebView. Ưu tiên tiếp theo: **quick wins option (đợt 1) → Shift+Enter + notification + backpressure (đợt 2) → kitty protocol / OSC 133 (đợt 3)**; WebGL chỉ khi có bằng chứng đo đạc DOM renderer nghẽn thật.

---

## 2. Feature matrix — xterm 6 core vs Stackgrid vs iTerm2/Ghostty

Cột "xterm 6": ✅ có built-in · 🔌 addon chính thức (chưa cài) · 🧩 embedder tự làm được qua public hooks · ❌ không có đường nào ngoài fork.
Cột "Stackgrid": ✅ đang dùng · ⚠️ dùng một phần / dùng sai đường · ❌ chưa dùng.

### Input & keyboard

| Tính năng                                         | xterm 6                                                               | Stackgrid                                              | iTerm2/Ghostty   | Ghi chú                                                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Enter + Shift/Ctrl phân biệt được                 | ❌ (`Keyboard.ts:100-104` chỉ xét Alt)                                | ❌                                                     | ✅               | Đã có finding; bổ sung: **Ctrl+Enter cũng bị gộp**, không chỉ Shift+Enter                                                                  |
| kitty keyboard protocol / CSI-u / modifyOtherKeys | ❌ core (grep 0 kết quả) → 🧩                                         | ❌                                                     | ✅ cả 4 terminal | Khả thi 100% qua `registerCsiHandler` (prefix `>`/`<`/`?` hợp lệ — `EscapeSequenceParser.ts:306-308`) + `term.input()` (`xterm.d.ts:1025`) |
| Bracketed paste (DECSET 2004)                     | ✅ (`InputHandler.ts:1969-1970`, `Clipboard.ts:21-26,51-56`)          | ✅ mặc định (không set `ignoreBracketedPasteMode`)     | ✅               | **Không phải gap**                                                                                                                         |
| Arrow/Home/End/F1-F12 + modifier                  | ✅ đầy đủ `CSI 1;N …` (`Keyboard.ts:113-305`)                         | ✅                                                     | ✅               | Điểm mạnh sẵn có                                                                                                                           |
| Backspace/Insert + modifier CSI                   | ❌ (`Keyboard.ts:84-90,165-172` — bất đối xứng với Delete `:173-180`) | ❌                                                     | ✅               | Combo hiếm, giá trị thấp                                                                                                                   |
| Ctrl+Shift+Space                                  | ❌ bị nuốt (`Keyboard.ts:308-324`)                                    | ❌                                                     | ✅               | Giá trị thấp                                                                                                                               |
| Option-as-Meta tách trái/phải                     | ❌ chỉ 1 boolean toàn cục (`macOptionIsMeta`)                         | `false` (bắt buộc cho IME — lựa chọn đúng, giữ nguyên) | ✅ per-side      | Muốn có phải tái hiện thủ công nhánh alt trong custom handler — L                                                                          |
| Cmd-key passthrough xuống PTY                     | ❌ by design (mọi nhánh default đòi `!ev.metaKey`)                    | —                                                      | —                | Đúng mong đợi — Cmd không phải modifier VT; **không phải gap**                                                                             |

### Escape sequences & protocol

| Tính năng                                           | xterm 6                                                                                   | Stackgrid                                                                                                          | iTerm2/Ghostty    | Ghi chú                                                                                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OSC 0/1/2 title (`onTitleChange`)                   | ✅ (`InputHandler.ts:292-296`)                                                            | ❌ chưa nghe event                                                                                                 | ✅                | Có thể dùng đặt tên tab tự động                                                                                                                                      |
| OSC 8 hyperlink                                     | ✅ built-in (`InputHandler.ts:304`, `OscLinkProvider`)                                    | ⚠️ **rơi vào `window.confirm/open` mặc định** vì thiếu `linkHandler`                                               | ✅                | Gap ưu tiên #1                                                                                                                                                       |
| OSC 7 cwd report                                    | ❌ core → 🧩                                                                              | ❌ — thay bằng poll Rust `proc_pidinfo` mỗi 2s (`pane-info-poller.ts:4`, `info.rs:118-140`)                        | ✅                | Poll Rust hoạt động với mọi chương trình không cần hợp tác — **không khuyến nghị thay**, chỉ cân nhắc làm fast-path                                                  |
| OSC 9 notification / OSC 777                        | ❌ core → 🧩                                                                              | ⚠️ chỉ parse OSC 9;4 progress bằng regex ngoài parser (`lib/osc-progress.ts:14`, feed từ `tab-manager.ts:606-615`) | ✅                | Pattern embedder-OSC đã có sẵn làm mẫu; có `@xterm/addon-progress` upstream nhưng logic hiện tại đủ và đã test                                                       |
| OSC 52 clipboard                                    | ❌ core (`InputHandler.ts:321` chỉ là comment)                                            | ❌                                                                                                                 | ✅ cả 4           | 🔌 `@xterm/addon-clipboard` — caveat WKWebView clipboard                                                                                                             |
| OSC 133 shell integration (prompt marks)            | ❌ core → 🧩 (`registerOscHandler` + `registerMarker`/`registerDecoration`)               | ❌                                                                                                                 | ✅ cả 4           | Caveat lớn: marker vô hiệu khi TUI ở alt-buffer (`xterm.d.ts:846-847`) — xem §3 G7                                                                                   |
| iTerm2 OSC 1337                                     | ❌                                                                                        | ❌                                                                                                                 | ✅ iTerm2/WezTerm | Không có use case (Claude Code không render ảnh) — bỏ qua                                                                                                            |
| Synchronized output DEC 2026                        | ✅ **đầy đủ** (`InputHandler.ts:1972,2203,2301` + `RenderService.ts:320-376`, timeout 1s) | ✅ hưởng tự động                                                                                                   | ✅                | **Không phải gap**                                                                                                                                                   |
| DA1/DA2                                             | ✅ `ESC[?1;2c` / `ESC[>0;276;0c` (`InputHandler.ts:1667-1722`)                            | ✅                                                                                                                 | ✅                | DA2 trả version tự đặt 276 — vô hại                                                                                                                                  |
| XTVERSION (`CSI > q`)                               | ❌ im lặng (grep 0 kết quả)                                                               | ❌                                                                                                                 | ✅                | Giá trị thấp — CLI dò qua env var; Rust đã set `TERM=xterm-256color`, `COLORTERM=truecolor`, `ConEmuANSI=ON` để lách feature-gate của Claude Code (`pty.rs:125-137`) |
| DECRQM / DECRQSS                                    | ✅ (`InputHandler.ts:2245-2303`, `:3416-3434`)                                            | ✅                                                                                                                 | ✅                | Mouse/paste/2026 query đều trả state thật                                                                                                                            |
| Mouse reporting X10/VT200/DRAG/ANY + SGR/SGR-pixels | ✅ (`CoreMouseService.ts:13-150`)                                                         | ✅                                                                                                                 | ✅                | UTF8/URXVT bỏ có chủ đích (#2507); 1005/1015 từ chối tường minh — đủ cho Ink TUI                                                                                     |

### Rendering & hiển thị

| Tính năng                                      | xterm 6                                                                                    | Stackgrid                                                                   | iTerm2/Ghostty | Ghi chú                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Renderer                                       | chỉ DOM trong core (`CoreBrowserTerminal.ts:583-585`; `renderer/` chỉ có `dom/`+`shared/`) | ✅ DOM                                                                      | ✅ GPU/Metal   | WebGL = 🔌 addon, đào API private — rủi ro WKWebView, xem §6                                                               |
| `smoothScrollDuration`                         | ✅ (`Viewport.ts:43-51`)                                                                   | ❌ default 0 — cuộn giật                                                    | ✅ mặc định    | (a), 1 dòng                                                                                                                |
| `minimumContrastRatio`                         | ✅ (`DomRendererRowFactory.ts:480-507`)                                                    | ❌ default 1 (no-op)                                                        | ✅ iTerm2      | (a), 1 dòng                                                                                                                |
| `cursorInactiveStyle` outline ở pane mất focus | ✅ default `'outline'` (`DomRenderer.ts:239-242`)                                          | ✅ miễn phí                                                                 | ✅             | **Không phải gap** — ngang iTerm2                                                                                          |
| Overview ruler (minimap decoration)            | ✅ canvas 2D thường (`OverviewRulerRenderer.ts`)                                           | ❌ chưa bật `overviewRuler.width` → gate `CoreBrowserTerminal.ts:561` false | ✅             | search-bar đã truyền đủ màu ruler, chỉ thiếu option                                                                        |
| `customGlyphs`/`rescaleOverlappingGlyphs`      | ❌ với DOM renderer (doc `xterm.d.ts:80-87,229`)                                           | —                                                                           | ✅             | Chỉ có nghĩa nếu đổi renderer — không ưu tiên                                                                              |
| Ligatures                                      | 🔌 addon, **không chạy với DOM renderer**                                                  | ❌                                                                          | ✅             | Bỏ qua ở cấu hình hiện tại                                                                                                 |
| Sixel / inline images                          | 🔌 `@xterm/addon-image`                                                                    | ❌                                                                          | ✅             | Không có use case agent-CLI — bỏ qua                                                                                       |
| `windowOptions` reports                        | ✅ tắt mặc định vì bảo mật (`xterm.d.ts:312-314`, `InputHandler.ts:2840-2900`)             | ✅ giữ tắt                                                                  | —              | **Giữ tắt `getWinTitle`/`getIconTitle`** — lớp CVE echo-title-vào-stdin; agent CLI cat nội dung không tin cậy thường xuyên |

### Tiện ích hiện đại

| Tính năng                                          | xterm 6                                                                                                                                            | Stackgrid                                          | iTerm2/Ghostty     | Ghi chú                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------ | ---------------------------------------------------- |
| Copy tự trim trailing whitespace                   | ✅ sẵn (`SelectionService.ts:203-262` — mọi đường lấy text đều gọi `translateBufferLineToString(…, trimRight=true, …)`, signature `Buffer.ts:535`) | ✅                                                 | ✅                 | **Không phải gap**                                   |
| Copy-on-select                                     | ❌ option → 🧩 `onSelectionChange`                                                                                                                 | ❌                                                 | ✅                 | Caveat clipboard WKWebView — nên đi qua Tauri plugin |
| Double-click chọn nguyên link/path                 | ✅ link-range thắng word (`SelectionService.ts:344-361`)                                                                                           | ✅ miễn phí (nhờ link provider tự viết)            | ✅ smart selection | Gần như smart-selection cho path/URL, có sẵn         |
| Smart selection regex (email/hash/IP)              | ❌ không hook vào `_getWordAt`                                                                                                                     | ❌                                                 | ✅                 | Effort/giá trị không cân xứng — bỏ qua               |
| `rightClickSelectsWord`                            | ✅ default true trên Mac (`OptionsService.ts:50`)                                                                                                  | ✅                                                 | ✅                 |                                                      |
| Search highlight-all + đếm n/total                 | ✅ addon (`SearchAddon.ts:96-148`, `onDidChangeResults`)                                                                                           | ✅ đã wire đủ (`search-bar.ts:31-46,102-106`)      | ✅                 | Chỉ thiếu ruler (hàng Rendering)                     |
| Bell → notification                                | chỉ còn `onBell` event (`InputHandler.ts:699-701`; `bellStyle`/`bellSound` đã xoá khỏi API 6.0)                                                    | ❌ chưa nghe; chưa cài `tauri-plugin-notification` | ✅                 | Gap giá trị cao cho "chạy agent rồi bỏ đi"           |
| Jump-to-prompt (`registerMarker` + `scrollToLine`) | ✅ API đủ (`xterm.d.ts:1143-1147,1229-1233`)                                                                                                       | ❌ chưa dùng marker nào                            | ✅                 | Phối hợp OSC 133; caveat alt-buffer                  |
| Alternate scroll (wheel→arrows trong alt-screen)   | ✅ built-in luôn bật (`CoreBrowserTerminal.ts:806-843`; DECSET 1007 không có nhưng không cần)                                                      | ✅                                                 | ✅                 | **Không phải gap** — Ink TUI cuộn được sẵn           |
| Copy mode / keyboard selection kiểu vim            | ❌ phải tự build trên `select()`/`selectLines()`                                                                                                   | ❌                                                 | ✅                 | Giá trị thấp cho agent-CLI — bỏ qua                  |

### Vòng đời & hiệu năng

| Tính năng                                  | xterm 6                                                                               | Stackgrid                                                                                | iTerm2/Ghostty | Ghi chú                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| Flow control qua `write(data, cb)`         | ✅ (`WriteBuffer.ts:103-130`, callback per-chunk `:221-222`)                          | ❌ không truyền callback (`pane.ts:178`); Rust không backpressure (`pty.rs:167-193`)     | ✅ native      | Gap ưu tiên cao                                                                                              |
| Batching output IPC                        | — (việc của embedder)                                                                 | ❌ 1 `read()` 8KB = 1 Tauri event JSON (`pty.rs:168,184-190`)                            | —              | Gom 4-8ms/32-64KB phía Rust                                                                                  |
| Time-slice parse 12ms + ưu tiên echo input | ✅ (`WriteBuffer.ts:28`, `_didUserInput` `:44-55,112-121`)                            | ✅ tự động                                                                               | —              | `writeSync` vẫn tồn tại nhưng deprecated — Stackgrid không dùng, đúng                                        |
| Render gộp theo rAF + pause khi ẩn         | ✅ (`RenderDebouncer.ts:40-54`; IntersectionObserver `RenderService.ts:119-146`)      | ✅ tự động (tab ẩn `display:none` → ngừng render)                                        | —              | **Không phải gap**                                                                                           |
| Dispose sạch                               | ✅ addon tự dispose theo terminal (`AddonManager.dispose`)                            | ✅ (`pane.ts:198-206` + các đường `pane-lifecycle`/`terminal-manager` — không thấy leak) | —              |                                                                                                              |
| Reflow khi đổi cột                         | O(scrollback) (`Buffer.ts:172-176`); FitAddon đã guard resize thừa (`FitAddon.ts:41`) | ⚠️ scrollback 10k hardcode → resize thật quét 10k dòng; chưa expose trong Settings       | ✅             | Chấp nhận được; nên cho user chỉnh                                                                           |
| Grapheme tiếng Việt NFD                    | ✅ addon Unicode 15 + `shouldJoin` (`UnicodeGraphemeProvider.ts:24-58`)               | ✅ (`pane.ts:115-117`)                                                                   | ✅             | Đã fix đúng từ trước; addon vẫn gắn mác experimental upstream — regression test IME/width mỗi lần bump xterm |
| Search khớp NFC vs NFD                     | ❌ addon không normalize (`SearchLineCache.ts:94`)                                    | ❌ search term từ IME là NFC, buffer có thể NFD → không match                            | ✅             | (c), S — normalize term trước khi `findNext`                                                                 |

---

## 3. Khoảng trống chi tiết (đã phân loại)

### G1 — `linkHandler` cho OSC 8 hyperlink — **(a) · S · Cao**

xterm luôn đăng ký `OscLinkProvider` (`CoreBrowserTerminal.ts:160`); thiếu `linkHandler` thì activate = `confirm()` + `window.open()` (`OscLinkProvider.ts:114-129`) — trên WKWebView thường bị chặn popup (chính code xterm cũng try/catch và warn vì biết trước sẽ khó). Agent CLI hiện đại wrap đường dẫn/URL bằng OSC 8 ngày càng nhiều.
**Cách lấp**: set `linkHandler: { activate }` trong `Terminal(...)` ở `pane.ts`, route về `link-client.ts` (Tauri `openUrl` / `open_editor`) — cùng đích với ⌘+click provider tự viết. Giữ `allowNonHttpProtocols` mặc định false (xterm tự validate — `OscLinkProvider.ts:71-82`).

### G2 — Flow control PTY + batching IPC — **(c) · S (batching) + M (backpressure) · Cao**

Hiện trạng: JS nhận event là `term.write(data)` ngay, không đếm pending; Rust emit mỗi lần `read()` trả về. Output dày → hàng đợi WriteBuffer phình (chặn cứng duy nhất là ném Error ở 50MB — `WriteBuffer.ts:104-106`).
**Cách lấp** (2 bước độc lập):

1. _Batching (S, Rust-only)_: gom nhiều `read()` trong cửa sổ 4-8ms hoặc 32-64KB rồi mới `emit_to_owner` — trễ thêm nhỏ hơn time-slice 12ms của WriteBuffer nên không cảm nhận được.
2. _Backpressure (M, JS+Rust)_: truyền callback vào `term.write` để đếm `pendingBytes`; vượt high-watermark (~1-2MB) → command Rust mới `pause_pty_reads(id)`; xuống low-watermark → `resume_pty_reads(id)`. Rust: cờ atomic/condvar trong reader thread. **Caveat**: `kill_pty` phải đánh thức thread đang pause, tránh deadlock khi đóng pane. Giá trị tăng theo số pane chạy agent song song.

### G3 — Notification khi agent cần chú ý — **(c) · S–M · Cao**

Nguyên liệu đã có đủ: `onBell` (hook duy nhất còn lại — audio/visual bell đã bị xoá khỏi API 6.0), pattern OSC embedder-parser sẵn có (`lib/osc-progress.ts` + `agent-activity.ts`), thiếu mỗi đầu ra hệ điều hành.
**Cách lấp**: (i) đăng ký `registerOscHandler(9, …)` bắt OSC 9 tổng quát (không chỉ 9;4) — parse thuần ở `src/lib/` có test; (ii) nghe `term.onBell`; (iii) khi pane là agent + window/tab không focus → bắn notification qua `tauri-plugin-notification` (chưa cài — cần thêm dependency + capability). Debounce theo pane; tận dụng transition working→idle của `agent-activity.ts` làm trigger chính. **Caveat**: dùng plugin Tauri, không dùng Web Notification API (permission model WKWebView khác).

### G4 — Kitty keyboard protocol tối thiểu — **(c) · M · Cao**

Bổ sung mới so với finding cũ: khả thi **100% qua public API** — `registerCsiHandler` nhận prefix `>`/`<`/`?` (range hợp lệ 0x3c–0x3f, `EscapeSequenceParser.ts:306-308`; nhiều handler cùng ident chạy mới-nhất-trước, trả `false` để bubble xuống built-in), và `term.input()` (`xterm.d.ts:1025`) là data path đúng để bơm chuỗi CSI-u đã encode — không cần đụng field private nào.
**Cách lấp**: bảng encode modifier→CSI-u thuần ở `src/lib/` (unit test); state machine push/pop per-pane + đăng ký handler + hợp nhất vào custom key handler của `webkit-ime-fix.ts` (slot đơn!) ở `src/terminal/`; reset state khi PTY exit/respawn. Chỉ encode khi app phía dưới đã xin bật — không ảnh hưởng IME (protocol chỉ kích hoạt theo yêu cầu từ escape sequence). Khi xong sẽ thay thế luôn workaround Shift+Enter Option A.

### G5 — Search: overview ruler + normalize NFC — **(a)+(c) · S · Trung**

- Ruler: `search-bar.ts` đã truyền đủ `matchOverviewRuler`/`activeMatchColorOverviewRuler` (`search-bar.ts:33-41`) nhưng `OverviewRulerRenderer` không bao giờ được tạo vì thiếu `overviewRuler: { width }` (gate `CoreBrowserTerminal.ts:561`). Thêm 1 dòng option. Renderer là canvas 2D thường — an toàn WKWebView.
- NFC: `input.value.normalize('NFC')` trước `findNext`/`findPrevious` — fix một chiều đủ cho phần lớn case (buffer thường NFC); triệt để 100% cần patch `addon-search` (không đề xuất).

### G6 — Polish rendering + Settings — **(a) · S · Trung**

- `smoothScrollDuration` (~125ms): chạy qua lớp `vs/base` scrollable thuần JS — an toàn WKWebView, thu hẹp cảm giác "giật" so với momentum scroll của iTerm2/Ghostty.
- `minimumContrastRatio` (~4.5): cứu các theme TUI dùng màu RGB tuỳ ý trên nền tối.
- Expose `scrollback` (đang hardcode 10 000 — `pane.ts:90`) vào Settings; đánh đổi trực tiếp giữa lịch sử cuộn và chi phí reflow khi đổi cột — để user chọn.

### G7 — Shell integration OSC 133 + jump-to-prompt — **(c) · L · Cao nhưng có caveat lớn**

API đủ: `registerOscHandler(133)` + `registerMarker()` + `registerDecoration({overviewRulerOptions})` + `scrollToLine()`; keymap Cmd+↑/↓ để nhảy giữa prompt.
**Hai caveat phải cân nhắc trước khi đầu tư**:

1. Cần bơm precmd/preexec hook vào RC file của shell người dùng (zsh/bash/fish — không kiểm soát hết).
2. **Vô dụng khi agent CLI đang full-screen trong alt-buffer**: `Terminal.markers` trả `[]` và `registerDecoration` trả `undefined` khi alt-buffer active (`xterm.d.ts:846-847,1152-1156`) — mà Claude Code/Codex chạy TUI alt-screen gần như toàn thời gian. Prompt marks chỉ có nghĩa _giữa_ các lần chạy agent.
   → Xếp sau G1–G4; làm khi có nhu cầu cụ thể về điều hướng scrollback shell. Parse state machine thuần → `src/lib/shell-integration.ts` có unit test.

### G8 — OSC 52 clipboard — **(b) · S–M · Trung**

`@xterm/addon-clipboard` (chưa cài). **Caveat WKWebView**: addon dùng `navigator.clipboard` — cần user-gesture/secure-context, dễ lỗi âm thầm; nên đánh giá route qua `@tauri-apps/plugin-clipboard-manager` thay vì Web Clipboard API, và cân nhắc confirm gate (chương trình remote/không tin cậy có thể ghi clipboard). Test thực tế trước khi bật.

### G9 — Định danh terminal: `TERM_PROGRAM=Stackgrid` — **(c phía Rust) · S · Trung**

Rust đang set `ConEmuANSI=ON` chỉ để lách feature-gate OSC 9;4 của Claude Code (`pty.rs:125-137`) — mượn danh ConEmu, dễ gãy khi Claude Code đổi logic detect. Set thêm `TERM_PROGRAM=Stackgrid` + `TERM_PROGRAM_VERSION` là bước rẻ để có định danh riêng, theo dõi dần việc bỏ spoof khi các agent CLI nhận diện `TERM_PROGRAM` tuỳ ý.

### G10 — Các khoảng trống giá trị thấp (ghi nhận, không xếp lịch)

| Mục                                             | Phân loại            | Effort | Lý do xếp thấp                                                                                                           |
| ----------------------------------------------- | -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| Option-as-Meta tách trái/phải                   | (c)                  | L      | Phải tái hiện thủ công nhánh alt của `Keyboard.ts` per-side trong custom handler; rủi ro đụng IME cao, nhu cầu hẹp       |
| Backspace/Insert modifier CSI, Ctrl+Shift+Space | (c)                  | S      | Combo hiếm; Ctrl/Option+Backspace đã hoạt động (`Keyboard.ts:84-90`)                                                     |
| XTVERSION reply                                 | (c)                  | S      | CLI dò terminal qua env var, không qua `CSI > q`                                                                         |
| OSC 7 cwd fast-path                             | (c)                  | S      | Poll Rust 2s hoạt động với mọi chương trình; OSC 7 im lặng khi agent full-screen — chỉ làm nếu cần giảm độ trễ 2s cụ thể |
| OSC 0/2 → tên tab tự động                       | (a)                  | S      | `onTitleChange` sẵn có; giá trị tuỳ UX (tab đã đặt tên theo workspace)                                                   |
| Smart selection regex                           | (c)                  | M/L    | Không có hook vào `_getWordAt`, phải tự bắt double-click; link-range-wins đã cover path/URL                              |
| Copy mode kiểu vim                              | (c)                  | L      | Đối tượng agent-CLI ít cần keyboard selection                                                                            |
| WebGL renderer                                  | (b, đào API private) | L      | Chỉ khi có số đo chứng minh DOM renderer nghẽn; rủi ro WKWebView (§6)                                                    |
| Ligatures / sixel / iTerm2 images               | (b)                  | M      | Ligatures không chạy với DOM renderer; ảnh không có use case (Ink không render ảnh)                                      |

---

## 4. Không phải gap — đã có sẵn, đừng tốn công

1. **DEC 2026 synchronized output**: built-in đầy đủ (`InputHandler.ts:1972,2203`, DECRQM `:2301`), render thực sự hoãn khi mode bật và có timeout 1s tự nhả (`RenderService.ts:320-376`) — TUI nhấp nháy đã được core lo.
2. **Bracketed paste**: bật mặc định, bọc `\x1b[200~…201~` khi app xin (`Clipboard.ts:21-26,51-56`).
3. **Copy trim trailing whitespace**: mọi đường lấy selection text đều đi qua `translateBufferLineToString(…, trimRight=true, …)` (`SelectionService.ts:203-262`, signature `Buffer.ts:535`).
4. **Cursor outline ở pane mất focus**: default `cursorInactiveStyle: 'outline'` — multi-pane đã ngang iTerm2.
5. **Alternate scroll**: wheel trong alt-buffer tự convert thành arrow keys, luôn bật không cần DECSET 1007 (`CoreBrowserTerminal.ts:806-843`) — cuộn trong TUI Ink đã chạy.
6. **Double-click chọn nguyên link**: link-range thắng word-separator (`SelectionService.ts:344-361`) — cộng hưởng miễn phí với link provider tự viết.
7. **Render tiết kiệm**: gộp theo `requestAnimationFrame` (`RenderDebouncer.ts:40-54`), pane trong tab ẩn tự ngừng render nhờ IntersectionObserver (`RenderService.ts:119-146`).
8. **Dispose không leak**: `term.dispose()` tự dispose mọi addon theo thứ tự ngược (`AddonManager.dispose`) — `pane.ts:198-206` đúng và đủ.
9. **Echo input ưu tiên**: chunk đầu sau user input parse ngay không chờ queue (`WriteBuffer.ts:44-55,112-121`).
10. **`macOptionIsMeta: false`**: là lựa chọn đúng, không phải thiếu sót — bật `true` sẽ phá Telex/dead-key; Option+Enter vẫn ra `\x1b\r` vì third-level-shift chỉ áp dụng cho `keyCode > 47` (`CoreBrowserTerminal.ts:1116`).

---

## 5. Roadmap đề xuất (giá trị ÷ effort)

**Đợt 1 — quick wins, thuần option/config (tổng ~S):**
| # | Việc | Gap | Loại |
|---|---|---|---|
| 1.1 | `linkHandler` cho OSC 8 → `link-client.ts` | G1 | (a) |
| 1.2 | `overviewRuler: { width }` + normalize NFC search term | G5 | (a)+(c) |
| 1.3 | `smoothScrollDuration`, `minimumContrastRatio`; expose `scrollback` vào Settings | G6 | (a) |
| 1.4 | Batching output phía Rust 4-8ms / 32-64KB | G2.1 | (c) |
| 1.5 | `TERM_PROGRAM=Stackgrid` + version (giảm phụ thuộc ConEmu spoof) | G9 | (c) |
| 1.6 | Document workaround Option+Enter / `\`+Enter cho user (đến khi 2.1 ship) | — | docs |

**Đợt 2 — giá trị cao cho agent-CLI (S–M mỗi mục):**
| # | Việc | Gap | Loại |
|---|---|---|---|
| 2.1 | Shift+Enter Option A từ finding cũ (hợp nhất vào handler webkit-ime-fix; encode thuần ở `src/lib/` + test) | — | (c) |
| 2.2 | Notification: OSC 9 handler + `onBell` + `tauri-plugin-notification` | G3 | (c) |
| 2.3 | Backpressure write callback + pause/resume PTY | G2.2 | (c) |

**Đợt 3 — đầu tư chuẩn hoá (M–L):**
| # | Việc | Gap | Loại |
|---|---|---|---|
| 3.1 | Kitty keyboard protocol tối thiểu — thay thế luôn 2.1 khi xong | G4 | (c) |
| 3.2 | OSC 52 qua addon-clipboard, route Tauri clipboard + confirm gate | G8 | (b) |
| 3.3 | OSC 133 + jump-to-prompt — chỉ khi chấp nhận caveat alt-buffer | G7 | (c) |

**Không làm (có chủ đích):**
| Việc | Lý do |
|---|---|
| Fork xterm core (mọi mục) | (a)/(b)/(c) đủ cho toàn bộ gap có giá trị; upstream đã có feature request kitty protocol |
| `@xterm/addon-canvas` | Không còn hỗ trợ xterm 6 (peer `^5`, đã removed upstream) |
| Bật `macOptionIsMeta: true` | Phá IME tiếng Việt |
| Thay link provider tự viết bằng WebLinksAddon | Plain-click phá mouse mode của agent TUI |
| Bật `windowOptions.getWinTitle`/`getIconTitle` | Lớp CVE echo-title-vào-stdin — agent CLI thường cat nội dung không tin cậy |
| Sixel/images, ligatures, copy mode, smart selection | Xem G10 |

---

## 6. Rủi ro riêng của WKWebView / Tauri

1. **Slot đơn `attachCustomKeyEventHandler`** (`CoreBrowserTerminal.ts:914-916` — gán đè, không phải mảng): `webkit-ime-fix.ts:264` đang chiếm trên mọi bản production. Mọi tính năng keyboard mới (2.1, 3.1) **bắt buộc hợp nhất** vào thân handler này hoặc extract một `createKeyPipeline([...handlers])` duy nhất; attach mới = vô hiệu hoá IME fix âm thầm. Regression test Telex + EVKey/OpenKey cho mọi thay đổi keyboard.
2. **IME fix đụng internals**: `webkit-ime-fix` patch `_core._inputEvent` / wrap `triggerDataEvent` — đã có guard no-op + warn khi shape internals đổi (`webkit-ime-fix.ts:324-331`), nhưng vẫn phải smoke-test IME mỗi lần bump `@xterm/xterm`.
3. **Clipboard**: `navigator.clipboard.*` trong WKWebView đòi user-gesture, hay fail âm thầm ngoài click handler → copy-on-select và OSC 52 nên route qua plugin Tauri (`plugin-clipboard-manager` — chưa cài).
4. **`window.open` bị chặn popup** — chính là lý do G1 khẩn cấp: fallback OSC 8 của xterm phụ thuộc `window.open` (`OscLinkProvider.ts:117-127` tự try/catch vì biết trước sẽ khó).
5. **Notification**: Web Notification API trong WKWebView có permission model khác Safari thật — dùng `tauri-plugin-notification` (cần thêm capability trong `src-tauri/`).
6. **WebGL addon**: WKWebView chạy WebGL2 qua ANGLE→Metal; GPU process tách biệt, ngân sách nhỏ hơn Chromium, xu hướng `webglcontextlost` khi app background/nhiều pane ẩn-hiện cao hơn. Addon lại đào API private của core (`RenderService.setRenderer` — `RenderService.ts:234`) — breaking change không được type-check công khai. Upstream tracking (từ bản draft song song, chưa verify trực tiếp trong đợt này): issue xtermjs/xterm.js#5847 — ghosting/corruption với WebGL + transparency trên Tauri/WKWebView khi stream output dày, fix nhắm xterm 7 (#5883); Safari/WebKit WebGL breakage #5816. → Nếu vẫn thử: nền opaque (không `allowTransparency`), handler `onContextLoss` → dispose addon fallback DOM, verify trên đúng target macOS với Claude Code streaming.
7. **NSMenu accelerator ăn trước webview**: `menu.rs` đăng ký accelerator native (Cmd+Q/Z/X/C/V/A, **Cmd+Shift+S** `menu.rs:61-67`); `performKeyEquivalent:` chạy trước khi event tới WKWebView → binding `keymap.ts:70` (Cmd+Shift+S save-preset) nhiều khả năng **dead code qua bàn phím** (chỉ còn đường menu click). Cmd+W đã được gỡ khỏi menu có chủ đích (`menu.rs:21-22`) để lọt xuống keymap. Ngoài phạm vi xterm nhưng ảnh hưởng trực tiếp lớp keyboard — nên kiểm chứng runtime và đưa về một nguồn duy nhất.
8. **ConEmuANSI spoof**: cần để Claude Code phát OSC 9;4 hôm nay, nhưng là hợp đồng ngầm với logic detect của bên thứ ba — theo dõi và chuyển dần sang `TERM_PROGRAM` (G9).

---

## 7. Ghi chú phương pháp & phân xử hai bản draft

- Mọi `file:line` phía xterm tính theo `node_modules/@xterm/xterm/src/` (và `typings/xterm.d.ts`), addon theo `node_modules/@xterm/addon-*/src/`; phía Stackgrid theo repo root.
- Handler đăng ký qua `IParser.register*Handler` chạy theo thứ tự **mới-nhất-trước**, trả `true` = chặn built-in, trả `false` = bubble tiếp (`EscapeSequenceParser.ts:385-426,673-692`) — nền tảng cho mọi đề xuất (c); riêng DECSET built-in xử lý cả mảng params trong một lời gọi nên custom handler cho `h`/`l` phải lọc đúng code của mình và trả `false` phần còn lại.
- `PAYLOAD_LIMIT` OSC/DCS thật là 10 000 000 ký tự (`common/parser/Constants.ts:58`) — comment "50 MB" trong `DcsParser.ts` đã lỗi thời.
- So sánh iTerm2/Ghostty/Kitty/WezTerm dựa trên kiến thức của reviewer, không đọc source các terminal đó trong đợt này.
- **Phân xử với draft 13:58 cùng ngày** (viết bởi session song song trên cùng checkout): hai bản trùng kết luận ở đại đa số mục; các điểm khác biệt đã kiểm lại bằng source và bản này giữ kết quả đã verify: (i) xterm **có** trim trailing whitespace khi copy (draft cũ ghi "Không" — sai, xem §4.3); (ii) `fastScrollModifier` là option sống default `'alt'` (`OptionsService.ts:22`), không phải deprecated; (iii) bổ sung phát hiện draft cũ không có: fallback `window.confirm/open` của OSC 8 (G1), chi tiết flow-control watermark + batching Rust (G2), caveat alt-buffer của marker/decoration (G7), NSMenu accelerator (§6.7). Ngược lại, bản này tiếp nhận từ draft cũ: issue refs WebGL #5847/#5883/#5816, addon-canvas hết đường xterm 6, đề xuất `TERM_PROGRAM` (G9), `@xterm/addon-progress`, và các mục roadmap docs/Settings.
