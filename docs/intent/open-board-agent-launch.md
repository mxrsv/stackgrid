# Intent — Open board: 3 cột + agent launch + recent combo

- **Status:** Confirmed (explicit yes from user)
- **Date:** 2026-07-14
- **Method:** `interview-me` (11 rounds)
- **Downstream:** brainstorm → plan → implementation

## Confirmed intent

|                |                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Outcome**    | Open board trở thành cửa vào duy nhất của app. 3 cột: **sidebar trái** (giữ nguyên) \| **cột giữa = logo panel của dev** \| **cột phải** = recent workspace (trên) + layout preset + agent CLI (dưới). Bấm Open → tab mở đúng layout, **mọi pane** tự chạy agent đã chọn. |
| **User**       | Dev chạy nhiều agent CLI song song trong một workspace.                                                                                                                                                                                                                   |
| **Why now**    | Đang mất 2 bước: board chọn workspace/preset → tab mở ra → overlay "Run an agent" hỏi lại trên **từng** pane. Mở lại app thì pane cũ sống dậy rồi lại bị hỏi agent tiếp.                                                                                                  |
| **Success**    | Mở app → thấy board → click 1 dòng recent (nhớ sẵn workspace + layout + agent) → Enter → tab mở với agent chạy sẵn ở mọi pane, không phải trả lời overlay lần nào.                                                                                                        |
| **Constraint** | Bỏ **hẳn** session restore: tắt app là mất tab/pane, không auto-restore, không auto-chạy agent lúc khởi động. Overlay `agent-picker` xoá hoàn toàn.                                                                                                                       |

## Quyết định đã chốt

1. **Agent chọn ở board, áp cho cả tab** — mọi pane trong preset đều chạy agent đó (preset 4 pane → 4 agent song song). Không gán agent riêng từng pane.
2. **Overlay `agent-picker` (per-pane "Run an agent") xoá hoàn toàn** — cả đường new tab lẫn đường restore.
3. **Session restore xoá hẳn** — mở app lên là board, user tự click recent để mở lại. `session-schema.ts` + `session-persistence.ts` xoá luôn; recents/presets/settings vẫn giữ store riêng.
4. **Recent nhớ combo gần nhất theo từng workspace**: mỗi entry mang thêm `lastPresetId` + `lastAgent`. Click recent → preset + agent tự điền, vẫn đổi tay được.
5. **Logo: một logo duy nhất của dev**, không đổi theo workspace. Đổi bằng **kéo-thả ảnh vào panel** hoặc **Settings → Appearance**. Chưa set → fallback logo Stackgrid.
6. **Layout board**: gộp Workspace + Layout preset thành **một cột phải**; cột giữa dành cho logo panel; sidebar trái giữ nguyên.

## Out of scope

- Gán agent riêng cho từng pane (kể cả lưu vào `preset-schema` như `cwds`).
- Logo theo từng workspace / icon riêng cho từng project.
- Click vào panel để mở file picker đổi logo (chỉ drag-drop + Settings).
- Nhớ nhiều combo cho cùng một workspace (mỗi workspace chỉ nhớ combo gần nhất).
- ⌘⇧T undo-close tab (`closed-tabs.ts`) — giữ nguyên, chỉ sống trong phiên.

## Chỗ chạm code (tham chiếu, chưa phải plan)

- `src/open-board/open-board.tsx` — layout 3 cột, mục agent, recent combo.
- `src/lib/workspace-recents.ts` — thêm `lastPresetId` + `lastAgent` vào entry.
- `src/agent-picker/*` — xoá overlay; giữ lại `detect_agents` để board dùng.
- `src/terminal/tab-manager.ts` — `beginAgentPick` (dòng ~298, ~615) gỡ bỏ; spawn agent vào mọi pane khi materialize.
- `src/lib/session-schema.ts` — gỡ phần lưu/restore tab & pane.
- `src/settings/settings-schema.ts` + `src/ui/settings-panel.tsx` — field logo path, mục Appearance.
