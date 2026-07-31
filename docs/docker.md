# Docker Deployment

Docker mode serves two surfaces from the same container:

- `/` is the public, read-only showcase.
- `/admin/` is the authenticated management interface.

The public surface is generated from the showcase visibility settings rather than serving the full admin collection files. Data and managed images that are not required by enabled public views are unavailable from public routes. Hiding inks also hides linked swatches, current-ink relationships, and related activity. The authenticated admin routes continue to use the complete collection.

The container listens on plain HTTP. For anything beyond local testing, put it behind an HTTPS reverse proxy. Do not expose the admin interface over public HTTP because login credentials and session cookies need transport encryption.

## Container

Set the admin password in your shell before starting the container:

```bash
read -rsp "Inkubator admin password: " INKUBATOR_ADMIN_PASSWORD
echo
export INKUBATOR_ADMIN_PASSWORD
```

```bash
docker run \
  --name inkubator \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:latest
```

This exposes Inkubator only at `http://127.0.0.1:8080`, which is the safer default for a reverse proxy running on the same host. The container refuses to start without a password and also rejects the published `change-this-password` placeholder.

The `latest` tag tracks the newest published release. If you prefer controlled upgrades, pin a specific release instead, such as `ghcr.io/aloglu/inkubator:2.1.0`.

The first port after the host address is the host port. The second is the container's internal port. If host port `8080` is already occupied, change only the first port:

```bash
-p 127.0.0.1:8090:8080
```

With that mapping, Inkubator is available on the host at `http://127.0.0.1:8090`, and the container still listens internally on `8080`.

For deliberate LAN access, or for a reverse proxy running on another machine, bind the host port to every interface:

```bash
-p 0.0.0.0:8080:8080
```

Only use the LAN binding on a trusted network or behind a firewall. The container itself serves plain HTTP.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `INKUBATOR_ADMIN_USER` | `admin` | Username for the Docker admin login |
| `INKUBATOR_ADMIN_PASSWORD` | none | Password for the Docker admin login |
| `INKUBATOR_DATA_DIR` | `/data` | Container path for app data, preferences, images, and backups |
| `INKUBATOR_PORT` / `PORT` | `8080` | Internal HTTP port used by the Node server |
| `INKUBATOR_MAX_BACKUP_BYTES` | `1073741824` | Maximum compressed backup upload size (1 GiB) |
| `INKUBATOR_MAX_BACKUP_EXPANDED_BYTES` | `2147483648` | Maximum total extracted backup size (2 GiB) |
| `INKUBATOR_MAX_BACKUP_ENTRIES` | `20000` | Maximum files and directories accepted from a backup |

Most users should leave the internal port and backup safety limits at their defaults and only change the host-side port mapping.

Manual image URLs must point to a supported raster image on a public HTTPS address. Docker mode rejects URL credentials, private or local network destinations, unsafe redirects, unsupported media types, and responses larger than 25 MiB.

## Docker Compose

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
      INKUBATOR_DATA_DIR: /data
    volumes:
      - ./inkubator-data:/data
```

Example `.env` file for Docker Compose:

```dotenv
INKUBATOR_BIND_ADDRESS=127.0.0.1
INKUBATOR_HOST_PORT=8090
INKUBATOR_ADMIN_USER=your-username
INKUBATOR_ADMIN_PASSWORD=your-password
```

Set `INKUBATOR_BIND_ADDRESS=0.0.0.0` only when another machine must reach the container directly.

## Caddy Example

If Caddy runs on the same host as Docker:

```caddyfile
inkubator.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

If Caddy runs on another machine, use the Docker host IP instead:

```caddyfile
inkubator.example.com {
  reverse_proxy YOUR-SERVER-IP:8080
}
```

## Nginx Example

If Nginx runs on the same host as Docker:

```nginx
server {
  listen 443 ssl http2;
  server_name inkubator.example.com;
  client_max_body_size 1g;

  ssl_certificate /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

If Nginx runs on another machine, replace `proxy_pass http://127.0.0.1:8080;` with:

```nginx
proxy_pass http://YOUR-SERVER-IP:8080;
```

## Public-Domain Smoke Test

After DNS and HTTPS are configured:

1. Visit `https://your-domain.example/` and confirm the public showcase loads without login.
2. Confirm the public showcase has no add, edit, delete, import, export, backup, or settings controls.
3. Visit `https://your-domain.example/admin/` and confirm the login modal appears.
4. Log in and confirm Manage changes to Logout.
5. Refresh from Dashboard, Pens, Inks, Swatches, Activity, and Settings; each page should remain on the same section.
6. Add a pen or swatch with an image and confirm it appears on the public showcase after saving.
7. Export a full backup and confirm the browser saves or downloads a `.zip`.
8. Log out and confirm `/admin/` requires login again.

## Caching And Compression

Docker mode sends cache validators for app assets and managed images, supports conditional `304 Not Modified` responses, fingerprints app-shell asset URLs, and compresses text-like responses with Brotli or gzip when the browser supports them. Fingerprinted app-shell assets can be cached immutably. ZIP backups and already-compressed image formats are not compressed.

Authenticated collection images are marked private so shared reverse-proxy caches do not store them. Public showcase images retain public cache validators.

If you place Nginx, Caddy, Cloudflare, or another reverse proxy in front of the container, avoid overriding these response headers unless you are deliberately taking over caching there. For exported static showcase folders, use the same policy on your static host:

- Revalidate `index.html` and `data.js`.
- Compress HTML, CSS, JavaScript, JSON, SVG, and font responses.
- Cache fingerprinted CSS, JavaScript, fonts, and icons immutably; cache collection images with validators.
- Do not cache backup ZIP downloads if you expose any private download route outside Docker.

## Data And Backups

Keep the `/data` mount stable across upgrades. It contains app data, preferences, images, and automated backups. Updating the container should not replace this directory.

Run only one Inkubator container against a given `/data` directory. Save ordering and stale-write protection coordinate operations inside one container; they do not coordinate multiple containers sharing the same mount.

Manual full backups are saved as ZIP files through the browser. When the browser permits direct file saving, it opens a save dialog; otherwise it uses its configured download behavior. Automated backups remain inside `/data/backups/auto`.

Docker backup uploads send ZIP bytes directly rather than encoding the archive inside JSON. The server writes the upload to temporary storage, validates and extracts entries with bounded memory, generates thumbnails, and only then replaces the active collection. Invalid imports and commit failures restore the previous collection. A reverse proxy must permit request bodies at least as large as the backups you intend to restore; the Nginx example above matches Inkubator's default 1 GiB compressed-backup limit.

Docker admin saves and backup imports use collection revisions. If an older admin tab tries to replace data after another tab has saved, the stale operation is rejected and the newer collection remains unchanged.

For restore steps and backup settings, see [Backups And Data Safety](backups.md).

## Updating

For `docker run`:

```bash
docker pull ghcr.io/aloglu/inkubator:latest
docker stop inkubator
docker rm inkubator
# Re-run the original docker run command with the same /data mount.
```

For Docker Compose:

```bash
docker compose pull
docker compose up -d
```
