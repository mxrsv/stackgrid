# Plan ship landing Stackgrid chính thức

**Nguồn duyệt UI**: [sections-demo.html](../../marketing/landing-prototype/sections-demo.html)
**Goal**: Đưa hai section đã duyệt và footer vào landing chính thức tại route `/`, build/deploy bằng Vercel, đồng thời giữ nguyên tuyệt đối hero hiện tại và lifecycle đang chạy.
**Architecture**: Phần dưới hero được tách thành module markup/lifecycle và stylesheet riêng; [main.js](../../marketing/landing-prototype/src/main.js) chỉ làm nhiệm vụ ghép hero hiện tại với module section mới. Hero renderer, stage, aurora, dialog và CSS hero là vùng bảo vệ, không refactor, không đổi selector, không đổi hành vi.

## 1. Kết quả mong đợi

- Route `/` render hero hiện tại nguyên trạng, sau đó là workflow, terminal manifest và footer đã duyệt — verify bằng screenshot desktop `1440×900` và mobile `390×844`.
- Route `/` vẫn render đúng hero, stage stream, aurora, CTA, modal và locale toggle như trước — verify bằng checklist regression hero. Route `/landing-prototype/` bị gỡ khỏi build: nó dùng chung `main.js`/`base.css` với `/` nên chỉ là bản trùng lặp bị deploy công khai.
- EN/VI hoạt động cho toàn bộ section mới mà không rebuild aurora hoặc stage — verify bằng đổi locale liên tiếp 3 lần và quan sát animation chỉ chạy một luồng.
- Video inline chỉ phát khi vào viewport, có Play/Pause, dừng khi rời viewport và đứng yên với `prefers-reduced-motion: reduce` — verify bằng browser test.
- Production build tạo static artifact tại `marketing/dist` và Vercel phục vụ route `/` không lỗi asset — verify bằng `npm run landing:build` và `npm run landing:preview`.
- Không còn claim sai `45-sec`, typo `Macos`, hoặc CTA GitHub dư trong action row — verify bằng static scan.

## 2. Nguồn dữ liệu chuẩn

**Canonical data**: Hero và hành vi hiện tại lấy nguyên trạng từ renderer/lifecycle đang chạy; nội dung section mới lấy từ bản demo đã duyệt; claim sản phẩm lấy từ README và ADR hiện hành.

**Lấy từ**:

- Hero markup + mount: [a.js](../../marketing/landing-prototype/src/directions/a.js)
- Hero style: [direction-a.css](../../marketing/landing-prototype/styles/direction-a.css)
- Stage + demo dialog: [product-stage.js](../../marketing/landing-prototype/src/product-stage.js)
- Aurora: [aurora.js](../../marketing/landing-prototype/src/aurora.js) và [aurora.css](../../marketing/landing-prototype/styles/aurora.css)
- UI section đã duyệt: [sections-demo.html](../../marketing/landing-prototype/sections-demo.html)
- Product claims: [README.md](../../README.md), [REQUIREMENTS.md](../REQUIREMENTS.md), [0008-local-by-default-no-telemetry.md](../decisions/0008-local-by-default-no-telemetry.md), [0009-mit-open-source.md](../decisions/0009-mit-open-source.md)

**KHÔNG lấy từ**:

- Static hero stand-in, demo chip, “Live hero” link và footer review-only trong [sections-demo.html](../../marketing/landing-prototype/sections-demo.html).
- Nội dung version chưa được publish; CTA không được khẳng định đang tải v0.6.1 khi GitHub Releases chưa có bản tương ứng.

## 3. Business rules & invariants

