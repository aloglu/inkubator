# Inkubator 3.0 — plan and decisions

This folder holds the agreed direction for the 3.0 rework. Read this file first when picking the work back up.

- `prototype.html` — the clickable design prototype (desktop + mobile, light + dark). Open it in a browser. It is a design reference, not app code.
- Live copy: https://claude.ai/artifact/N42FTW27hqRav9Zzihmayp

## Ground rules

- 3.0 is a clean break. No backward compatibility with 2.x data, backups or code paths. The only bridge is a one-time import of the owner's 2.2 data.
- Keep the app lean: one backend, no dead code, no legacy migrations.

## Design decisions (settled)

**Visual language**
- Fonts: Peachi (display) + Inter (body). Icons: Phosphor (already shipped).
- Gold is the single accent. Lines and spacing instead of boxes; borders only on things you click into.
- The ink "swab" (organic blob, base color + sheen rim) represents an ink everywhere.
- Pens without a photo are drawn in their body colors.

**App icon**
- The owner-supplied gold nib with the burgundy band (`docs/v3/icon/nib.png`). Cream tile for desktop/installers; nib without tile in the sidebar; a flat simplified version for 24px and below.

**Desk** (replaces Dashboard)
- Only inked pens, one row each: pen, ink, days since inked (plain info, no meters, no warnings, no flush reminders).
- One-line stats ledger under the title.
- Actions per row: **Re-ink** and **Flush**.
- **Re-ink = switch to a different ink.** It opens a menu: the pen's most recent earlier inks first, then inks not in a pen for a while, then "Choose another ink…" (opens Ink a pen with the pen prefilled). A footer line says the current ink is flushed first.

**Ink line:** shown exactly as entered, "Standard" included. The owner uses "Standard" for a brand's regular range; it is a real value, not a placeholder to hide or clear (decided 2026-10-07).

**Ink a pen**
- Small dialog that reads as a sentence: [pen] → [ink]. Each side is a search field with a few suggestions; never a full list (must scale to 30+ pens/inks).
- Pen suggestions: resting pens, most recently used. Ink suggestions: last inks in this pen, inks not in a pen for a while.
- Context prefills one side ("Ink this pen" on a pen, "Ink a pen" on an ink).
- Date defaults to today; note optional. Button spells out the action ("Ink Safari with Fire & Ice").
- Mobile: full-screen sheet with two rows; tapping a row opens a search screen.

