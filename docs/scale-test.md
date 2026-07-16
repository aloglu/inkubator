# Inkubator 2.1 Collection Scale Test

Measured on 2026-07-02 against the local Node-hosted Docker implementation. Docker itself was unavailable in the test environment.

## Fixture

The deterministic synthetic fixture contains:

- 240 pens: 80 with one image, 80 with three images, and 80 with six images.
- 100 inks and 100 two-image swatches.
- 1,000 unique managed image files and exactly one primary image per pen or swatch.
- 80 currently inked records and 500 activity records.
- 900x1200 pen images and 1200x900 swatch images, matching the app's 1200px post-upload limit.
- 480px thumbnails matching the current thumbnail pipeline.

Storage characteristics:

| Artifact | Size |
| --- | ---: |
| Full managed images | 152,408,770 B (145.3 MiB) |
| Thumbnails | 13,732,150 B (13.1 MiB) |
| Complete fixture | 163 MiB |
| Average full image | 152,409 B |
| Average thumbnail | 13,732 B |
| Collection JSON | 521,649 B |

The fixture can be regenerated with ImageMagick installed:

```bash
node scripts/generate-scale-fixture.mjs /tmp/inkubator-scale-1000 1000
```

## Browser Results

Chromium 148, 1440x1000 viewport, localhost. Timings are development measurements rather than production latency targets.

| Scenario | Navigation | Managed images | Image transfer | Total transfer | JS heap used |
| --- | ---: | ---: | ---: | ---: | ---: |
| Public pens, cold, initial viewport | 125 ms | 20/240 loaded | 319 KiB | 1.18 MiB | 1.80 MiB |
| Public pens, cold, after full scroll | 125 ms | 240/240 loaded | 3.61 MiB | 4.49 MiB | 1.83 MiB |
| Public pens, warm revisit | 87 ms | 240/240 loaded | 58 KiB | 58 KiB | 2.76 MiB |
| Admin pens, cold, after full scroll | 38 ms | 240/240 loaded | 3.61 MiB | 4.49 MiB | 3.65 MiB |
| Admin pens, warm revisit | 18 ms | 240/240 loaded | 58 KiB | 74 KiB | 5.22 MiB |
| Public swatches, 100 cards | 56 ms | 100 backgrounds | 681 KiB | 694 KiB | 3.22 MiB |
| Public inks, 100 cards | 28 ms | no image requests | 0 B | 13 KiB | 3.50 MiB |

Additional observations:

- The pen page creates 4,325 DOM elements for 240 cards. This remains acceptable at the expected collection size.
- Lazy loading initially requests only 20 of the 240 pen thumbnails.
- A six-image pen detail carousel requested all six full images, transferred 1.00 MiB, and correctly hid the next arrow at the final image.
- Warm image revisits issue conditional requests and receive `304` responses. This avoids image-body bandwidth but still creates one request per visible image.
- No runtime errors, failed managed images, or failed HTTP requests were observed.

The browser benchmark is reproducible with:

```bash
node scripts/measure-scale-browser.mjs http://127.0.0.1:18081 /tmp/inkubator-scale-browser.json
```

### Desktop image delivery

The desktop manager previously read every referenced full image, base64-encoded it through Tauri IPC, and retained the resulting strings in JavaScript. It repeated that work after ordinary collection saves. At this fixture size, the 145.3 MiB image set would expand to roughly 193.8 MiB of base64 text before accounting for IPC serialization and JavaScript string storage.

The desktop manager now exposes only validated files beneath its managed image directory through a dedicated read-only media protocol. Grid cards request the 13.1 MiB thumbnail set, while detail and edit views request full images directly as needed. This removes the collection-wide JavaScript image copy, avoids image work after metadata-only saves, and reduces the aggregate grid image payload by about 91% at the 1,000-image boundary.

## Backup Results

The server exported a 152,619,349 B (145.5 MiB) ZIP containing the complete collection and all 1,000 full images in 2.26 seconds.

Three scale problems were found:

1. The Docker import API wraps the ZIP in base64 JSON. The 145.5 MiB ZIP becomes a 203,492,601 B request, which exceeds the default 120 MiB request limit. The default configuration rejects the backup with `Request body is too large.`
2. With the request limit temporarily raised to 300 MiB, the import succeeds in 611 ms and restores all 1,000 images byte-for-byte. Server RSS rises from about 58 MiB to 631 MiB during this buffered import.
3. Backups do not include thumbnails and import does not regenerate them. Immediately after restore, scrolling through 240 pen cards transfers 40.5 MiB of full images instead of 3.61 MiB of thumbnails, an 11.2x increase.

Export also buffers substantial data: server RSS rose from about 81 MiB to 386 MiB and remained there at least five seconds after the response completed.

## Remediation Results

The backup path was retested after replacing base64 JSON transport and in-memory ZIP handling with streamed binary transport, staged extraction, bounded thumbnail generation, and rollback-capable promotion.

| Measurement | Before | After |
| --- | ---: | ---: |
| Docker export time | 2.26 s | 0.68 s |
| Export server RSS after response | 386 MiB | 105 MiB |
| Import request size | 194.1 MiB | 145.8 MiB |
| Import time | failed by default; 0.61 s without thumbnails when limit raised | 9.5 s including 1,000 thumbnails and restore snapshots |
| Import server RSS after response | 631 MiB | 287 MiB |
| First full pen-page image transfer after import | 40.5 MiB | 3.72 MiB |

The remediated import succeeds under default settings, restores all 1,000 original images, creates all 1,000 thumbnails, preserves primary assignments and pre/post restore snapshots, and reports no browser runtime or image-loading errors. The longer successful import time is intentional: thumbnail work now completes before the staged collection replaces live data, so users do not receive a nominally successful restore followed by a bandwidth-heavy first browse.

## Assessment

Rendering, lazy loading, gallery navigation, and browser memory are acceptable for the expected 1,000-image boundary. Client-side virtualization is not justified at this scale.

The original backup handling was not release-ready at this boundary. The remediation above resolves the default import failure, removes base64 expansion, substantially reduces export/import memory, restores thumbnail performance, and protects active data through staged validation and rollback-capable replacement.

## HEIC/HEIF Upload Profile

Measured on 2026-07-10 with synthetic local HEIC fixtures generated by ImageMagick and `heif-enc`, then decoded in Chromium through the app's bundled `libheif-js` path.

The pre-optimization path decoded HEIC to a full-size PNG, base64-encoded that PNG for the save handoff, and then converted the image back to WebP. For a 3024x4032 phone-sized fixture, that created a 21.1 MB PNG and a 28.2 MB base64 string even though the final managed WebP was roughly 166 KB.

The app now converts HEIC pixels directly into the same 1200px WebP size used by the managed-image pipeline. Desktop Rust saves HEIC-derived WebP payloads directly when they are already within the managed-image bound, while still generating the normal thumbnail.

| Scenario | Before | After |
| --- | ---: | ---: |
| 3MP HEIC preview/save handoff | 5.5 MB PNG, 7.3 MB base64 | 132 KB WebP, 176 KB base64 |
| 12MP HEIC preview/save handoff | 21.0 MB PNG, 28.1 MB base64 | 114 KB WebP, 152 KB base64 |
| 12MP warm conversion plus handoff | about 1.36 s before downstream WebP work | about 1.02 s |

This improves HEIC responsiveness modestly and cuts the JavaScript/IPC payload by roughly two orders of magnitude. The remaining dominant cost is the actual HEIC pixel decode in `libheif-js`; moving that decode off the UI thread remains a possible future polish item if real-device testing still feels sluggish.
