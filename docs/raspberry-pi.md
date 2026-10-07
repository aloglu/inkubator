# Running Inkubator on a Raspberry Pi

A Raspberry Pi makes a good always-on home for Inkubator: it uses little power
and you can reach it from your phone at any time.

## What you need

- A Raspberry Pi 3, 4 or 5 (a Pi 4 or 5 with 2 GB of memory or more is
  comfortable).
- **Raspberry Pi OS (64-bit)**. Inkubator runs on 64-bit ARM (`arm64`); the
  older 32-bit system will not run it. If you are setting up a new card, choose
  "Raspberry Pi OS (64-bit)" in Raspberry Pi Imager. To check an existing
  system, run `uname -m`: it must say `aarch64`.
- The Pi connected to your home network, and a way to type commands on it:
  directly with a keyboard, or over SSH from another computer
  (`ssh your-user@raspberrypi.local`).

## Step 1: Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
```

Log out and back in (or restart the Pi), then check with `docker compose version`.

## Step 2: Set up Inkubator

```bash
mkdir ~/inkubator
cd ~/inkubator
```

Create `compose.yml`:

```bash
nano compose.yml
```

Paste this, save with **Ctrl+O**, **Enter**, then leave with **Ctrl+X**:

```yaml
services:
  inkubator:
    image: ghcr.io/aloglu/inkubator:latest
    container_name: inkubator
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      INKUBATOR_ADMIN_USER: ${INKUBATOR_ADMIN_USER:-admin}
      INKUBATOR_ADMIN_PASSWORD: "${INKUBATOR_ADMIN_PASSWORD:?Set INKUBATOR_ADMIN_PASSWORD before starting Inkubator}"
      PUID: ${PUID:-1000}
      PGID: ${PGID:-1000}
    volumes:
      - ./inkubator-data:/data
```

(Unlike the general Docker guide, this opens Inkubator to your home network
straight away, which is usually why you put it on a Pi.)

Then create `.env` for your password the same way (`nano .env`):

```dotenv
INKUBATOR_ADMIN_PASSWORD=choose-a-long-password-of-your-own
```

and make it private:

```bash
chmod 600 .env
```

Check your user's numbers with `id`. If they are not `1000`, add
`PUID=` and `PGID=` lines with your numbers to `.env`.

## Step 3: Start it

```bash
docker compose up -d
```

After the download, open `http://raspberrypi.local:8080` from any device at
home (or the Pi's address, which `hostname -I` shows, such as
`http://192.168.1.30:8080`). Sign in with `admin` and your password.

It starts again by itself whenever the Pi restarts.

## Good to know

- **Storage:** photos and backups add up. A good SD card works, but a USB SSD
  is faster and lasts longer. Either way, keep backups somewhere else too (see
  [Backups](backups.md)).
- **Updating:** `cd ~/inkubator && docker compose pull && docker compose up -d`.
  See [Updating](updating.md).
- **Away from home:** see [Remote access](remote-access.md). Tailscale works
  well on a Pi.
