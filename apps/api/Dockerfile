FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/api

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY migrations ./migrations
COPY app ./app

# The API does not need root.
RUN useradd --create-home --uid 10001 tapwear
USER tapwear

EXPOSE 8000

# Apply database migrations, then start. --proxy-headers makes the client address
# the real visitor's (from the reverse proxy), which the request limits rely on.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
