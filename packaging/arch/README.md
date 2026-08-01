# Arch Packaging

This directory contains the Arch Linux package recipe for the latest published Inkubator release. The recipe deliberately stays on that release while newer versions are in development.

## Local Build

Install the standard Arch build tools, clone the repository, and build the package:

```bash
sudo pacman -S --needed base-devel git
git clone https://github.com/aloglu/inkubator.git
cd inkubator/packaging/arch
makepkg -si
```

Do not run `makepkg` as root. It downloads the published source archive, verifies its checksum, builds the Tauri Linux DEB bundle, and extracts the Tauri payload into the Arch package. This keeps the installed binary, resources, desktop entry, and icons aligned with the DEB/RPM release artifacts.

## Uninstall

Remove the installed Arch package with:

```bash
if pacman -Qq inkubator-debug >/dev/null 2>&1; then
  sudo pacman -Rns inkubator inkubator-debug
else
  sudo pacman -Rns inkubator
fi
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

## Release Maintenance

The PKGBUILD is updated after a release tag exists because its archive checksum cannot be finalized earlier. After publishing a new Inkubator tag:

1. Confirm the tag exists on GitHub, update `pkgver`, and reset `pkgrel` to `1`. Remove any package patches already included in the new release.
2. Update and verify the source archive checksum:

   ```bash
   updpkgsums
   makepkg --verifysource
   ```

3. Build the package and inspect it with `namcap` when available. A clean-chroot build with `pkgctl build` is preferred before AUR publication.
4. Generate `.SRCINFO` if publishing the recipe to AUR:

   ```bash
   makepkg --printsrcinfo > .SRCINFO
   ```

5. Commit the updated PKGBUILD separately from the release tag.

Flatpak packaging is intentionally separate. It can be added later without changing the app architecture, but it requires a dedicated Flatpak manifest and build workflow rather than a native Tauri bundle target.
