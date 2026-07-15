# Open board: 3 cột, agent launch, recent combo

**Spec**: [2026-07-15-open-board-agent-launch-design](../specs/2026-07-15-open-board-agent-launch-design.md)
**Intent**: [open-board-agent-launch](../intent/open-board-agent-launch.md)
**Goal**: Open board thành cửa vào duy nhất — chọn workspace + layout + agent trong một màn hình; Open → tab mở đúng layout và **mọi pane** tự chạy agent. Overlay per-pane và session restore biến mất.
**Architecture**: Agent không spawn từ Rust mà **gõ vào shell tương tác** (`write_pty(id, "claude\r")`) sau khi pane in ra byte output đầu tiên — một `AgentLauncher` mới đứng giữa `listenOutput` (đã có, do `TabManager` sở hữu) và `write_pty`, cấp phát đúng một lần gõ cho mỗi pane, timeout 3s làm van an toàn. Recents lên v2, mỗi entry nhớ combo `lastPresetId` + `lastAgent`. Session restore bị gỡ tận gốc (`session-schema.ts`, `session-persistence.ts`, `settings.restoreTabs`), kéo theo `agentPick` / `activate` / `buildSessionData` trong `tab-materialize.ts` thành code chết → xoá luôn. Logo sống trong store riêng `logo.json` dạng data URL, nuốt vào app qua command Rust mới `read_image_as_data_url`.

## 1. Kết quả mong đợi

