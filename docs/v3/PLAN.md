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
- The owner-supplied gold nib with the burgundy band (`docs/v3/icon/` once added). Cream tile for desktop/installers; nib without tile in the sidebar; a flat simplified version for 24px and below.

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
