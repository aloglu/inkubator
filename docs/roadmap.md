# Roadmap Notes

## 2.1 Work Order

1. **Complete:** Establish baseline tests, builds, smoke checks, and performance measurements without broad cleanup.
2. **Complete:** Add a collection-scale test around roughly 1,000 total pen and swatch images, including multi-image items, backup import/export, and thumbnail behavior.
3. **Complete:** Remediate backup scalability with binary Docker uploads, streamed ZIP processing, atomic staged restoration, bounded archive limits, and thumbnail regeneration.
4. **Complete:** Align Docker automated-backup frequency and retention with desktop behavior, while preserving forced import restore snapshots.
5. **Complete:** Replace the desktop manager's collection-wide image data URL cache with scoped direct file URLs and native thumbnail URLs.
6. **Complete:** Profile HEIC/HEIF decode, preview, and conversion stages; replace the full-size PNG intermediate with a bounded WebP handoff and skip redundant Rust re-encoding for HEIC-derived WebP payloads.
7. **Complete:** Move Activity Log filters into a filter side panel consistent with Pens, Inks, and Swatches.
8. **Complete:** Validate fixed-shape pen cards and contained detail images with deliberately horizontal primary images; adaptive orientation was added and confirmed against mixed vertical/horizontal pen galleries.
9. **Complete:** Run scoped correctness, security, persistence, dependency, dead-code, duplication, and refactoring audits without broad behavior changes.
10. **Complete:** Run final end-to-end regression checks for desktop, Docker admin/public, and generated showcase workflows, including backup compatibility, data integrity, keyboard accessibility, and responsive layouts.
11. **Complete locally:** Fresh Linux DEB and RPM packages were built, inspected, and launched successfully. The manual release tag still needs to run the Windows, macOS, Linux, and Docker GitHub workflows before publication.
