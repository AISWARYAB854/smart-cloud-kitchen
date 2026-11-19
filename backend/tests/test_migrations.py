"""Exercise the frozen migration on PostgreSQL, including rollback/reapply."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import pytest
from sqlalchemy import create_engine, text, inspect
from alembic.migration import MigrationContext
from alembic.operations import Operations

@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="PostgreSQL integration only")
def test_migration_roundtrip():
    engine=create_engine(os.environ["TEST_DATABASE_URL"])
    schema="migration_"+uuid4().hex
    spec=importlib.util.spec_from_file_location("initial_migration",Path(__file__).parents[1]/"alembic/versions/0001_phase_one.py")
    migration=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    admin_spec=importlib.util.spec_from_file_location("admin_migration",Path(__file__).parents[1]/"alembic/versions/0002_admin.py")
    admin_migration=importlib.util.module_from_spec(admin_spec)
    admin_spec.loader.exec_module(admin_migration)
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            admin_migration.upgrade()
            assert "orders" in inspect(connection).get_table_names(schema=schema)
            assert "admin_events" in inspect(connection).get_table_names(schema=schema)
            assert "actor_id" in [c["name"] for c in inspect(connection).get_columns("order_status_history",schema=schema)]
            admin_migration.downgrade()
            migration.downgrade()
            assert not inspect(connection).get_table_names(schema=schema)
            migration.upgrade()
            admin_migration.upgrade()
            assert "payments" in inspect(connection).get_table_names(schema=schema)
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    engine.dispose()
