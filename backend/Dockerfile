FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code into /app/backend/ to maintain package structure
# This allows imports like "from .config.schema_loader" to work correctly
COPY . ./backend/

# Set PYTHONPATH so imports work correctly
ENV PYTHONPATH=/app

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Use production uvicorn settings
# Use PORT environment variable if set (Cloud Run requirement), otherwise default to 8080
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1

