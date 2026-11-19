"""Run the same API suite in disposable schemas on the configured PostgreSQL DB."""
import os
import pytest
from app.config import settings

if __name__ == "__main__":
    if not settings.database_url.startswith("postgresql"):
        raise SystemExit("Configure a PostgreSQL DATABASE_URL first")
    os.environ["TEST_DATABASE_URL"] = settings.database_url
    raise SystemExit(pytest.main(["tests", "-q"]))
