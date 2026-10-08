# Reaching Inkubator from outside your home

At home, Inkubator is reached by an address like `http://192.168.1.20:8080`.
That works only inside your home network, and it is plain HTTP: fine on your
own Wi-Fi, but not something to open to the internet.

**Never forward Inkubator's port on your router.** Your password would travel
unencrypted, and anyone on the internet could try to guess it.

Below are three safe ways, from easiest to most involved. All three also give
Inkubator an `https://` address, which is what lets you
[install it as an app](using-inkubator.md#installing-it-as-an-app) on a phone.

## Tailscale: just for you (easiest)

[Tailscale](https://tailscale.com) connects your own devices in a private,
encrypted network. Inkubator stays invisible to everyone else. It is free for
personal use.

1. Install Tailscale on the computer or server running Inkubator and on your
   phone, and sign in to the same account on both. (Unraid and Synology have
   Tailscale apps; on a Raspberry Pi follow
   [Tailscale's Linux instructions](https://tailscale.com/download/linux).)
2. On the computer running Inkubator, give it an HTTPS address:

   ```bash
   tailscale serve --bg 8080
   ```

   (If you changed Inkubator's port, use that number.) Tailscale prints an
   address like `https://your-server.your-tailnet.ts.net`.
3. Open that address on your phone. It works at home and away, as long as
   Tailscale is on.

This keeps Inkubator private: even if you let visitors see your collection,
only your own devices can reach it.

## Cloudflare Tunnel: a public address without opening your router

If you want others to see [your collection](using-inkubator.md#letting-visitors-see-your-collection)
at an address such as `https://pens.example.com`, a Cloudflare Tunnel
publishes Inkubator without opening any port at home. You need a domain name
managed by Cloudflare.

1. In the Cloudflare dashboard, go to **Zero Trust → Networks → Tunnels** and
   create a tunnel. Follow its instructions to install `cloudflared` on the
   machine running Inkubator.
2. Add a **public hostname** (for example `pens.example.com`) pointing to
   `http://localhost:8080`.
3. Open `https://pens.example.com`.

## Your own reverse proxy

If you already run a web server such as Caddy or nginx with a domain name, put
Inkubator behind it. With [Caddy](https://caddyserver.com), which gets HTTPS
certificates by itself, this is the whole configuration:

```caddyfile
pens.example.com {
  reverse_proxy localhost:8080
}
```

Use the address of the machine running Inkubator instead of `localhost` if
Caddy runs elsewhere. Inkubator recognises HTTPS behind a proxy that sends the
usual `X-Forwarded-Proto` header, and then marks its sign-in cookie as secure.

## Whichever way you choose

- Use a long password of your own.
- Repeated wrong passwords from one address are refused for 15 minutes.
- Keep backups (see [Backups](backups.md)).
