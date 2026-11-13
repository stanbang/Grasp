FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY apps/web/ ./
RUN npm run build

FROM python:3.11-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils && rm -rf /var/lib/apt/lists/*
COPY apps/api/requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r /app/requirements.lock
RUN useradd --uid 10001 --create-home grasp && mkdir -p /data && chown grasp:grasp /data /app
COPY apps/api /app/apps/api
COPY samples /app/samples
COPY --from=web /web/dist /app/apps/web/dist
ENV DATA_DIR=/data MOCK_LLM=1 PYTHONUNBUFFERED=1
USER grasp
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health',timeout=3)"
CMD ["python", "-m", "uvicorn", "app.production:application", "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
