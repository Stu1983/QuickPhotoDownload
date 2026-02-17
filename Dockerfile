# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend /app/frontend/dist ./static/

# Create cache directories
RUN mkdir -p /app/cache/thumbs /app/cache/previews

# Build args for version info
ARG GIT_COMMIT=unknown
ARG GIT_COMMIT_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_COMMIT_DATE=$GIT_COMMIT_DATE

EXPOSE 8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
