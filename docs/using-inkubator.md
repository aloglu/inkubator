# Using Inkubator

## Opening it

Open Inkubator's address in any modern browser (Chrome, Edge, Firefox,
Safari):

- On the computer running it: `http://localhost:8080`
- From another device at home: the computer's address, such as
  `http://192.168.1.20:8080` (your setup guide shows how to find it)

Sign in with your user name (`admin` unless you chose another) and password.
You stay signed in for a week on each device.

## Installing it as an app

Browsers can install Inkubator so it opens in its own window with its own
icon, like an app.

| Where | How |
| --- | --- |
| Chrome or Edge on a computer | Click the install icon at the right end of the address bar, or menu → **Install Inkubator** (Edge: **Apps → Install this site as an app**) |
| Safari on a Mac | **File → Add to Dock** |
| iPhone or iPad | Safari's **Share** button → **Add to Home Screen** |
| Android | Chrome's menu → **Install app** or **Add to Home screen** |

**One limit:** browsers only offer a real install for addresses that are
`localhost` or start with `https://`. When you reach Inkubator at home by an
address like `http://192.168.1.20:8080`, it works fully in the browser, and
iPhone's **Add to Home Screen** still works, but Chrome and Android may only
offer a plain shortcut. To install it properly on a phone, give Inkubator an
HTTPS address; [Remote access](remote-access.md) shows the easiest ways
(Tailscale takes a few minutes).

## On your phone

Inkubator adapts to small screens: the tabs along the bottom are the Desk,
Pens, Inks, Swatches and More (which has Stats, Activity and Settings). **Ink a
pen** is at the top of the Desk, and on each pen's page.

## Letting visitors see your collection

Inkubator can also show your collection to people who are not signed in,
read-only. This is **off** until you turn it on:

1. Open **Settings → Visitors** and switch on **Let visitors see the
   collection**.
2. Choose what visitors see: pens, inks, swatches, prices, notes, stats,
   charts and activity, and how each list is sorted.

Visitors who open your address then see the same screens as you, without any
way to change anything, and only what you allowed. They can never see:

- notes you have not marked "Show to visitors" (each pen, ink and swatch has
  its own switch, and **Notes** under Settings → Visitors turns all of them
  off at once),
- where you bought a pen, or prices when **Prices** is off,
- notes on inkings,
- your settings.

While this is off, anyone who is not signed in only sees the sign-in page.

Letting visitors in is mostly useful when Inkubator has an address others can reach;
see [Remote access](remote-access.md).

## Changing your password

- **Docker:** change `INKUBATOR_ADMIN_PASSWORD` (in `.env`, or in Unraid's
  container settings) and restart the container.
- **Without Docker:** stop Inkubator, run `inkubator set-password` again, and
  start it.

Everyone who was signed in has to sign in again after a restart.

If too many wrong passwords are tried from one place, Inkubator refuses that
address for 15 minutes.
