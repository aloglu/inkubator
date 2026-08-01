# Unraid Deployment

Inkubator can run as a custom container managed by Unraid's Docker WebGUI. This
uses Unraid's native port, path, and environment-variable mappings rather than
Docker Compose.

The published Inkubator image currently targets `linux/amd64`, which matches
standard Unraid systems.

## Add The Container

1. Make sure the Unraid array is started and Docker is enabled.
2. Open **Docker**, select **Add Container**, and enter these settings:

   | Field | Value |
   | --- | --- |
   | Name | `Inkubator` |
   | Repository | `ghcr.io/aloglu/inkubator:latest` |
   | Network Type | `Bridge` |
   | Privileged | `Off` |
   | WebUI | `http://[IP]:[PORT:8080]/admin/` |

   The WebUI field may require **Advanced View**. Its `8080` value refers to
   the container port; Unraid substitutes whichever host port is mapped to it.

3. Select **Add another Path, Port, Variable, Label or Device** and add a TCP
   port mapping:

   | Field | Value |
   | --- | --- |
   | Name | `Inkubator Web` |
   | Container Port | `8080` |
   | Host Port | `8080`, or another unused host port |
   | Connection Type | `TCP` |

   Change only the host port when avoiding a conflict. The container port must
   remain `8080`.

4. Add a read/write path mapping:

   | Field | Value |
   | --- | --- |
   | Name | `Inkubator Data` |
   | Container Path | `/data` |
   | Host Path | `/mnt/user/appdata/inkubator` |
   | Access Mode | `Read/Write` |

   This mapping preserves the collection, images, preferences, and automated
   backups when the container is updated or recreated.

5. Add the required environment variables:

   | Name | Key | Value |
   | --- | --- | --- |
   | Admin Username | `INKUBATOR_ADMIN_USER` | Your chosen username, such as `admin` |
   | Admin Password | `INKUBATOR_ADMIN_PASSWORD` | A long, unique password |

   `PORT` and `INKUBATOR_DATA_DIR` do not need to be added. The image already
   defaults to internal port `8080` and data path `/data`.

6. Select **Apply** or **Create** and wait for Unraid to download and start the
   image. Enable **Auto-Start** from the Docker tab if Inkubator should start
   with the array.

Unraid documents these port, path, variable, creation, and Auto-Start controls
in its [container management guide](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).

## Open Inkubator

Using host port `8080`:

- Public showcase: `http://UNRAID-IP:8080/`
- Admin interface: `http://UNRAID-IP:8080/admin/`

Replace `UNRAID-IP` and the port with the values used by your server. The WebUI
action on Unraid's Docker tab opens the admin interface when configured as
shown above.

## Data And Updates

Keep `/mnt/user/appdata/inkubator` mapped to `/data` whenever the container is
updated or recreated. Unraid recommends its appdata share for persistent
container files; its [Docker overview](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/)
explains how container configuration and appdata are retained.

The `latest` image tag follows the newest Inkubator release. For controlled
updates, replace it with a release tag such as
`ghcr.io/aloglu/inkubator:2.1.0`. Export a full Inkubator backup before an
update, then use Unraid's normal container update controls.

## Security

Bridge networking makes the mapped host port reachable from the local network.
The `/` route is intentionally a public showcase; `/admin/` requires the
configured credentials.

Do not forward the port directly from an internet router. Use an HTTPS reverse
proxy or private remote-access network when Inkubator must be available outside
a trusted LAN. Keep **Privileged** off, do not mount the Docker socket, and do
not add unrelated host-path mappings.

The current image runs its process as root inside the container to avoid
bind-mount permission failures. Keep its read/write host access limited to the
dedicated Inkubator appdata directory.

## Troubleshooting

- If downloading the image fails with a `ghcr.io` `denied: denied` error,
  Unraid may have outdated saved credentials for GitHub Container Registry.
  Open Unraid's terminal, run `docker logout ghcr.io`, and retry **Apply** or
  **Create**. This is not part of a normal installation. It removes saved GHCR
  credentials, so users of private GHCR images may need to sign in again.
- If the container does not start, open its **Logs** from the Docker tab and
  confirm that an admin password was provided.
- If the page does not load, confirm that the selected host port is unused and
  maps to container port `8080`.
- If collection data does not survive recreation, confirm that the host
  appdata path maps to `/data` with read/write access.
