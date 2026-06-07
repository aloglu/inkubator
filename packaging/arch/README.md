# Arch Packaging

This directory contains a PKGBUILD template for Arch Linux and AUR-style packaging.

## Local Build

From this directory:

```bash
makepkg -si
```

The package builds the Tauri Linux DEB bundle first, then extracts the verified Tauri payload into the Arch package. This keeps the installed binary, resources, desktop entry, and icons aligned with the DEB/RPM release artifacts.

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
