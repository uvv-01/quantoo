FROM python:3.11-slim

# Run as an unprivileged user.
RUN useradd --create-home --shell /usr/sbin/nologin runner

WORKDIR /app

# Which pinned dependency set to bake in. The default builds the
# deployment's standard runtime; `--build-arg REQUIREMENTS=requirements-legacy.txt`
# builds a separate, controlled legacy environment image.
# Users never influence this value: profiles are provisioned by the operator.
ARG REQUIREMENTS=requirements.txt

# Install pinned runtime dependencies first (layer caching).
COPY requirements.txt requirements-legacy.txt /app/
RUN pip install --no-cache-dir --requirement /app/${REQUIREMENTS}

# Install the runner (read-only at runtime).
COPY runner.py /app/runner.py

# Drop privileges for the execution process.
USER runner

# One execution per container: read the JSON request from stdin and emit
# the result document on stdout.
ENTRYPOINT ["python", "/app/runner.py"]
