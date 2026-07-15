# Badge theo dõi agent trên workspace avatar + Swap pane

**Spec**: intent chốt qua interview-me (không có file spec riêng)
**Goal**: Thêm 2 tính năng độc lập cho StackGrid — (1) viền avatar workspace phản ánh trạng thái agent (pending spinner / unread vàng / done trống), và (2) đổi chỗ 2 pane bằng `Cmd` + kéo header.
**Architecture**: Track A (swap) mở rộng hạ tầng kéo-header sẵn có: thêm transform thuần `swapLeaves` vào split tree + nhánh "swap mode" trong `pane-drag`. Track B (status) tái dùng `agentBusy` (đã có) cho pending, và thêm một `Set` unread trong `TabManager` bật khi có `pty:output` ở tab không active, tắt khi mở tab. Hai track tách 2 commit riêng để `git revert` từng phần.

## 1. Kết quả mong đợi

- `swapLeaves` đổi chỗ 2 paneId, giữ nguyên cấu trúc split + ratio — verify bằng test `swapLeaves` trong [split-tree.test.ts](../../src/lib/split-tree.test.ts)
- Giữ `Cmd` + kéo header pane thả lên pane khác → 2 pane đổi vị trí, PTY/session đi theo — verify bằng drive app (`/run`) + quan sát gõ vào pane đã swap vẫn đúng session
- `TabView.unread` bật khi tab nền nhận `pty:output`, tắt khi `selectTab` vào nó — verify bằng test unread trong [tab-manager.test.ts](../../src/terminal/tab-manager.test.ts)
- Viền avatar: pending → vòng segment xoay; unread (và không pending) → chấm vàng; done → không gì — verify bằng `/run` + chụp sidebar đối chiếu ảnh tham chiếu
- `npm run build` (tsc + vite) và `npm test` xanh — verify bằng chạy 2 lệnh

## 2. Nguồn dữ liệu chuẩn

**Canonical data**:

- Trạng thái pending = `agentBusy` của tab (đã tính sẵn ở [tab-manager.ts](../../src/terminal/tab-manager.ts) `syncViews`, dòng ~156: bất kỳ pane nào trong tab có foreground process là agent).
- Trạng thái unread = `Set<number>` (keyed by `tab.key`) do `TabManager` sở hữu, cập nhật từ sự kiện `pty:output` (`listenOutput` tại init, dòng ~568) và `selectTab`.
- Vị trí pane trong layout = cây `tree` (immutable) trong [terminal-manager.ts](../../src/terminal/terminal-manager.ts).

**Lấy từ**: `poller.infoFor(id).process` (pending), `pty.listenOutput` + active index (unread), `tree` local của mỗi TerminalManager (swap).

**KHÔNG lấy từ**:

- KHÔNG parse text output để đoán "agent đang chờ input" — poll process không làm được đáng tin, out of scope.
- KHÔNG persist unread (in-memory theo phiên, như busy-dot hiện tại).
- KHÔNG suy ra pending từ output stream (giữ nguyên nguồn duy nhất là poll foreground process).

## 3. Business rules & invariants

- **Ưu tiên hiển thị pending > unread > done**: khi `pending` true luôn hiện spinner, che chấm vàng; chỉ khi `pending` false mà `unread` true mới hiện vàng — verify bằng nhánh render trong [workspace-logo.tsx](../../src/ui/workspace-logo.tsx) và quan sát tab đang chạy chỉ thấy spinner.
- **unread bật ở transition, không mỗi chunk**: chỉ gọi `syncViews()` khi `unread` chuyển false→true cho một tab (đã unread thì bỏ qua) — verify bằng đọc code guard `!unread.has(key)` trong `listenOutput`.
- **unread không tính tab active**: output tới pane của tab đang active KHÔNG bật unread — verify bằng test case "output tới tab active → unread false".
- **unread clear khi mở tab**: `selectTab(i)` xoá `tabs[i].key` khỏi `unread` — verify bằng test "sau selectTab → unread false".
- **swap là no-op an toàn**: `swapLeaves` trả về cây cũ BY REFERENCE khi `idA === idB` hoặc một id không tồn tại (khớp convention `movePane`) — verify bằng test `toBe(tree)`.
- **swap giữ nguyên cấu trúc**: chỉ đổi 2 `paneId`, mọi `dir`/`ratio`/hình dạng cây giữ nguyên — verify bằng test so khớp cây kỳ vọng.
- **derived field không bị override đè**: `applyTabOverride` KHÔNG đụng `unread` (giống `agentBusy`) — verify bằng test "never touches ... agentBusy" mở rộng cho `unread`.

