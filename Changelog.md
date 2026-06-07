# Changelog

## 2.0.0

### Added

- Added a Tauri-based desktop app, replacing the Electron runtime.
- Added Docker admin mode for self-hosted browser-based collection management.
- Added an authenticated `/admin/` interface for Docker mode.
- Added a public read-only showcase at `/` for Docker mode.
- Added ZIP-based full backup export and import.
- Added compatibility for importing pre-2.0 folder backups.
- Added local HEIC/HEIF image upload support for iPhone photo workflows.
- Added remote HEIC/HEIF swatch URL conversion.
- Added Docker-specific update status checks.
- Added GitHub Actions workflows for desktop installers and Docker image publishing.
- Added Arch Linux PKGBUILD packaging support.
- Added new Inkubator icon and refreshed package metadata.

### Changed

- Moved app assets and frontend code into the `app/` directory.
- Moved desktop filesystem, backup, image, import/export, and update logic into Tauri/Rust commands.
- Changed manual full backups to download as portable ZIP files.
- Changed Docker mode so the public website updates directly from live mounted data instead of requiring showcase export.
- Changed Docker default examples to bind locally and expect HTTPS reverse proxy usage for public deployments.
- Changed Settings update checks so they only run when the user clicks the check button.
- Changed desktop app startup so it opens Dashboard instead of restoring the last visited panel.
- Changed static showcase and Docker admin refresh behavior so the current section is preserved.
- Changed release packaging to produce Windows, macOS, Linux DEB/RPM, Docker, and Arch package paths.

### Fixed

- Fixed image handling for imported backups in the Tauri app.
- Fixed adding pens, inks, and swatches with managed images.
- Fixed delete behavior from edit panels.
- Fixed settings text fields so changes save without requiring Enter.
- Fixed settings save feedback with notification toasts.
- Fixed trailing periods in notification toast messages.
- Fixed dark/light mode startup flash.
- Fixed showcase refresh flashing Dashboard before returning to the selected section.
- Fixed Docker admin refresh performance.
- Fixed Docker login modal behavior, focus, escape-to-close, and sidebar Manage/Logout controls.
- Fixed Docker mode hiding redundant showcase export controls.
- Fixed version comparison so local `2.0.0` is not treated as older than GitHub `1.7.6`.
- Fixed Docker release workflow version sync for tagged builds.
