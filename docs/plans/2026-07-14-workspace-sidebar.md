# Workspace sidebar

**Intent**: [workspace-sidebar](../intent/workspace-sidebar.md)
**Goal**: Biến tab bar thành workspace bar đổi hướng được (`left` mặc định, `top` tuỳ chọn), mỗi dòng là một workspace kèm chấm báo có agent đang chạy.
**Architecture**: Gán `workspacePath` vào từng tab như một chrome field mới trong `session.json` (optional, giữ nguyên `SESSION_VERSION = 1` nên file cũ vẫn đọc được). `TabView` mọc thêm `workspacePath` + `agentBusy`; `agentBusy` suy ra từ `PaneInfoPoller` bằng `isAgent()` trên toàn bộ pane của tab đó. Phần render tách đôi: `TabBar` (ngang, giữ nguyên) và `WorkspaceSidebar` (dọc, mới), cụm nút hành động được rút ra thành `ChromeActions` để hai bên dùng chung.

## 1. Kết quả mong đợi

- `session.json` lưu `workspacePath` cho mỗi tab, file cũ (không có field này) vẫn load được — verify bằng `npm test` (`session-schema.test.ts`, case "tab thiếu workspacePath vẫn hợp lệ").
- `Settings.tabBarPosition` tồn tại, default `"left"`, giá trị lạ rơi về default — verify bằng `npm test` (`settings-schema.test.ts`, case "tabBarPosition lạ → left").
- Sidebar dọc hiện mỗi workspace một dòng: tên repo + path rút gọn `~/...` + chấm sáng khi có agent chạy trong tab đó — verify bằng `npm run tauri dev`, mở 2 workspace, chạy `claude` ở một cái, quan sát chỉ dòng đó có chấm sáng.
- Mở lại một workspace đã có tab thì focus tab cũ, không đẻ tab thứ hai — verify bằng `npm run tauri dev`: mở workspace A, Cmd+T, chọn lại A, đếm số tab vẫn là 1.
- Restore session spawn pane tại `workspacePath` của tab chứ không phải `$HOME` — verify bằng `npm run tauri dev`: mở workspace A, quit, mở lại, gõ `pwd` trong pane → in ra path của A.
- Toàn bộ typecheck + test pass — verify bằng `npm run build` và `npm test`.

## 2. Nguồn dữ liệu chuẩn

**Canonical data**: `workspacePath` của một tab = đường dẫn thư mục người dùng chọn ở Open board tại thời điểm mở tab đó. Nó là identity của tab, bất biến trong suốt đời tab.

**Lấy từ**:

- Open board: tham số `workspace` trong `handleOpen` tại [app.tsx](../../src/ui/app.tsx).
- Session restore: field `workspacePath` đọc từ `session.json`.
- Closed-tab reopen: field `workspacePath` trong `ClosedTabSnapshot`.
- Preset editor nguồn `live`: kế thừa `workspacePath` của tab đang active.

**KHÔNG lấy từ**:

- CWD sống của pane (`PaneProcessInfo.cwd`). Người dùng `cd` sang chỗ khác trong terminal KHÔNG được đổi workspace của tab — nếu lấy từ đây thì danh tính tab nhảy loạn theo mỗi lần `cd`, và sidebar mất ý nghĩa.
- `Preset.cwds`. Preset có thể ghim CWD tuyệt đối cho một leaf, trỏ ra ngoài workspace; đó là pane lệch, không phải workspace của tab.
- `workspaces.json` (`recents`). Đó là lịch sử thư mục đã mở, không phải tab đang sống.

## 3. Business rules & invariants

