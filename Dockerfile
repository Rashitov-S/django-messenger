FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/cybersec

COPY requirements/prod.txt /app/cybersec/requirements/prod.txt

RUN pip install --no-cache-dir -r /app/cybersec/requirements/prod.txt

COPY cybersec/ .

EXPOSE 8000

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "cybersec.asgi:application"]
