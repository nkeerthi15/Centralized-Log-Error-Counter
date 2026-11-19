FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY bridge.py .
COPY templates/ templates/
COPY static/ static/

EXPOSE 5000

CMD ["python", "bridge.py"]
