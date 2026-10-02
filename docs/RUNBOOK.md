# TapWear runbook

How to put TapWear on a server, update it, back it up and recover it. Everything runs
from `infra/docker-compose.prod.yml` on one server: Postgres, object storage, the API,
the website and a reverse proxy (Caddy) that provides HTTPS.

## What you need

- A Linux server with Docker and the Compose plugin, reachable on ports 80 and 443.
- A domain name whose DNS record points at the server.
- An SMTP account for outgoing email (registration confirmation, password reset).

## First installation

1. Get the code on the server and create the settings file:

   ```bash
   git clone https://github.com/aidartakenov/tap-wear.git && cd tap-wear
   cp infra/.env.prod.example infra/.env.prod
   ```

2. Edit `infra/.env.prod`: the domain (`SITE_ADDRESS`, `SITE_URL`), long random
   passwords for Postgres and object storage, and the SMTP settings. With
   `EMAIL_BACKEND=console` emails are only written to the API log and reach nobody.

3. Build and start:

   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
   ```

   The API applies database migrations on every start. Caddy obtains the HTTPS
   certificate on the first request to the domain.

4. Load the reference lists (cities, categories, colours). This does **not** load
   the demo stores, which must never be shown as real offers:

   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
     exec api python -m app.seed --reference-only
   ```

5. Create the administrator account (the password is asked interactively):

   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod \
     exec api python -m app.create_admin you@example.com
   ```

6. Check: `https://<domain>/api/v1/health/ready` answers `"status":"ready"`, the site
   opens, and you can sign in as the administrator.

## Updating to a new version

```bash
git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Take a backup first (below). Migrations run automatically when the API starts.

## Rolling back

```bash
git checkout <previous commit>
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

This restores the previous code. If the newer version changed the database schema,
the older code may not work with it: restore the backup taken before the update, or
run `alembic downgrade <revision>` in the API container before switching the code.
Check the migration files of the release for anything that drops data.

## Backups

`infra/backup.sh` writes a database dump to `infra/backups` and keeps the latest 14.
Schedule it daily with cron (the script's header shows the line) and copy the dumps
to another machine: a backup on the same disk does not survive losing the disk.

Product photos live in the `minio_data` volume and are not in the database dump.
Back the volume up as well, for example:

```bash
docker run --rm -v tapwear-prod_minio_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

### Restoring the database

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod stop api web
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < infra/backups/<file>.dump
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod start api web
```

Practise a restore into a spare database before relying on the backups.

## Logs and health

- `docker compose -f infra/docker-compose.prod.yml logs -f api` — API log. Every
  response carries an `X-Request-ID`; search the log for it when someone reports an error.
- `/api/v1/health` — the API process is up. `/api/v1/health/ready` — the database
  answers and pgvector is installed.
- Watch free disk space: the database, photos and Docker images all grow.

## Known limits of this setup

- Request limits are counted in the API's memory, so the API must stay a single
  process. Several API processes would need a shared store such as Redis.
- Uploaded search photos for visual search are not stored yet; when that part is
  added, they must be deleted within 24 hours.
- There is no staging environment yet. Use a second server, or the same compose file
  with another project name, domain and settings file, with test data only.
