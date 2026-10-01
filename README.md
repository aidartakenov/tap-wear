# TopWear

Clothing catalog for Kyrgyzstan with visual search: a buyer uploads a photo or screenshot, selects the garment, and gets similar items from connected stores with price, size and availability.

The full specification (in Russian) is in [docs/TopWear_TZ_v3.md](docs/TopWear_TZ_v3.md).

## Repository layout

| Path | Contents |
|----|----|
| `apps/web` | Next.js frontend (mobile first). Currently runs on the demo catalog below. |
| `apps/api` | FastAPI modular monolith: config, database session, health endpoints. |
| `infra` | Docker Compose for local Postgres (pgvector) and MinIO. |
| `scripts` | Development scripts, including the demo catalog import. |
| `docs` | Specification and decisions. |

All work happens on the `development` branch.

## Demo catalog

`apps/web/lib/data/demoCatalog.json` holds about 30 products each from the public sites of four Bishkek stores (Gergert Sport, Dresscode, ЛИРУС, adidas Кыргызстан). It exists so the interface can be developed against realistic data.

- These stores have **not** agreed to take part in TopWear. The data is for local development and must not go into a public release or be presented as live offers.
- Product photos are not stored in this repository. The catalog holds links to the images on the stores' own servers.
- Prices and availability are a snapshot from the import date and may be out of date.

To refresh it (standard library only; pass store ids to refresh only some stores):

```bash
python3 scripts/import_demo_catalog.py
```

## Local setup

Requirements: Docker Desktop, Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js.

1. Start Postgres and MinIO:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

2. Set up the API:

   ```bash
   cd apps/api
   uv venv .venv
   uv pip install --python .venv/bin/python -r requirements-dev.txt
   cp .env.example .env
   .venv/bin/uvicorn app.main:app --reload --port 8000
   ```

3. Start the web app:

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

## Checks

From `apps/api`:

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/pytest
```

From `apps/web`:

```bash
npm run lint
```