- **Workspace ≡ Tab (1:1)**: một tab có đúng một `workspacePath`; hai tab không được cùng một `workspacePath` — verify bằng test `tab-manager` case "mở lại workspace đã có tab → không tạo tab mới" (đếm `tabViews.value.length`).
- **workspacePath bất biến**: sau khi tab được materialize, không có đường nào ghi đè `workspacePath` — verify bằng đọc code: chỉ `addTab` gán, không có setter nào khác export ra từ [tab-manager.ts](../../src/terminal/tab-manager.ts).
- **agentBusy = có ít nhất một pane trong tab đang chạy agent**: dùng `isAgent(info.process)` từ [process-info.ts](../../src/lib/process-info.ts), KHÔNG dùng `isBusy` của [close-guard.ts](../../src/terminal/close-guard.ts) (cái đó coi `vim`, `npm` là busy → chấm sẽ sáng vĩnh viễn và trở thành nhiễu) — verify bằng test `tabs-store.test.ts` case "pane chạy vim → agentBusy false; pane chạy claude → agentBusy true".
- **Tab cũ không có workspacePath vẫn sống**: `session.json` từ bản trước không có field này → tab hiển thị label fallback, không crash, không bị drop — verify bằng test `session-schema.test.ts` case "tab thiếu workspacePath vẫn hợp lệ".
- **Chỉ một thanh hiện tại một thời điểm**: `tabBarPosition = "left"` thì không render `TabBar` ngang, và ngược lại — verify bằng đọc render tree trong [app.tsx](../../src/ui/app.tsx): hai nhánh loại trừ nhau.

## 4. Phạm vi / Ngoài phạm vi

**Làm**:

- Thêm `workspacePath` (optional) vào `SessionTab`, `SessionTabChrome`, `MaterializeIntent`, `ClosedTabSnapshot`.
- Thêm `workspacePath` + `agentBusy` vào `TabView`.
- Mở rộng `pollTargets()` để poll toàn bộ pane của mọi tab (hiện chỉ poll pane active của mỗi tab) — cần thiết để biết agent chạy ở pane nền.
- Session restore spawn pane tại `workspacePath` thay vì `$HOME`.
- Thêm `Settings.tabBarPosition: "top" | "left"`, default `"left"`, kèm control trong Settings panel.
- Component mới `WorkspaceSidebar`; rút cụm nút hành động ra `ChromeActions` dùng chung.
- Dedupe khi Open: workspace đã có tab thì focus tab đó.
- Cập nhật `CONTEXT.md` + `docs/ARCHITECTURE.md` cho khớp model mới.
- Bump version lên `0.2.2`.

**KHÔNG làm**:

- Cây file / file explorer.
- File preview + git diff (ADR D5 để nguyên, chưa implement).
- Xổ tầng pane trong sidebar (chấm chỉ ở tầng workspace).
- Đổi `Preset` schema hay cấm preset ghim CWD ra ngoài workspace.
- Sidebar resize bằng chuột (dùng chiều rộng cố định `--sidebar-w`).
- Multi-window, `move_pane_ownership`.
- Đổi Open board.

## 5. Rủi ro & Quyết định còn mở

**Đã chốt có rủi ro**:

- **Session restore đổi hành vi: spawn tại `workspacePath` thay vì `$HOME`.** Đây là hệ quả trực tiếp của workspace ≡ tab — một tab dán nhãn `stackgrid` mà shell nằm ở `~` là nói dối. Rủi ro: vi phạm ADR 0001 ("session.json = chrome only"), và nếu thư mục đã bị xoá/unmount thì spawn fail. Giảm thiểu: `initFromLayout` đã bọc try/catch trong `addTab`, spawn fail chỉ skip tab đó chứ không sập app. `CONTEXT.md` + `ARCHITECTURE.md` phải sửa theo (Task 15).
- **Giữ `SESSION_VERSION = 1`, không bump.** `workspacePath` là optional, thêm vào không phá file cũ. Rủi ro: schema version không còn phản ánh trung thực hình dạng file. Đổi lại: người dùng không mất session đang có (bump version → `validateSession` trả null → mất sạch tab).
- **Poll toàn bộ pane của mọi tab.** Rủi ro: số pane trong một lần `pty_info` tăng (trước: 1 pane/tab nền; sau: mọi pane). Chấp nhận được vì `ptyInfo` nhận cả mảng id trong một IPC, và `MAX_RESTORED_TABS = 16`.
- **Preset ghim CWD tuyệt đối vẫn được phép trỏ ra ngoài workspace.** Rủi ro: một tab `stackgrid` có thể chứa pane đang ở repo khác, sidebar không phản ánh điều đó. Chấp nhận vì user xác nhận không bao giờ dùng kiểu này; siết `Preset` schema là scope riêng.

**Chưa chốt cần resolve**:

