# Desktop Install

Download the latest desktop installer from the GitHub [Releases](https://github.com/aloglu/inkubator/releases) page.

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

Build the package from the included PKGBUILD template:

```bash
cd packaging/arch
makepkg -si
```

Flatpak is not currently provided. The Linux release artifacts are DEB, RPM, and the Arch PKGBUILD template.
