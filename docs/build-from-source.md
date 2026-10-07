# Building from source

For people who want to change Inkubator or build it themselves.

## What it is made of

| Part | Folder | Language |
| --- | --- | --- |
| Core: the collection, storage, photos, backups, import | `crates/core` | Rust |
| Server: the `inkubator` program and its web API | `crates/server` | Rust |
| Web interface | `web` | Svelte 5, TypeScript, Vite |

The program has the web interface built into it: `crates/server` embeds
`web/dist` when it is compiled.

## Requirements

- Rust (the version in `rust-toolchain.toml` is installed automatically by
  [rustup](https://rustup.rs)) and a C compiler (for the photo and HTTPS
  libraries).
- Node.js 24 or later (`web/.nvmrc`).

## Build the program

```bash
cd web
npm ci
npm run build
cd ..
cargo build --release -p inkubator-server
```

The program is `target/release/inkubator`. Build the web interface first;
otherwise the program starts but says it was built without its interface.

## Build the Docker image

```bash
docker build -t inkubator:local .
docker/smoke-test.sh inkubator:local
```

The smoke test runs the image through its whole life and cleans up after
itself.

## Develop

Run the server on a scratch data folder, and the web interface with live
reloading:

```bash
INKUBATOR_DATA_DIR=/tmp/inkubator-dev INKUBATOR_ADMIN_PASSWORD=dev PORT=18080 \
  cargo run -p inkubator-server
```

```bash
cd web
npm run dev
```

Open the address Vite prints (`http://localhost:5173`). It forwards API calls
to the server on port 18080. In development, a page of all shared components is
at `/_components`.

## Checks

```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

cd web
npm test
npm run check
npm run build
```

The TypeScript types in `web/src/lib/types` are generated from the Rust model.
After changing the model, run `npm run types` in `web/` and commit the result.

## Releases

`.github/workflows/release.yml` builds and tests everything. On a version tag
(`v3.0.0`) it also publishes the Docker images for amd64 and arm64 and drafts
a GitHub release with the programs for Linux, macOS and Windows. The version in
`crates/server/Cargo.toml` and `web/package.json` must match the tag.