- Tab kế thừa từ session cũ (không có `workspacePath`) thì sidebar hiển thị label gì? Đề xuất: dùng `name` override nếu có, không thì chuỗi `Unknown`, path để trống. Cần user gật trước Task 9.
- `tabBarPosition` mặc định `"left"` áp cho cả user đang dùng bản cũ (settings hiện có không chứa field này → `validateSettings` trả default `"left"`) — tức là bản cập nhật sẽ tự đổi layout của họ. Chấp nhận hay giữ `"top"` cho ai đã có `settings.json`? Đề xuất: chấp nhận, vì đây là app một người dùng.

## 6. Các task

### Task 1: Hàm thuần đặt tên workspace

**File(s)**:

- [workspace-label.ts](../../src/lib/workspace-label.ts) (mới)
- [workspace-label.test.ts](../../src/lib/workspace-label.test.ts) (mới)

**Decision**: `workspaceLabel(path)` trả về basename; `"/"` trả về `"/"`; chuỗi rỗng trả về `"Unknown"`. Path hiển thị dùng lại `tildify` sẵn có trong [process-info.ts](../../src/lib/process-info.ts), không viết lại.

**Build**:

- Export `workspaceLabel(path: string): string` — cắt trailing slash, lấy đoạn sau dấu `/` cuối.
- Không import React/Preact, không đụng Web API.

**Verify**:

- `npm test` → `workspace-label.test.ts` pass với các case: `/Users/k/dev/stackgrid` → `stackgrid`; `/Users/k/dev/stackgrid/` → `stackgrid`; `/` → `/`; `""` → `Unknown`.

---

### Task 2: `workspacePath` vào session schema

**File(s)**:

- [session-schema.ts](../../src/lib/session-schema.ts)
- [session-schema.test.ts](../../src/lib/session-schema.test.ts)

**Decision**: `SessionTab.workspacePath?: string`. Giữ `SESSION_VERSION = 1`. Validate: phải là string bắt đầu bằng `/`, độ dài 1–512, sai thì bỏ field (không loại cả tab).

**Build**:

- Thêm field optional vào interface `SessionTab`.
- Thêm `validateWorkspacePath(raw: unknown): string | undefined` theo đúng khuôn `validateTabName` đang có.
- Nối vào vòng lặp dựng `tabs` trong `validateSession`, spread giống `name` / `dotColor`.

**Verify**:

- `npm test` → `session-schema.test.ts` pass với: tab có `workspacePath: "/Users/k/dev/x"` → giữ nguyên; tab thiếu field → vẫn hợp lệ, `workspacePath === undefined`; tab có `workspacePath: "relative/path"` → field bị bỏ, tab vẫn hợp lệ.

---

### Task 3: `workspacePath` xuyên qua materialize + closed tab

**File(s)**:

- [tab-materialize.ts](../../src/terminal/tab-materialize.ts)
- [closed-tabs.ts](../../src/terminal/closed-tabs.ts)

**Phụ thuộc**: Task 2

**Decision**: `MaterializeIntent.workspacePath?: string`, `SessionTabChrome.workspacePath?: string`, `ClosedTabSnapshot.workspacePath: string | null`.

**Build**:

- Thêm field vào ba interface trên.
- `buildSessionData` spread `workspacePath` vào từng `SessionTab` giống cách nó đang spread `name`.
- `buildClosedTabSnapshot` nhận thêm `workspacePath: string | null` trong input và trả ra trong snapshot.

**Verify**:

- `npm run build` → tsc pass (mọi call site của `buildClosedTabSnapshot` bị buộc truyền field mới).
- `npm test` → `tab-materialize.test.ts` pass với case "buildSessionData giữ workspacePath".

---

### Task 4: TabManager sở hữu workspacePath của từng tab

**File(s)**:

- [tab-manager.ts](../../src/terminal/tab-manager.ts)

**Phụ thuộc**: Task 3

**Decision**: `TabEntry` mọc thêm `readonly workspacePath: string | null`. Gán đúng một lần lúc `addTab`, không có setter.

**Build**:

