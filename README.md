# TapWear

Clothing catalog for Kyrgyzstan with visual search: a buyer uploads a photo or screenshot, selects the garment, and gets similar items from connected stores with price, size and availability.

The full specification (in Russian) is in [docs/TapWear_TZ_v3.md](docs/TapWear_TZ_v3.md).

## Repository layout

| Path | Contents |
|----|----|
| `apps/web` | Next.js frontend (mobile first). Reads everything from the API. |
| `apps/api` | FastAPI modular monolith: catalog, stores, health; migrations in `apps/api/migrations`. |
| `infra` | Docker Compose for local Postgres (pgvector) and MinIO. |
| `scripts` | Development scripts, including the demo catalog import. |
| `docs` | Specification and decisions. |

All work happens on the `development` branch.

## Demo catalog

`apps/api/seed/demo_catalog.json` holds about 30 products each from the public sites of four Bishkek stores (Gergert Sport, Dresscode, ЛИРУС, adidas Кыргызстан). It exists so the product can be developed against realistic data. `python -m app.seed` loads it into the database, where these stores are flagged `is_demo`.

- These stores have **not** agreed to take part in TapWear. The data is for local development and must not go into a public release or be presented as live offers.
- Product photos are not stored in this repository. The catalog holds links to the images on the stores' own servers.
- Prices and availability are a snapshot from the import date and may be out of date.

To refresh the file from the stores' sites (standard library only; pass store ids to refresh only some stores), then load it again:

```bash
python3 scripts/import_demo_catalog.py
```

## Local setup

Requirements: Docker Desktop, Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js.

1. Start Postgres and MinIO:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

   If port 5432 is already taken on your machine, put `POSTGRES_PORT=5433` in `infra/.env` and use the same port in `DATABASE_URL` below.

2. Set up the API, create the tables and load the demo catalog:

   ```bash
   cd apps/api
   uv venv .venv
   uv pip install --python .venv/bin/python -r requirements-dev.txt
   cp .env.example .env
   .venv/bin/alembic upgrade head
   .venv/bin/python -m app.seed
   .venv/bin/python -m app.seed_dev
   .venv/bin/uvicorn app.main:app --reload --port 8000
   ```

   `app.seed_dev` creates a local administrator and a local seller account with the emails and passwords from the `DEV_*` lines in `apps/api/.env`. It refuses to run outside the local environment.

3. Start the web app (it calls the API at `NEXT_PUBLIC_API_URL`, by default `http://localhost:8000/api/v1`):

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

| Service | URL |
|----|----|
| Web | http://localhost:3000 |
| API docs | http://localhost:8000/api/v1/docs |
| API liveness | http://localhost:8000/api/v1/health |
| API readiness (database and pgvector) | http://localhost:8000/api/v1/health/ready |
| MinIO console | http://localhost:9001 |

## Accounts and roles

- **Buyers** can use everything as a guest: catalog, search, favorites (kept on the device) and reporting a problem. With an account (`/login`), favorites are stored in the account and follow the buyer across devices; a list saved as a guest can be added to the account after signing in.
- **Sellers** use the same kind of account, create a store in `/cabinet`, and add products. A store and each product are reviewed by an administrator before they become public. The owner can add staff, who manage products but not the store profile or its members.
- **Administrators** review stores, products and buyer reports at `/admin`. An administrator is created only from the command line:

  ```bash
  cd apps/api
  .venv/bin/python -m app.create_admin you@example.com
  ```

Sessions use an HttpOnly cookie; every changing request must also carry the session's CSRF token in the `X-CSRF-Token` header (the web app does this automatically).

## Delivery and return conditions

Each store owner fills in the store's own conditions in the cabinet: pickup, delivery area, fee and time, try-on at delivery, payment methods, and the return period and terms. Buyers see them on the store page and on every product page before contacting the seller. Each save is stored as a new version and earlier versions are kept. The conditions are the seller's statement; they do not replace the buyer's rights under consumer protection law.

## Stock freshness and statistics