- **Hero là vùng bảo vệ**: không chỉnh [a.js](../../marketing/landing-prototype/src/directions/a.js), [direction-a.css](../../marketing/landing-prototype/styles/direction-a.css), [product-stage.js](../../marketing/landing-prototype/src/product-stage.js), [aurora.js](../../marketing/landing-prototype/src/aurora.js), [aurora.css](../../marketing/landing-prototype/styles/aurora.css) — các file đang có thể chứa thay đổi hợp lệ từ trước, vì vậy verify bằng cách so diff sau implementation với baseline diff chụp ở Task 1.
- **Hero behavior bất biến**: Download vẫn dẫn Releases; Watch vẫn mở dialog; GitHub vẫn ở header; stage stream và locale toggle không đổi — verify bằng browser regression checklist.
- **Additive integration**: section mới có prefix `.a-section-*` và lifecycle riêng; không dùng selector chung `.workflow`, `.proof`, `.footer` trong production — verify bằng static scan stylesheet.
- **Locale không remount hero**: đổi EN/VI chỉ update `[data-section-copy]`; không gọi lại `renderDirectionA` hoặc `mountAurora` — verify bằng test locale và quan sát canvas không flash.
- **Motion có kiểm soát**: reveal chỉ chạy một lần, video chỉ play trong viewport, reduced motion luôn render trạng thái cuối — verify bằng browser emulation.
- **CTA trung thực**: dùng `Download for macOS`, `Watch the 16-sec demo`; unsigned preview note xuất hiện gần CTA cuối — verify bằng test copy EN/VI.
- **Không kéo GIF/master vào page**: landing chỉ dùng `.webm`, `.mp4` và poster — verify bằng network request list.

## 4. Phạm vi / Ngoài phạm vi

**Làm**:

- Productionize workflow, terminal manifest và footer từ bản demo.
- Thêm copy EN/VI riêng cho các section.
- Thêm lifecycle cho reveal, video viewport và Play/Pause.
- Thêm production entry route `/`, static build scripts và Vercel config.
- Thêm favicon, description, Open Graph cơ bản và kiểm tra accessibility/performance.
- Giữ route prototype hiện tại để regression review cho tới khi landing production được duyệt.

**KHÔNG làm**:

- Không chỉnh layout, copy, CTA, animation, stage hoặc responsive behavior của hero.
- Không refactor module hero để “dùng chung đẹp hơn”.
- Không đổi app source trong `src/` hoặc Tauri build.
- Không publish release mới hoặc giải quyết Apple signing trong plan landing này.
- Không thêm analytics, account, telemetry hoặc dependency motion mới.
- Không xoá [sections-demo.html](../../marketing/landing-prototype/sections-demo.html) trước khi production route qua eye-review cuối.

## 5. Rủi ro & quyết định đã chốt

**Đã chốt có rủi ro**:

- Hero modal và video inline dùng cùng asset — chấp nhận để bảo toàn hero; video inline dùng `preload="metadata"` và chỉ play trong viewport để giảm tải.
- CTA Releases hiện có thể dẫn tới version cũ hơn code trong repo — landing không hiển thị số version; release alignment là ship gate riêng.
- App chưa ký Apple Developer ID — footer phải hiển thị unsigned preview note thay vì che giấu friction.
- Route `/` dùng cùng renderer hero với prototype — mọi integration phải additive và có regression gate trên các file hero.

## 6. Các task

### Task 1: Đóng băng baseline hero

**File(s)**:

- [a.js](../../marketing/landing-prototype/src/directions/a.js)
- [direction-a.css](../../marketing/landing-prototype/styles/direction-a.css)
- [product-stage.js](../../marketing/landing-prototype/src/product-stage.js)
- [aurora.js](../../marketing/landing-prototype/src/aurora.js)
- [aurora.css](../../marketing/landing-prototype/styles/aurora.css)

**Decision**: Ghi baseline screenshot và diff guard trước khi tích hợp section.

**Build**:

- Chụp hero EN/VI ở desktop `1440×900` và mobile `390×844`.
- Lưu diff hiện tại của năm file vùng bảo vệ vào `/tmp/stackgrid-hero-baseline.diff` trước khi implementation; baseline này bao gồm các thay đổi hợp lệ đang có trong working tree.
- Lập checklist Download, Watch dialog, GitHub header, locale toggle, aurora và stage stream.

**Verify**:

- `git diff -- marketing/landing-prototype/src/directions/a.js marketing/landing-prototype/styles/direction-a.css marketing/landing-prototype/src/product-stage.js marketing/landing-prototype/src/aurora.js marketing/landing-prototype/styles/aurora.css | cmp - /tmp/stackgrid-hero-baseline.diff` → exit `0`.

---

### Task 2: Tách copy EN/VI cho section

**File(s)**:

- [sections-copy.js](../../marketing/landing-prototype/src/sections-copy.js)
- [landing-sections.test.js](../../marketing/landing-prototype/src/landing-sections.test.js)

