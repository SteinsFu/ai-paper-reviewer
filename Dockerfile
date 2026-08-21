FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py reviewer.py bundle_builder.py pdf_utils.py bedrock_client.py ./
COPY novelty_review ./novelty_review
EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]