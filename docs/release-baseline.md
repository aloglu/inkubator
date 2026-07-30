# Inkubator 2.1 Initial Release Baseline

Measured on 2026-07-02 before the final 2.1 verification work. These historical
numbers are local development baselines, not production latency targets.

## Final Verification Update

Final local verification on 2026-07-30 used Node.js 24.18.0, npm 11.12.1,
Rust/Cargo 1.97.1, and Chromium 150. It passed 96 Node tests, the complete
renderer workflow suite, Rust formatting, Cargo check, strict Clippy checks,
and 88 Rust tests. A clean `npm ci` reproduced the dependency tree.

`npm audit` reported 0 vulnerabilities and `npm outdated` reported no outdated
direct dependencies. `cargo audit` reported no vulnerable crates and 18
allowed upstream warnings: 17 unmaintained transitive crates and the tracked
`glib::VariantStrIter` unsoundness warning. Inkubator does not directly use
that API; the warnings are inherited through Tauri's Linux GTK3/WebKit stack,
Tauri utilities, and image-processing dependencies.

Fresh 2.1.0 Linux DEB and RPM packages were built and inspected. Both are
23 MiB, include the expected executable, desktop entry, frontend files, and
icons, and the rebuilt executable launched and reopened valid isolated data.
The Docker server passed its local release-metadata, privacy, backup, and route
checks. The local environment has no Docker CLI, so container-image production
remains covered by the tagged GitHub workflow.

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

## Initial Findings And Resolution

- The first uncached load was dominated by static identity assets rather than application code: the ICO favicon transferred about 370 KiB, the Phosphor font about 147 KiB, and the transparent logo about 112 KiB. This remains optional post-release asset optimization rather than a 2.1 blocker.
- `renderer.js` and `style.css` were large but reasonably compressed. The completed duplication and refactoring audit found no broad rewrite justified before 2.1; future organization should remain incremental and behavior-covered.
- The completed [1,000-image scale test](scale-test.md) found rendering, lazy loading, gallery navigation, and browser memory acceptable at the expected boundary. It also identified backup transport and thumbnail-restoration problems that were remediated and retested before release.
