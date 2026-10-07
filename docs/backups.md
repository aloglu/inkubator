# Backups

Your whole collection lives in Inkubator's **data folder**: the list of pens,
inks, swatches and inkings, all photos, and the backups themselves. Inkubator
makes backups by itself, and you can make one whenever you like.

A backup is a single `.zip` file with the collection, the photos and the
settings. It works on any Inkubator 3 setup: Docker, Unraid, Synology or the
plain program.

## Automatic backups

**Settings → Backups** starts with when the last backup was made. Below it you
choose:

- **Automatic backups:** off, daily (the default), weekly or monthly.
- **Keep:** how many automatic backups to keep (30 by default). Older ones are
  deleted.

Automatic backups are saved in the data folder, in `backups/auto`. They protect
you from mistakes inside Inkubator (such as deleting the wrong pen), but not
from losing the disk they are on. For that, also keep a copy elsewhere: export
one now and then (below), or let your NAS backup tool or cloud sync include
the data folder.

## Making a backup yourself

**Settings → Backups → Export backup** downloads a `.zip` of everything. Keep it
somewhere safe, such as another disk or cloud storage.

## Restoring a backup

**Settings → Backups → Restore…**, then choose a backup `.zip`.

Restoring **replaces your whole collection** with the one in the backup.
Inkubator asks first, checks the backup before using it, and saves a backup of
your current collection just before replacing it (in `backups/auto`), so a
restore can be undone by restoring that one.

Backups can be up to 1 GB.

## Moving to another computer or server

1. On the old setup: **Export backup**.
2. Set Inkubator up on the new one (see the [guides](README.md)).
3. On the new one: **Restore…** with that file.

## What is in the data folder

| Item | What it is |
| --- | --- |
| `inkubator.json` | Your collection and settings |
| `images/` | Your photos (`images/.thumbs/` holds smaller copies, made again when needed) |
| `backups/auto/` | Automatic backups and safety copies made before a restore |
| `replaced-photos/` | Photos you replaced or removed, if **Keep replaced photos** is on |
| `password.json` | Only without Docker: your password, stored as a one-way hash |

Where the data folder is:

| Setup | Data folder |
| --- | --- |
| Docker (the guide's setup) | `inkubator-data`, next to `compose.yml` |
| Unraid | `/mnt/user/appdata/inkubator` |
| Synology | `docker/inkubator/data` |
| Raspberry Pi | `~/inkubator/inkubator-data` |
| Without Docker | see [the table there](without-docker.md#where-your-collection-is-kept) |

You can also back up by copying the whole data folder while Inkubator is
stopped.
