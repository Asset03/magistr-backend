FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy models
RUN python -m spacy download en_core_web_sm

COPY . .

ENV PYTHONUNBUFFERED=1

# Use the PORT environment variable provided by Render
CMD ["sh", "-c", "gunicorn -w 1 -k gthread --threads 4 --timeout 300 -b 0.0.0.0:$PORT app:app"]