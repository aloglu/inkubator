# Build the server.
FROM rust:1.97.1-bookworm AS build
WORKDIR /src
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates
# The desktop app is a workspace member; Cargo needs its manifest and sources
# to resolve the workspace, but only the server is compiled.
COPY src-tauri/Cargo.toml src-tauri/build.rs ./src-tauri/
COPY src-tauri/src ./src-tauri/src
RUN cargo build --release --locked -p inkubator-server

# Run it.
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/inkubator-server /usr/local/bin/inkubator-server
COPY docker/entrypoint.sh /usr/local/bin/inkubator-entrypoint

ENV PORT=8080 \
    INKUBATOR_DATA_DIR=/data \
    INKUBATOR_WEB_DIR=/app/web

VOLUME ["/data"]
EXPOSE 8080
# Runs the server as PUID:PGID (default 1000:1000), never as root.
ENTRYPOINT ["inkubator-entrypoint"]