## 4. Phạm vi / Ngoài phạm vi

**Làm**:

- Transform `swapLeaves` + test.
- Nhánh swap trong `pane-drag` (Cmd modifier, overlay full-pane, flip live theo keydown/keyup), wire `onSwap` ở `terminal-manager`, CSS overlay swap.
- Field `unread` trên `TabView`, tracking trong `TabManager`, render pending/unread/done ở `WorkspaceLogo`, component spinner + CSS, badge vàng CSS.
- Bump version + cập nhật README + chạy test/build.

**KHÔNG làm**:

- KHÔNG detect "agent đang dừng hỏi và chờ mình gõ".
- KHÔNG badge trên tab chrome ngang (chỉ trên workspace avatar ở sidebar dọc).
- KHÔNG OS/system notification.
- KHÔNG phím tắt swap riêng; KHÔNG swap giữa 2 window.
- KHÔNG persist unread qua restart.

## 5. Rủi ro & Quyết định còn mở

**Đã chốt có rủi ro**:

- pending detect qua poll 2s — rủi ro: trễ tối đa ~2s khi agent bắt đầu/kết thúc; agent dừng hỏi input vẫn hiển thị như "đang chạy" hoặc "done" tùy foreground process, không phải trạng thái "chờ mình" (user đã chấp nhận).
- unread = bất kỳ `pty:output` nào ở tab không active — rủi ro: một pane nền tự in output không phải agent (vd shell background job) cũng bật vàng (false positive). Chốt đơn giản, không lọc theo agent.
- Spinner ôm avatar 20px rất nhỏ — rủi ro: độ trung thực với ảnh tham chiếu (24 ô comet-trail) bị giới hạn ở kích thước này; sẽ iterate trên screenshot ở Task B4.

**Chưa chốt cần resolve**: (không có — intent đã khoá qua interview-me)

## 6. Các task

### Task A1: `swapLeaves` trong split tree

**File(s)**:

- [split-tree.ts](../../src/lib/split-tree.ts)
- [split-tree.test.ts](../../src/lib/split-tree.test.ts)

**Decision**: Thêm pure function `swapLeaves(node: TreeNode, idA: number, idB: number): TreeNode` đổi chỗ 2 paneId, giữ nguyên `dir`/`ratio`/hình dạng cây. Trả về `node` by-reference khi `idA === idB` hoặc `idA`/`idB` không nằm trong `leafIds(node)`.

**Build**:

- Guard đầu hàm: `if (idA === idB) return node;` và `const ids = leafIds(node); if (!ids.includes(idA) || !ids.includes(idB)) return node;`
- Đệ quy map từng leaf: `paneId === idA ? leaf(idB) : paneId === idB ? leaf(idA) : node`; split node spread `{ ...node, a: rec(a), b: rec(b) }`.
- Đặt cạnh `replaceLeaf` (cùng họ transform id).

**Verify**:

- Thêm `describe("swapLeaves")` với: swap 2 leaf trong `twoRow` → cây kỳ vọng chỉ đổi paneId, `dir`/`ratio` nguyên; swap trong cây 3 pane (`tree` fixture sẵn có) → chỉ 2 leaf mục tiêu đổi; `swapLeaves(twoRow, 1, 1)` → `toBe(twoRow)`; `swapLeaves(twoRow, 1, 99)` → `toBe(twoRow)`.
- `npm test` → file `split-tree.test.ts` pass.

---

### Task A2: Nhánh "swap mode" trong pane-drag

**File(s)**:

- [pane-drag.ts](../../src/terminal/pane-drag.ts)

**Phụ thuộc**: Task A1 (dùng chung khái niệm swap; onSwap callback wire ở A3)

**Decision**: Giữ `Cmd` (metaKey) trong lúc kéo → `mode = "swap"`: overlay phủ TOÀN pane đích (bỏ qua edge), thả → gọi `onSwap(sourceId, targetId)`. Không giữ Cmd → `mode = "dock"` như hiện tại. Cmd bật/tắt giữa chừng cập nhật ngay (không cần di chuột).

**Build**:

