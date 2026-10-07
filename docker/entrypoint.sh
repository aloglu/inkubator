#!/bin/sh
# Starts the server as an unprivileged user.
#
# Started as root (the default), the container takes the user from PUID and
# PGID (default 1000:1000), makes sure everything in the data folder belongs to
# that user, then drops to it before starting the server. Started with
# `docker run --user`, it starts the server directly as that user.
set -eu

DATA_DIR="${INKUBATOR_DATA_DIR:-/data}"

if [ "$(id -u)" != "0" ]; then
    exec inkubator-server
fi

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
case "$PUID$PGID" in
    *[!0-9]*|'')
        echo "PUID and PGID must be numbers (got PUID=$PUID, PGID=$PGID)." >&2
        exit 1
        ;;
esac
if [ "$PUID" = "0" ] || [ "$PGID" = "0" ]; then
    echo "Inkubator does not run as root. Set PUID and PGID to a regular user (on Unraid: 99 and 100)." >&2
    exit 1
fi

mkdir -p "$DATA_DIR"
# Only walk the whole folder when something belongs to someone else, so
# restarts stay fast.
if [ -n "$(find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -print -quit)" ]; then
    echo "Giving $DATA_DIR to user $PUID:$PGID"
    chown -R "$PUID:$PGID" "$DATA_DIR"
fi

exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups --no-new-privs -- inkubator-server
