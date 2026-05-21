# Stage 1 - Build React frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .

ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2 - Python backend + serve frontend
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built frontend into backend static folder
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
