# Inkubator

Inkubator is an app for cataloging fountain pens, inks, and swatches. It stores your collection in files, supports images and backups, and can run either as a desktop app or as a self-hosted Docker web app.

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
read -rsp "Inkubator admin password: " INKUBATOR_ADMIN_PASSWORD
echo
export INKUBATOR_ADMIN_PASSWORD
```

```bash
docker run \
  --name inkubator \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:latest
```

Open `http://localhost:8080`. See the Docker guide before exposing the port to a LAN or the internet.

See [Docker Deployment](docs/docker.md) for configuration, reverse proxy examples, and update instructions.

## Backups

Manual full backups export as `.zip` files and include collection data, preferences, images, and replaced-image archives when enabled. Import accepts these ZIP backups in both desktop and Docker admin mode. See [Backups And Data Safety](docs/backups.md) for data locations, automated backups, and restore steps.

Pre-2.0 folder backups remain usable after you compress the backup folder into a ZIP and import that ZIP.

## Documentation

- [Desktop Install](docs/desktop-install.md)
- [Docker Deployment](docs/docker.md)
- [Backups and Data Safety](docs/backups.md)
- [Build From Source](docs/build-from-source.md)

## License

Released under the [MIT License](LICENSE).
