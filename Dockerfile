FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including git
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy requirements first to leverage Docker cache
COPY agent-api-python/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir python-multipart

# Copy application code
COPY agent-api-python/ .

# Create directory for logs
RUN mkdir -p /app/logs

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO
ENV AWS_DEFAULT_REGION=us-east-1

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the FastAPI application
CMD ["python", "-m", "uvicorn", "agent:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]