**Pens**
- Cards (no shelf view for pens — tried and rejected). Fixed 16:9 media frame: photo cropped around a stored focus point, or the pen drawing.
- Footer shows the ink it holds or "Resting". Status is only Inked/Resting, derived from whether a fill is open.
- Detail: read-only side sheet; Edit turns the same sheet into the editor. Full photo shown fitted over a blurred copy of itself.
- Editor: crop tool (drag focus, zoom, rotate). Nib size, nib material and filling are free text with one-tap suggestions underneath: values already in the collection (most used first), then common ones (decided 2026-10-07; the owner's data has values like "LH", "3.8", "Converter, Cartridge").

**Inks**
- Shelf is the only view: swabs grouped by color family, with name, brand, and a pen marker when in use. No ink cards.
- Color family is worked out from the base color unless the ink has one chosen ("Shelf group" in the editor, default Automatic). Stored as optional `color_family` (decided 2026-10-07: stored colors can mislead, e.g. two different inks share `#8c5050`).
- Property order (detail view and filters): volume, shimmer, sheen, shading, water resistance, flow, dry time, then the rest.
- Editor: properties as equal-width step scales, split into "On paper" and "In the pen"; base type and paper behaviour as toggle chips.

**Swatches**
- 4:3 photo tiles (same crop approach as pens). Detail shows the full photo.
- Editor has the same layout as the pen/ink editors; linked ink is one field with "Change". No lighting field.

**Lists:** each list has Search, Filter (panel of facets, active filters as removable chips with a result count) and Sort.

**Stats:** color spectrum of all inks, four headline numbers, a 90-day rotation timeline (which ink was in which pen), brand/spend bars in gold only.

**Showcase = the app, signed out (decided 2026-10-07).** There is one app at one address. Visitors who are not signed in see the same screens read-only (Desk, Pens, Inks, Swatches, Stats, Activity as allowed), fed by the public projection (`/api/public`), which the server already strips of private notes, prices unless shown, purchase details and fill notes. Signing in (a "Sign in" link) reveals the editing controls on the same screens and the Settings page; `/admin` links redirect. A new showcase on/off setting: when off, visitors see only the sign-in page and the server refuses `/api/public` and public photos. Hiding controls is tidiness; privacy is enforced by the server.

**Showcase notes:** private by default. Each pen, ink and swatch has a "Show on showcase" switch for its notes, and the showcase settings have a "Show notes" master switch that hides every note when off. Fill notes are never public. Imported 2.x notes start private.

**Settings:** one column with a section index; label + help text on the left, control on the right; switches instead of checkboxes; backups lead with their status.

**Activity:** grouped by day, written as sentences; filters in one row.

**Mobile:** bottom tab bar (Desk, Pens, center "Ink a pen", Inks, More). Swatches, Stats, Activity, Settings live under More. Details open full-screen; editors open as full-screen sheets.

## Data model 3.0 (direction)

- `pens`, `inks`, `swatches`, `fills`, `activity`, `settings`.
- `fills` replaces `currently_inked` and serves as ink history: `{id, pen_id, ink_id, inked_at, emptied_at|null, note}`. Currently inked = fills with no `emptied_at`. Re-ink closes the open fill and opens a new one.
- Retention: the activity retention setting gains "Keep forever". If a limit is set, closed fills older than it are pruned too (respecting the user's choice); open fills are always kept.
- Images: `{path, primary, rotation, focus_x, focus_y, zoom}`.
- Inks: explicit `base` and `sheen` colors; properties as enums.
- Dropped: swatch lighting, `ml`/`cl` legacy fields, legacy swatch fields on inks, implicit defaults such as nib material "Steel".

## Architecture

**3.0 is server-only (decided 2026-10-07).** No desktop app: no known users depend on the desktop builds, and a desktop app costs ongoing work out of proportion to its value (three different system web engines to test, per-platform installers, signing and updates). Inkubator runs as a server and is used in a browser; the browser's "install as app" gives it its own window and icon. Docker is the main way to run it; the same server is also offered as a plain program for people without Docker. The architecture keeps a desktop wrapper possible later without rework, if ever wanted.

- **Frontend:** Svelte + Vite in `web/`, served by the server; one small `fetch` API client.
- **Backend: one, in Rust.**
  - `crates/core` — data store and schema, images, backups, showcase export, ink swatch fetch.
  - `crates/server` — HTTP server (axum): API, auth, public showcase, scheduled backups, serving the web build.
  - The Node server and the 2.x desktop app (`src-tauri/`, `app/`, remaining Node files) are removed as part of the 3.0 cleanup.
- Schema defined once in Rust; TypeScript types generated for the frontend.
- The Docker image is a small single binary plus the web build.

**Requirements for the server release (owner, 2026-10-07):**
- The Docker setup must be rock solid and run on different servers: regular PCs and NAS boxes (amd64) and ARM devices such as a Raspberry Pi or Apple Silicon machines (arm64). Images built for both, tested on both in CI (start, sign in, write, back up, restart, upgrade with existing data), with a health check, clean shutdown, correct file ownership (PUID/PGID), and data that survives container upgrades.
- The plain server program is released for Linux, macOS and Windows.
- Documentation must be excellent and written for people who have never used Docker: what Inkubator and Docker are, installing Docker, starting Inkubator step by step (Docker Compose, plain `docker run`, Unraid, Synology and similar NAS, Raspberry Pi), the plain program without Docker, opening it and installing it as an app, using it from a phone, passwords and safety (keeping it at home vs. exposing it with HTTPS), backups and restoring, updating, moving from 2.x, and troubleshooting.

## Phases

1. **Foundation** — repo restructure (core / server / desktop / web); 3.0 schema in core with tests; `import-v2` command for the owner's 2.2 data; port the Docker-only Node logic to Rust and delete Node; Svelte + Vite scaffold with design tokens and shared components (swab, pen drawing, segmented control, switch, side sheet, dialog, search picker, photo frame); icon set.
2. **Core loop** — Desk, Ink a pen, Re-ink menu, Flush; ink shelf, ink detail, ink editor.
3. **Collection** — pen cards, detail, editor with crop tool; swatches; filters and sort on all lists.
4. **The rest** — Activity, Settings (with retention options), Stats from fills.
5. **Mobile** — tab bar, full-screen details and sheets (same codebase, responsive).
6. **Showcase** — the signed-out view of the same screens (see "Showcase = the app, signed out"): one address with a Sign in link, screens that read from either the collection or the public projection with actions only when signed in, a showcase on/off setting enforced by the server, the existing showcase settings deciding what visitors see; check every screen signed out, including the projection covering every 3.0 field.
7. **Release 3.0** — remove the 2.x code (desktop app, Node leftovers) and its CI; multi-architecture Docker images and plain server programs built and tested in CI; the documentation described above; version 3.0.0.

## Open items

- Whether the showcase keeps every current toggle.

## Progress

- **Phase 1, step 1 — done.** Cargo workspace; `crates/core` with the 3.0 model, validation, storage (`inkubator.json`, atomic writes, lock, revisions), retention, and `import-v2` (binary `inkubator-import-v2 <2.x folder> <new folder>`). Tested on the owner's real 2.2 data in a scratch folder: 32 pens, 43 inks, 43 swatches, 90 photos, 11 fills, 242 activity entries, no adjustments. The real 2.2 data (`~/.local/share/com.aloglu.inkubator`) has not been converted for use yet.
- **Phase 1, step 2 — done.** Core gained `commands` (ink, re-ink, flush, save/delete with activity per settings; `Store::apply`), `photos` (lossy WebP 1200px + 480px thumbnails, safe paths, retiring unused photos), `remote` (https-only downloads pinned to public addresses; inkswatch.com lookup), `backup` (single-zip backups, verified restore with a safety backup first, scheduled backups) and `public` (showcase privacy projection). New `crates/server` (axum) replaces the Node server: session + Basic auth, failed-login lockout, cross-site refusal, `/api/commands`, uploads, backups, public showcase and photo routes, hourly backup check. Node `server/` and server-only `lib/` modules and tests deleted; Dockerfile now builds the Rust server. Smoke-tested against the converted real collection.
- **Phase 1, step 3 — done.** `web/`: Svelte 5 + Vite 8 + TypeScript, plain Svelte with a small history router (admin under `/admin`, showcase at `/`). Design tokens and fonts from the prototype (light/dark, `data-theme` override). Phosphor icons imported individually as SVG. Shared components: Button, Icon, Swab, PenDrawing, Segmented, Switch, TextField, Sheet (side panel), Dialog, SlotButton + SearchPicker (sentence-style pickers; ARIA combobox), PhotoFrame (cover with focus/zoom/rotation, or fit over a blurred copy). `lib/api.ts` (fetch client for every server route), collection store (`run(command)` with revision; reloads on conflict), sign-in page, admin shell (rail on wide screens, tab bar on phones) with placeholder sections, showcase placeholder. TypeScript types are generated from core with ts-rs (`npm run types`; committed). Dev-only component gallery at `/admin/_components` (left out of release builds). Checked: `npm run check` (svelte-check + config), build, screenshots in light/dark/phone against a scratch copy of the converted collection, production build served by the Rust server. Dockerfile gained a Node stage that builds `web/` into `/app/web`.
- **Phase 2, step 1 — done.** Desk (date heading, one-line ledger, a row per inked pen with photo, ink, days since inked, Re-ink menu and Flush), Ink a pen dialog (sentence-style pickers with the planned suggestions; date and optional note; prefilled from context; errors shown in the dialog), notices, popover Menu component, phone tab bar with the centre Ink a pen button, theme setting applied. Pure logic in `web/src/lib` (`suggestions`, `search`, `color`, `format`) has Vitest tests (`npm test` in `web/`). Exercised in a browser against a scratch copy: re-ink from the menu (keyboard), flush, ink through the dialog with a note, past date before the last change refused with a readable message.
- **Phase 2, step 2 — done.** Ink shelf (swabs grouped by color family, in hue order, with a pen marker; search), ink detail (properties in the planned order, notes with their showcase visibility, pens it is in, swatches, earlier pens, bottle photo; delete with a confirmation that names what goes with it, blocked while the ink is in a pen) and ink editor (step scales split into On paper / In the pen, chips for paper and base, base and sheen colors, bottle photos, notes with the showcase switch, discard prompt). Detail and editor are side panels addressed by the URL (`/admin/inks?ink=<id>`, `&edit`, `?new`), and honour "open items in edit mode". New shared pieces: ConfirmDialog (`ui.confirm`), ChipToggles, PhotoList (upload, remove, choose main photo), SearchField, `ids.newId` (works on plain-http LAN addresses, unlike `randomUUID`). Desk ink names link to the ink. The swab shows the sheen color only when the ink's sheen is above None (42 of the owner's 43 inks have a sheen color, 25 have sheen). Color families tuned and tested on the owner's real colors. Exercised in a browser against a scratch copy: search, detail, edit and save, discard prompt, new ink with an uploaded photo, delete with confirmation, Ink a pen from an ink.
- **Phase 2, step 3 — done.** Optional per-ink `color_family` in core (enum `ColorFamily`, logged as "color family" when changed; tested), "Shelf group" select in the ink editor ("Automatic (Blue)" or a family), shelf and search use the chosen family. Checked in a browser: moving Jet Black to Browns and back to Automatic.
- **Phase 3, step 1 — done.** Pens: cards (16:9 photo crop or drawing, brand, model, nib · material · filling, footer with the ink and days or "Resting"; newest first; search), detail (whole photo fitted over a blurred copy with a photo strip, details, notes visibility, inked-with card with Re-ink and Flush or "Ink this pen", earlier inks; delete with confirmation) and editor (crop tool with drag, arrow keys, zoom, rotate and reset, live card preview, photo list that picks which photo to crop, body colors, suggestion fields for nib and filling, purchase date as YYYY-MM or YYYY-MM-DD). Shared: `lib/crop.ts` (crop window geometry, tested), `lib/pen.ts` (suggestions, purchase dates, tested), CropTool, SuggestField, `actions.flushPen`. Checked in a browser against a scratch copy: rotate and crop a portrait photo and see the card change, suggestion chips, bad purchase date message, add a pen without a photo, delete.
- **Phase 3, step 2 — done.** Swatches: 4:3 tiles (photo crop, or the ink's swab on paper), newest first, search, and a nudge listing inks without a swatch; detail (full photo fitted, ink card with "Open ink", paper, nib, date, notes; delete with confirmation); editor (ink as one field with "Change" and a search picker suggesting inks without a swatch, crop tool at 4:3 with a tile preview, paper and nib suggestions from the collection, date, notes and showcase switch). PhotoList gained "From a link" and an optional lookup, used for "Find on inkswatch.com". The ink detail links its swatches and has "Add a swatch" (opens the editor with that ink). Checked in a browser against a scratch copy, including a real inkswatch.com lookup.
- **Phase 3, step 3 — done.** Filters and sort on pens, inks and swatches. ListTools (search, Filter button with a count, sort menu, active filters as removable chips with "Showing X of Y" and Clear all) over a filter panel of facets; any value within a facet, every facet across. Only values present in the collection are offered, and facets that cannot tell items apart are hidden. Comma lists count under each part ("Converter, Cartridge"). Sorts use the showcase's `PenSort`/`InkSort`/`SwatchSort` values (`lib/sorting.ts`, so the showcase can share it); the ink shelf is grouped by color family only when sorted by hue. Filters last while the app is open; sorts are remembered per browser. The Re-ink menu now sits on the shared Popover. Checked in a browser against a scratch copy.
- **Phase 4, step 1 — done.** Activity screen: newest first, grouped by day (Today, Yesterday, then dates), one sentence per entry with the ink's swab or an action icon, links to items that still exist, flushes with the ink and how long it was in, re-inks with the ink flushed first; one row of filters (search, All/Pens/Inks/Swatches, date range); 100 at a time with "Show older"; retention note linking to Settings. Activity changes are now structured in core (`Change { field, values: [before, after] | null }`; values only at the detailed level and never for notes or photos), and the interface words them with its own labels ("Sheen: Medium → High", prices as money, colors as dots). `lib/activity.ts` is tested.
- **Phase 4, step 2 — done.** Settings: one column with a section index (General, Backups, Showcase website, Activity log, Defaults for new items, About); label and help on the left, control on the right; switches; changes save as they are made through a queue so quick changes never collide, text fields on leaving them. Backups lead with their status (last automatic backup, frequency, how many kept, size) with Restore… (confirmation, safety backup first) and Export backup. Shortening "Keep activity for" first says exactly what would be removed ("238 activity entries and 5 finished fills"), computed by `lib/retention.ts` with core's rule. Checked in a browser against a scratch copy, including export then restore of the same file. Restoring the owner's 6.7 MB backup takes about 1 s on a release build (24 s on a debug build, which checks each photo slowly).
- **Phase 4, step 3 — done.** Stats with a period switch (30 days, 90 days, year, all): the ink spectrum (every ink in hue order, marked when in a pen; links to the ink), four figures (pens inked now, average finished fill in the period, inks swatched, tracked spend), the rotation timeline (a lane per pen, a bar per fill in the ink's color, month grid, tooltip with pen, dates and days; repeated models labelled with their nib) and gold bars for pen spend and ink bottles by brand. Every chart has a hover/focus tooltip and a "View as table". Chart gold has its own token (`--chart-mark`, darker in dark mode) checked with the dataviz palette validator against both surfaces. Calculations in `lib/stats.ts`, tested.
- **Phase 5 — done.** Phones (≤600–700px): More page (Swatches, Stats, Activity, Settings, showcase link, Log out, backup status), "‹ More" back links and the More tab lit on those pages; Ink a pen fills the screen with its two fields stacked; filter panels and menus become bottom sheets; pens become a compact list; the ink shelf is three across; swatches two across; sheets keep their footer clear of the home indicator; no horizontal scrolling on any screen (checked at 390px). Installable from the browser: web app manifest (opens at `/admin`), icons generated from the owner's nib on a cream tile (normal, maskable, Apple touch, favicon), theme colors; Chromium reports no installability errors. The sidebar and sign-in page use a 128px nib instead of the 566 KB original.
- **Phase 6 — done.** One app at one address. Core: `ShowcaseSettings.enabled` (off by default for new and imported collections; while off the server refuses `/api/public` and every public photo with `showcase_off`), the public view now says which sections are shown and gives re-inks and flushes the ink that came out (tested). Web: addresses lost the `/admin` prefix (old ones redirect); the collection store loads the owner's collection when signed in or the public view for visitors (`lib/visitor.ts` gives it the same shape), with photos from the matching routes; visitors get the same screens read-only — no editing controls, only the sections the showcase allows (hidden pages redirect to the first allowed one), the showcase title as the page title, rows with nothing in them left out, prices and spend only when shown, charts only when allowed, activity filters only when allowed, unnamed hidden items ("a pen"), recent activity on the Desk, and the showcase's default sorts unless the visitor picks their own; "Sign in" (rail, More, `/sign-in?next=`) returns to the page you were on; with the showcase off visitors see only the sign-in page ("This collection is private"). Settings has the "Public showcase" switch. The separate showcase page is gone. Checked in a browser against a scratch copy: off, on, visitor screens, typed addresses for Settings and editors, hidden sections, phone, signing in and out.
- **Phase 7, step 1 — done.** Removed the 2.x code: the desktop app (`src-tauri/`, `app/`), the Node tooling (`lib/`, `scripts/`, `tests/`, root `package.json` and lockfile), the Arch package recipe, the desktop workflow and its install guide. The workspace is `crates/core` and `crates/server`; `web/` has its own Node version pin.
- **Phase 7, step 2 — done.** One program, `inkubator` (package `inkubator-server`): starts the server (`--data-dir`, `--port`, `--host`, each also an environment variable), `set-password` (asks twice, at least 8 characters, stores an argon2id hash in `password.json` in the data folder, owner-only permissions), `import-v2 <2.x folder>` (replaces the separate importer), `healthcheck` (for Docker; plain HTTP to `/api/health`), `--help`, `--version`. Password from `INKUBATOR_ADMIN_PASSWORD` (wins) or the stored one; without either it refuses to start and says how to set one. Default data folder per system (`~/.local/share/Inkubator`, `~/Library/Application Support/Inkubator`, `%APPDATA%\Inkubator`), separate from 2.x's. The web interface is built into the program (`web/dist` embedded; `INKUBATOR_WEB_DIR` still overrides for development), so the download is one 15 MB file. Stops cleanly on SIGTERM (51 ms), not only Ctrl+C. Basic-auth sign-in for scripts removed (no lockout, and it would run the slow hash on every request). Checked end to end with a release build on a scratch import of the owner's data.
- **Phase 7, step 3 — done.** (Built by the owner on 2026-10-08 on amd64 Linux; `docker/smoke-test.sh` passed: "All checks passed for inkubator:test".) Dockerfile builds the interface, embeds it in the program, and ships only the program and the entrypoint on `debian:bookworm-slim`; built-in `HEALTHCHECK` (`inkubator healthcheck`); OCI labels. The entrypoint passes arguments to the program through the PUID:PGID drop, so `docker compose run --rm inkubator set-password` or `import-v2 /import` write files the server can read. `docker/smoke-test.sh <image>` runs an image through its life (health, interface, sign-in, a change, a photo and thumbnail, a backup, restart keeps data, data owned by 1000:1000, quick stop); with `PREVIOUS_IMAGE` it first creates the data with an older image (upgrade path). Compose example commented for beginners.
- **Phase 7, step 4 — written, not yet run.** `.github/workflows/release.yml` (replaces the 2.x workflow; runs on `v*` tags or by hand, by hand it builds and tests without publishing): checks (versions agree and match the tag, web tests/type check/build, Rust fmt/clippy/tests, generated types up to date); Docker built natively on amd64 and arm64 runners, each smoke-tested, plus an upgrade test from the latest published 3.x image when there is one, then on a tag pushed by digest and joined into one multi-architecture image (`3.0.0`, `3`, `latest`; pre-releases only their own tag); plain programs for Linux x86-64 and arm64 (static musl), macOS arm64 and x86-64, Windows x86-64, each started and health-checked where the runner can run it, packaged with LICENSE and a short README; on a tag, a draft GitHub release with the programs and SHA256SUMS. HTTPS now uses the `ring` crypto backend (`aws-lc` removed) so the musl and Windows builds need only a C compiler; checked with a real inkswatch.com lookup.
- **Phase 7, step 5 — drafted.** New beginner guides in `docs/` (start-here, Docker, Unraid, Synology, Raspberry Pi, without Docker, using Inkubator, remote access, backups, updating, moving from 2.x, troubleshooting, build from source) and a new README; all links checked. Synology and Unraid steps were written without access to those systems and should be tried. Also: the program accepts its command before or after options (tested), and the cross-site check compares only the host, so sign-in works behind HTTPS proxies that do not send X-Forwarded-Proto (tested).
- **CI run 37690113165 (first run, push trigger):** checks and all five programs passed (Linux x86-64/arm64, macOS arm64/x86-64, Windows; those that can run were started and health-checked). Docker built and passed every smoke-test check on both amd64 and arm64, but the jobs failed in the script's cleanup: the runner is not root and could not delete the test data folder (owned by the container's user) from `/tmp`. Fixed by putting the data folder inside a folder the script owns; needs a new run to confirm.
- **3.0.0-rc.1 published and tested (2026-10-08):** tag run 37735402754 passed (checks, Docker amd64/arm64 with smoke tests, all five programs, multi-architecture image `ghcr.io/aloglu/inkubator:3.0.0-rc.1`, draft release). The owner installed it on their real Unraid server following the Unraid guide, exposed it at their own domain, and a friend on another network signed in and added an ink that appeared on the owner's side. No problems found.
- **Release plan (agreed with the owner, 2026-10-08):** version `3.0.0-rc.1`, temporary push trigger removed, merge to `main`, tag `v3.0.0-rc.1` (publishes only `ghcr.io/aloglu/inkubator:3.0.0-rc.1` and a draft release; `latest` untouched). The owner tests on real systems with that image and the downloads. Then delete the rc draft release, the `v3.0.0-rc.1` tag (local and on GitHub) and the `3.0.0-rc.1` image version on GHCR, so the Releases page stays clean; set the version to `3.0.0`, tag `v3.0.0`, owner reviews and publishes the draft.

## Owner's notes from testing 3.0.0-rc.1 (2026-10-08) — before 3.0.0

Fixed in this order unless the owner says otherwise; mark each when done.

1. [x] Favicon looks wide: should be as narrow as the logo (the 64px nib PNG is not square, so browsers stretch it; pad it onto a square canvas).
2. [x] Settings index: clicking a section near the bottom (e.g. Activity log) scrolls there but the index does not highlight it when the window is too short for that section to reach the top.
3. [x] Add Pen / Ink / Swatch panels have no icon in their header (give panel headers their section's icon).
4. [x] After adding a new item, the detail panel should not open; return to the list.
5. [x] "Color name" in the pen editor is unclear (the maker's name for the finish, e.g. "Green Stripe"): renamed "Finish" with an example (the stored field stays `color_name`). Renamed "Colorway" after rc.5 ("Finish" read as the surface treatment).
6. [x] Add-photo area in the editors is too small (bigger, with drag and drop).
7. [x] Date pickers wherever a date is entered: the pen purchase date is a date picker with an "Only the month" checkbox (month pickers do not work in Safari and Firefox); swatch dates and Ink a pen already had pickers.
8. [x] Filling system: several can be chosen; drop the combined "Converter, Cartridge" (choose Converter and Cartridge separately). Done: `Pen.filling_systems` is a list (no empty or repeated entries), the importer splits combined 2.x values on `,` `/` `+`, the editor offers chips (collection values first, then common ones) plus "Other…". Data from 3.0.0-rc.1 (old single field) does not load in the new version; acceptable, since the rc install was a throwaway test.
9. [x] HEIC photos (iPhone exports) are refused: now converted to JPEG in the browser before upload (`lib/heic.ts`): the browser's own decoder first (Safari), else libheif-js (LGPL-3.0, a separate 723 KB gzip file downloaded only when a HEIC photo is chosen). Recognised by type, name or file header. Tested with a real HEIC in Chromium (libheif path): converted and stored in under 2 s.

## Owner's notes from testing 3.0.0-rc.2 (2026-10-08) — before 3.0.0

1. [x] Adding an item still opens its detail panel afterwards (meant to be fixed in rc.2): reproduce for pens, inks, swatches, desktop and phone; find the cause. Resolved: not reproducible; the owner meant that after editing an item (opened from its detail panel), the detail panel is still open. Kept by decision (2026-10-08).
2. [x] Panel headers: small uppercase kicker ("PEN") beside a display-font title ("Edit") looks like two unrelated things. One header style everywhere: icon + one title ("Pen", "New pen", "Edit pen"; same for inks and swatches).
3. [x] Ink editor, Bottle: Volume / Amount / Price first, then Type; Type with its label above like the fields.
4. [x] Ink editor's left column is too busy (base and sheen colors, shelf group, photo): keep only the swab preview and bottle photo there; move colors into a "Color" section of the form (base, sheen with a clear "None", shelf group). Done: colors moved into a Color section, with a typed `#rrggbb` code next to each picker (`ColorInput`).
5. [x] Desk on phones: the inked pen's card is unbalanced (huge "Today", big swab stacked on the left). Compact layout: photo + pen name, then one line with a small swab, ink name and days, then Re-ink / Flush. Check signed in and signed out.
6. [x] Docker image has no icon on Unraid: add the `net.unraid.docker.icon` label (and the WebUI label), and the Icon URL field to the Unraid guide. Done; the icon URL points at `main`, so it shows once 3.0 is merged there.

Result on rc.3: headers, ink editor and phone Desk confirmed fixed.

## Owner's notes from testing 3.0.0-rc.3 (2026-10-08) — before 3.0.0

1. [x] Ink editor, Bottle: Type belongs on one line with its options, like the On paper rows (label left), not label above.
2. [x] Ink editor, Sheen color: adding one through a text link feels off. Improve without changing the Color section's look, or leave it. Done: an empty sheen shows a dashed + circle and "None" in the code box; typing a code or clicking + adds one, × removes it (`ColorInput` with `fallback`).
3. [x] Settings: rewrite descriptions that read oddly (e.g. Backups → Keep: "Older automatic backups are deleted after this many."). Drop the "showcase" wording: the section is now about what signed-out visitors may see, so name and describe it that way (app and docs). Done: the section is now "Visitors" ("Let visitors see the collection", "Name for visitors", "Show to visitors" on notes), every description rewritten, "Defaults for new items" became "Formats and defaults"; docs updated. Internal names (`showcase` settings, API) unchanged.
4. [x] Settings → Default sort: the label with three dropdowns stacked to its right looks wrong; lay it out properly. Done: three labelled cells (Pens, Inks, Swatches) like the toggles above.
5. [x] Pen editor: same treatment as the ink editor, with the left column kept to the preview and photos and the rest in the form. Done: Finish and body colors moved into a Color section; Brand, Model, Body material share the first row.

## Owner's notes from testing 3.0.0-rc.4 (2026-10-08) — before 3.0.0

1. [x] Desk at in-between widths (sidebar shown, narrow content): inked pen cards unbalanced (huge "Today", big swab), and the stats line wraps with stray borders. Done: the Desk's layouts follow its own width (container queries), the middle layout has a small swab and a smaller day count, and the stats become a 2×2 grid before they would wrap.
2. [x] Detail panel header buttons (Delete, Edit) were smaller than Close: all regular size now.
3. [x] Pen editor's left column was confusing (crop tool, slider, card preview, photos all at once). Done (pens and swatches): the preview first with "Adjust photo"; the crop tool opens only on request (from the preview or a photo's pencil button) with Done.
4. [x] Notes had two headings (NOTES and a "Notes" label): the field label is for screen readers only. "Show to visitors" is a label-left row like the rest of the form.

## Owner's notes from testing 3.0.0-rc.5 (2026-10-08) — before 3.0.0

1. [x] Desk cards at medium and phone widths still felt misaligned, and Re-ink / Flush under the ink looked off. Done: the buttons sit beside the pen's name (icons only on phones, words kept for screen readers) and the days beside the ink; on phones the swab sits under the photo so the ink's name lines up with the pen's.
2. [x] Pen editor side panel: the pen's name should not sit below the photo; put the photos under a heading. Done (all three editors): the name moved into the header in Title Case with a muted dot ("Edit · Pilot Custom 742", "Edit · Pilot Yama-guri", "Edit · Pilot Yama-guri Swatch", by the saved name so it does not change while typing; new items "New Pen" etc.); the side panel is the preview, then a Photos heading. Detail panels keep their simple titles (the name is already large in their body).
3. [x] Crop: resize the crop area directly on the photo instead of a zoom slider; consider phones. Decided: the frame keeps the card's shape (cards are a fixed 16:9 / 4:3, so independent width and height would distort or letterbox). Done: corner handles (small, finger-sized touch area; the opposite corner stays put, `resizeFromCorner` in `lib/crop.ts`, tested), pinch, scroll wheel, arrow keys and + / −; the slider is gone; Done sits in the crop tool's button row.
4. [x] Notes: the "Show to visitors" hint beside the switch looked misaligned (smaller text squeezed next to it). Done: the hint is on its own line below, like the other hints in the editors.

## Owner's notes from testing 3.0.0-rc.6 (2026-10-08) — before 3.0.0

1. [x] Desk card: "Today" alone means little to a newcomer, the two buttons sat awkwardly, and the wide layout looked off. After two rounds of mockups (directions A–E, published as a private artifact), the owner chose E, "Ink first": one quiet panel with hairline rows, each led by the ink's swab and name, "in Pilot Kaküno · M · Steel" under it, the days on the right ("22 days" over "in the pen since Sep 16"; "Today" over "inked Oct 8"), and a drop-icon menu with just "Change ink…" (opens Ink a pen with the pen chosen, where the resting-ink suggestions already are) and "Flush". The ink and pen names open their pages (plain text, no link styling; only when that page is open to the viewer). No photos on the Desk. The pen detail panel keeps its Re-ink and Flush buttons.
2. [x] Crop: independent width and height handles were asked for; after discussion the owner chose to leave the crop tool as it is (the card's shape is fixed).
3. [x] Phone tab bar: Desk, Pens, Inks, Swatches, More (Swatches left More; the middle Ink a pen tab is gone). Ink a pen is the button beside the Desk title on every width, and "Ink this pen" on a pen's page.
4. [x] Undo instead of confirming ink changes: inking, re-inking and flushing show a notice with Undo for 8 s (`Command::UndoInkChange { pen_id, at }`, which only takes back the pen's latest ink change and removes its activity entry; tested in `crates/core/tests/commands.rs`). Deleting keeps its confirmation.
5. [x] Settings: confirm each saved change. Done the owner's way: a "Settings saved." notice that replaces the previous one instead of stacking (`ui.notify(..., key)`).

## Follow-ups (do not lose)

- **CI:** `.github/workflows/release.yml` builds, tests and publishes (see phase 7, step 4). The macOS Intel program is cross-built on an Apple Silicon runner and is not started in CI.
- **2.x quirks handled by `import-v2`** (both covered by tests in `crates/core/tests/import_v2.rs`; neither can occur in 3.0):
  - 2.x copied each ink's swatch photo into the ink's own `image` field; the importer skips those duplicates.
  - 2.x kept a pen's first inking date after a re-ink; the importer uses the later of that date and the logged re-ink.
- **Docker image — resolved.** Built and smoke-tested by the owner. The server never runs as root: `docker/entrypoint.sh` gives `/data` to `PUID:PGID` (default `1000:1000`, Unraid `99:100`) and drops privileges with `setpriv`; `PUID=0` is refused; `docker run --user` is honored. Verified: refusal message, root-owned data folder re-owned, all files written by the server owned by the unprivileged user.
- **Orphaned uploads:** a photo uploaded in an editor that is then cancelled stays in `images/` unreferenced. Add a cleanup (e.g. on startup and daily) that retires unreferenced photos older than a day.
- **Zip timestamps:** backup zip entries carry no modification time (shown as 1980-01-01). Set real times (zip crate `time` feature) — cosmetic.
- **Versions:** the crates and `web/package.json` are `3.0.0-alpha.0`; set all three to `3.0.0` at release (the 2.x version-sync scripts are gone).
- **Photo encoding:** photos and thumbnails are lossy WebP (quality 82) via the `webp` crate (builds libwebp from source; needs a C compiler in build environments). The `image` crate alone only writes lossless WebP, which made thumbnails larger than photos.
- **Test setups next to the real install (owner's request, 2026-10-07):** once 3.0 is in daily use, the owner tests changes without touching the main installation. With the server-only decision this is a second container (or plain program) with its own data folder and port, optionally started from a copy of the real data. The documentation should show how.
- **Vite dev proxy:** Vite 8 rewrites `Host` to the target, which tripped the server's same-origin check; `web/vite.config.ts` forwards the original host as `X-Forwarded-Host`. Keep this if the proxy config changes.
- **Portrait pen photos:** all 32 of the owner's pen photos are portrait (pen standing upright), so a 16:9 card shows only the middle of the pen until each is rotated in the crop tool (done for one in testing: one Rotate click makes a full card). Possible later help: suggest rotating when a portrait photo is added to a pen. `import-v2` should not guess orientation silently.
- **Clear old activity:** the prototype's Settings has "Clear old activity" (remove entries older than a chosen date) besides the retention period. Not built; needs a core command.
- **Installing on phones needs HTTPS:** browsers only offer "install as app" on `localhost` or HTTPS. Reached over plain http by a home-network address, Inkubator works fully in the browser but cannot be installed. The documentation should explain this and show the simplest HTTPS setups (phase 7).
- **Range filters:** the prototype's pen price range and swatch date range filters are not built (facets are value lists only). Add if wanted.
- **Ink colors from a swatch photo:** the prototype's swatch editor has "Update from this photo" (set the ink's stored colors from the swatch). Not built yet; worth doing given how rough some stored colors are.
- **Converting the real collection:** run `import-v2` on the owner's data only when the 3.0 app can open it, into a new folder; keep the 2.x folder untouched as a fallback.
