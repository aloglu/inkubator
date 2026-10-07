# Inkubator guides

Inkubator keeps track of your fountain pens, inks and swatches. It runs on a
computer you own and you use it in your web browser, on that computer or on
your phone. Nothing is stored anywhere else.

If you have never set up anything like this before, that is fine: every guide
here goes step by step and says what you should see.

## 1. Choose where Inkubator runs

Inkubator is a small program that needs to keep running while you use it. Pick
the line that sounds most like you:

| Your situation | Follow |
| --- | --- |
| I have a home server or NAS running **Unraid** | [Unraid](unraid.md) |
| I have a **Synology** NAS | [Synology](synology.md) |
| I have a **Raspberry Pi** (or want to use one) | [Raspberry Pi](raspberry-pi.md) |
| I already use **Docker**, or want to on my computer or server | [Docker](docker.md) |
| I just want to try it on **my own computer**, without installing anything else | [Without Docker](without-docker.md) |

Not sure? A computer or NAS that stays on is the best home for Inkubator,
because then you can open it from your phone at any time. If you only want to
try it, start with [Without Docker](without-docker.md) on your own computer; you
can move your collection to a server later with a backup.

**What is Docker?** Docker runs programs in sealed boxes called *containers*.
You tell Docker which program you want ("the Inkubator image") and which
folder it may keep its files in, and Docker takes care of the rest. Many home
servers and NAS systems have it built in. The [Docker guide](docker.md)
explains it from the start.

## 2. Use it

- [Using Inkubator](using-inkubator.md): opening it, installing it as an app,
  using it from your phone, and the public showcase.
- [Reaching Inkubator from outside your home](remote-access.md): safely, with
  HTTPS.
- [Backups](backups.md): automatic backups, exporting and restoring.
- [Updating](updating.md): getting a new version.
- [Moving from Inkubator 2.x](moving-from-2x.md): bringing your old collection
  over.
- [Troubleshooting](troubleshooting.md): when something does not work.

For developers: [Building from source](build-from-source.md).