- `addTab(layout, cwds, workspacePath)` — thêm tham số thứ ba, gán vào `TabEntry` khi push.
- `materialize` truyền `intent.workspacePath ?? null` xuống `addTab`.
- `sessionChrome()` đọc `tab.workspacePath` và spread vào chrome object.
- `disposeTab` truyền `entry.workspacePath` vào `buildClosedTabSnapshot`.
- `reopenTab` truyền `snapshot.workspacePath ?? undefined` vào `materialize`.
- Trong `init()`, session restore: đổi `cwds: []` thành mảng lấp đầy `sessionTab.workspacePath` cho mọi leaf (dùng `countLeaves` từ [split-tree.ts](../../src/lib/split-tree.ts)); nếu `workspacePath` undefined thì giữ `[]` như cũ.

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev` → mở workspace A, quit, mở lại app, gõ `pwd` trong pane restore → in ra path của A (không phải `$HOME`).

---

### Task 5: Poll toàn bộ pane + tra tab theo workspace

**File(s)**:

- [tab-manager.ts](../../src/terminal/tab-manager.ts)

**Phụ thuộc**: Task 4

**Decision**: `pollTargets()` trả về mọi pane id của mọi tab. Thêm API `findTabByWorkspace(path: string): number` vào interface `TabManager`, trả `-1` khi không có.

**Build**:

- Đổi `pollTargets()`: bỏ nhánh "chỉ active pane của mỗi tab", thay bằng `tabs.flatMap((tab) => tab.manager.paneIds())` — chính là `allPaneIds()` đã có.
- Thêm `findTabByWorkspace` vào interface `TabManager` và vào object trả về: `tabs.findIndex((tab) => tab.workspacePath === path)`.

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev` → mở tab A (split 2 pane), chạy `claude` ở pane KHÔNG active, chuyển sang tab B, quan sát dòng A trong sidebar vẫn có chấm sáng.

---

### Task 6: `TabView` mọc `workspacePath` + `agentBusy`

**File(s)**:

- [tabs-store.ts](../../src/terminal/tabs-store.ts)
- [tab-manager.ts](../../src/terminal/tab-manager.ts)

**Phụ thuộc**: Task 5

**Decision**: `TabView.workspacePath: string | null` và `TabView.agentBusy: boolean`. `agentBusy` tính trong `syncViews` bằng `isAgent()` trên info của mọi pane thuộc tab. `applyTabOverride` KHÔNG đụng hai field này (chúng không phải override của người dùng).

**Build**:

- Thêm hai field vào interface `TabView` trong [tabs-store.ts](../../src/terminal/tabs-store.ts).
- Trong `syncViews()` của [tab-manager.ts](../../src/terminal/tab-manager.ts): với mỗi tab, map `tab.manager.paneIds()` qua `poller.infoFor(id)`, `agentBusy = infos.some((info) => info !== undefined && isAgent(info.process))`.
- Truyền `workspacePath: tab.workspacePath` vào object `TabView`.

**Verify**:

- `npm test` → `tabs-store.test.ts` pass với case "applyTabOverride không ghi đè agentBusy/workspacePath".
- `npm run build` → tsc pass (TabBar buộc phải nhận field mới).

---

### Task 7: `tabBarPosition` vào settings

**File(s)**:

- [settings-schema.ts](../../src/settings/settings-schema.ts)
- [settings-schema.test.ts](../../src/settings/settings-schema.test.ts)

**Decision**: `Settings.tabBarPosition: "top" | "left"`, `DEFAULT_SETTINGS.tabBarPosition = "left"`. Giá trị lạ hoặc thiếu → `"left"`.

**Build**:

- Thêm `export type TabBarPosition = "top" | "left"` và field vào interface `Settings`.
- Thêm vào `DEFAULT_SETTINGS`.
- Thêm nhánh trong `validateSettings`: chỉ nhận đúng hai chuỗi hợp lệ, còn lại rơi về default.

**Verify**:

- `npm test` → `settings-schema.test.ts` pass với: `{tabBarPosition: "top"}` → `"top"`; `{tabBarPosition: "diagonal"}` → `"left"`; `{}` → `"left"`.

---

### Task 8: Rút cụm nút hành động ra `ChromeActions`

**File(s)**:

- [chrome-actions.tsx](../../src/ui/chrome-actions.tsx) (mới)
- [tab-bar.tsx](../../src/ui/tab-bar.tsx)

**Decision**: Toàn bộ khối `.tabbar__actions` (split row, split column, close pane, expand, separator, gear) cùng năm SVG icon component chuyển sang `ChromeActions`. `TabBar` import và dùng lại, hành vi không đổi.

**Build**:

