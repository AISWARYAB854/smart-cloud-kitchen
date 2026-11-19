# Smart Cloud Kitchen · Phases 1 & 2

A working customer ordering foundation for a Kozhikode cloud kitchen. React + TypeScript + Vite + Tailwind, shadcn-style components, React Router, TanStack Query, React Hook Form and Zod; FastAPI + SQLAlchemy + Pydantic; PostgreSQL, Alembic and JWT/Argon2 authentication.

**Implemented:** customer menu, filters, dish details and add-ons, persistent cart, registration/login, delivery pricing, scheduled checkout, COD, and order history; plus a separate protected admin dashboard, date-filtered revenue and sales charts, searchable order table/board, order status workflow, audited COD payment recording, printable receipts, food/photo/add-on editing, availability switches, archiving and category management. **Later phases:** inventory/costing, expenses/promotions/reports, account editing, delivery assignments, kitchen/delivery staff access, granular owner-managed permissions and online payments. This is not yet a production-ready complete system.

See [architecture and relationships](docs/ARCHITECTURE.md) and [API guide](docs/API.md).

## Windows setup (PowerShell)

Prerequisites: Python 3.12+, Node.js 20.19+ (22.12+ recommended), PostgreSQL 16+. XAMPP/PHP is not used. Work from this project directory.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.lock.txt
cd frontend
npm.cmd ci
cd ..
```

Choose one database setup:

**Isolated local database:** With PostgreSQL binaries installed at `C:\Program Files\PostgreSQL\16\bin`, run:

```powershell
python scripts/setup-local-db.py
```

The helper creates a password-protected cluster inside ignored `.local/postgres-dev`, binds only `127.0.0.1:55432`, creates `smart_kitchen`, and writes ignored `backend/.env` with random credentials. It does not alter an existing PostgreSQL service. Set `$env:PG_BIN` if your binaries are elsewhere. It refuses to overwrite existing data or configuration. If setup is interrupted, preserve `.env` and inspect `.local/postgres.log`; do not blindly rerun or delete data.

**Existing PostgreSQL:** Create a dedicated database and login using pgAdmin, copy `backend/.env.example` to `backend/.env`, and set the connection URL/password and a random JWT secret of at least 32 characters. URL-encode special characters in database passwords. No default owner password exists.

Then migrate and seed:

```powershell
cd backend
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m app.seed
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. API docs: **http://127.0.0.1:8000/docs**. Register your own customer account. Only cash on delivery is currently enabled. After cutoff, choose a future delivery slot. For delivery, select an area in the header and meet its minimum subtotal.

## Open the admin dashboard

The dashboard is **http://127.0.0.1:5173/admin**. You can also follow **Kitchen workspace** in the customer page footer.

If upgrading from Phase 1, stop the running backend with Ctrl+C, install the updated requirements, migrate and grant your existing account owner access:

```powershell
cd C:\xamppnew\htdocs\smart-cloud-kitchen\backend
.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.venv\Scripts\python.exe -m alembic upgrade head
.venv\Scripts\python.exe -m app.create_owner --promote-email your@email.com
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Replace `your@email.com` with your registered email. If you want a separate owner account, run `.venv\Scripts\python.exe -m app.create_owner` instead; it prompts privately for a password. There are no default admin credentials, and public registration never grants staff access. Sign out and sign back in after promotion. Keep the backend running and start/restart `npm.cmd run dev` from `frontend` in another terminal. See [the admin testing guide](docs/ADMIN.md).

Restart the isolated database after reboot:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D "$PWD\.local\postgres-dev" -l "$PWD\.local\postgres.log" -o '-h 127.0.0.1 -p 55432' -w start
```

Stop it from the project root when finished:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D "$PWD\.local\postgres-dev" -m fast -w stop
```

## Test customer and admin workflows

```powershell
cd backend
.venv/Scripts/python -m pytest -q
.venv/Scripts/python test_postgres.py
cd ../frontend
npm.cmd run build
```

The default tests use an isolated in-memory SQLite database. `test_postgres.py` runs customer/admin workflow tests plus both migrations' upgrade/downgrade/reapply against disposable schemas in the configured PostgreSQL database; it leaves business tables alone and requires schema-creation permission. Tests cover authentication, authoritative pricing, order ownership, staff authorization, valid/stale/invalid order transitions, payment auditing, menu validation, historical price snapshots, category visibility, image validation and migration rollback. Uploaded test photos are removed afterwards. These tests do not establish production concurrency/load capacity.

Manual walkthrough: filter/search the menu → open a dish → add an add-on and chef note → add to bag → refresh and confirm cart persists → register → enter delivery details → choose an available future slot → review final total → confirm → inspect order history. Log in as a second account to verify it has no access to the first account's orders. Check the same journey at a phone viewport.

Food imagery uses external illustrative Unsplash URLs and fonts use Google Fonts; the interface retains system font fallbacks. Replace photos with licensed images of the real menu before launch. Supply actual business contact numbers in `business_settings` to enable contact links.

## Deployment preparation

Build with `npm.cmd run build`; serve `frontend/dist` through an HTTPS static host/reverse proxy with SPA fallback to `index.html`, including `/admin/*`. Proxy `/api` and `/uploads` to a separately managed FastAPI process. Persist and back up `backend/uploads` with the database; uploaded photos are public menu assets, never private bills. Use managed PostgreSQL or a secured dedicated database role, strong environment secrets, exact CORS origins, automated backups, and monitoring. Run Alembic migrations once per release before starting workers. Never deploy `.env`, `.local`, `.venv`, or public development servers. Production must finish the hardening and operations work listed in the architecture document before accepting real orders. Sites hosting is not used because this project targets the requested local Python/PostgreSQL stack.