**Decision**: Copy section nằm riêng, không thêm key vào hero [copy.js](../../marketing/landing-prototype/src/copy.js).

**Build**:

- Khai báo flat keys cho workflow, ba bước, terminal manifest, footer, metadata và unsigned note.
- Dùng `macOS` đúng brand casing và `16-sec` đúng duration asset.
- Viết test bảo đảm EN/VI có cùng key set và không còn `45-sec`/`Macos`.

**Verify**:

- `npx vitest run marketing/landing-prototype/src/landing-sections.test.js` → toàn bộ test pass.

---

### Task 3: Tạo module markup section production

**File(s)**:

- [landing-sections.js](../../marketing/landing-prototype/src/landing-sections.js)
- [sections-copy.js](../../marketing/landing-prototype/src/sections-copy.js)

**Phụ thuộc**: Task 2

**Decision**: Render workflow, manifest và footer dưới một root riêng; không copy static hero từ demo.

**Build**:

- Export `renderLandingSections(copy)` với semantic `<section>`, `<article>`, `<footer>`, heading hierarchy và landmark đúng.
- Dùng `[data-section-copy]` cho mọi chuỗi đổi theo locale.
- Giữ terminal manifest thay cho grid 2×2; giữ hai CTA cuối, GitHub chỉ ở utility navigation.
- Gắn accessible name cho video và Play/Pause control.

**Verify**:

- Test `renderLandingSections` chứa đúng một workflow, một manifest bốn row và một footer.
- Static scan không có `demo-chip`, `hero-stage`, `sections demo for layout review`.

---

### Task 4: Port treatment vào stylesheet cô lập

**File(s)**:

- [landing-sections.css](../../marketing/landing-prototype/styles/landing-sections.css)
- [sections-demo.html](../../marketing/landing-prototype/sections-demo.html)

**Phụ thuộc**: Task 3

**Decision**: Reuse token `--a-*` nhưng mọi selector production dùng prefix `.a-section-*`.

**Build**:

- Port workflow attention rail, video frame/corner ticks, terminal manifest, footer và transition đã duyệt.
- Thiết kế riêng desktop/mobile; manifest row compact ở `390px`, không biến thành card stack mặc định.
- Thêm `:focus-visible`, contrast state và reduced-motion override.
- Không di chuyển hoặc sửa rule hero trong [direction-a.css](../../marketing/landing-prototype/styles/direction-a.css).

**Verify**:

- Browser measurement tại `390×844` → `scrollWidth <= innerWidth`.
- Static scan production CSS không có selector unprefixed `.workflow`, `.proof`, `.footer`.

---

### Task 5: Tạo lifecycle độc lập cho section

**File(s)**:

- [landing-sections.js](../../marketing/landing-prototype/src/landing-sections.js)
- [landing-sections.test.js](../../marketing/landing-prototype/src/landing-sections.test.js)

**Phụ thuộc**: Task 3

**Decision**: `mountLandingSections(root)` trả dispose function; không chạm timer hoặc listener của hero.

**Build**:

- Thêm IntersectionObserver reveal-once.
- Video play khi đủ 45% trong viewport, pause khi rời viewport, custom Play/Pause cập nhật `aria-pressed`.
- Với reduced motion: không autoplay, reveal hiển thị ngay; người dùng vẫn có thể chủ động Play.
- Export `updateLandingSectionsLocale(root, copy)` chỉ update text section.

**Verify**:

- Browser test: click hero Watch vẫn mở modal hiện tại.
- Browser test: scroll đến inline video → play; click Pause → paused; rời viewport → paused.
- Browser emulation reduced motion → video paused, reveal opacity `1`, scroll behavior `auto`.

---

### Task 6: Ghép section vào bootstrap mà không đổi hero

**File(s)**:

- [main.js](../../marketing/landing-prototype/src/main.js)
- [landing-sections.js](../../marketing/landing-prototype/src/landing-sections.js)
- [landing-sections.css](../../marketing/landing-prototype/styles/landing-sections.css)

**Phụ thuộc**: Task 4, Task 5

**Decision**: [main.js](../../marketing/landing-prototype/src/main.js) mount hero trước, section sau; dispose và locale update chạy hai nhánh độc lập.

**Build**:

