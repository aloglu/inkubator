# Running Inkubator with Docker

This guide sets Inkubator up with Docker on any computer or server: Windows,
macOS or Linux, on a regular PC (amd64) or an ARM machine such as a Raspberry
Pi or an Apple Silicon Mac. If you use Unraid or Synology, their own guides
([Unraid](unraid.md), [Synology](synology.md)) are easier.

## What you will end up with

- Inkubator running in the background, starting again by itself after a
  restart.
- A folder called `inkubator-data` that holds your whole collection: the list
  of pens, inks and swatches, the photos, and the automatic backups. As long as
  you keep this folder, you keep your collection.
- Inkubator open in your browser at `http://localhost:8080`.

## Step 1: Install Docker

- **Windows or macOS:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  and start it. Wait until it says Docker is running.
- **Linux:** follow Docker's guide for your distribution
  ([docs.docker.com/engine/install](https://docs.docker.com/engine/install/)).
  On Debian, Ubuntu and Raspberry Pi OS, the short way is:

  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  ```

  Then log out and back in, so your account may use Docker without `sudo`.

Check that it works. Open a terminal (on Windows: PowerShell; on macOS: the
Terminal app) and run:

```bash
docker compose version
```

You should see a version number. If you see "command not found", Docker is
not installed or not running yet.

## Step 2: Make a folder for Inkubator

Make a folder that will hold Inkubator's settings and data, for example
`inkubator` in your home folder, and open a terminal in it:

```bash
mkdir inkubator
cd inkubator
```

## Step 3: Describe the setup

Create a file called `compose.yml` in that folder with this content (or copy
[`docker-compose.example.yml`](../docker-compose.example.yml) from this
repository):

```yaml
services:
  inkubator:
    image: ghcr.io/aloglu/inkubator:latest
    container_name: inkubator
    restart: unless-stopped
    ports:
      - "${INKUBATOR_BIND_ADDRESS:-127.0.0.1}:${INKUBATOR_HOST_PORT:-8080}:8080"
    environment:
      INKUBATOR_ADMIN_USER: ${INKUBATOR_ADMIN_USER:-admin}
      INKUBATOR_ADMIN_PASSWORD: "${INKUBATOR_ADMIN_PASSWORD:?Set INKUBATOR_ADMIN_PASSWORD before starting Inkubator}"
      PUID: ${PUID:-1000}
      PGID: ${PGID:-1000}
    volumes:
      - ./inkubator-data:/data
```

Then create a second file called `.env` (the name starts with a dot) next to
it. This is where your password lives:

```dotenv
INKUBATOR_ADMIN_USER=admin
INKUBATOR_ADMIN_PASSWORD=choose-a-long-password-of-your-own
```

Use a password you do not use anywhere else. On Linux and macOS, make the file
readable only by you:

```bash
chmod 600 .env
```

**What these lines mean**

- `image` is the Inkubator program Docker downloads.
- `ports` decides who can open Inkubator. `127.0.0.1` means only this computer.
  See [Using Inkubator from your phone](#using-inkubator-from-your-phone) to
  change it.
- `PUID` and `PGID` are the user that owns your data folder. On most Linux
  systems your own user is `1000`; run `id` to check. Inkubator never runs as
  the administrator (root).
- `./inkubator-data:/data` is your collection. Docker creates the folder the
  first time.

## Step 4: Start Inkubator

In the same folder, run:

```bash
docker compose up -d
```

The first time, Docker downloads Inkubator, which takes a moment. When it finishes,
open **http://localhost:8080** in your browser and sign in with the user name
and password from your `.env` file.

To see what Inkubator is doing, run `docker compose logs inkubator`. Docker
also checks on it every 30 seconds: `docker compose ps` shows it as
`(healthy)` when all is well.

## Everyday commands

Run these in the folder with `compose.yml`:

| To | Run |
| --- | --- |
| Stop Inkubator | `docker compose stop` |
| Start it again | `docker compose start` |
| See its messages | `docker compose logs inkubator` |
| Change the password | Edit `.env`, then `docker compose up -d` |
| Update to a new version | See [Updating](updating.md) |

## Using Inkubator from your phone

At first only the computer running Inkubator can open it. To use it from your
phone, tablet or other computers at home:

1. Add this line to `.env`:

   ```dotenv
   INKUBATOR_BIND_ADDRESS=0.0.0.0
   ```

2. Run `docker compose up -d` again.
3. Find your computer's address on your home network. It looks like
   `192.168.1.20`. On Windows run `ipconfig`, on macOS open System Settings →
   Wi-Fi → Details, on Linux run `hostname -I`.
4. On your phone, open `http://192.168.1.20:8080` (with your address).

Your phone must be on the same Wi-Fi. Only do this on a network you trust; to
use Inkubator away from home, see [Remote access](remote-access.md).

## If port 8080 is taken

If another program already uses port 8080, Docker says "port is already
allocated". Choose another port in `.env`:

```dotenv
INKUBATOR_HOST_PORT=8090
```

Run `docker compose up -d` and open `http://localhost:8090` instead. (Only the
first number changes; Inkubator itself keeps using 8080 inside its box.)

## Without Compose

If you prefer a single command, this starts the same setup:

```bash
docker run -d --name inkubator --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_PASSWORD='choose-a-long-password-of-your-own' \
  -e PUID=1000 -e PGID=1000 \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:latest
```

On Windows PowerShell, put the whole command on one line and use
`${PWD}/inkubator-data` for the folder.

## All settings

| Setting | Default | What it does |
| --- | --- | --- |
| `INKUBATOR_ADMIN_PASSWORD` | none (required) | The password you sign in with |
| `INKUBATOR_ADMIN_USER` | `admin` | The user name you sign in with |
| `PUID`, `PGID` | `1000`, `1000` | The user that owns the data folder (Unraid: `99`, `100`). `0` (root) is refused |
| `PORT` | `8080` | The port inside the container. Leave it; change the host port instead |
| `INKUBATOR_DATA_DIR` | `/data` | The folder inside the container. Leave it |

Images are published for regular PCs and servers (`amd64`) and ARM machines
(`arm64`); Docker picks the right one by itself. `latest` is always the newest
release; to stay on one version, use its number instead, such as
`ghcr.io/aloglu/inkubator:3.0.0`.

## Safety

- Inkubator speaks plain HTTP. That is fine at home, but never open it to the
  internet by forwarding a port on your router. To reach it from outside, use
  one of the safe ways in [Remote access](remote-access.md).
- Keep `.env` private, and back up the `inkubator-data` folder (see
  [Backups](backups.md)).
- The container needs nothing special: no privileged mode and no access to
  Docker itself.
