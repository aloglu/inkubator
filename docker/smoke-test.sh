#!/usr/bin/env bash
# Runs an Inkubator image through its life: start, health, sign-in, a change,
# a photo, a backup, restart, ownership of the data, and stopping.
#
#   docker/smoke-test.sh <image>
#
# With PREVIOUS_IMAGE=<older image>, the data is first created by that image,
# then <image> must take it over: the upgrade path. Needs docker, curl and
# python3. Leaves nothing behind.
set -euo pipefail

IMAGE="${1:?Usage: docker/smoke-test.sh <image>}"
PREVIOUS="${PREVIOUS_IMAGE:-}"
PORT="${SMOKE_PORT:-18199}"
PASSWORD="smoke-test-password"
NAME="inkubator-smoke-$$"
DATA="$(mktemp -d)"
JAR="$(mktemp)"
BASE="http://127.0.0.1:$PORT"

cleanup() {
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    # The data belongs to the container's user; remove it from inside a container.
    docker run --rm -v "$DATA:/data" --entrypoint sh "$IMAGE" -c 'rm -rf /data/* /data/.[!.]*' >/dev/null 2>&1 || true
    rm -rf "$DATA" "$JAR"
}
trap cleanup EXIT

step() { printf '\n== %s\n' "$*"; }
fail() { printf 'FAILED: %s\n' "$*" >&2; docker logs "$NAME" >&2 2>&1 || true; exit 1; }

start() {
    docker run -d --name "$NAME" -p "127.0.0.1:$PORT:8080" \
        -e INKUBATOR_ADMIN_PASSWORD="$PASSWORD" -v "$DATA:/data" "$1" >/dev/null
}

wait_healthy() {
    for _ in $(seq 1 60); do
        case "$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null)" in
            healthy) return 0 ;;
            unhealthy) fail "the container reports unhealthy" ;;
        esac
        sleep 1
    done
    fail "not healthy after 60 seconds"
}

json() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

sign_in() {
    curl -sf -c "$JAR" -H 'Content-Type: application/json' \
        -d "{\"username\":\"admin\",\"password\":\"$PASSWORD\"}" "$BASE/auth/login" >/dev/null \
        || fail "could not sign in"
}

run_command() {
    local revision
    revision="$(curl -sf -b "$JAR" "$BASE/api/collection" | json 'd["revision"]')"
    curl -sf -b "$JAR" -H 'Content-Type: application/json' -H "Origin: $BASE" \
        -d "{\"command\": $1, \"revision\": \"$revision\"}" "$BASE/api/commands" >/dev/null \
        || fail "command refused: $1"
}

INK='{"type":"save_ink","ink":{"id":"ink_smoke","brand":"Smoke","line":"","name":"Test Blue","kind":"bottle","volume_ml":50,"amount":1,"price":null,"base_color":"#1f3a5f","sheen_color":null,"color_family":null,"shimmer":"none","sheen":"none","shading":"none","water_resistance":"none","flow":"average","lubrication":"none","dry_time_seconds":null,"base_types":["dye"],"paper":[],"notes":"","notes_public":false,"images":[],"created_at":0,"updated_at":0}}'

if [ -n "$PREVIOUS" ]; then
    step "Creating data with the previous image ($PREVIOUS)"
    start "$PREVIOUS"
    wait_healthy
    sign_in
    run_command "$INK"
    docker rm -f "$NAME" >/dev/null
fi

step "Starting $IMAGE"
start "$IMAGE"
wait_healthy
echo "healthy"

step "Version and help"
docker run --rm "$IMAGE" --version
docker run --rm "$IMAGE" --help >/dev/null || fail "--help failed"

step "Web interface"
curl -sf "$BASE/" | grep -q '<div id="app">' || fail "the interface is not served"
curl -sf "$BASE/inks" | grep -q '<div id="app">' || fail "app pages do not open"
curl -sf "$BASE/manifest.webmanifest" >/dev/null || fail "no web app manifest"
echo "ok"

step "Signing in and saving a change"
code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"wrong"}' "$BASE/auth/login")"
[ "$code" = "401" ] || fail "a wrong password got $code"
sign_in
[ -n "$PREVIOUS" ] || run_command "$INK"
curl -sf -b "$JAR" "$BASE/api/collection" | json 'd["collection"]["inks"][0]["name"]' | grep -q "Test Blue" \
    || fail "the change was not saved"
echo "ok"

step "Uploading a photo"
PNG="$(mktemp)"
python3 - "$PNG" <<'PY'
import struct, sys, zlib
def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
raw = b"".join(b"\x00" + b"\x1f\x3a\x5f" * 32 for _ in range(32))
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 32, 32, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
PY
path="$(curl -sf -b "$JAR" -H 'Content-Type: image/png' -H "Origin: $BASE" --data-binary "@$PNG" \
    "$BASE/api/uploads/inks?name=smoke" | json 'd["path"]')" || fail "photo upload failed"
rm -f "$PNG"
curl -sf -b "$JAR" "$BASE/api/thumbs/$path" >/dev/null || fail "no thumbnail for $path"
echo "ok ($path)"

step "Backup"
curl -sf -b "$JAR" -o /dev/null -w '%{http_code} %{size_download} bytes\n' "$BASE/api/backups/export" || fail "export failed"

step "Restart keeps the data"
docker restart "$NAME" >/dev/null
wait_healthy
sign_in
curl -sf -b "$JAR" "$BASE/api/collection" | json 'd["collection"]["inks"][0]["name"]' | grep -q "Test Blue" \
    || fail "the data did not survive a restart"
echo "ok"

step "Data belongs to the unprivileged user"
owners="$(docker exec "$NAME" sh -c 'find /data -exec stat -c %u:%g {} + | sort -u')"
[ "$owners" = "1000:1000" ] || fail "data owned by: $owners"
docker exec "$NAME" sh -c 'ps -o user= -p 1 2>/dev/null || cat /proc/1/status | grep ^Uid' 
echo "ok"

step "Stopping is quick (SIGTERM is handled)"
started="$(date +%s)"
docker stop "$NAME" >/dev/null
took=$(( $(date +%s) - started ))
[ "$took" -lt 8 ] || fail "stopping took $took seconds"
[ "$(docker inspect -f '{{.State.ExitCode}}' "$NAME")" = "0" ] || fail "stopped with an error"
echo "ok (${took}s)"

printf '\nAll checks passed for %s\n' "$IMAGE"
