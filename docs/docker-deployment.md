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
  -p 127.0.0.1:8080:8080 \
  -e INKUBATOR_ADMIN_USER=admin \
  -e INKUBATOR_ADMIN_PASSWORD='change-this-password' \
  -v "$PWD/inkubator-data:/data" \
  ghcr.io/aloglu/inkubator:2.0
```

Binding to `127.0.0.1` keeps the container reachable only from the host machine. Your reverse proxy can still reach it locally, but the container port is not directly exposed to the network.

## Docker Compose

```yaml
services:
  inkubator:
    image: ghcr.io/aloglu/inkubator:2.0
    container_name: inkubator
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    environment:
      INKUBATOR_ADMIN_USER: admin
      INKUBATOR_ADMIN_PASSWORD: change-this-password
      INKUBATOR_DATA_DIR: /data
    volumes:
      - ./inkubator-data:/data
```

## Caddy Example

```caddyfile
inkubator.example.com {
  reverse_proxy 127.0.0.1:8080
}
```

## Nginx Example

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
docker pull ghcr.io/aloglu/inkubator:2.0
docker stop inkubator
docker rm inkubator
# Re-run the original docker run command with the same /data mount.
```

For Docker Compose:

```bash
docker compose pull
docker compose up -d
```
