FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy models
# RUN python -m spacy download en_core_web_sm

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]