- Thêm `onSwap(sourceId: number, targetId: number): void` vào `PaneDragOptions`.
- Thêm biến `let mode: "dock" | "swap" = "dock"` và `let lastX = 0, lastY = 0` (nhớ vị trí con trỏ để re-hit-test khi Cmd đổi).
- Trong `onPointerMove`: set `mode = event.metaKey ? "swap" : "dock"`, lưu `lastX/lastY`, rồi `hitTest`.
- `hitTest(x, y)`: lấy `hit = dropTargetAt(slotRects(), x, y, sourceId)`; nếu `mode === "swap"` → `target = { id: hit.id, edge: "full" }` và gọi `showOverlay(hit.rect, "full")`; nếu `"dock"` → như cũ.
- `showOverlay`: thêm nhánh `edge === "full"` → phủ nguyên `rect` (left/top/width/height = full) và `overlay.classList.toggle("is-swap", true)`; các edge khác `toggle("is-swap", false)`. (Mở rộng type target `edge` cục bộ thành `Edge | "full"`.)
- Đăng ký `window.addEventListener("keydown"/"keyup", onMetaChange)` khi `beginDrag`, gỡ ở `cleanup`; `onMetaChange` cập nhật `mode` theo `event.metaKey` rồi `hitTest(lastX, lastY)`.
- `onPointerUp`: nếu `mode === "swap" && dropTarget` → `opts.onSwap(src, dropTarget.id)`; ngược lại giữ `opts.onMove(src, dropTarget.id, dropTarget.edge)`.

**Verify**:

- `npm run build` (tsc) → 0 lỗi type.
- Drive app (`/run`): tab có ≥2 pane, giữ `Cmd` + kéo header → overlay phủ nguyên pane đích và có class `is-swap` (kiểm bằng devtools/screenshot); nhả Cmd giữa chừng → overlay quay về kiểu dock nửa-cạnh.

---

### Task A3: Wire `onSwap` ở terminal-manager

**File(s)**:

- [terminal-manager.ts](../../src/terminal/terminal-manager.ts)

**Phụ thuộc**: Task A1, Task A2

**Decision**: Thêm handler `onSwap(sourceId, targetId)` cho `createPaneDragController`, gọi `swapLeaves(tree, sourceId, targetId)`; no-op khi kết quả `=== tree`.

**Build**:

- Import `swapLeaves` từ `../lib/split-tree` (cạnh `movePane` dòng 7).
- Trong object opts của `createPaneDragController` (dòng ~384), thêm sau `onMove`:
  `onSwap(sourceId, targetId) { if (!tree) return; const next = swapLeaves(tree, sourceId, targetId); if (next === tree) return; tree = next; render(); setActive(sourceId); life.panes.get(sourceId)?.focus(); callbacks.onLayoutChange(); }`

**Verify**:

- `npm run build` pass.
- Drive app: mở 2 pane, chạy `claude` ở pane trái + shell ở pane phải; `Cmd`+kéo đổi chỗ → pane `claude` chuyển sang vị trí phải, gõ vào nó vẫn đúng session `claude` (PTY theo pane). Layout (tỉ lệ split) không đổi.

---

### Task A4: CSS overlay cho swap

**File(s)**:

- [styles.css](../../src/styles.css)

**Phụ thuộc**: Task A2 (A2 toggle class `is-swap` trên overlay)

**Decision**: `.drop-overlay.is-swap` dùng màu khác biệt để báo "đổi chỗ" thay vì "dock" (dock hiện là accent nửa-cạnh).

**Build**:

- Sau rule `.drop-overlay` (dòng ~1304) thêm:
  `.drop-overlay.is-swap { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 90%, white); background: color-mix(in srgb, var(--accent) 12%, transparent); }`
- Giữ transition sẵn có; overlay swap phủ full rect (do A2 set geometry).

**Verify**:

- Drive app: giữ Cmd kéo → overlay full-pane nét đứt, khác rõ với overlay dock nửa-cạnh nét liền. Đối chiếu mắt.

---

### Task B1: Thêm field `unread` vào TabView

**File(s)**:

- [tabs-store.ts](../../src/terminal/tabs-store.ts)
- [tabs-store.test.ts](../../src/terminal/tabs-store.test.ts)

**Decision**: `TabView` thêm `readonly unread: boolean` (derived, đặt cạnh `agentBusy`, có comment "output mới ở tab lúc không active; tắt khi mở tab"). `applyTabOverride` KHÔNG đụng `unread` (spread `...view` giữ nguyên).

**Build**:

