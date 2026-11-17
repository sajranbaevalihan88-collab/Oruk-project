# ── Stage 1: build the React frontend ─────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend serving API + built frontend ─────────
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /src/frontend/dist /frontend/dist
ENV PORT=8020
EXPOSE 8020
CMD ["python", "run_backend.py"]
