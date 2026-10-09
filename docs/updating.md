# Updating Inkubator

Updating never touches your collection: it replaces only the program. Still,
it is a good habit to **Export backup** first (Settings → Backups).

## Knowing when a new version is out

**Settings → About** shows the version you are running. When a newer one is
out, it says so there, with **What's new** and a link to this guide, and
Settings gets a small dot in the menu (on phones, on the **More** tab).

To know, Inkubator asks GitHub at most twice a day which version is the
latest. Nothing about your collection is sent. You can turn this off in
Settings → About → **Check for updates**; new versions are always listed on
the [releases page](https://github.com/aloglu/inkubator/releases).

Then follow the steps for your setup below.

## Docker Compose (also Raspberry Pi)

In the folder with `compose.yml`:

```bash
docker compose pull
docker compose up -d
```

The first command downloads the new version, the second restarts Inkubator
with it. Afterwards you can remove the old download with `docker image prune`.

If your `compose.yml` names a version (such as
`ghcr.io/aloglu/inkubator:3.0.0`), change the number first.

## Docker without Compose

A container started with `docker run` keeps the version it started with.
Download the new version, remove the old container (your data folder stays),
and start it again with the same command you used the first time:

```bash
docker pull ghcr.io/aloglu/inkubator:latest
docker stop inkubator
docker rm inkubator
docker run -d --name inkubator ...   # the same command as before
```

## Unraid

On the Docker tab, click **update ready** next to Inkubator, or **Check for
Updates** and then **Apply Update**. Your data in
`/mnt/user/appdata/inkubator` is kept.

**The Docker tab says "3rd Party" and offers no update?** Then Inkubator was
started from the terminal with `docker run`, and Unraid does not look after
containers it did not create. Let Unraid manage it instead; your collection is
kept:

1. On the Docker tab, click Inkubator's icon → **Stop**, then **Remove**.
2. Add it again with **Add Container**, as in the [Unraid guide](unraid.md),
   with the same appdata folder and password.

From then on, updates appear on the Docker tab.

## Synology

Over SSH (see [Synology, step 3](synology.md#step-3-find-the-user-and-group-ids) for turning SSH on):

```bash
cd /volume1/docker/inkubator
sudo docker compose pull && sudo docker compose up -d
```

Your data in `docker/inkubator/data` is kept. Container Manager can also do
this from its **Project** and **Image** screens, but the menus differ between
DSM versions.

## Without Docker

1. Stop Inkubator (**Ctrl+C** in its window).
2. Download the new version for your computer from the
   [releases page](https://github.com/aloglu/inkubator/releases/latest).
3. Replace the old `inkubator` (or `inkubator.exe`) with the new one.
4. Start it again.

Your data folder stays where it is.

## Checking that it worked

Open Inkubator and look at **Settings → About**: it shows the new version and
"Up to date."

## Going back to an older version

Within Inkubator 3, data written by a newer version is not guaranteed to work
with an older one. If you need to go back, run the older version and restore
the backup you exported before updating.
