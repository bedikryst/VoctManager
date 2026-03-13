# Use the official lightweight Python 3.12 image
FROM python:3.12-slim

# Disable output buffering to ensure logs are immediately visible in the terminal.
# Prevent Python from writing .pyc files to disk (saves space and improves performance).
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies required for WeasyPrint (PDF generation engine)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies securely without caching
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app/