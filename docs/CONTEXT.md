# Stackgrid — working context

## Pointers

- Frozen PRINCIPLES: `docs/PRINCIPLES.md` (root of hash-graph).
- Domain glossary lives at repo-root `CONTEXT.md` (Window → Tab → Pane language). Prefer that file for vocabulary; do not duplicate here.
- Pre-pipeline ADRs: `docs/adr/0001-*.md`, `docs/adr/0002-*.md`. New ADRs go to `docs/decisions/` via `/adr`.
- Prior specs/plans: `docs/superpowers/` (backdrop only).

## Confirmed product intent (/product — ready to distill)

### Pain & job
- iTerm/Terminal thiếu tiện ích cho agent CLI.
- North star: **quan sát + điều khiển nhiều agent CLI song song** (nhiều pane, biết busy/agent).

### Must-now (v1)
- Focus pane, split, **swap pane** (đổi chỗ 2 pane, PTY đi theo — chưa có trong code; drag-dock ≠ swap).
- **Layout preset**: mô hình nhỏ chỉnh layout → confirm mở **tab mới**; layout đang mở có thể **lưu thành bản nhớ** (persist, đặt tên / đổi tên / xóa / ghi đè). Preset = split + CWD-per-pane (artifact riêng, không đụng `session.json`). Pane không set CWD → CWD mặc định (workspace folder lúc Open, hoặc `$HOME` tùy ngữ cảnh).
- **Move pane ↔ window** (kiểu iTerm): hai chiều; đóng tab cuối của **một** window = đóng window đó; app quit chỉ khi hết window cuối (ADR 0002 cần mở rộng — `/adr` sau).
- **Sidebar phải** (Cmd+click filepath trong CLI): preview nội dung (markdown nếu `.md`) + git diff khi có git. Sidebar = **viewer**, không edit. Relative path resolve theo CWD pane; path không tồn tại → toast/error, không mở sidebar.

### Open / launch journey
- **Bảng Open** (một màn song song): chọn **workspace** (folder kiểu Cursor Recents + Open Folder) + **preset layout** → Open → layout thật → **từng pane pick agent CLI**.
- Pick agent = **spawn lệnh ngay**; luôn có lối **chỉ shell**; có **Skip all** (chưa pick → shell; đã pick → agent).
- Agent list trên picker = **auto-detect binary trên PATH** + Shell; không bắt cấu hình.
- **Mở lại app** (lần 2+): restore layout chrome **mọi window** (vẫn không CWD). Sau restore vẫn hiện **picker agent một lần** trên từng pane.
- Bảng Open khi: **New Window** (luôn) / không có session / user tắt restore.
- Move/swap / move-to-window: **không** confirm khi busy — chỉ đóng pane/tab mới busy-guard.

### OUT v1
- Embed agent UI, remote/SSH, full iTerm parity (profiles, triggers, …).
- Sidebar không phải editor.
- Signed/notarized macOS build — **sau**; v1 chấp nhận unsigned Gatekeeper (product constraint).

### Brownfield (đã scan)
- Có: focus, split, drag-dock, expand/zoom, session restore chrome-only, closed-tab + CWD in-memory, agent/busy.
- Chưa: layout preset/editor, pane swap, multi-window/detach, sidebar preview/diff, Open board workspace+preset.

### Glossary note
- **Workspace** (product): folder làm việc / recent paths (kiểu Cursor) — khác Window/Tab/Session trong root `CONTEXT.md`. Distill vào PRD + cập nhật glossary root.

## Distill status
- Drafts ready for freeze: `docs/PRD.md`, `docs/BUSINESS-FLOW.md` (no frontmatter yet — chờ người freeze).
- Glossary root `CONTEXT.md` updated (Workspace, Layout preset, Open board, Swap, Move to window, File sidebar, multi-window quit).

## Deferred → `/architecture` or `/adr`
- Schema persist multi-window session (one file vs many).
- ADR 0002 amendment for multi-window quit rule.
- Exact agent binary discovery heuristics (PATH scan rules).
- Open-board empty-preset UX beyond built-in single-pane default.
