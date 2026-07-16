# Backups And Data Safety

Inkubator stores your collection on the machine where it runs. A desktop install stores data in your user profile. A Docker install stores data in the container data directory, which should be mounted to a host folder.

## Stored Files

Inkubator keeps these files and folders in its data directory:

- `data.json`: pens, inks, swatches, currently inked pens, and activity log entries.
- `preferences.json`: app settings, collection defaults, backup settings, and showcase settings.
- `images/`: current managed images referenced by your collection.
- `replaced-images/`: old managed images, only when replaced-photo retention is enabled.
- `backups/auto/`: automated backup snapshots.
- `backups/manual/`: temporary working folders used while creating or importing manual backups.

Manual full backups are ZIP files. They include `data.json`, `preferences.json`, `manifest.json`, current referenced images, and `replaced-images/` when replaced-photo retention is enabled.

Thumbnails are derived cache files and are not stored in full backups. Inkubator regenerates them from the restored images during import so the first collection view does not need to download or decode every full-resolution image.

## Desktop Data Location

The desktop app uses the app data directory for the app identifier `com.aloglu.inkubator`.

| Platform | Data directory |
| --- | --- |
| Windows | `%APPDATA%\com.aloglu.inkubator\` |
| macOS | `$HOME/Library/Application Support/com.aloglu.inkubator/` |
| Linux | `$XDG_DATA_HOME/com.aloglu.inkubator/` |

On Linux, if `XDG_DATA_HOME` is not set, the directory is:

```text
$HOME/.local/share/com.aloglu.inkubator/
```

On a default Windows profile, `%APPDATA%` expands to:

```text
C:\Users\<your-user-name>\AppData\Roaming
```

Desktop automated backups are stored under the data directory:

```text
backups/auto/
```

## Docker Data Location

Docker stores data inside the container path set by `INKUBATOR_DATA_DIR`. The default is:

```text
/data
```

Mount that path to a stable host folder. Example:

```bash
-v "$PWD/inkubator-data:/data"
```

With that example, the host folder is:

```text
$PWD/inkubator-data
```

Inside the container, automated backups are stored in:

```text
/data/backups/auto/
```

On the host, the same files are under the folder you mounted to `/data`:

```text
<your-mounted-folder>/backups/auto/
```

## Exporting A Full Backup

Use **Settings > Data & Safety > Export Full Backup**.

Desktop app:

- Inkubator opens a save dialog.
- Choose where to save the `.zip` file.
- Keep the ZIP outside the Inkubator data directory if you are preparing for migration, uninstalling, or testing a new build.

Docker admin:

- Open `/admin/`.
- Use **Export Full Backup**.
- The browser downloads the `.zip` file.

Full backup ZIPs are the portable backup format for moving between machines, restoring after an install, or moving between desktop and Docker.

## Importing A Full Backup

Use **Import Full Backup**.

Importing is a restore operation. It overwrites the current collection, preferences, and managed images with the selected ZIP backup.

The flow is:

1. Inkubator warns that the import will overwrite current data.
2. Choose **Import** to continue, or **Cancel** to stop.
3. Select the backup ZIP.
4. Inkubator validates and restores the selected ZIP.
5. Inkubator regenerates image thumbnails.

If the ZIP is invalid or fails validation, Inkubator reports an error instead of treating it as a successful restore.

The desktop app restores the collection first and regenerates missing thumbnails in the background. Grid cards temporarily fall back to their full managed images, so thumbnail work does not block the import result or the next app launch.

Docker mode stages the complete import and only replaces active data after validation and thumbnail generation succeed. It also creates automated restore snapshots immediately before and after a successful replacement. Invalid Docker imports and commit failures restore the previous collection.

## Automated Backups

Automated backups are folders, not downloaded ZIP files. Each snapshot contains the same core files as a full backup folder: collection data, preferences, manifest, and referenced images.

Desktop app behavior:

- Default frequency: daily.
- Default retention: keep the latest 30 automated snapshots.
- Frequency options: Off, Daily, Weekly, Monthly.
- Retention range: 1 to 365 snapshots.
- Save-triggered automated backups follow the selected frequency.
- Older automated backups are pruned according to the retention setting.

Docker behavior:

- Save-triggered automated backups follow the selected frequency.
- Forced restore snapshots are created before and after imports even when frequency is Off.
- The configured retention count is applied to both scheduled and restore snapshots.
- They are stored in `/data/backups/auto/`.
- Docker automated backups are not downloaded automatically.

## Replaced Images

Current referenced images are included in full backups and automated backups.

When **Keep replaced photos in backups** is enabled, old managed images are moved into `replaced-images/` instead of being deleted when a photo is replaced. Those archived files are included in full backups. Showcase exports never include replaced photos.

## Restoring An Automated Backup

The import button expects a ZIP file. To restore an automated backup folder, first make a ZIP from that folder.

The ZIP must contain:

- `data.json`
- `preferences.json`
- `manifest.json`
- `images/`
- `replaced-images/`, if that backup has it

Then use **Import Full Backup** and select the ZIP.

For Docker, copy the automated backup folder from the host-mounted data directory, make the ZIP, then import it from `/admin/`.

For the desktop app, copy the automated backup folder from the app data directory, make the ZIP, then import it from the desktop app.

## Showcase Export Is Not A Backup

Desktop **Export Showcase** creates a static website folder named `showcase`. It includes public website files, display data, and current referenced images. It does not include restore snapshots, replaced-image archives, or backup metadata intended for restoring the app.

Docker does not export a separate showcase folder. The public showcase is served directly at `/` and updates when the collection is saved.
