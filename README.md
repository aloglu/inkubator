# Inkubator

Inkubator is a local-first app for cataloging fountain pens, inks, and swatches. It stores your collection in files, supports images and backups, and can run either as a desktop app or as a self-hosted Docker web app.

[Live demo](https://alog.lu/inkubator) | [Releases](https://github.com/aloglu/inkubator/releases) | [Documentation](docs/)

## Features

- Manage pens, inks, swatches, images, status history, and activity logs
- Store data locally without a hosted account or external database
- Import and export full ZIP backups, including referenced images
- Generate a read-only showcase website from the desktop app
- Run a browser-based Docker version with public showcase and authenticated admin mode
- Use light or dark mode across the app and website

## Quick Start

### Desktop App

Download the latest installer from [Releases](https://github.com/aloglu/inkubator/releases).

- Windows: use the `.exe` installer
- macOS: use the `.dmg` installer
- Linux: use the `.deb` or `.rpm` package
- Arch-based Linux: build from the PKGBUILD template in `packaging/arch`

See [Desktop Install](docs/desktop-install.md) for more detail.

### Docker

Docker mode serves the public showcase at `/` and the authenticated admin interface at `/admin/`.

```bash
docker run \
  --name inkubator \
  --restart unless-stopped \
  -p 8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:2.0.0
```

Open `http://localhost:8080` or `http://YOUR-SERVER-IP:8080`.

See [Docker Deployment](docs/docker.md) for configuration, reverse proxy examples, and update instructions.

## Documentation

- [Desktop Install](docs/desktop-install.md)
- [Docker Deployment](docs/docker.md)
- [Build From Source](docs/build-from-source.md)

## Backups

Manual full backups export as `.zip` files and include collection data, preferences, images, and replaced-image archives when enabled. Import accepts these ZIP backups in both desktop and Docker admin mode.

Pre-2.0 folder backups remain usable. In desktop mode, old backup folders can still be selected directly. In Docker mode, compress the old backup folder into a ZIP and import that ZIP.

## License

Released under the [MIT License](LICENSE).