- Tạo `ChromeActions` nhận props: `settingsOpen`, `expandActive`, `onSplitRow`, `onSplitColumn`, `onClosePane`, `onToggleExpand`, `onToggleSettings`.
- Chuyển `SplitRowIcon`, `SplitColumnIcon`, `ClosePaneIcon`, `ExpandIcon`, `GearIcon` sang file mới.
- `TabBar` thay khối inline bằng `<ChromeActions ... />`, xoá các icon component đã chuyển đi.

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev` với `tabBarPosition: "top"` → năm nút vẫn hoạt động đúng như trước (split, close pane, expand, settings).

---

### Task 9: Component `WorkspaceSidebar`

**File(s)**:

- [workspace-sidebar.tsx](../../src/ui/workspace-sidebar.tsx) (mới)

**Phụ thuộc**: Task 1, Task 6, Task 8

**Decision**: Danh sách dọc, mỗi dòng: chấm trạng thái, label từ `workspaceLabel(tab.workspacePath)`, dòng path phụ từ `tildify(tab.workspacePath, home)`. Tab không có `workspacePath` → label `Unknown`, không có dòng path. Chấm sáng (`var(--accent)`) khi `agentBusy`, mờ (`var(--text-faint)`) khi không. Nút `+` new tab ở cuối danh sách, `ChromeActions` KHÔNG nằm trong sidebar (nó lên titlebar ở Task 11).

**Build**:

- Props: `onSelectTab`, `onCloseTab`, `onNewTab`, `onRenameTab`, `onSetTabColor`.
- Đọc `tabViews`, `activeTabIndex`, `statusInfo.value.home` từ [tabs-store.ts](../../src/terminal/tabs-store.ts).
- Giữ nguyên cơ chế `TabPopover` anchored theo `tab.key` như [tab-bar.tsx](../../src/ui/tab-bar.tsx) đang làm (rename + đổi màu chấm), chỉ đổi vị trí anchor sang `rect.right + 6` / `rect.top`.

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev` với `tabBarPosition: "left"` → sidebar hiện đúng số dòng bằng số tab, click dòng thì đổi tab.

---

### Task 10: `App` render theo `tabBarPosition`

**File(s)**:

- [app.tsx](../../src/ui/app.tsx)

**Phụ thuộc**: Task 9

**Decision**: `left` → `.window.window--sidebar`, titlebar chứa `ChromeActions` căn phải, `WorkspaceSidebar` là cột trái, không render `TabBar`. `top` → giữ nguyên cây hiện tại.

**Build**:

