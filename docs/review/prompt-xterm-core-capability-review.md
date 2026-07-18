# Prompt — Review toàn bộ năng lực xterm.js core cho Stackgrid

> Dùng prompt dưới đây (nguyên văn) để chạy một đợt review sâu xterm.js như một embedder (giống cách VS Code nhúng xterm), nhằm tìm các config/tính năng còn thiếu so với iTerm2/Ghostty.

---

Bạn là reviewer chuyên sâu về terminal emulator. Hãy audit toàn bộ xterm.js 6 (source tại `node_modules/@xterm/xterm/src/`) trong vai trò Stackgrid là một **embedder** — giống cách VS Code nhúng xterm.js rồi tự bổ sung năng lực ở lớp embedder. Mục tiêu: xác định mọi config/tính năng xterm đang có mà Stackgrid chưa tận dụng, và mọi khoảng trống so với iTerm2/Ghostty/Kitty/WezTerm, để lên roadmap nâng cấp terminal cho use case chạy agent CLI (Claude Code, Codex, Gemini CLI).

**Bối cảnh Stackgrid (đọc trước):**

- `CLAUDE.md`, `docs/ARCHITECTURE.md`, `CONTEXT.md` — kiến trúc hybrid: terminal layer imperative (`src/terminal/`), lib thuần (`src/lib/`), PTY phía Rust qua Tauri IPC.
- `src/terminal/pane.ts` — nơi khởi tạo `Terminal` với options hiện tại và các addon đang dùng (fit, search, unicode-graphemes, link provider tự viết).
- `src/terminal/webkit-ime-fix.ts` — ĐANG CHIẾM slot duy nhất của `attachCustomKeyEventHandler` (xterm chỉ cho một handler); mọi đề xuất về keyboard phải hợp nhất với handler này.
- `docs/review/findings-xterm-core-2026-07-18.md` — finding đã có về Shift+Enter (xterm không hỗ trợ kitty keyboard protocol / CSI-u).
- Ràng buộc môi trường: Tauri 2 WKWebView trên macOS (không phải Chromium — kiểm tra caveat WebKit cho mọi đề xuất), IME tiếng Việt phải tiếp tục hoạt động.

**Các trục audit (mỗi trục: xterm hỗ trợ gì / Stackgrid đang dùng gì / iTerm2-Ghostty có gì hơn / lấp khoảng trống bằng cách nào):**

1. **Input & keyboard pipeline**: `src/common/input/Keyboard.ts`, modifier encoding, `modifyOtherKeys`/CSI-u/kitty keyboard protocol (đã biết là thiếu — đánh giá mức triển khai tối thiểu qua `parser.registerCsiHandler`), bracketed paste (DECSET 2004), Option-as-Meta trade-off với IME, các tổ hợp Ctrl+Enter / Shift+Space / Cmd-key passthrough.
2. **Escape sequences & protocol hooks**: kiểm kê OSC/CSI/DCS handler public (`parser.registerOscHandler`, `registerCsiHandler`, `registerDcsHandler`): OSC 0/2 (title), OSC 7 (cwd report — Stackgrid đang poll cwd từ Rust, so sánh hai hướng), OSC 8 (hyperlinks), OSC 9/777 (notifications), OSC 52 (clipboard), OSC 133 (shell integration / prompt marks — nhảy giữa các prompt như iTerm2), iTerm2 OSC 1337, synchronized output (DEC 2026), DA1/DA2/XTVERSION responses mà agent CLI dùng để nhận diện terminal.
3. **Rendering & hiển thị**: renderer đang dùng (DOM/WebGL — addon `@xterm/addon-webgl` có chạy được trên WKWebView không), ligatures addon, sixel/iTerm2 image protocol addon, cursor styles, minimum contrast ratio, các option `Terminal` chưa khai thác (`fastScrollModifier`, `scrollOnUserInput`, `rescaleOverlappingGlyphs`, `windowOptions`, `smoothScrollDuration`…).
4. **Tiện ích terminal hiện đại** (chuẩn iTerm2/Ghostty): shell integration (command tracking, jump-to-prompt, command status), clickable file/URL nâng cao, copy-on-select, trim trailing whitespace khi copy, search decorations, scrollback config, bell/notification, mouse reporting modes cho TUI.
5. **Vòng đời & hiệu năng**: write throughput cho output agent dày đặc (flow control, `writeSync` vs callback), dispose/leak, resize/reflow, unicode/grapheme (đã dùng addon — kiểm tra khoảng trống còn lại với tiếng Việt NFD).

**Yêu cầu phương pháp:**

- Đọc source xterm thật trong `node_modules` — không suy đoán từ trí nhớ; trích dẫn `file:line` cho mọi kết luận "có/không hỗ trợ".
- Với mỗi khoảng trống, phân loại: (a) xterm có sẵn chỉ cần bật option, (b) có addon chính thức, (c) tự implement được qua public hooks, (d) cần fork/patch core — kèm effort ước lượng (S/M/L) và giá trị cho use case agent CLI (cao/trung/thấp).
- Không đề xuất fork core nếu (a)–(c) khả thi.
- Tôn trọng kiến trúc: mọi logic thuần (encode phím, parse sequence, state machine protocol) đặt ở `src/lib/` có unit test; phần imperative gắn vào `src/terminal/`.

**Deliverable:** ghi báo cáo vào `docs/review/xterm-core-capability-review-<ngày hôm nay YYYY-MM-DD>.md` gồm: (1) bảng feature-matrix xterm vs Stackgrid vs iTerm2/Ghostty, (2) danh sách khoảng trống đã phân loại + trích dẫn source, (3) roadmap ưu tiên theo giá trị/effort cho Stackgrid, (4) rủi ro riêng của WKWebView/Tauri. Chỉ review và viết báo cáo — KHÔNG sửa code trong đợt này.
