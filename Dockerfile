FROM python:3.11-slim

# Set environment variables to avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker layer caching)
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Copy backend code to maintain package structure
COPY backend/ ./backend/

# Set PYTHONPATH so imports work correctly
ENV PYTHONPATH=/app

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Use production uvicorn settings
# Use single worker for Cloud Run (it handles scaling)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]

