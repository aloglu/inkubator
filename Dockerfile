# Inkubator: one program with the web interface built in.

# 1. Build the web interface. The TypeScript types generated from the Rust core
#    are committed in web/src/lib/types, so this stage needs no Rust.
FROM node:24-bookworm-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web ./
RUN npm run build

# 2. Build the program, with the interface from step 1 built into it.
FROM rust:1.97.1-bookworm AS build
WORKDIR /src
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY --from=web /web/dist ./web/dist
RUN cargo build --release --locked -p inkubator-server

# 3. The image people run.
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/inkubator /usr/local/bin/inkubator
COPY docker/entrypoint.sh /usr/local/bin/inkubator-entrypoint

ENV PORT=8080 \
    INKUBATOR_DATA_DIR=/data

LABEL org.opencontainers.image.title="Inkubator" \
      org.opencontainers.image.description="Your fountain pens, inks and swatches, in your browser." \
      org.opencontainers.image.source="https://github.com/aloglu/inkubator" \
      org.opencontainers.image.licenses="MIT" \
      net.unraid.docker.icon="https://raw.githubusercontent.com/aloglu/inkubator/main/web/public/icons/icon-512.png" \
      net.unraid.docker.webui="http://[IP]:[PORT:8080]/"

VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["inkubator", "healthcheck"]
# Runs as PUID:PGID (default 1000:1000), never as root. Arguments go to the
# program, e.g. `set-password` or `import-v2 /import`.
ENTRYPOINT ["inkubator-entrypoint"]
