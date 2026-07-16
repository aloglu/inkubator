# Build From Source

These steps are for development, local testing, or building your own copy of Inkubator.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Rust and Cargo
- Tauri system dependencies for your operating system

For Linux, install the Tauri prerequisites that match your distribution before building.

## Setup

```bash
git clone https://github.com/aloglu/inkubator.git
cd inkubator
npm install
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

## Showcase Preview

```bash
npm run showcase
```

This serves the app folder locally so you can preview the read-only showcase surface.

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

```bash
npm run docker:build
docker run \
  --name inkubator-local \
  --rm \
  -p 8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  inkubator:local
```

Open `http://localhost:8080` or `http://YOUR-SERVER-IP:8080`.

## Tests

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```
