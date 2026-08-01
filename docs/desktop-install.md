# Desktop Install

Download the latest desktop installer from the GitHub [Releases](https://github.com/aloglu/inkubator/releases) page.

Before moving machines, uninstalling, or testing a new build, create a full backup ZIP. See [Backups And Data Safety](backups.md) for export, import, and automated backup details.

## Windows

Download the Windows `.exe` installer and run it.

## macOS

Download the macOS `.dmg`, open it, and drag Inkubator into Applications.

If macOS warns that the app cannot be opened, use the standard macOS security prompt to allow the app from System Settings. This can happen for unsigned or newly distributed builds.

## Linux

Use the package that matches your distribution family:

```bash
# Debian / Ubuntu
sudo apt install ./Inkubator-<version>-linux-x64.deb

# Fedora / RHEL / openSUSE-style RPM systems
sudo dnf install ./Inkubator-<version>-linux-x64.rpm
```

To remove the package:

```bash
# Debian / Ubuntu
sudo apt remove inkubator

# Fedora / RHEL / openSUSE-style RPM systems
sudo dnf remove inkubator
```

## Arch-Based Linux

The repository keeps a PKGBUILD for the latest published release. Install the standard Arch build tools, clone the repository, and build it:

```bash
sudo pacman -S --needed base-devel git
git clone https://github.com/aloglu/inkubator.git
cd inkubator/packaging/arch
makepkg -si
```

Do not run `makepkg` as root.

To remove the Arch package:

```bash
if pacman -Qq inkubator-debug >/dev/null 2>&1; then
  sudo pacman -Rns inkubator inkubator-debug
else
  sudo pacman -Rns inkubator
fi
```

Arch may install `inkubator-debug` automatically when debug symbols are produced. It is safe to remove it with the main package.

Uninstalling the package does not delete your collection data. To reset a current Tauri-based Inkubator install completely, remove the local app data after uninstalling:

> [!WARNING]
> This deletes your collection data, images, preferences, and automated backups. Export a full backup first if you want to keep your data.

```bash
rm -rf ~/.local/share/com.aloglu.inkubator
```

If you previously used the Electron version, you may also have legacy data in `~/.local/share/com.inkubator.app` or `~/.config/Inkubator`.

Flatpak is not currently provided. The Linux release artifacts are DEB, RPM, and the Arch PKGBUILD template.
