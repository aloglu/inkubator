# Inkubator

Inkubator is a local-first desktop application for managing and cataloging fountain pen and ink collections. It provides a centralized interface for pen, ink, and swatch management, activity tracking, statistics, and static showcase generation from local data.

[Live Showcase Demonstration](https://alog.lu/inkubator) | [Latest Releases](https://github.com/aloglu/inkubator/releases)

## Features

### Collection Management
* **Pen Management**: Maintain detailed pen records with structured fields such as manufacturer, model, nib material, tip size, nib type, filling system, condition, status, and additional details.
* **Ink Management**: Maintain detailed ink records including brand, line, name, color values, bottle and sample metadata, inventory and ownership state, performance characteristics (shading, sheen, shimmer, flow, dry time), and additional details.
* **Swatch Management**: Attach and manage multiple independent swatches per ink with per-swatch metadata, image support, and separate swatches for different testing conditions.
* **Dynamic Filtering**: Filter and browse pens, inks, and swatches using their metadata to quickly locate specific items and hide irrelevant or empty views.
* **Stats Page**: Get a clear overview of your collection with totals, category breakdowns, and activity-based metrics in one place.
* **Status and Activity Tracking**: Track pen states (Inked, Cleaned, Resting) and keep an automatic log of additions, edits, and inking history, with optional inclusion in static website exports.
* **Built-In Color Assistance**: Optionally use local image analysis to isolate subjects and extract dominant color values from swatch photos.
* **Dark Mode Support**: Both the desktop application and the generated showcase include dark mode.
* **Local Persistence**: All data is stored in a structured `data.json` file without mandatory account creation or cloud dependency.

### Data Integrity & Portability
* **Manual and Automated Backups**: Create backups on demand or rely on scheduled snapshots for both data and images.
* **Full Archive Export**: A manual Export/Import feature allows for complete library migration between devices by bundling data and media into a single portable ZIP archive.

### Static Site Generation (SSG)
* **Showcase Export**: The application generates a responsive, read-only static website from the local database.
* **Deployment**: The `showcase/` directory is portable and compatible with any static hosting provider (e.g., GitHub Pages, Vercel, S3).

## Technical Stack

* **Core Runtime**: Tauri / Rust
* **Frontend**: Vanilla JavaScript / CSS3
* **Image Processing**: Rust image pipeline for WebP optimization
* **Filesystem**: Rust file-backed JSON storage

## Getting Started

### Binary Execution
Pre-compiled binaries for supported operating systems are available via the GitHub [Releases](https://github.com/aloglu/inkubator/releases) page.

### Linux Packages
Linux release artifacts are currently available as DEB and RPM packages in the Tauri migration workspace. Arch users can build an Arch package from the PKGBUILD template in `packaging/arch`.

Install or remove the package with the tool that matches the artifact you used:

```bash
# DEB
sudo apt install ./Inkubator-<version>-linux-x64.deb
sudo apt remove inkubator

# RPM
sudo dnf install ./Inkubator-<version>-linux-x64.rpm
sudo dnf remove inkubator
```

For Arch-based systems:

```bash
cd packaging/arch
makepkg -si
```

Flatpak packaging is tracked separately because Tauri does not provide a native Flatpak bundle target. It can be added later with a dedicated Flatpak manifest/workflow if needed.

### Docker Admin Mode
Docker mode runs the same collection manager in a browser against files mounted from a host directory. It does not use a database. Your app data, preferences, images, backups, and exports live under the mounted `/data` directory.

This mode is intended for self-hosting behind your own HTTPS reverse proxy. The public root serves the read-only showcase, while `/admin/` serves the authenticated management interface. The admin interface uses a built-in login screen backed by an HttpOnly session cookie.

```bash
docker run \
  --name inkubator \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:2.0.0
```

Then open `http://localhost:8080` for the public showcase or `http://localhost:8080/admin/` for the admin interface. For a public domain, route the domain to the container through your HTTPS reverse proxy. See `docs/docker-deployment.md` for Caddy and Nginx examples.

If port `8080` is already used on your host, change the left side of the port mapping. For example, `-p 127.0.0.1:8090:8080` makes Inkubator available at `http://localhost:8090` while keeping the container's internal port unchanged.

The admin username and password are both configurable:

```bash
-e INKUBATOR_ADMIN_USER='your-username'
-e INKUBATOR_ADMIN_PASSWORD='your-password'
```

For local source builds:

```bash
npm run docker:build
docker run \
  --name inkubator-local \
  --rm \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  inkubator:local
```

Docker mode preserves the static-showcase model without a separate export step: the admin interface edits local JSON and image files, and the public root renders those files as the read-only website. Desktop builds still support standalone Showcase Export for static hosting uploads.

To update Docker mode, pull the newer `ghcr.io/aloglu/inkubator` image and recreate the container while keeping the same `/data` volume mount. The admin settings page can check whether a newer release/image version is available, but it does not update the container from inside the app.

For a plain `docker run` install, the update flow is:

```bash
docker pull ghcr.io/aloglu/inkubator:2.0.0
docker stop inkubator
docker rm inkubator
# Re-run the original docker run command with the same -v /data mount.
```

For Docker Compose, update the image tag if needed, then run:

```bash
docker compose pull
docker compose up -d
```

### Backups
Manual full backups export as `.zip` files and include collection data, preferences, referenced images, and replaced-image archives when enabled. Import accepts these ZIP backups in both desktop and Docker admin mode.

Pre-2.0 folder backups remain usable. In desktop mode, old backup folders can still be selected directly. In Docker mode, compress the old backup folder into a ZIP and import that ZIP; the importer accepts both ZIPs that contain `data.json` directly and ZIPs that contain one top-level backup folder.

### Source Build & Development
**Prerequisites**: Node.js (v18.0.0+), npm (v9.0.0+), Rust, and the Tauri Linux/macOS/Windows platform prerequisites for your OS.

1. **Repository Initialization**:
   ```bash
   git clone https://github.com/aloglu/inkubator.git
   cd inkubator
   ```

2. **Dependency Installation**:
   ```bash
   npm install
   ```

3. **CLI Commands**:
   * `npm start`: Initialize the Tauri management interface.
   * `npm run showcase`: Launch a local development server for the static showcase.
   * `npm run build`: Build a Tauri desktop artifact for the current platform.
   * `npm run docker:start`: Run Docker admin mode directly with Node.js. Set `INKUBATOR_ADMIN_PASSWORD` and optionally `INKUBATOR_DATA_DIR`.

## Migration Notes

This branch is the Tauri migration workspace. See `docs/tauri-transition-status.md` for current parity status and known gaps.

Release packaging notes and preflight commands are in `docs/release-checklist.md`.
The 2.0.0 release notes draft is in `docs/release-notes-2.0.0.md`, and the publication sequence is in `docs/publication-runbook.md`.

## License
Released under the [MIT License](https://github.com/aloglu/inkubator/blob/main/LICENSE).
