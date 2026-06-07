# Arch Packaging

This directory contains a PKGBUILD template for Arch Linux and AUR-style packaging.

## Local Build

From this directory:

```bash
makepkg -si
```

The package builds the Tauri Linux DEB bundle first, then extracts the verified Tauri payload into the Arch package. This keeps the installed binary, resources, desktop entry, and icons aligned with the DEB/RPM release artifacts.

## Uninstall

Remove the installed Arch package with:

```bash
sudo pacman -Rns inkubator inkubator-debug
```

`inkubator-debug` may be created automatically by Arch packaging when debug symbols are present. It is not a separate debug build of the app, and it can be removed with the main package.

Package removal does not delete user data. This is intentional, so uninstalling or upgrading Inkubator does not wipe a collection.

To remove local data for a current Tauri-based Inkubator install:

> [!WARNING]
> This deletes your collection data, images, preferences, and automated backups. Export a full backup first if you want to keep your data.

```bash
rm -rf ~/.local/share/com.aloglu.inkubator
```

If you previously used the Electron version, you may also have legacy data in `~/.local/share/com.inkubator.app` or `~/.config/Inkubator`.

## Publishing Notes

Before publishing to AUR:

1. Update `pkgver` and reset `pkgrel` to `1`.
2. Replace `sha256sums=('SKIP')` with the real source archive checksum:

   ```bash
   updpkgsums
   ```

3. Generate `.SRCINFO`:

   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```

4. Test the package in a clean chroot if possible.

Flatpak packaging is intentionally separate. It can be added later without changing the app architecture, but it requires a dedicated Flatpak manifest and build workflow rather than a native Tauri bundle target.
