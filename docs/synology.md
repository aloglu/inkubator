# Running Inkubator on a Synology NAS

On a Synology NAS, Inkubator runs in **Container Manager**, Synology's Docker
app. These steps are for DSM 7.2 or later. Inkubator runs on both Intel/AMD and
ARM (arm64) Synology models; older 32-bit ARM models are not supported.

## Step 1: Install Container Manager

Open **Package Center**, search for **Container Manager**, and install it.

## Step 2: Make a folder

Open **File Station**. In the `docker` shared folder (Container Manager creates
it), make a folder called `inkubator`, and inside it another folder called
`data`.

## Step 3: Find the user and group IDs

Inkubator should run as a regular user who owns the `data` folder. The simplest
way to find your user's numbers:

1. Open **Control Panel → Terminal & SNMP** and turn on **SSH** for a moment.
2. Connect with an SSH program (on Windows: PowerShell; on macOS: Terminal):
   `ssh your-user@your-nas`, and run `id`.
3. Note the numbers after `uid=` and `gid=` (often `1026` and `100`), then
   turn SSH off again if you do not use it.

## Step 4: Create the project

1. Open **Container Manager → Project → Create**.
2. **Project name:** `inkubator`. **Path:** the `docker/inkubator` folder.
3. **Source:** *Create docker-compose.yml*, and paste this, putting in your own
   password and the numbers from step 3:

   ```yaml
   services:
     inkubator:
       image: ghcr.io/aloglu/inkubator:latest
       container_name: inkubator
       restart: unless-stopped
       ports:
         - "8080:8080"
       environment:
         INKUBATOR_ADMIN_USER: admin
         INKUBATOR_ADMIN_PASSWORD: "choose-a-long-password-of-your-own"
         PUID: 1026
         PGID: 100
       volumes:
         - ./data:/data
   ```

4. Click **Next** until **Done**. Container Manager downloads Inkubator and
   starts it.

If port 8080 is already in use on the NAS, change the first number, for
example `"8090:8080"`.

## Step 5: Open Inkubator

Open `http://YOUR-NAS:8080` in your browser (your NAS's address, for example
`http://192.168.1.10:8080`, or the name you use for it). Sign in with `admin`
and the password from the project.

Synology's firewall, if you turned it on, must allow port 8080 from your home
network (**Control Panel → Security → Firewall**).

## Updating

The most reliable way is two commands over SSH (see step 3 for turning SSH on):

```bash
cd /volume1/docker/inkubator
sudo docker compose pull && sudo docker compose up -d
```

The first downloads the new version, the second restarts Inkubator with it.
Your data in `docker/inkubator/data` is kept. (Container Manager can also do
this from its **Project** and **Image** screens, but the menus differ between
DSM versions.) See [Updating](updating.md).

## Next

- [Using Inkubator](using-inkubator.md): from your phone, installing it as an
  app.
- [Backups](backups.md): Hyper Backup can include the `docker/inkubator` folder
  too.
- [Remote access](remote-access.md): reaching it from outside your home safely.
