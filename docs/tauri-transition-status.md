# Tauri Transition Status

## Implemented

- Added a Tauri v2 Rust project under `src-tauri`.
- Moved bundled web assets into `app/` and configured Tauri to use them through `frontendDist`.
- Added `app/tauri-api.js`, a Tauri bridge that exposes the manager-app API through `window.inkubatorAPI`.
- Removed renderer dependence on Electron naming; the app now uses framework-neutral manager-app checks.
- Ported the main desktop service surface to Rust commands:
  - data and preference persistence
  - managed image save/delete/dispose flows
  - manual and automatic backup basics
  - ZIP backup import/export, including overwrite/skip/merge conflict behavior and pre-2.0 folder backup compatibility
  - showcase export
  - release status checks
  - InkSwatch lookup and remote image import
  - native file and confirmation dialogs
  - external URL opening
- Added self-contained local HEIC/HEIF upload support through the vendored `libheif-js` WASM decoder. Local HEIC/HEIF pen, ink, and swatch uploads are converted in the renderer before entering the existing managed WebP image pipeline.
- Removed local ML pen color detection from the Tauri target. The command returns an explicit unavailable response and the renderer falls back to browser-side color extraction.
- Updated desktop packaging for Tauri:
  - GitHub Actions builds Windows x64/arm64 NSIS installers, macOS x64/arm64 DMG/ZIP artifacts, and Linux x64 DEB/RPM packages.
  - GitHub Actions builds and publishes the Docker admin image to GitHub Container Registry on version tags.
  - Release version sync now updates Node, Rust, Cargo lockfile, Tauri config, and Arch PKGBUILD versions together.
  - Generated full Tauri desktop icon assets from the new Inkubator logo.
  - Added an Arch PKGBUILD template under `packaging/arch`.
  - Added release preflight documentation in `docs/release-checklist.md`.
- Improved app startup behavior:
  - Manager app launches on Dashboard.
  - Static showcase refresh preserves the current section without a Dashboard/sidebar flash.
  - Theme boot applies the saved/system color mode before the app shell is shown.
- Added Docker admin mode:
  - Serves the public read-only showcase at `/`.
  - Serves the manager UI from Node.js at `/admin/` with a built-in login screen and session cookie.
  - Persists data, preferences, images, backups, and exports under a mounted `/data` directory.
  - Preserves the no-database model.
  - Supports local image uploads, local and remote HEIC/HEIF conversion through the existing browser decoder, ZIP backup import/export, and local automated backup restore.
  - Checks Docker image update status and points users to container image updates rather than attempting in-app container updates.
  - Does not expose Showcase Export because the Docker public website is served directly from the mounted data.

## Known Gaps

- Flatpak packaging is not implemented in the Tauri workflow. Arch users are covered by the PKGBUILD path for now. Flatpak can still be added later with a dedicated manifest/workflow if broader sandboxed Linux distribution becomes necessary.
- Docker admin mode should be tested behind a real HTTPS reverse proxy before public release. The login session cookie is HttpOnly, but credentials must still be transported over HTTPS.
- Windows and macOS installers are configured in GitHub Actions but have not been manually tested on those operating systems in this workspace.

## Local Linux Build Prerequisites

`cargo check` requires the Tauri Linux platform prerequisites for the current distro. On Arch/Omarchy, install the packages that provide:

- `webkit2gtk-4.1`
- `javascriptcoregtk-4.1`
- GTK/GIO/GDK development headers
- `pkg-config`

On Arch-based systems, this is typically covered by packages such as `webkit2gtk-4.1`, `gtk3`, and `base-devel`. After installing the system packages, run:

```bash
npm install
npm test
cargo check --manifest-path src-tauri/Cargo.toml
npm start
```