- **Freshness:** a variant marked "in stock" is shown to buyers as in stock only while its confirmation is recent. After `AVAILABILITY_REMINDER_HOURS` (48) the seller sees a reminder in the cabinet; after `AVAILABILITY_STALE_HOURS` (72) buyers see "availability needs checking" and the variant no longer matches the "in stock" filter, until the seller confirms it. Setting a new stock status counts as a confirmation; other edits do not.
- **Events:** the web app reports product views, storefront views and contact clicks to `POST /events`. No personal data is stored: the visitor is a random id from the browser, and no IP address or search text is kept. A link can carry `?source=instagram` (or `utm_source`) so the store can see where visitors came from.
- **Statistics:** each store's members see views, visitors, contact clicks, sources and top products for 7 or 30 days in the cabinet. A contact click is an inquiry, not a sale.

## Languages and request limits

- **Languages:** the buyer-facing pages are in Russian and Kyrgyz; the switch is in the header and the choice is kept in a cookie. Interface text lives in `apps/web/lib/i18n` (`ru.ts` is the source, `ky.ts` must have the same keys). The API returns category, colour and city names in the language of the `Accept-Language` header, falling back to Russian. The Kyrgyz text was machine-drafted and needs review by a native speaker before a public release. The seller cabinet and moderation pages are translated too; their Kyrgyz text is in `kySeller.ts`, keyed by the Russian source text.
- **Request limits:** sign-in, registration, reports, events and photo uploads are limited per client address (`RATE_LIMIT_ENABLED`). Counters are kept in the API process's memory, which is enough for a single process.

## Email

Registration sends a confirmation link; opening a store requires a confirmed address (saving favorites does not). "Forgot password" sends a single-use link that is valid for one hour and signs out all sessions when used. The answer is the same whether or not the address has an account.

With `EMAIL_BACKEND=console` (the default) messages are written to the API log and nothing is sent. In local development they can also be read at `http://localhost:8000/api/v1/dev/outbox`. For real delivery set `EMAIL_BACKEND=smtp` and the `SMTP_*` variables.

## Photo search

`apps/api/app/search` holds everything around the image model: the vector table
(`product_embeddings`, pgvector), the indexer and `POST /api/v1/search/visual`,
which applies the catalog filters first and then ranks by cosine distance.

The model plugs in through one setting, `EMBEDDER` (see `app/search/embedder.py`):

- unset: `app.search.placeholder:PlaceholderEmbedder`, a colour-only stand-in
  that is **not a model**. Tests and a fresh checkout use it, so nothing heavy
  needs installing.
- `app.search.hf_embedder:HFEmbedder`: a real model from Hugging Face, by
  default SigLIP B/16 with solid bars trimmed off the photo. It needs
  `pip install -r requirements-ml.txt` (PyTorch) and downloads the model once.

How that model was chosen, with the measurements, is in `ml/README.md`. A new
model or a change in how pictures are prepared must get a new version
(`EMBEDDER_MODEL`, `EMBEDDER_REVISION`): the catalog then indexes again and
vectors of different versions are never mixed.

A product's photos are indexed right after it is approved. To index everything
that is missing (for example after changing the model):

```bash
cd apps/api
python -m app.search.indexer                 # once
python -m app.search.indexer --retry-failed  # also photos that failed before
python -m app.search.indexer --watch         # keep running
```

## Deployment

`infra/docker-compose.prod.yml` runs the whole product on one server behind Caddy with automatic HTTPS. Installation, updates, rollback, backups and restore are described in [docs/RUNBOOK.md](docs/RUNBOOK.md). GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and a web build on every push to `development` and `main`.

## Checks

From `apps/api` (the tests use a separate `tapwear_test` database and a separate `tapwear-test-assets` bucket; the ones that need Postgres or object storage are skipped if it is not running):

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest
```

From `apps/web`:

```bash
npm run lint
```

## Database changes

Schema changes go through Alembic migrations. After changing a model in `apps/api/app`:

```bash
cd apps/api
.venv/bin/alembic revision --autogenerate -m "what changed"
.venv/bin/alembic upgrade head
```

Review the generated file before applying it.
