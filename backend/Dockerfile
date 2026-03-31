FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour psycopg2 (connecteur PostgreSQL)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p storage/cvs

EXPOSE 8000

# --reload : redémarre automatiquement quand vous modifiez un fichier .py
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
