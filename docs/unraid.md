# Running Inkubator on Unraid

Unraid runs Inkubator as a Docker container that you add through its web
interface. No terminal is needed.

## Add the container

1. Make sure the array is started and Docker is enabled (**Settings → Docker**).
2. Open the **Docker** tab and click **Add Container**.
3. Fill in the top of the form:

   | Field | Value |
   | --- | --- |
   | Name | `Inkubator` |
   | Repository | `ghcr.io/aloglu/inkubator:latest` |
   | Network Type | `Bridge` |
   | Privileged | Off |
   | Icon URL | `https://raw.githubusercontent.com/aloglu/inkubator/main/web/public/icons/icon-512.png` |
   | WebUI | `http://[IP]:[PORT:8080]/` |

   **Icon URL** and **WebUI** appear after switching to **Advanced View** (top
   right). The icon is what the Docker tab and the dashboard show for
   Inkubator; WebUI adds an "Open WebUI" entry to the container's menu.

4. Click **Add another Path, Port, Variable, Label or Device** and add a
   **Port**:

   | Field | Value |
   | --- | --- |
   | Name | `Web` |
   | Container Port | `8080` |
   | Host Port | `8080` (or any free port) |
   | Connection Type | `TCP` |

   If 8080 is already used by another container, change only the **Host
   Port**, for example to `8090`.

5. Add a **Path** for your collection:

   | Field | Value |
   | --- | --- |
   | Name | `Data` |
   | Container Path | `/data` |
   | Host Path | `/mnt/user/appdata/inkubator` |
   | Access Mode | `Read/Write` |

   Everything Inkubator keeps (your collection, photos and automatic backups)
   lives in this folder, so it survives updates.

6. Add four **Variables**:

   | Name | Key | Value |
   | --- | --- | --- |
   | Password | `INKUBATOR_ADMIN_PASSWORD` | A long password of your own |
   | User name | `INKUBATOR_ADMIN_USER` | `admin`, or a name you like |
   | User ID | `PUID` | `99` |
   | Group ID | `PGID` | `100` |

   `99` and `100` are Unraid's usual `nobody` user and `users` group, so the
   files stay accessible from your shares. Inkubator never runs as root.

7. Click **Apply**. Unraid downloads Inkubator and starts it. Turn on
   **Autostart** for the container so it starts with the array.

## Open Inkubator

Click the Inkubator icon on the Docker tab and choose **WebUI**, or open
`http://YOUR-SERVER:8080` in your browser (with your server's address or name,
for example `http://tower.local:8080`). Sign in with the user name and password
you set.

The Docker tab shows the container as **healthy** once it is ready; Inkubator
checks itself every 30 seconds.

From your phone, open the same address while on your home Wi-Fi. See
[Using Inkubator](using-inkubator.md) for installing it as an app.

## Updating

When a new version is out, the Docker tab shows **update ready** next to
Inkubator. Click it (or **Check for Updates**, then **Apply Update**). Your data
in `/mnt/user/appdata/inkubator` is kept. See [Updating](updating.md).

To stay on one version instead, change **Repository** to a version number, for
example `ghcr.io/aloglu/inkubator:3.0.0`.

## Backups

Inkubator makes its own automatic backups inside the appdata folder (see
[Backups](backups.md)). If you use the Appdata Backup plugin, it also covers
Inkubator's folder.

## Safety

The port is reachable from your home network, which is what makes phone access
work. Do not forward it on your router; to reach Inkubator from outside, see
[Remote access](remote-access.md). Keep **Privileged** off and do not give the
container other folders.

## Problems

- **"denied" while downloading:** Unraid may have old saved credentials for
  GitHub's registry. Open the Unraid terminal, run `docker logout ghcr.io`,
  then click **Apply** again.
- **The container stops right away:** open its **Logs**. The most common cause
  is a missing `INKUBATOR_ADMIN_PASSWORD` variable.
- **The page does not open:** check that the host port is free and points to
  container port `8080`.

More in [Troubleshooting](troubleshooting.md).