- Import stylesheet/module section.
- Append section markup sau `page.markup`, không sửa markup trả về từ `renderDirectionA`.
- Mount/dispose section lifecycle cùng lifecycle hiện có.
- Khi đổi locale, gọi cả `updateDirectionALocale` và `updateLandingSectionsLocale`; không render lại trang.

**Verify**:

- Đổi EN↔VI ba lần: hero không flash, aurora canvas giữ nguyên node, stage stream không duplicate.
- Năm file hero vùng bảo vệ vẫn không có diff.

---

### Task 7: Chuẩn hóa web assets cho production build

**File(s)**:

- [marketing/public](../../marketing/public)
- [marketing/README.md](../../marketing/README.md)

**Phụ thuộc**: Task 6

**Decision**: URL asset hiện tại được giữ nguyên; file dùng trên web được phục vụ qua Vite `public/`.

**Build**:

- Đưa icon cần cho URL `/landing-prototype/assets/*` vào cấu trúc tương ứng trong `marketing/public/`.
- Đưa `.webm`, `.mp4` và poster dùng trên landing vào `marketing/public/`; không đưa GIF hoặc master video vào bundle.
- Cập nhật marketing asset documentation để phân biệt web asset và README/master asset.

**Verify**:

- Network request ở production preview cho icon, poster, webm/mp4 → `200` hoặc `206`, không `404`.
- `marketing/dist` không chứa GIF 2.7MB hoặc master 1080p60.

---

### Task 8: Tạo production entry tại route root

**File(s)**:

- [marketing/index.html](../../marketing/index.html)

**Phụ thuộc**: Task 7

**Decision**: Route `/` là entry production; route `/landing-prototype/` tiếp tục tồn tại làm regression surface.

**Build**:

- Tạo shell root dùng cùng `#specimen-root`, `#demo-root` và bootstrap module hiện tại.
- Thêm favicon thật, title, description, Open Graph/Twitter metadata dùng poster hiện có.
- Gỡ `marketing/landing-prototype/index.html`: sau khi `/` dùng chung `main.js` và `base.css`, route prototype chỉ là bản trùng lặp được deploy công khai. Regression surface của hero giờ chính là `/`.

**Verify**:

- Dev server mở `/` và `/?lang=vi` đều render.
- Accessibility snapshot có một `h1`, section heading đúng cấp, footer landmark và video control có accessible name.

---

### Task 9: Thêm build scripts và Vercel config

**File(s)**:

- [package.json](../../package.json)
- [vercel.json](../../vercel.json)

**Phụ thuộc**: Task 8

**Decision**: Vercel build riêng marketing root; không thay app/Tauri build hiện tại.

**Build**:

- Thêm `landing:dev`, `landing:build`, `landing:preview`; giữ `dev`, `build`, `tauri`. Gỡ `prototype:landing` — đã trùng chức năng với `landing:dev` và trỏ tới route vừa xoá.
- Cấu hình Vercel chạy landing build và publish `marketing/dist`.
- Không thêm rewrite làm ảnh hưởng asset.

**Verify**:

- `npm run landing:build` → exit `0`, output tại `marketing/dist`.
- `npm run landing:preview` → `/` trả `200`, prototype route và asset trả đúng status.

---

### Task 10: Regression, performance và eye-review cuối

**File(s)**:

- [sections-demo.html](../../marketing/landing-prototype/sections-demo.html)
- [2026-07-17-ship-official-landing.md](2026-07-17-ship-official-landing.md)

**Phụ thuộc**: Task 9

**Decision**: Chỉ promote production route sau khi user duyệt bằng mắt ở desktop/mobile; demo chưa xoá trong cùng bước.

**Build**:

- Chụp full-page desktop `1440×900` và mobile `390×844`.
- So hero production với baseline Task 1; mọi khác biệt hero là blocker.
- Kiểm tra keyboard focus, video Play/Pause, reduced motion, EN/VI, CTA Releases, unsigned note.
- Đo request list: không tải video inline trước khi cần quá mức; không tải GIF/master.

**Verify**:

- `npm test` → pass.
- `npm run landing:build` → pass.
- Browser console → `0` error, `0` warning từ landing code.
- Desktop/mobile → không horizontal overflow.
- Hero regression checklist → không thay đổi.
- User eye-review chấp thuận production route trước khi xoá hoặc archive demo.
