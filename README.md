# Inkubator

Inkubator keeps track of your fountain pens, inks and swatches: which ink is
in which pen and for how long, every ink with its sheen, shading and swatches,
and photos of it all. It runs on a computer you own (a home server, a NAS, a
Raspberry Pi or your own computer) and you use it in your browser, on the
computer or on your phone. Your collection stays with you; there is no account
and nothing in the cloud.

- **Desk:** the pens that are inked now, how long they have been, and re-inking
  or flushing in two clicks.
- **Inks** on a shelf grouped by color, **pens** with photos, **swatches**, and
  the ink history of every pen.
- **Stats:** your inks across the spectrum, the rotation of the last months,
  and what went where.
- **Activity:** everything that changed, day by day.
- Optionally, **visitors** can see your collection without signing in: the
  same screens, read-only, showing only what you choose.
- Automatic **backups**, light and dark mode, and an app you can install from
  the browser.

## Get started

Read the **[guides](docs/README.md)**: they help you choose a setup and go
through it step by step, also if you have never used Docker.

The quickest start with Docker:

```bash
mkdir inkubator && cd inkubator
curl -fsSLO https://raw.githubusercontent.com/aloglu/inkubator/main/docker-compose.example.yml
mv docker-compose.example.yml compose.yml
echo "INKUBATOR_ADMIN_PASSWORD=choose-a-long-password" > .env
docker compose up -d
```

Then open http://localhost:8080 and sign in as `admin`.

Prefer not to use Docker? Download the program for Windows, macOS or Linux from
the [releases](https://github.com/aloglu/inkubator/releases/latest) and follow
[Without Docker](docs/without-docker.md).

## Coming from 2.x

Inkubator 3 replaces the 2.x desktop app with a single app for the browser.
[Moving from 2.x](docs/moving-from-2x.md) brings your collection over; your 2.x
data is only read, never changed.

## License

[MIT](LICENSE). To read HEIC photos (as iPhones save them), the web interface
includes [libheif](https://github.com/strukturag/libheif) through
[libheif-js](https://github.com/catdad-experiments/libheif-js), under the
LGPL-3.0, unchanged and as a separate file loaded only when needed.
