# Release Checklist

This project publishes desktop installers and the Docker admin image through GitHub Actions.

For the 2.0.0 release notes draft, see `docs/release-notes-2.0.0.md`.
For the exact publication sequence, see `docs/publication-runbook.md`.

## Automated Release Flow

1. Run the `Version Bump and Tag` workflow manually.
2. Choose `patch`, `minor`, or `major`.
3. The workflow updates version fields, commits the change, and creates a `vX.Y.Z` tag.
4. The `Build Desktop Artifacts` workflow runs for that tag and uploads release assets.
5. The `Build Docker Image` workflow runs for that tag and publishes the image to GitHub Container Registry.

Expected release assets:

- `Inkubator-X.Y.Z-win-x64.exe`
- `Inkubator-X.Y.Z-win-arm64.exe`
- `Inkubator-X.Y.Z-mac-x64.dmg`
- `Inkubator-X.Y.Z-mac-x64.zip`
- `Inkubator-X.Y.Z-mac-arm64.dmg`
- `Inkubator-X.Y.Z-mac-arm64.zip`
- `Inkubator-X.Y.Z-linux-x64.deb`
- `Inkubator-X.Y.Z-linux-x64.rpm`
- `ghcr.io/aloglu/inkubator:X.Y.Z`
- `ghcr.io/aloglu/inkubator:latest`

## Local Preflight

Run these before tagging when possible:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:linux:deb -- --ci
npm run build:linux:rpm -- --ci
npm run docker:build
bash -n packaging/arch/PKGBUILD
```

If Docker is not available locally, rely on the `Build Docker Image` workflow for the image build, but still run `npm test` and verify the Docker admin smoke test through `npm run docker:start`.

Docker admin smoke test:

```bash
INKUBATOR_ADMIN_PASSWORD=test INKUBATOR_DATA_DIR="$(mktemp -d)" npm run docker:start
curl http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/admin/
curl -i -c /tmp/inkubator-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"test"}' \
  http://127.0.0.1:8080/auth/login
curl -b /tmp/inkubator-cookies.txt http://127.0.0.1:8080/admin/
curl -b /tmp/inkubator-cookies.txt http://127.0.0.1:8080/api/release-status
```

## Release Candidate Manual Checks

Before tagging a 2.0 release candidate, verify:

- Desktop launches to Dashboard on fresh app start.
- Public showcase and Docker admin preserve the current section on browser refresh.
- Pen, ink, and swatch image uploads work with PNG/JPEG/WebP and local HEIC/HEIF files.
- Remote HEIC/HEIF swatch URLs preview and save correctly.
- Manual backup export creates a ZIP and desktop/Docker import can restore it.
- A pre-2.0 folder backup can be imported directly on desktop and as a compressed ZIP in Docker.
- Docker public root is read-only and `/admin/` requires login.
- Docker public-domain deployment works behind an HTTPS reverse proxy using `docs/docker-deployment.md`.
- Docker `App Version & Updates` reports container-image status and opens the GHCR package page.
- Showcase export remains available in desktop mode and hidden in Docker mode.

## Post-Tag Checks

After the `vX.Y.Z` tag workflows finish:

- Confirm the GitHub Release contains every expected desktop artifact.
- Confirm the GitHub Container Registry package is visible and has `X.Y.Z` and `latest` tags.
- Download at least one generated Linux package and verify it installs, launches, and uses the packaged icon.
- Pull `ghcr.io/aloglu/inkubator:X.Y.Z` and confirm `/`, `/admin/`, login, backups, and image uploads work against a mounted `/data` directory.

On Linux, verify the generated DEB contains a desktop entry that points at the packaged icon:

```bash
tmpdir="$(mktemp -d)"
ar x src-tauri/target/release/bundle/deb/Inkubator_*.deb --output "$tmpdir"
mkdir -p "$tmpdir/root"
tar -xzf "$tmpdir/data.tar.gz" -C "$tmpdir/root"
grep '^Icon=inkubator' "$tmpdir"/root/usr/share/applications/*.desktop
find "$tmpdir/root/usr/share/icons/hicolor" -type f -name 'inkubator.png' | sort
rm -rf "$tmpdir"
```

## Arch Package

The Arch PKGBUILD is a source package template. Before publishing it to AUR:

```bash
cd packaging/arch
updpkgsums
makepkg --printsrcinfo > .SRCINFO
makepkg -si
```

Flatpak remains a separate future packaging track.
