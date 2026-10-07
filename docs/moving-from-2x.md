# Moving from Inkubator 2.x

Inkubator 3 is a new version with a new way of storing your collection, so a
2.x collection is brought over once with the **import**. The import only reads
your 2.x data; it never changes it, so your 2.x setup keeps working until you
are happy with 3.

## What comes over

Everything: pens, inks, swatches, photos, which pen held which ink and when,
the activity history, and your settings. A few things are adjusted:

- **Notes start private.** 3.0 lets you show each note on the public showcase
  or not; all imported notes start private.
- **The public showcase starts off.** Turn it on in Settings when you want it.
- 2.x's "currently inked" list becomes 3.0's ink history (fills).

At the end the import lists anything it had to adjust.

## Step 1: Find your 2.x data

- **2.x desktop app:** the folder is

  | System | 2.x data folder |
  | --- | --- |
  | Windows | `%APPDATA%\com.aloglu.inkubator` |
  | macOS | `~/Library/Application Support/com.aloglu.inkubator` |
  | Linux | `~/.local/share/com.aloglu.inkubator` |

- **2.x Docker:** the folder you gave the container as `/data`.
- **Only a 2.x backup `.zip`:** unzip it. Use the folder that contains
  `data.json`.

Close the 2.x app first, so nothing changes while the import reads it.

## Step 2: Import

The import fills a **new, empty** Inkubator 3 data folder. Do it before you add
anything in 3.

### Without Docker

Download Inkubator 3 (see [Without Docker](without-docker.md), steps 1 and 2),
then run, with your 2.x folder:

```bash
./inkubator import-v2 "/path/to/your/2.x/folder"
```

(On Windows: `.\inkubator.exe import-v2 "C:\Users\you\AppData\Roaming\com.aloglu.inkubator"`.)

Then continue with [setting a password](without-docker.md#step-3-set-your-password-once)
and starting Inkubator.

### Docker (Compose)

Set Inkubator up as in the [Docker guide](docker.md) up to step 3, but **do not
start it yet**. Then, in the folder with `compose.yml`, run the import with your
2.x folder:

```bash
docker compose run --rm -v "/path/to/your/2.x/folder:/import:ro" inkubator import-v2 /import
```

When it reports what it imported, start Inkubator with `docker compose up -d`.

If you already started it once, that is fine as long as you have not added
anything: stop it (`docker compose down`), delete `inkubator-data/inkubator.json`,
and run the import.

### Unraid

1. Put a copy of your 2.x data folder on the server, for example in
   `/mnt/user/appdata/inkubator-2x`.
2. Open the Unraid terminal and run:

   ```bash
   docker run --rm -e PUID=99 -e PGID=100 \
     -v /mnt/user/appdata/inkubator:/data \
     -v /mnt/user/appdata/inkubator-2x:/import:ro \
     ghcr.io/aloglu/inkubator:latest import-v2 /import
   ```

3. Then add the Inkubator container as in the [Unraid guide](unraid.md).

## Step 3: Check

Open Inkubator and look through your pens, inks and swatches. When everything
is there, you can uninstall 2.x. Keep the 2.x folder (or a 2.x backup) for a
while, just in case.
