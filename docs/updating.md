# Updating Inkubator

Updating never touches your collection: it replaces only the program. Still,
it is a good habit to **Export backup** first (Settings → Backups).

The current version is shown in **Settings → About**. New versions are listed
on the [releases page](https://github.com/aloglu/inkubator/releases).

## Docker (Compose, Raspberry Pi)

In the folder with `compose.yml`:

```bash
docker compose pull
docker compose up -d
```

The first command downloads the new version, the second restarts Inkubator
with it. Afterwards you can remove the old download with `docker image prune`.

If your `compose.yml` names a version (such as
`ghcr.io/aloglu/inkubator:3.0.0`), change the number first.

## Unraid

On the Docker tab, click **update ready** next to Inkubator, or **Check for
Updates** and then **Apply Update**.

## Synology

See [Synology → Updating](synology.md#updating).

## Without Docker

1. Stop Inkubator (**Ctrl+C** in its window).
2. Download the new version for your computer from the
   [releases page](https://github.com/aloglu/inkubator/releases/latest).
3. Replace the old `inkubator` (or `inkubator.exe`) with the new one.
4. Start it again.

Your data folder stays where it is.

## Going back to an older version

Within Inkubator 3, data written by a newer version is not guaranteed to work
with an older one. If you need to go back, run the older version and restore
the backup you exported before updating.
