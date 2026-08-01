# Build From Source

These steps are for development, local testing, or building your own copy of Inkubator.

## Prerequisites

- Node.js 24 or newer; official verification uses the exact LTS version in `.nvmrc`
- npm (included with Node.js)
- Rust 1.97.1 and Cargo
- Chromium or a Chromium-based browser for renderer verification
- Tauri system dependencies for your operating system
- Docker Engine or Docker Desktop only when building the Docker image

For Linux, install the Tauri prerequisites that match your distribution before building.

## Setup

```bash
git clone https://github.com/aloglu/inkubator.git
cd inkubator
npm ci
```

## Desktop Development

```bash
npm start
```

This launches the Tauri desktop app in development mode.

The desktop development app uses the same operating-system app data location as a normal Inkubator install unless you override it. To test this working tree without touching an installed copy, use an isolated data directory:

```bash
npm run start:isolated
```

This is equivalent to:

```bash
INKUBATOR_DATA_DIR=/tmp/inkubator-desktop-dev npm start
```

With this override, `data.json`, preferences, images, thumbnails, replaced images, and backups are stored under `/tmp/inkubator-desktop-dev`.

## Desktop Build

```bash
npm run build
```

This builds a desktop artifact for your current platform.

Linux package builds can be run with:

```bash
npm run build:linux
```

## Docker Build

This section requires Docker Engine or Docker Desktop.

```bash
npm run docker:build
read -rsp "Inkubator admin password: " INKUBATOR_ADMIN_PASSWORD
echo
export INKUBATOR_ADMIN_PASSWORD
docker run \
  --name inkubator-local \
  --rm \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD \
  -v "$PWD/inkubator-data:/data" \
  inkubator:local
```

Open `http://localhost:8080`. See [Docker Deployment](docker.md) before exposing the port to a LAN or the internet.

## Verification

```bash
npm run verify
```

This runs the Node version, JavaScript syntax, release-version consistency, Node, renderer, Rust formatting, Cargo check, Clippy, and Rust test checks. It does not install dependencies or modify collection data.

The active Node version must match `.nvmrc`. With `nvm`, run `nvm use` first. If the Chromium executable is not named `chromium`, provide its path:

```bash
INKUBATOR_CHROMIUM_BIN=/path/to/chromium npm run verify
```

Individual test suites remain available:

```bash
npm test
npm run test:renderer
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Version Synchronization

Use `npm run sync-version -- X.Y.Z` when development moves to a new app version. This updates the application metadata only. The Arch PKGBUILD remains on the latest published release until the new tag exists and its checksum can be calculated; follow the [Arch release-maintenance checklist](../packaging/arch/README.md#release-maintenance) after publishing the tag.
