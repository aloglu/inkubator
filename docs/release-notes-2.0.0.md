# Inkubator 2.0.0 Release Notes

Inkubator 2.0.0 moves the desktop app from Electron to Tauri and adds a Docker admin mode for self-hosted browser-based management while preserving the no-database, file-backed model.

## Highlights

- Migrated the desktop app runtime from Electron to Tauri v2.
- Added Windows, macOS, and Linux desktop packaging through GitHub Actions.
- Added Docker admin mode with an authenticated `/admin/` interface and a read-only public showcase at `/`.
- Added full ZIP backup export/import for desktop and Docker.
- Preserved compatibility with pre-2.0 folder backups.
- Added local HEIC/HEIF upload support for iPhone photo workflows.
- Added new Inkubator app icon and updated desktop/package metadata.
- Added Docker-specific update status that points users to container image updates.

## Desktop App

- Data, preferences, image handling, backup, import/export, showcase export, update checks, InkSwatch lookup, and external URL opening are handled through Tauri/Rust commands.
- Desktop app launches to Dashboard on fresh app start.
- Static showcase refresh preserves the current section.
- Showcase export remains available in desktop mode.
- Manual full backups export as `.zip` files.
- Backup import supports new ZIP backups and old pre-2.0 backup folders.

## Docker Admin Mode

- Public root `/` serves the read-only showcase.
- `/admin/` serves the authenticated management interface.
- Data, preferences, images, and backups live under the mounted `/data` directory.
- No database is required.
- Manual backup export downloads a ZIP file.
- Backup import accepts ZIP files, including ZIPs created by compressing old backup folders.
- Automated backups remain under `/data/backups/auto`.
- Showcase export is hidden because Docker serves the public website directly from live data.

## Image Handling

- Local PNG, JPEG, WebP, AVIF, HEIC, and HEIF uploads are supported.
- Local HEIC/HEIF files are converted before entering the managed WebP image pipeline.
- Remote HEIC/HEIF swatch image URLs are converted before entering the managed image pipeline.

## Linux Packaging

- Linux release artifacts are DEB and RPM packages.
- Arch users can build from the PKGBUILD template under `packaging/arch`.
- Flatpak is not included in 2.0.0 and remains a future packaging track.

## Docker Image

Expected image tags:

- `ghcr.io/aloglu/inkubator:2.0.0`
- `ghcr.io/aloglu/inkubator:2.0`
- `ghcr.io/aloglu/inkubator:latest`

To update a Docker install, pull the newer image and recreate the container while keeping the same `/data` mount.

## Known Notes

- Windows and macOS packages are built by GitHub Actions and should be manually smoke-tested after publishing.
- Docker admin mode should be served behind HTTPS for real deployments.
- The app does not self-update Docker containers from inside the admin interface.