- Thêm dòng `readonly unread: boolean;` sau `agentBusy` (dòng 17) kèm comment.
- Cập nhật fixture test (dòng ~11 `agentBusy: true`) thêm `unread: false`.
- Mở rộng test "never touches workspacePath or agentBusy" thành cũng assert `merged.unread === <giá trị gốc>`.

**Verify**:

- `npm test` → `tabs-store.test.ts` pass (TS ép mọi literal TabView phải có `unread`).

---

### Task B2: Tracking unread trong TabManager

**File(s)**:

- [tab-manager.ts](../../src/terminal/tab-manager.ts)
- [tab-manager.test.ts](../../src/terminal/tab-manager.test.ts)

**Phụ thuộc**: Task B1

**Decision**: `const unread = new Set<number>()` keyed by `tab.key`. Bật khi `pty:output` tới pane của tab KHÁC tab active và chưa unread (transition-only `syncViews`). Tắt ở `selectTab` và `disposeTab`. `syncViews` đọc `unread.has(tab.key)`.

**Build**:

- Khai báo `const unread = new Set<number>();` cạnh `overrides` (dòng ~123).
- Trong `syncViews` (dòng ~150 map), thêm `unread: unread.has(tab.key),` vào object trước `applyTabOverride`.
- Trong `init` → `pty.listenOutput` callback (dòng ~569), sau vòng `for (const tab of tabs) tab.manager.handleOutput(...)`:
  `const owner = tabs.find((t) => t.manager.paneIds().includes(id)); if (owner && owner !== tabs[active] && !unread.has(owner.key)) { unread.add(owner.key); syncViews(); }`
- Trong `selectTab` (dòng ~235), sau khi set `active = index` và trước `syncViews()`: `unread.delete(tabs[index].key);`
- Trong `disposeTab` (sau `overrides.delete(entry.key)` dòng ~427): `unread.delete(entry.key);`

**Verify**:

- Thêm test trong `tab-manager.test.ts`: giả lập output tới pane của một tab nền → `tabViews.value[bgIndex].unread === true`; output tới pane của tab active → tab active `unread === false`; sau `selectTab(bgIndex)` → `unread === false`.
- `npm test` → `tab-manager.test.ts` pass.

---

### Task B3: WorkspaceLogo render pending / unread / done + wiring

**File(s)**:

- [workspace-logo.tsx](../../src/ui/workspace-logo.tsx)
- [workspace-sidebar.tsx](../../src/ui/workspace-sidebar.tsx)

**Phụ thuộc**: Task B1

**Decision**: `WorkspaceLogoProps` đổi `busy` → `pending: boolean`, thêm `unread: boolean`, GỠ `dotColor` (busy-dot cũ là nơi duy nhất WorkspaceLogo dùng `dotColor`; màu người dùng chọn vẫn hiển thị ở tab bar ngang [tab-bar.tsx](../../src/ui/tab-bar.tsx) dòng ~74 và header pane [pane.ts](../../src/terminal/pane.ts) dòng ~189 → không mất tính năng). Render theo ưu tiên: `pending` → span spinner INLINE (Task B4 tạo style, không import component để tránh symbol chưa tồn tại); else `unread` → badge chấm vàng; else → không render gì. Sidebar truyền `pending={tab.agentBusy}` và `unread={tab.unread}`.

**Build**:

- Sửa interface: bỏ `busy`, `dotColor`; thêm `pending: boolean; unread: boolean;`. Gỡ import `tabDotCssColor`/`TabDotColor` nếu không còn dùng ở đâu khác trong file (letter-avatar vẫn dùng `tabDotCssColor(avatar.color)` — GIỮ import đó).
- Thay khối `{busy ? (...badge...) : null}` bằng:
  `pending ? <span class="wsitem__spinner" aria-hidden="true" /> : unread ? <span class="wsitem__logo-badge wsitem__logo-badge--unread" /> : null`
- Sidebar (dòng ~180): đổi `busy={tab.agentBusy}` → `pending={tab.agentBusy}`, thêm `unread={tab.unread}`, XOÁ dòng `dotColor={tab.dotColor}` (dòng 184). Popover vẫn nhận `dotColor` riêng ở dòng 227 — KHÔNG đụng.

**Verify**:

- `npm run build` pass (mọi call site `WorkspaceLogo` khớp props mới, không còn tham chiếu `busy`/`dotColor` trên WorkspaceLogo).

---

### Task B4: Spinner "comet-trail" quanh avatar (frontend-design-bar)

**File(s)**:

