FROM python:3.11-slim

# Run as an unprivileged user.
RUN useradd --create-home --shell /usr/sbin/nologin runner

WORKDIR /app

# Install pinned runtime dependencies first (layer caching).
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --requirement /app/requirements.txt

# Install the runner (read-only at runtime).
COPY runner.py /app/runner.py

# Drop privileges for the execution process.
USER runner

# One execution per container: read the JSON request from stdin and emit
# the result document on stdout.
ENTRYPOINT ["python", "/app/runner.py"]
