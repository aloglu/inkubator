# Inkubator

Inkubator helps you organize your fountain pens, inks, and swatches in one place.

This repository starts with an empty library (`data.json`) so every user can begin fresh.

It is designed so you can:

- Keep your collection tidy
- Find things quickly with search, sort, and filters
- Track what is currently inked
- Save swatches with notes and photos
- Share your collection as a clean public website

## Details

### General

- Add pens, inks, and swatches with photos
- Store details like nib size, filling system, color, flow, sheen, shimmer, and more
- Keep notes for each item

### Track what pen is inked

- Link pens and inks
- See your "Currently Inked" section at a glance
- Open detailed cards to review each item

## Use swatches in a practical way

- Link swatches to inks
- Keep standalone swatches if needed
- Add context like paper, nib, lighting, date, and observations

### Browse comfortably on desktop and mobile

- Keyboard navigation on desktop
- Swipe navigation on mobile
- Filters and detail views adapted for smaller screens

### Keep your data safe

- Automatic backups while you use the app
- Manual backup export/import when you want extra control

### Publish your collection

- Use the built-in static showcase mode
- Host online so others can view your collection (read-only)

## Typical User Workflow

1. Add your pens and inks
2. Upload photos (optional but recommended)
3. Mark pens as currently inked
4. Add swatches for your favorite inks
5. Use filters to explore your collection
6. Publish the showcase when you want to share

## Unsigned App Notice

Current releases are unsigned.

That means you may see security warnings:

- Windows: "Unknown publisher"
- macOS: app blocked on first open

If this happens:

- Windows: click **More info** -> **Run anyway**
- macOS: right-click app -> **Open** (or allow in System Settings > Privacy & Security)

## For Developers
### Desktop App

Use this for adding/editing your library, uploads, backups, and management.

```bash
npm install
npm start
```

### Web Showcase

Use this to preview or publish the public-facing website.

```bash
npm run showcase
```

## License

Released under the [MIT License](https://github.com/aloglu/inkubator/blob/main/LICENSE).