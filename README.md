# Stackgrid 🖥️

Terminal desktop app xây bằng **Tauri 2 + xterm.js** để chạy các AI agent CLI (`claude`, `codex`, `gemini`...) trong một cửa sổ riêng.

## Kiến trúc

- **Backend (Rust)** — `src-tauri/src/pty.rs`: mở PTY thật qua `portable-pty`, spawn login shell (`$SHELL -l` nên PATH đầy đủ), stream output về frontend qua Tauri event `pty:output`, nhận input qua command `write_pty`, resize qua `resize_pty`.
- **Frontend (TypeScript)** — `src/main.ts`: xterm.js + fit addon + web-links addon, theme Tokyo Night, tự fit theo kích thước cửa sổ.
- Khi shell thoát, nhấn **Enter** để mở phiên mới.

## Chạy dev

```bash
npm install
npm run tauri dev
```

## Build bản phát hành

```bash
npm run tauri build
```

File `.app` / `.dmg` nằm trong `src-tauri/target/release/bundle/`.

## Dùng AI agent CLI

Mở app rồi gõ như terminal bình thường:

```bash
claude          # Claude Code
codex           # OpenAI Codex CLI
gemini          # Gemini CLI
```
