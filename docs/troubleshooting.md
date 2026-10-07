# Troubleshooting

First, look at what Inkubator says. It explains most problems in plain words.

- **Docker Compose:** `docker compose logs inkubator` in the folder with
  `compose.yml`.
- **Unraid / Synology:** the container's **Logs**.
- **Without Docker:** the terminal window Inkubator runs in.

## Inkubator does not start

**"No password is set, so Inkubator will not start."**
Docker: add `INKUBATOR_ADMIN_PASSWORD` (in `.env`, or as a variable on
Unraid/Synology). Without Docker: run `inkubator set-password` once.

**"…is still the placeholder from the example."**
Choose your own password instead of `change-this-password`.

**"Could not listen on 0.0.0.0:8080" / "port is already allocated"**
Another program uses port 8080. Docker: set another host port
(`INKUBATOR_HOST_PORT=8090` in `.env`). Without Docker: start with
`--port 8090`. Then use that port in the address.

**"PUID and PGID must be numbers" / "Inkubator does not run as root"**
Set `PUID` and `PGID` to a regular user (run `id` to see yours; on Unraid
`99` and `100`). `0` is root and is refused on purpose.

**"Could not open the data folder" / "Permission denied"**
The data folder belongs to another user. With Docker, check `PUID`/`PGID`:
Inkubator gives the folder to that user when it starts. Without Docker, make
sure your user may write to the folder, or choose another with `--data-dir`.

**macOS: "cannot be opened" / "is damaged"**
See [Without Docker, step 3](without-docker.md#step-3-set-your-password-once).

## The page does not open

- **On the same computer:** check that Inkubator is running and that you use
  the right port (`http://localhost:8080`).
- **From your phone or another computer:**
  - Both must be on the same home network (not on mobile data, not on a guest
    Wi-Fi).
  - Docker Compose: `.env` needs `INKUBATOR_BIND_ADDRESS=0.0.0.0` (then
    `docker compose up -d`).
  - Without Docker: do not use `--host 127.0.0.1`. On Windows, allow Inkubator
    through the firewall on private networks.
  - Use the computer's home-network address (like `192.168.1.20`), not
    `localhost`.
- **Docker shows the container as "unhealthy":** Inkubator did not answer its
  own check. Look at the logs, then restart it.

## Signing in

**"Wrong username or password."**
The user name is `admin` unless you set another (`INKUBATOR_ADMIN_USER`, or
`--user` with `set-password`). Passwords are case-sensitive.

**"Too many failed sign-ins. Try again in 15 minutes."**
After 5 wrong passwords, that device is refused for 15 minutes. Wait, or
restart Inkubator.

**Forgot the password:** set a new one (see
[Changing your password](using-inkubator.md#changing-your-password)). Your
collection is not affected.

**"Requests from other sites are not allowed."**
Your browser is on a different address than the one Inkubator receives, which
can happen behind a proxy. Make sure the proxy passes on the original host
name (the `Host` header), or sets `X-Forwarded-Host` to it.

## Visitors see only the sign-in page

The public showcase is off, which is the default. Turn it on in
**Settings → Showcase website**. See [Using Inkubator](using-inkubator.md#the-public-showcase).

## "Install app" is missing on my phone

Browsers offer a real install only for `https://` addresses (and `localhost`).
See [Installing it as an app](using-inkubator.md#installing-it-as-an-app).

## Photos

**"The photo is larger than 25 MB."** Use a smaller photo, or one exported at a
lower size.

**Finding a swatch on inkswatch.com or adding a photo from a link fails.**
The server running Inkubator needs internet access for these. Links must be
`https://` addresses of public pictures.

## Still stuck?

Open an issue on [GitHub](https://github.com/aloglu/inkubator/issues) with what
you did, what you expected, and the messages from the logs. Leave out your
password.