- Đọc `settings.value.tabBarPosition`.
- Thêm class có điều kiện cho `.window`.
- Nhánh `left`: đặt `<ChromeActions />` bên trong `.titlebar`, render `<WorkspaceSidebar />` trước `<main class="stage">`.
- Nhánh `top`: giữ `<TabBar />` như cũ.
- Cả hai nhánh dùng chung một bộ handler đang có (`onSelectTab`, `onCloseTab`, `onNewTab`, `onRenameTab`, `onSetTabColor`).

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev`, đổi setting qua lại giữa `left` và `top` → chỉ một thanh hiện tại một thời điểm, không có thanh nào mồ côi.

---

### Task 11: CSS cho sidebar

**File(s)**:

- [styles.css](../../src/styles.css)

**Phụ thuộc**: Task 10

**Decision**: `--sidebar-w: 200px` thêm vào `:root`. `.window--sidebar` dùng CSS grid: hàng titlebar full-width, hàng giữa hai cột `var(--sidebar-w) 1fr`, hàng status bar full-width. Không đụng `.window` mặc định.

**Build**:

- Thêm `--sidebar-w` vào block `:root`.
- Thêm `.window--sidebar` grid template.
- Thêm `.wsbar`, `.wsbar__list`, `.wsitem`, `.wsitem.is-active`, `.wsitem__dot`, `.wsitem__label`, `.wsitem__path`, `.wsitem__close` — dùng token sẵn có (`--chrome-1`, `--hair`, `--tab-active-bg`, `--text-primary`, `--text-muted`, `--text-faint`, `--accent`).
- `.titlebar` ở chế độ sidebar: `display: flex; justify-content: flex-end` để `ChromeActions` nằm phải, giữ `data-tauri-drag-region` hoạt động (nút không có drag region).

**Verify**:

- `npm run tauri dev` → sidebar rộng đúng 200px, không đè lên `.stage`, terminal fit lại đúng khi đổi orientation (không có vùng đen thừa).

---

### Task 12: Control `tabBarPosition` trong Settings panel

**File(s)**:

- [settings-panel.tsx](../../src/ui/settings-panel.tsx)

**Phụ thuộc**: Task 7

**Decision**: Một cặp radio / segmented control hai lựa chọn `Left` và `Top`, đặt cùng nhóm với `showPaneBar` (nhóm chrome).

**Build**:

- Thêm control gọi `updateSettings({ tabBarPosition: value })`.
- Label: `Tab bar position`.

**Verify**:

- `npm run tauri dev` → chọn `Top` trong Settings, layout đổi ngay lập tức, quit rồi mở lại app vẫn giữ `Top`.

---

### Task 13: Dedupe khi mở workspace đã có tab

**File(s)**:

- [app.tsx](../../src/ui/app.tsx)

**Phụ thuộc**: Task 5

**Decision**: Trong `handleOpen`, trước khi gọi `openFromPreset`, tra `findTabByWorkspace(workspace)`. Khác `-1` → `selectTab(index)`, `recordWorkspaceOpen(workspace)`, đóng board, trả `true`, KHÔNG materialize tab mới. Preset người dùng chọn bị bỏ qua trong trường hợp này.

**Build**:

- Thêm nhánh early-return ở đầu `handleOpen`.
- Truyền `workspacePath: workspace` vào `openFromPreset` (mở rộng chữ ký để nhận thêm workspace, đẩy tiếp vào `materialize`).

**Verify**:

- `npm run tauri dev` → mở workspace A, Cmd+T, chọn lại A → số dòng trong sidebar vẫn là 1 và dòng A được focus.

---

### Task 14: Preset editor nguồn `live` kế thừa workspace

**File(s)**:

- [app.tsx](../../src/ui/app.tsx)
- [tab-manager.ts](../../src/terminal/tab-manager.ts)

**Phụ thuộc**: Task 13

**Decision**: Đường `handleEditorCreate` với `request.source === "live"` tạo tab mới kế thừa `workspacePath` của tab đang active. Thêm API `activeWorkspacePath(): string | null` vào `TabManager`.

**Build**:

- Thêm `activeWorkspacePath()` vào interface `TabManager` và object trả về: `tabs[active]?.workspacePath ?? null`.
- Trong `handleEditorCreate` nhánh `live`, truyền workspace đó vào `openFromPreset`.

**Verify**:

- `npm run build` → tsc pass.
- `npm run tauri dev` → từ workspace A, menu New preset → Create → tab mới xuất hiện trong sidebar dưới đúng nhãn A, không phải `Unknown`.

---

### Task 15: Đồng bộ tài liệu domain model

**File(s)**:

- [CONTEXT.md](../../CONTEXT.md)
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)

**Phụ thuộc**: Task 4

**Decision**: Sửa hai câu đang mâu thuẫn với model mới. `CONTEXT.md`: Workspace không còn "not `session.json`" — nó giờ là identity của Tab và có mặt trong `session.json`. `ARCHITECTURE.md`: "session.json = chrome only" đổi thành "chrome + workspacePath; vẫn không lưu process, vẫn không lưu CWD per-pane".

**Build**:

- Sửa mục `Workspace` trong `CONTEXT.md`: bổ sung "1:1 với Tab; persist trong `session.json` dưới field `workspacePath`".
- Sửa dòng session trong `ARCHITECTURE.md` và ghi rõ session restore giờ spawn tại `workspacePath`.

**Verify**:

- `grep -n "not .session.json" CONTEXT.md` → không còn dòng nào.
- `grep -n "chrome only" docs/ARCHITECTURE.md` → không còn dòng nào.

---

### Task 16: Bump version

**File(s)**:

- [package.json](../../package.json)
- [tauri.conf.json](../../src-tauri/tauri.conf.json)
- [Cargo.toml](../../src-tauri/Cargo.toml)

**Phụ thuộc**: Task 15

**Decision**: `0.2.1` → `0.2.2` ở cả ba nơi.

**Build**:

- Sửa field `version` trong từng file.

**Verify**:

- `grep -rn "0.2.2" package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml` → ra đúng 3 dòng.