- [styles.css](../../src/styles.css)
- [workspace-spinner.tsx](../../src/ui/workspace-spinner.tsx) (chỉ tạo khi phải chuyển sang SVG)

**Phụ thuộc**: Task B3 (B3 đã render sẵn span `.wsitem__spinner`; task này style nó)

**Decision**: Style `.wsitem__spinner` (span do B3 render ở nhánh pending) thành vòng segment "comet-trail" khớp ảnh tham chiếu (khoảng 24 ô vuông quanh vòng tròn, sáng nhất ở đầu rồi mờ dần thành đuôi, glow nhẹ), xoay tuyến tính lặp vô hạn, ôm quanh avatar 20px như một viền. Tôn trọng `prefers-reduced-motion`. Chỉ tách ra `workspace-spinner.tsx` khi buộc phải dùng SVG (B3 khi đó đổi span thành `<WorkspaceSpinner/>`).

**Build**:

- CSS `.wsitem__spinner`: `position: absolute; inset: -3px; border-radius: 50%; pointer-events: none;` phủ quanh `.wsitem__logo`.
- Dựng vòng segment: `repeating-conic-gradient` (hard stops tạo các ô) làm lớp hình + `conic-gradient` alpha-ramp (sáng→trong) làm lớp "comet" + `mask` hình vành khuyên (radial-gradient) để chỉ chừa viền; `animation: wsspin 1s linear infinite;` `@keyframes wsspin { to { transform: rotate(360deg); } }`. Nếu độ trung thực không đạt → tạo `workspace-spinner.tsx` với SVG 24 `<rect>` opacity-ramp trong `<g>` xoay và đổi span ở B3 thành component đó.
- `@media (prefers-reduced-motion: reduce) { .wsitem__spinner { animation: none; opacity: .6; } }`.
- Đặt `.wsitem__spinner` sau khối `.wsitem__logo-badge` (dòng ~185).

**Verify**:

- Drive app (`/run`): mở workspace chạy `claude`; chụp sidebar → vòng segment xoay quanh avatar, sáng dồn ở đầu vệt, mờ dần đuôi, khớp ảnh tham chiếu. Đối chiếu mắt qua frontend-design-bar (build pass ≠ xong).
- Bật `prefers-reduced-motion` → không xoay.

---

### Task B5: CSS badge vàng cho unread

**File(s)**:

- [styles.css](../../src/styles.css)

**Phụ thuộc**: Task B3

**Decision**: Định nghĩa token màu vàng `--status-unread` và biến thể `.wsitem__logo-badge--unread` (kế thừa badge sẵn có: chấm 10px, viền cắt 2px theo màu nền hàng).

**Build**:

- Thêm `--status-unread` vào bảng biến màu (cùng chỗ khai báo `--accent`); giá trị vàng phù hợp cả light/dark (vd `#e2b341` / điều chỉnh khi đối chiếu).
- Thêm rule `.wsitem__logo-badge--unread { background: var(--status-unread); }` (badge cơ bản đã có viền cắt ở dòng 173–185; giữ nguyên cơ chế `border-color` theo `.is-active`).

**Verify**:

- Drive app: một tab nền có agent vừa chạy xong + có output mới → chấm vàng hiện ở avatar; `Cmd`/click mở tab đó → chấm vàng biến mất (unread clear). Đối chiếu mắt.

---

### Task B6: Bump version + README + test/build xanh

**File(s)**:

- [package.json](../../package.json)
- [tauri.conf.json](../../src-tauri/tauri.conf.json)
- [Cargo.toml](../../src-tauri/Cargo.toml)
- [README.md](../../README.md)

**Phụ thuộc**: Task A1–A4, Task B1–B5

**Decision**: Bump `0.5.2` → `0.6.0` (tính năng mới) ở cả 3 file; cập nhật README thêm mô tả swap pane (`Cmd`+kéo) và badge trạng thái agent (spinner/vàng/trống) + phím tắt/thao tác liên quan.

**Build**:

- Sửa `version` ở [package.json](../../package.json), [tauri.conf.json](../../src-tauri/tauri.conf.json) (dòng 4), [Cargo.toml](../../src-tauri/Cargo.toml) (dòng 3) → `0.6.0`.
- README: thêm mục 2 tính năng mới, sửa nội dung lỗi thời nếu có (mục pane/workspace).

**Verify**:

- `npm test` → toàn bộ suite pass.
- `npm run build` → tsc + vite build thành công.
- `grep -R "0.6.0" package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml` → cả 3 khớp.
