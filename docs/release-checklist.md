# Release Checklist

Use this checklist before creating a release tag. Version-consistency tests catch
mismatched files, but determining whether a tool or dependency is still current
requires an explicit review.

## Runtime And Dependency Review

1. Check the official Node.js release schedule. Confirm that `.nvmrc` pins a
   supported LTS release and that the Docker base image uses the same version.
2. Check the latest stable Rust release and compare it with
   `rust-toolchain.toml` and the desktop build workflow. Update the pinned
   toolchain only after verifying the complete application.
3. Run `npm outdated` and `npm audit`. Review Tauri CLI and API release notes
   before accepting their updates.
4. Run `cargo update --dry-run --manifest-path src-tauri/Cargo.toml` and
   `cargo audit --file src-tauri/Cargo.lock`. Review new major versions and
   security advisories rather than relying only on compatible lockfile updates.
5. Review the pinned major versions of actions in `.github/workflows` against
   their current stable releases.
6. Record any intentionally deferred upgrade and its reason in the local
   changelog or engineering plan.

## Release Verification

1. Start from a clean `npm ci` installation using the Node version in `.nvmrc`.
2. Run `npm run verify`.
3. Build and inspect the intended desktop packages and Docker image.
4. On Arch Linux, confirm that `makepkg -si` accepts the regular `nodejs`
   package without requesting a provider replacement.
5. Confirm application versions with `npm run check:version`, then create the
   tag only after the source and release notes are final.
