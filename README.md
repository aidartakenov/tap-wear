# TopWear

Clothing catalog for Kyrgyzstan with visual search: a buyer uploads a photo or screenshot, selects the garment, and gets similar items from connected stores with price, size and availability.

The full specification (in Russian) is in [docs/TopWear_TZ_v3.md](docs/TopWear_TZ_v3.md).

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

- These stores have **not** agreed to take part in TopWear. The data is for local development and must not go into a public release or be presented as live offers.
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

- **Buyers** need no account: catalog, search, favorites and reporting a problem all work as a guest.
- **Sellers** register at `/login`, create a store in `/cabinet`, and add products. A store and each product are reviewed by an administrator before they become public. The owner can add staff, who manage products but not the store profile or its members.
- **Administrators** review stores, products and buyer reports at `/admin`. An administrator is created only from the command line:

  ```bash
  cd apps/api
  .venv/bin/python -m app.create_admin you@example.com
  ```

Sessions use an HttpOnly cookie; every changing request must also carry the session's CSRF token in the `X-CSRF-Token` header (the web app does this automatically).

## Checks

From `apps/api` (the tests use a separate `topwear_test` database and a separate `topwear-test-assets` bucket; the ones that need Postgres or object storage are skipped if it is not running):

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