- Mở app → không còn tab cũ sống dậy, luôn thấy Open board — verify bằng `npm run tauri dev`: mở 2 tab, quit, chạy lại → 0 tab, board hiện.
- Click một dòng recent đã có combo → preset + agent tự điền, Enter → tab mở đúng layout, **mọi pane** đang chạy agent đó, không overlay nào hỏi lại — verify bằng `npm run tauri dev` với preset 2 pane + Claude Code.
- Chọn `Shell only` → không pane nào bị gõ gì — verify bằng test `agent-launch.test.ts` case "agent null → không writePty".
- Pane câm (shell không in gì) vẫn được gõ sau 3s — verify bằng test `agent-launch.test.ts` case "timeout 3s".
- `workspaces.json` v1 cũ vẫn đọc được, entry không bị drop — verify bằng test `workspace-recents.test.ts` case "file v1 → entry sống, combo undefined".
- Kéo ảnh vào logo panel → logo đổi ngay và sống qua restart; ảnh > 1MB / sai định dạng → lỗi inline, logo giữ nguyên — verify bằng `npm run tauri dev` + test Rust `read_image_as_data_url`.
- Toàn bộ typecheck + test pass — verify bằng `npm run build`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`.

## 2. Nguồn dữ liệu chuẩn

**Canonical data**: `agent` của một lần mở tab = chip agent đang chọn trên board tại thời điểm bấm Open. Nó chỉ sống trong luồng materialize của tab đó (arm → gõ → xong), **không** là state lâu dài của tab.

**Lấy từ**:

- Board: signal `selectedAgent` trong `open-board.tsx`, giá trị là `name` của một `DetectedAgent` (đã có trên `$PATH`) hoặc `null` (Shell only).
- Recent combo: `RecentWorkspace.lastAgent` — chỉ dùng để **tự điền** chip, không dùng để chạy thẳng.

**KHÔNG lấy từ**:

- `PaneProcessInfo.process` (agent đang chạy thật). Đó là quan sát runtime cho chấm sidebar; nó không quyết định pane mới phải gõ gì.
- `Preset`. Preset là hình học + CWD, không mang agent (out of scope, intent §Out of scope).
- `settings.json`. Agent là lựa chọn theo từng lần mở, không phải preference toàn app.

**Logo canonical**: `logo.json` key `dataUrl` — data URL đã nuốt vào app. KHÔNG giữ path gốc (file bị xoá/di chuyển thì logo chết), KHÔNG nhét vào `settings.json` (mỗi lần ghi settings sẽ kéo theo cả chuỗi base64).

## 3. Business rules & invariants

- **Một pane gõ agent đúng một lần**: `AgentLauncher` giữ set `launched`; output đến sau khi timeout đã bắn, hay `arm` gọi hai lần trên cùng pane, đều không gõ lần hai — verify bằng test `agent-launch.test.ts` case "output sau timeout → vẫn 1 lần gõ".
- **Chỉ gõ sau khi shell đã in prompt**: gõ trước prompt thì zsh nuốt ký tự. Cổng mở khi `noteOutput(id)` báo byte đầu tiên, hoặc hết 3s — verify bằng test case "chưa có output → chưa gõ".
- **Output đến trước `arm` vẫn tính**: pane spawn xong in prompt ngay, `arm()` chạy sau `await addTab` nên có thể trễ hơn byte đầu. `AgentLauncher` nhớ `sawOutput` và bắn ngay khi arm — verify bằng test case "output trước arm → arm gõ ngay".
- **Agent không còn trên `$PATH` = không tồn tại**: recent nhớ `claude` nhưng `detect_agents` không trả về → chip không render, selection rơi về `Shell only`, không có `write_pty` nào — verify bằng test `agent-launch`/board case "lastAgent lạ → null".
- **`write_pty` fail không kéo sập tab**: `.catch(console.error)`, pane vẫn là shell trống — verify bằng đọc code `agent-launch.ts`.
- **Recents v1 không bao giờ bị drop**: `validateWorkspaces` chấp nhận `version` 1 _và_ 2; entry thiếu `lastPresetId`/`lastAgent` → `undefined`, vẫn giữ — verify bằng test `workspace-recents.test.ts`.
- **`undefined` ≠ `null` cho `lastAgent`**: `undefined` = chưa từng ghi (giữ combo cũ khi push), `null` = người dùng chọn Shell only (ghi đè combo cũ) — verify bằng test case "pushRecent với agent null ghi đè lastAgent cũ".
- **Logo panel chỉ nhận drop khi board đang mở**: `boardOpen === false` → drop rơi về file-drop của terminal như cũ — verify bằng đọc code `tab-manager.ts` (early return) + `open-board.tsx` (listener chỉ sống khi board mount).
- **Ảnh > 1MB hoặc sai đuôi không đổi logo**: chặn ở Rust, `Err(String)` người-đọc-được, frontend hiện inline, `logo.json` không đổi — verify bằng test Rust.

## 4. Phạm vi / Ngoài phạm vi

**Làm**:

- `workspace-recents.ts` lên v2 (`lastPresetId`, `lastAgent`), migrate v1 không mất entry.
- Module mới `agent-launch.ts` + test: cổng first-output, timeout 3s, một lần/pane.
- `MaterializeIntent.agent`; `TabManager.materialize` arm launcher thay vì gọi picker.
- Xoá: `src/agent-picker/*`, `src/lib/session-schema.*`, `src/terminal/session-persistence.*`, `settings.restoreTabs` + toggle, `flushPendingSaves` (còn `flushSettingsSave`), `AgentPickScope`/`materializeAfterSpawn`/`activate`/`buildSessionData`/`dropDeadWorkspaces`/`SessionTabChrome`, `TabManager.paneOverlayHost`, CSS `.agent-picker*` + `.skip-all*`.
- Rust: `images.rs` với `read_image_as_data_url` (allowlist đuôi, ≤1MB, base64) + đăng ký vào `lib.rs`; thêm crate `base64`.
- `logo-store.ts` + `logo.json` + `LogoPanel` (drop zone) + row "App logo" trong Settings → Appearance.
- Board 3 cột: logo panel giữa, cột phải recent (2 dòng/row) → chip layout → chip agent, footer summary có agent.
- CSS board viết lại theo `DESIGN-LANGUAGE.md`.
- Cập nhật `CONTEXT.md` + `docs/ARCHITECTURE.md`; bump version `0.3.0` → `0.4.0`.

**KHÔNG làm**:

- Gán agent riêng từng pane; agent theo preset.
- Logo theo từng workspace; click panel để mở file picker.
- Nhớ nhiều combo cho một workspace.
- Đụng `WorkspaceSidebar`, preset editor, `closed-tabs.ts` (⌘⇧T giữ nguyên, reopen **không** chạy lại agent — đúng như hành vi cũ khi picker `agentPick: "none"`).
- Spawn agent trực tiếp từ Rust (A1: `$SHELL -lc` non-interactive → mất `$PATH`).

## 5. Rủi ro & Quyết định còn mở

**Đã chốt có rủi ro**:

- **Gõ lệnh vào stdin thay vì spawn**: nếu `.zshrc` in banner rồi mới sẵn sàng, byte đầu tiên có thể đến _trước_ khi zsh nhận input → lệnh vẫn vào buffer của tty và chạy khi prompt sẵn sàng (tty buffer giữ giúp). Rủi ro còn lại: shell nào clear buffer khi khởi động (hiếm). Giảm thiểu: gõ sau byte đầu tiên chứ không phải ngay sau spawn; nếu thực tế lỗi, chỗ sửa duy nhất là `AgentLauncher` (thêm debounce sau byte đầu).
- **Xoá session restore là mất dữ liệu người dùng**: quit là mất tab. Đây chính là điều intent yêu cầu (§Constraint). `session.json` cũ nằm lại trên đĩa vô hại, không đọc nữa.
- **Bỏ `activate`/`materializeAfterSpawn`** vượt ngoài chữ của spec §6 nhưng đúng tinh thần B1 ("không để code chết"): sau khi restore biến mất, `activate: false` không còn caller nào.

**Cần chốt trước khi code**:

- **Đường "New preset" từ live window** (`handleEditorCreate`, `request.source === "live"`) không đi qua board → chưa có agent. Mặc định plan chọn `agent = null` (Shell only). Cần user xác nhận.

## 6. Các task

### Task 1: Recents v2 — nhớ combo

**File(s)**:

- [workspace-recents.ts](../../src/lib/workspace-recents.ts)
- [workspace-recents.test.ts](../../src/lib/workspace-recents.test.ts)

**Decision**: `WORKSPACES_VERSION = 2`. `validateWorkspaces` chấp nhận `version === 1 || version === 2`, luôn trả v2. `pushRecent(recents, path, now, presetId?, agent?)`: tham số `undefined` → **kế thừa** combo cũ của entry cùng path (dedupe path chỉ cập nhật thời gian, không xoá combo); `agent: null` → ghi đè thành Shell only.

**Build**:

- `export type AgentChoice = string | null;`
- `RecentWorkspace` thêm `readonly lastPresetId?: string; readonly lastAgent?: AgentChoice;`
- Validate từng field: `lastPresetId` là string không rỗng mới giữ; `lastAgent` là `null` hoặc string không rỗng mới giữ; sai → bỏ field, **không** bỏ entry.
- `pushRecent` tìm entry cũ cùng path trước khi filter để kế thừa combo.

**Verify**:

- `npm test` → `workspace-recents.test.ts`: file `{version:1, recents:[{path,lastOpenedAt}]}` → entry sống, `lastPresetId === undefined`; `pushRecent(..., "p1", "claude")` → combo ghi vào entry đầu; push lại cùng path với `undefined, undefined` → combo cũ còn nguyên, `lastOpenedAt` mới; push với `agent: null` → `lastAgent === null`; quá `MAX_RECENTS` → cắt còn 8.

---

### Task 2: `recordWorkspaceOpen` mang combo

**File(s)**:

- [workspaces-store.ts](../../src/open-board/workspaces-store.ts)

**Phụ thuộc**: Task 1

**Decision**: `recordWorkspaceOpen(path: string, presetId?: string, agent?: AgentChoice)` — chuyển thẳng xuống `pushRecent`.

**Build**:

- Đổi chữ ký, truyền qua `pushRecent`.

**Verify**:

- `npm run build` → tsc pass (call site trong `app.tsx` buộc cập nhật ở Task 7).

---

### Task 3: Memory PTY client ghi lại `writePty`

**File(s)**:

- [pty-client.ts](../../src/terminal/pty-client.ts)

**Decision**: `createMemoryPtyClient` trả thêm `readonly writes: { id: number; data: string }[]` — test agent launch cần assert đã gõ gì, gõ mấy lần.

**Build**:

- Thêm mảng `writes` trong closure, `writePty(id, data)` push vào, expose trong object trả về.

**Verify**:

- `npm run build` → tsc pass; test cũ dùng `createMemoryPtyClient` vẫn pass (`npm test`).

---

### Task 4: `AgentLauncher` — cổng first-output

**File(s)**:

- [agent-launch.ts](../../src/terminal/agent-launch.ts) (mới)
- [agent-launch.test.ts](../../src/terminal/agent-launch.test.ts) (mới)

**Phụ thuộc**: Task 3

**Decision** (TDD — test trước): API

```ts
export const AGENT_LAUNCH_TIMEOUT_MS = 3000;
export interface AgentLauncher {
  arm(paneIds: readonly number[], agent: AgentChoice): void;
  noteOutput(id: number): void;
  prune(alive: readonly number[]): void;
  dispose(): void;
}
export function createAgentLauncher(
  pty?: PtyClient,
  timeoutMs?: number,
): AgentLauncher;
```

State: `armed: Map<id, {agent, timer}>`, `sawOutput: Set<id>`, `launched: Set<id>`.
`arm`: `agent === null` → no-op; pane đã `sawOutput` → gõ ngay; chưa → hẹn `setTimeout(timeoutMs)`.
`noteOutput`: ghi `sawOutput`, nếu pane đang `armed` → gõ ngay.
`fire`: chặn bằng `launched`, `clearTimeout`, `pty.writePty(id, agent + "\r").catch(console.error)`.
`prune(alive)`: clearTimeout + xoá id chết khỏi cả ba tập (pane id không tái sử dụng nên không có va chạm).

**Build**:

- Viết test trước với `vi.useFakeTimers()` + `createMemoryPtyClient()`.
- Implement cho test xanh.

**Verify**:

- `npm test` → `agent-launch.test.ts` pass: (1) arm rồi `noteOutput` → `writes === [{id, data:"claude\r"}]`; (2) arm, không output, `vi.advanceTimersByTime(3000)` → 1 write; (3) output đến sau timeout → vẫn 1 write; (4) `arm([1], null)` → `writes` rỗng; (5) `noteOutput(1)` trước `arm([1],"codex")` → gõ ngay, không cần chờ; (6) `prune([])` rồi advance 3000 → không write; (7) `dispose()` → không write.

---

### Task 5: `MaterializeIntent.agent` thay `agentPick`

**File(s)**:

- [tab-materialize.ts](../../src/terminal/tab-materialize.ts)
- [tab-materialize.test.ts](../../src/terminal/tab-materialize.test.ts)

**Phụ thuộc**: Task 4

**Decision**: Bỏ `AgentPickScope`, `materializeAfterSpawn`, `MaterializeIntent.activate`, `buildSessionData`, `SessionTabChrome`, `dropDeadWorkspaces` (toàn bộ là code chết sau khi restore biến mất). `MaterializeIntent` mọc `readonly agent?: AgentChoice`. `CwdPolicy` bỏ nhánh `"none"` nếu không còn caller.

**Build**:

- Xoá các export trên + import `SessionData`/`SessionTab`.
- Thêm `agent?: AgentChoice` vào `MaterializeIntent`.
- Xoá test tương ứng trong `tab-materialize.test.ts` (`buildSessionData`, `dropDeadWorkspaces`, `materializeAfterSpawn`).

**Verify**:

- `npm run build` → tsc pass sau khi Task 6 sửa call site.
- `grep -rn "agentPick\|materializeAfterSpawn\|buildSessionData" src/` → rỗng.

---

### Task 6: `TabManager` — bỏ restore, arm launcher

**File(s)**:

- [tab-manager.ts](../../src/terminal/tab-manager.ts)
- [tab-manager.test.ts](../../src/terminal/tab-manager.test.ts)

**Phụ thuộc**: Task 4, Task 5

**Decision**: `init(): Promise<void>` (không còn `{hasTabs}` vì luôn false). `openFromPreset(layout, cwds, options: { workspacePath?: string; agent?: AgentChoice })`. Launcher do TabManager sở hữu: `listenOutput` → `noteOutput`, `onLayoutChange`/`disposeTab` → `prune(live)`, `dispose()` → `dispose()`. Quit path gọi thẳng `flushSettingsSave()`.

**Build**:

- Bỏ import/chạy `loadSession`, `scheduleSessionSave`, `flushPendingSaves`, `beginAgentPick`, `prunePending`; bỏ `sessionChrome()`, `persist()` và mọi lời gọi, bỏ `tabsWithLiveWorkspace`, bỏ `paneOverlayHost` khỏi interface + object trả về.
- `const launcher = createAgentLauncher(pty);` — trong handler `listenOutput` gọi `launcher.noteOutput(id)` **trước** khi route vào các tab.
- `materialize`: sau `selectTab(...)` → `void poller.poll(); launcher.arm(newTab.manager.paneIds(), intent.agent ?? null);`
- `reopenTab` truyền `agent: null` (⌘⇧T không chạy lại agent).
- `init()`: giữ nguyên listeners + `poller.start()` + `syncViews()`, trả `void`.

**Verify**:

- `npm test` → `tab-manager.test.ts`: xoá case restore; thêm case "materialize với agent → sau khi pane phát output, `pty.writes` có đúng 1 entry/pane với `claude\r`"; case "agent null → `writes` rỗng".
- `grep -rn "restoreTabs\|loadSession\|beginAgentPick" src/` → rỗng.

---

### Task 7: Xoá agent-picker + session persistence

**File(s)**:

- `src/agent-picker/agent-picker.ts`, `picker-store.ts`, `picker-store.test.ts`, `skip-all-bar.tsx` (xoá)
- `src/lib/session-schema.ts`, `session-schema.test.ts` (xoá)
- `src/terminal/session-persistence.ts`, `session-persistence.test.ts` (xoá)
- [app.tsx](../../src/ui/app.tsx)
- [styles.css](../../src/styles.css)

**Phụ thuộc**: Task 6

**Decision**: `flushPendingSaves` biến mất, quit guard dùng thẳng `flushSettingsSave` từ `settings-store`.

**Build**:

- `git rm` 8 file trên.
- `app.tsx`: bỏ `installAgentPicker`, `<SkipAllBar />`, import `flushPendingSaves` → `flushSettingsSave`; `init()` không nhận `{hasTabs}` nữa → `boardOpen.value = true` ở cả `then` và `catch`.
- `styles.css`: xoá block `.agent-picker*`, `.skip-all*`.

**Verify**:

- `npm run build` && `npm test` pass.
- `grep -rn "agent-picker\|SkipAllBar\|session-schema\|session-persistence" src/` → rỗng.

---

### Task 8: Bỏ `settings.restoreTabs`

**File(s)**:

- [settings-schema.ts](../../src/settings/settings-schema.ts)
- [settings-schema.test.ts](../../src/settings/settings-schema.test.ts)
- [settings-panel.tsx](../../src/ui/settings-panel.tsx)

**Phụ thuộc**: Task 7

**Decision**: Xoá field khỏi `Settings`, `DEFAULT_SETTINGS`, `validateSettings`, và `ToggleRow` "Restore tabs". `settings.json` cũ còn key thừa → `validateSettings` bỏ qua, vô hại.

**Build**:

- Xoá 3 chỗ trong schema, 1 toggle trong panel, các case test liên quan.

**Verify**:

- `npm test` → `settings-schema.test.ts` pass.
- `grep -rn "restoreTabs" src/` → rỗng.

---

### Task 9: Rust `read_image_as_data_url`

**File(s)**:

- `src-tauri/src/images.rs` (mới)
- [lib.rs](../../src-tauri/src/lib.rs)
- [Cargo.toml](../../src-tauri/Cargo.toml)

**Decision**: `#[tauri::command] pub async fn read_image_as_data_url(path: String) -> Result<String, String>`. Allowlist đuôi (case-insensitive): `png`, `jpg`, `jpeg`, `svg`, `webp` → mime `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`. `MAX_LOGO_BYTES = 1_048_576`. Thêm crate `base64 = "0.22"` (zero-dep, chỉ để encode).

**Build**:

- `fn mime_for(path: &Path) -> Option<&'static str>` (pure, test được).
- Command: mime → check `metadata().len()` → đọc file → encode → `format!("data:{mime};base64,{b64}")`.
- Lỗi (English, người-đọc-được): `"Unsupported image type — use .png, .jpg, .svg or .webp"`, `"Image is too large (max 1 MB)"`, `"Couldn't read the image file"`.
- Đăng ký `mod images;` + `images::read_image_as_data_url` trong `invoke_handler`.

**Verify**:

- `cargo test --manifest-path src-tauri/Cargo.toml` → pass: `mime_for` với `.PNG` → `image/png`, `.gif` → `None`; command với file 2MB → `Err("Image is too large (max 1 MB)")`; file không tồn tại → `Err`; file png nhỏ → `Ok` bắt đầu bằng `data:image/png;base64,`.

---

### Task 10: `logo-store.ts`

**File(s)**:

- `src/settings/logo-store.ts` (mới)
- `src/settings/logo-store.test.ts` (mới)
- [main.tsx](../../src/main.tsx)

**Phụ thuộc**: Task 9

**Decision**: Store riêng `logo.json`, key `dataUrl`. Signal `logoDataUrl = signal<string>("")` — rỗng = fallback mark mặc định. Phần thuần (test được) tách rõ: `isSupportedImagePath`, `pickImagePath` (lấy file hợp lệ **đầu tiên** trong danh sách drop), `validateLogoDataUrl` (phải bắt đầu bằng `data:image/`, sai → `""`).

**Build**:

- `initLogo()` load store (theo khuôn `initWorkspaces`), gọi trong `main.tsx` cạnh `initSettings`/`initWorkspaces`.
- `setLogoFromPath(path)`: `invoke<string>("read_image_as_data_url", { path })` → set signal → persist; ném lại message lỗi cho UI hiện inline.
- `clearLogo()`: signal `""` + persist.

**Verify**:

- `npm test` → `logo-store.test.ts`: `isSupportedImagePath("/a/b.PNG")` → true, `.gif` → false; `pickImagePath(["/a.txt","/b.jpg","/c.png"])` → `/b.jpg`; `pickImagePath(["/a.txt"])` → null; `validateLogoDataUrl("data:image/png;base64,xx")` → giữ; `validateLogoDataUrl("http://x")` / `null` / `123` → `""`.

---

### Task 11: `LogoPanel` — cột giữa + drop zone

**File(s)**:

- `src/open-board/logo-panel.tsx` (mới)
- [file-drop.ts](../../src/terminal/file-drop.ts) (đọc, không sửa)
- [tab-manager.ts](../../src/terminal/tab-manager.ts)

**Phụ thuộc**: Task 10

**Decision**: `LogoPanel` tự `installFileDrop` trong `useEffect` (Tauri cho phép nhiều listener trên cùng event). Hit-test toạ độ drop vào `getBoundingClientRect()` của panel: ngoài vùng → bỏ qua. `TabManager`'s file-drop handlers early-return khi `boardOpen.value === true` (drop trong lúc board mở không được rơi vào terminal phía sau). Fallback logo = inline SVG mark (không thêm file asset — DL-1.1).

**Build**:

- Panel: `<div class="board-logo">` + `<img src={logoDataUrl}>` hoặc SVG mark; state `dragOver` (viền đứt + "Thả ảnh để đổi logo"), `error` (inline).
- Drop → `pickImagePath(paths)` → null thì hiện lỗi định dạng; có thì `setLogoFromPath` (lỗi từ Rust hiện inline).
- `tab-manager.ts`: 3 handler `onOver/onDrop/onLeave` mở đầu bằng `if (boardOpen.value) return;`.

**Verify**:

- `npm run tauri dev`: kéo `.png` 200KB vào panel → logo đổi; kéo `.gif` → lỗi inline, logo cũ giữ; kéo file khi board đóng → path vẫn được chèn vào terminal như cũ; restart app → logo mới còn.

---

### Task 12: Board 3 cột + chip agent + recent combo

**File(s)**:

- [open-board.tsx](../../src/open-board/open-board.tsx)
- [app.tsx](../../src/ui/app.tsx)

**Phụ thuộc**: Task 1, Task 11

**Decision**: `OpenBoardProps.onOpen(workspace, preset, agent)`. Ba section trong cột phải: `workspace` → `layout` → `agent`, Tab/Shift-Tab xoay vòng, ↑↓ di chuyển trong section, `1/2/3/0` chọn agent (giữ convention overlay cũ), Enter = Open, Esc = Cancel. `detectAgents()` chạy lúc mount, fail → `[]` (chỉ còn Shell only). Chọn workspace → tự điền preset + agent từ combo; agent trong combo mà không có trên `$PATH` → chip không render, selection về `null`, badge ở dòng recent hiện xám + gạch.

**Build**:

- Signals: `selectedPath`, `selectedPresetId`, `selectedAgent: AgentChoice`, `agents: readonly DetectedAgent[]`, `section`.
- `selectWorkspace(path)` — một chỗ duy nhất tự điền combo (không dùng effect, để user đổi tay là dính).
- Layout preset: chip ngang (`PresetThumb` 44×28 + tên), `＋ New preset` là chip cuối; rename/delete giữ nguyên hành vi cũ.
- Footer summary: `Open <b>name</b> as <b>preset</b> with <b>agent</b>`.
- `app.tsx`: `handleOpen(workspace, preset, agent)` → `openFromPreset(..., { workspacePath, agent })` + `recordWorkspaceOpen(path, preset.id, agent)`; nhánh dedupe (tab đã tồn tại) chỉ `recordWorkspaceOpen(path)` (giữ combo cũ, vì preset/agent đã chọn không được áp dụng).
- `handleEditorCreate` nguồn `live` → `agent: null` (chốt ở §5).

**Verify**:

- `npm run tauri dev`: recent có combo → click → chip preset + agent sáng đúng; Enter → tab mở, mọi pane chạy agent; `0` → Shell only, không pane nào bị gõ.
- `npm run build` → tsc pass.

---

### Task 13: CSS board + logo panel

**File(s)**:

- [styles.css](../../src/styles.css)
- [DESIGN-LANGUAGE.md](../DESIGN-LANGUAGE.md) (đọc trước khi viết)

**Phụ thuộc**: Task 12

**Decision**: Ba cột `grid-template-columns: 1fr <520px>` bên trong `.stage` (sidebar là app chrome, nằm ngoài board). Row recent 2 dòng ~44px, path `text-overflow: ellipsis` cắt giữa bằng `direction: rtl` trick hoặc cắt ở JS; chip layout cuộn ngang (`overflow-x: auto`, thanh cuộn mảnh như `.open-board__col`); chip agent một hàng. Tuân thủ DL: chỉ token màu, không `box-shadow` mờ, không `backdrop-filter`, transition ≤ 300ms.

**Build**:

- Viết lại block `/* ---------- Open board ---------- */`; xoá `.preset-grid`/`.preset-card` nếu preset editor không dùng chung (kiểm tra bằng grep trước khi xoá).
- Thêm `.board-logo*`, `.preset-chip*`, `.agent-chip*`.

**Verify**:

- `npm run tauri dev` + screenshot: 3 cột đúng tỉ lệ, không tràn ngang, chip không vỡ hàng; chạy checklist §9 của `DESIGN-LANGUAGE.md`.

---

### Task 14: Row "App logo" trong Settings → Appearance

**File(s)**:

- `src/ui/controls/logo-row.tsx` (mới)
- [settings-panel.tsx](../../src/ui/settings-panel.tsx)

**Phụ thuộc**: Task 10

**Decision**: `ConfigRow label="App logo"` với nút "choose…" (dùng `plugin-dialog` `open({ filters: [{ name: "Image", extensions: [...] }] })`) + nút "remove" khi đã có logo + lỗi inline dưới row.

**Build**:

- Component theo khuôn `EditorRow`/`FontRow`.
- Chèn vào nhóm `appearance`, ngay dưới `Font size`.

**Verify**:

- `npm run tauri dev`: chọn ảnh → logo panel đổi ngay; remove → về mark mặc định; chọn file 2MB → lỗi inline.

---

### Task 15: Đồng bộ tài liệu + bump version

**File(s)**:

- [CONTEXT.md](../../CONTEXT.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [package.json](../../package.json), [tauri.conf.json](../../src-tauri/tauri.conf.json), [Cargo.toml](../../src-tauri/Cargo.toml)

**Phụ thuộc**: Task 1–14

**Decision**: Gỡ mọi mô tả session restore / agent picker overlay khỏi hai tài liệu; thêm mô hình "board là cửa vào duy nhất + agent launch qua stdin" và store `logo.json`. Version `0.3.0` → `0.4.0` (breaking: mất session restore).

**Build**:

- Sửa hai tài liệu; sửa `version` ở ba file.

**Verify**:

- `grep -rn "session.json\|agent picker\|restoreTabs" CONTEXT.md docs/ARCHITECTURE.md` → rỗng (hoặc chỉ còn dòng ghi chú "đã gỡ").
- `grep -rn "0.4.0" package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml` → 3 dòng.
- `npm run build && npm test && cargo test --manifest-path src-tauri/Cargo.toml` → pass.
