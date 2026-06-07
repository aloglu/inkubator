# Docker Deployment

Docker mode serves two surfaces from the same container:

- `/` is the public, read-only showcase.
- `/admin/` is the authenticated management interface.

The container listens on plain HTTP. For anything beyond local testing, put it behind an HTTPS reverse proxy. Do not expose the admin interface over public HTTP because login credentials and session cookies need transport encryption.

## Container

```bash
docker run \
  --name inkubator \
  --restart unless-stopped \
  -p 8080:8080 \
  -e INKUBATOR_ADMIN_USER='admin' \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:latest
```

This exposes Inkubator on the host at `http://YOUR-SERVER-IP:8080`, which works for LAN testing and for reverse proxies running on the same host or another machine.

The `latest` tag tracks the newest published release. If you prefer controlled upgrades, pin a specific release instead, such as `ghcr.io/aloglu/inkubator:2.0.0`.

The first port is the host port. The second port is the container's internal port. If host port `8080` is already occupied, change only the first value:

```bash
-p 8090:8080
```

With that mapping, Inkubator is available on the host at `http://YOUR-SERVER-IP:8090`, and the container still listens internally on `8080`.

If your reverse proxy runs on the same host and you do not want the port reachable from your LAN, bind to localhost instead:

```bash
-p 127.0.0.1:8080:8080
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `INKUBATOR_ADMIN_USER` | `admin` | Username for the Docker admin login |
| `INKUBATOR_ADMIN_PASSWORD` | none | Password for the Docker admin login |
| `INKUBATOR_DATA_DIR` | `/data` | Container path for app data, preferences, images, and backups |
| `INKUBATOR_EXPORT_DIR` | `/data/exports` | Container path for generated exports |
| `INKUBATOR_PORT` / `PORT` | `8080` | Internal HTTP port used by the Node server |

Most users should leave the internal port at `8080` and only change the host-side port mapping.

## Docker Compose

```yaml
services:
  inkubator:
    image: ghcr.io/aloglu/inkubator:latest
    container_name: inkubator
    restart: unless-stopped
    ports:
      - "${INKUBATOR_HOST_PORT:-8080}:8080"
    environment:
      INKUBATOR_ADMIN_USER: ${INKUBATOR_ADMIN_USER:-admin}
      INKUBATOR_ADMIN_PASSWORD: ${INKUBATOR_ADMIN_PASSWORD:-change-this-password}
      INKUBATOR_DATA_DIR: /data
    volumes:
      - ./inkubator-data:/data
```

Example `.env` file for Docker Compose:

```dotenv
INKUBATOR_HOST_PORT=8090
INKUBATOR_ADMIN_USER=your-username
INKUBATOR_ADMIN_PASSWORD=your-password
```

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
7. Export a full backup and confirm the browser downloads a `.zip`.
8. Log out and confirm `/admin/` requires login again.

## Data And Backups

Keep the `/data` mount stable across upgrades. It contains app data, preferences, images, automated backups, and export output. Updating the container should not replace this directory.

Manual full backups download as ZIP files through the browser. Automated backups remain inside `/data/backups/auto`.

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
