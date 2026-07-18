# Findings — xterm.js core: Shift+Enter không xuống dòng trong agent CLI

- **Ngày**: 2026-07-18
- **Phạm vi**: pipeline bàn phím từ pane (xterm.js 6) → PTY → agent CLI (Claude Code / Codex / Gemini CLI)
- **Phiên bản liên quan**: `@xterm/xterm` ^6.0.0, Tauri 2 (WKWebView, macOS)

## 1. Context

Stackgrid nhúng xterm.js 6 cho mỗi pane (`src/terminal/pane.ts`); mỗi pane gắn 1:1 với một PTY chạy login shell phía Rust (`src-tauri/src/pty.rs`). Agent CLI được gõ vào shell (agent launch is typing), nên mọi phím người dùng bấm đi theo đường:

```
keydown (DOM) → xterm Keyboard.evaluateKeyboardEvent → term.onData
             → TerminalManager → pty.writePty → PTY → agent CLI
```

**Triệu chứng**: trong input của agent CLI, bấm Shift+Enter thì prompt bị submit thay vì xuống dòng. Cùng agent CLI đó chạy trong iTerm2 / Ghostty / Kitty / WezTerm thì Shift+Enter xuống dòng bình thường.

## 2. Root causes

### RC1 — xterm.js core vứt bỏ modifier Shift đối với phím Enter

`node_modules/@xterm/xterm/src/common/input/Keyboard.ts:100-104`:

```ts
case 13:
  // return/enter
  result.key = ev.altKey ? C0.ESC + C0.CR : C0.CR;
  result.cancel = true;
  break;
```

Chỉ có **Alt** được xét (thêm prefix `ESC`); **Shift bị bỏ qua hoàn toàn**. Hệ quả: Shift+Enter và Enter gửi xuống PTY **cùng một byte `\r`** — agent CLI không có cách nào phân biệt, nên hiểu là submit.

### RC2 — xterm.js không implement kitty keyboard protocol / CSI-u / modifyOtherKeys

Các terminal mà Shift+Enter hoạt động (iTerm2, Ghostty, Kitty, WezTerm) hỗ trợ **kitty keyboard protocol** (hoặc CSI-u): agent CLI bật protocol lúc khởi động, terminal encode Shift+Enter thành `\x1b[13;2u`, TUI decode ra "insert newline".

Grep toàn bộ source xterm.js 6 trong repo (`node_modules/@xterm/xterm/src/`) cho `modifyOtherKeys`, `kitty`, `13;2u` → **không có kết quả nào**. xterm.js không bao giờ trả lời query bật protocol, nên agent CLI fallback về chế độ cổ điển — nơi Enter và Shift+Enter là một.

## 3. Findings chi tiết

### F1 — App-level keymap không phải thủ phạm

`src/terminal/keymap.ts:65` chỉ bind **Cmd**+Shift+Enter (`toggle-zoom-pane`). Plain Shift+Enter không match binding nào, rơi thẳng xuống xterm. Lỗi nằm sau lớp keymap của app.

### F2 — Không có custom key handler nào xử lý Enter

`src/terminal/pane.ts` không gắn handler nào can thiệp Enter. Handler duy nhất đang tồn tại là của webkit IME fix (`src/terminal/webkit-ime-fix.ts:264`) — chỉ xử lý suppression cho IME tiếng Việt, không đụng tới Enter.

### F3 — `attachCustomKeyEventHandler` là single slot (ràng buộc quan trọng cho fix)

`node_modules/@xterm/xterm/src/browser/CoreBrowserTerminal.ts:914`: handler được **gán đè** (`this._customKeyEventHandler = handler`), không phải danh sách. `applyWebkitImeFix` đã chiếm slot này trên WKWebView — tức là **luôn luôn** trong production Tauri macOS. Mọi fix Shift+Enter phải **hợp nhất vào handler hiện có** (hoặc chain thủ công), không được attach một handler mới đè lên — nếu không sẽ vô hiệu hoá IME fix (hoặc ngược lại).

### F4 — VS Code (cùng nhúng xterm.js) cũng không dựa vào xterm core cho việc này

VS Code terminal cũng embed xterm.js và gặp đúng giới hạn này. Claude Code giải quyết bằng `/terminal-setup`: thêm keybinding VS Code map Shift+Enter → `sendSequence` một chuỗi thay thế. Tức là **giải pháp chuẩn của hệ sinh thái xterm.js embedder là intercept ở lớp embedder rồi tự gửi sequence** — không chờ xterm core.

### F5 — Workaround sẵn có cho người dùng (chưa cần sửa code)

- **Option+Enter**: xterm gửi `\x1b\r` (nhánh `ev.altKey` ở RC1) — Claude Code hiểu là newline (lưu ý: `macOptionIsMeta: false` trong `pane.ts` để IME tiếng Việt hoạt động, nhưng Option+Enter thì Enter không phải character key nên vẫn ra `\x1b\r`).
- **`\` rồi Enter**: line-continuation mà Claude Code hỗ trợ.

## 4. Cách fix

### Option A — Intercept Shift+Enter, gửi `\x1b\r` (khuyến nghị, ngắn hạn)

Trong custom key event handler (hợp nhất với handler của webkit IME fix — xem F3): khi `keydown` + `key === "Enter"` + `shiftKey` và không có modifier khác → tự gửi `\x1b\r` xuống PTY qua `events.onData`, return `false` để xterm không gửi `\r`.

- ✅ Nhỏ, an toàn, hiểu được bởi Claude Code / Codex (cùng semantics Option+Enter).
- ✅ Không phụ thuộc trạng thái protocol.
- ⚠️ Khi pane đang ở shell thường, zsh nhận `ESC` + `Enter` — gần như vô hại (vi-mode sẽ đổi mode). Có thể gate theo agent-recognition có sẵn (`pane-info`) nếu muốn chặt chẽ, nhưng không bắt buộc.

### Option B — Hỗ trợ kitty keyboard protocol tối thiểu (đúng chuẩn, dài hạn)

Theo dõi trạng thái protocol từ output stream bằng public API `term.parser.registerCsiHandler`:

- `CSI > flags u` (push/enable), `CSI < u` (pop/disable), trả lời query `CSI ? u`.
- Khi protocol đang active → encode Shift+Enter thành `\x1b[13;2u` (và mở rộng dần các tổ hợp modifier khác).

- ✅ Semantics chuẩn, mở đường cho các phím tổ hợp khác (Ctrl+Enter, Shift+Space…), tương lai tiệm cận iTerm2/Ghostty.
- ⚠️ Phức tạp hơn đáng kể: phải quản lý stack push/pop theo từng pane, reset khi PTY exit, và chỉ gửi CSI-u khi app phía dưới đã bật — gửi vô điều kiện sẽ thành rác trên shell thường.

### Option C — Fork/patch xterm.js core

Không khuyến nghị: chi phí bảo trì cao, upstream đã có feature request mở cho kitty protocol; hai option trên đều dùng public API.

### Khuyến nghị

Làm **Option A ngay** (một điểm chạm trong terminal layer, có unit test cho hàm encode thuần). Cân nhắc **Option B** trong đợt review năng lực xterm core tổng thể (xem `docs/review/prompt-xterm-core-capability-review.md`).
