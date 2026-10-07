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
- Editor: crop tool (drag focus, zoom, rotate). Nib/material/filling option lists still need design work.

**Inks**
- Shelf is the only view: swabs grouped by color family, with name, brand, and a pen marker when in use. No ink cards.
- Property order (detail view and filters): volume, shimmer, sheen, shading, water resistance, flow, dry time, then the rest.
- Editor: properties as equal-width step scales, split into "On paper" and "In the pen"; base type and paper behaviour as toggle chips.

**Swatches**
- 4:3 photo tiles (same crop approach as pens). Detail shows the full photo.
- Editor has the same layout as the pen/ink editors; linked ink is one field with "Change". No lighting field.

**Lists:** each list has Search, Filter (panel of facets, active filters as removable chips with a result count) and Sort.

**Stats:** color spectrum of all inks, four headline numbers, a 90-day rotation timeline (which ink was in which pen), brand/spend bars in gold only.

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

- **Frontend:** rewrite in Svelte + Vite. One small API client with two transports (Tauri `invoke` on desktop, `fetch` in Docker).
- **Backend: one, in Rust.**
  - `crates/core` — data store and schema, images, backups, showcase export, ink swatch fetch.
  - `src-tauri` — thin desktop shell (native dialogs, window) over core.
  - `crates/server` — small HTTP server (axum) for Docker: API, auth, public showcase, scheduled backups, serving the Svelte build.
  - The Node server (`server/`, `lib/`) is ported and then deleted.
- Schema defined once in Rust; TypeScript types generated for the frontend.
- Docker image becomes a small single binary instead of a Node runtime.

## Phases

1. **Foundation** — repo restructure (core / server / desktop / web); 3.0 schema in core with tests; `import-v2` command for the owner's 2.2 data; port the Docker-only Node logic to Rust and delete Node; Svelte + Vite scaffold with design tokens and shared components (swab, pen drawing, segmented control, switch, side sheet, dialog, search picker, photo frame); icon set.
2. **Core loop** — Desk, Ink a pen, Re-ink menu, Flush; ink shelf, ink detail, ink editor.
3. **Collection** — pen cards, detail, editor with crop tool; swatches; filters and sort on all lists.
4. **The rest** — Activity, Settings (with retention options), Stats from fills.
5. **Mobile** — tab bar, full-screen details and sheets (same codebase, responsive).
6. **Showcase** — read-only version of the same screens; privacy projection for new fields.
7. **Release 3.0.**

## Open items

- Nib size/material and filling system option lists (pen editor).
- Whether the showcase keeps every current toggle.

## Progress

- **Phase 1, step 1 — done.** Cargo workspace; `crates/core` with the 3.0 model, validation, storage (`inkubator.json`, atomic writes, lock, revisions), retention, and `import-v2` (binary `inkubator-import-v2 <2.x folder> <new folder>`). Tested on the owner's real 2.2 data in a scratch folder: 32 pens, 43 inks, 43 swatches, 90 photos, 11 fills, 242 activity entries, no adjustments. The real 2.2 data (`~/.local/share/com.aloglu.inkubator`) has not been converted for use yet.
- **Phase 1, step 2 — done.** Core gained `commands` (ink, re-ink, flush, save/delete with activity per settings; `Store::apply`), `photos` (lossy WebP 1200px + 480px thumbnails, safe paths, retiring unused photos), `remote` (https-only downloads pinned to public addresses; inkswatch.com lookup), `backup` (single-zip backups, verified restore with a safety backup first, scheduled backups) and `public` (showcase privacy projection). New `crates/server` (axum) replaces the Node server: session + Basic auth, failed-login lockout, cross-site refusal, `/api/commands`, uploads, backups, public showcase and photo routes, hourly backup check. Node `server/` and server-only `lib/` modules and tests deleted; Dockerfile now builds the Rust server. Smoke-tested against the converted real collection.
- **Next:** the Svelte + Vite frontend scaffold (design tokens, shared components) talking to the server; then the desktop shell (`src-tauri`) switched to the core with the same API.

## Follow-ups (do not lose)

- **CI paths:** the workspace moved Rust build output from `src-tauri/target` to `target/`. Update `.github/workflows/build-desktop.yml` (bundle paths, `--manifest-path`), `.dockerignore` and `package.json` scripts when the release builds are reworked.
- **2.x quirks handled by `import-v2`** (both covered by tests in `crates/core/tests/import_v2.rs`; neither can occur in 3.0):
  - 2.x copied each ink's swatch photo into the ink's own `image` field; the importer skips those duplicates.
  - 2.x kept a pen's first inking date after a re-ink; the importer uses the later of that date and the logged re-ink.
- **Docker image — resolved.** Built and smoke-tested by the owner. The server never runs as root: `docker/entrypoint.sh` gives `/data` to `PUID:PGID` (default `1000:1000`, Unraid `99:100`) and drops privileges with `setpriv`; `PUID=0` is refused; `docker run --user` is honored. Verified: refusal message, root-owned data folder re-owned, all files written by the server owned by the unprivileged user.
- **Orphaned uploads:** a photo uploaded in an editor that is then cancelled stays in `images/` unreferenced. Add a cleanup (e.g. on startup and daily) that retires unreferenced photos older than a day.
- **Zip timestamps:** backup zip entries carry no modification time (shown as 1980-01-01). Set real times (zip crate `time` feature) — cosmetic.
- **Versions:** the new crates are `3.0.0-alpha.0` while `package.json`/`src-tauri` stay `2.2.0`; align everything to `3.0.0` at release (`scripts/sync-version.mjs`).
- **Photo encoding:** photos and thumbnails are lossy WebP (quality 82) via the `webp` crate (builds libwebp from source; needs a C compiler in build environments). The `image` crate alone only writes lossless WebP, which made thumbnails larger than photos.
- **Converting the real collection:** run `import-v2` on the owner's data only when the 3.0 app can open it, into a new folder; keep the 2.x folder untouched as a fallback.
