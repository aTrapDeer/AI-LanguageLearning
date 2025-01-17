FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including git
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy requirements first to leverage Docker cache
COPY agent-api-python/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir python-multipart

# Copy application code and .env file
COPY agent-api-python/ .

# Create directory for logs
RUN mkdir -p /app/logs

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO
ENV AWS_DEFAULT_REGION=us-east-1

# Do not set AWS credentials directly in Dockerfile
# They will be loaded from .env file by the application

EXPOSE 8000

# Run the FastAPI application
CMD ["python", "-m", "uvicorn", "agent:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]