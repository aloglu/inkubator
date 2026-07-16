# Inkubator 2.1 Release Baseline

Measured on 2026-07-02. These numbers are local development baselines, not production latency targets.

## Environment

- Linux 7.0.9 x86_64
- Node.js 25.9.0 and npm 11.12.1
- Rust/Cargo 1.95.0
- Chromium 148.0.7778.178
- Docker CLI unavailable

## Correctness Baseline

- All first-party JavaScript files pass `node --check`.
- `npm test`: 35 passed, 0 failed.
- `cargo test`: 8 passed, 0 failed.
- `cargo check`: passed.
- Linux release build: passed.
- Node-hosted Docker mode public, login, authenticated admin, health, Brotli, and conditional-cache routes: passed.
- Public and admin Chromium reloads reported 0 runtime errors.

## Package Sizes

- Release executable: 32 MiB.
- Debian package: 23 MiB.
- RPM package: 23 MiB.
- Bundled frontend directory: 9.2 MiB.
- HEIC assets: 1.5 MiB.

## Core Frontend Transfer Sizes

| Asset | Raw | Gzip | Brotli |
| --- | ---: | ---: | ---: |
| `index.html` | 113,025 B | 13,237 B | 10,659 B |
| `style.css` | 139,363 B | 21,936 B | 18,103 B |
| `renderer.js` | 461,004 B | 87,398 B | 67,997 B |
| `docker-api.js` | 10,394 B | 2,806 B | 2,470 B |
| `heic-converter.js` | 4,373 B | 1,344 B | 1,149 B |
| `theme-boot.js` | 1,108 B | 458 B | 360 B |

## Empty-Collection Browser Baseline

Measured with cache disabled against the local Node-hosted Docker mode.

| Page | Load | Resources | Transferred | Decoded | DOM elements | Runtime errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Public | 42 ms | 15 | 865,362 B | 1,444,000 B | 1,207 | 0 |
| Admin | 40 ms | 19 | 870,228 B | 1,456,899 B | 1,209 | 0 |

- Empty admin JavaScript heap used: 2.08 MiB.
- Local public HTML response: about 12 ms total.
- Local Brotli `renderer.js` response: about 10 ms total.
- Matching Brotli conditional request: `304`, 0 B, under 1 ms.

## Findings For Later 2.1 Steps

- The first uncached load is dominated by static identity assets rather than application code: the ICO favicon transfers about 370 KiB, the Phosphor font about 147 KiB, and the transparent logo about 112 KiB.
- `renderer.js` and `style.css` are large source files, but their Brotli transfer sizes are not current release blockers. Their structure should be reconsidered during the later duplication/refactoring audit, not before feature work.
- The browser measurements use an empty collection and localhost. The 1,000-image scale phase must compare load time, heap, DOM size, image requests, backup size, and import/export behavior against this baseline.
