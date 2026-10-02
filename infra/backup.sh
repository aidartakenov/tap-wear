#!/bin/sh
# Daily database backup for the production stack. Run from cron on the server:
#   0 3 * * * /path/to/tap-wear/infra/backup.sh >> /var/log/tapwear-backup.log 2>&1
# Keeps the 14 most recent dumps in infra/backups. Copy them off the server too:
# a backup on the same disk does not survive losing the disk.
set -eu

cd "$(dirname "$0")"
. ./.env.prod

mkdir -p backups
file="backups/tapwear-$(date +%Y-%m-%d-%H%M).dump"

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$file"

# A dump that is suspiciously small means the backup failed.
if [ "$(wc -c < "$file")" -lt 1000 ]; then
  echo "Backup $file looks empty" >&2
  exit 1
fi

ls -1t backups/*.dump | tail -n +15 | xargs -r rm --
echo "Saved $file"
