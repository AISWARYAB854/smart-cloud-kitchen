"""Create an isolated, password-protected development PostgreSQL cluster on port 55432."""
from pathlib import Path
import os
import secrets
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
pg = Path(os.environ.get("PG_BIN", r"C:\Program Files\PostgreSQL\16\bin"))
data = root / ".local" / "postgres-dev"
env = root / "backend" / ".env"
if data.exists() or env.exists():
    raise SystemExit("Local database or backend/.env already exists; refusing to overwrite. Follow README to start it.")
data.parent.mkdir(exist_ok=True)
password = secrets.token_urlsafe(32)
env.write_text(f"DATABASE_URL=postgresql+psycopg://kitchen:{password}@127.0.0.1:55432/smart_kitchen\nJWT_SECRET={secrets.token_urlsafe(48)}\nCORS_ORIGINS=[\"http://localhost:5173\",\"http://127.0.0.1:5173\"]\n", encoding="utf-8")
with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
    f.write(password)
    password_file = f.name
try:
    subprocess.run([str(pg / "initdb.exe"), "-D", str(data), "-U", "kitchen", "--pwfile", password_file, "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C"], check=True)
finally:
    Path(password_file).unlink(missing_ok=True)
subprocess.run([str(pg / "pg_ctl.exe"), "-D", str(data), "-l", str(data.parent / "postgres.log"), "-o", "-h 127.0.0.1 -p 55432", "-w", "start"], check=True)
process_env = {**os.environ, "PGPASSWORD":password}
subprocess.run([str(pg / "createdb.exe"), "-h", "127.0.0.1", "-p", "55432", "-U", "kitchen", "smart_kitchen"], env=process_env, check=True)
print("Local PostgreSQL ready on 127.0.0.1:55432. Credentials saved only in ignored backend/.env.")
