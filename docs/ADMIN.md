# Admin workspace · Phase 2

Open http://127.0.0.1:5173/admin after starting PostgreSQL, FastAPI and Vite. Backend `/docs` is interactive API documentation; `/admin` is the visual application.

## First sign-in

From `backend`, run `.venv\Scripts\python.exe -m app.create_owner` to create a separate owner. Or explicitly promote an existing registered account with `.venv\Scripts\python.exe -m app.create_owner --promote-email your@email.com`. This command requires trusted local filesystem/database access. No public endpoint can promote an account. Passwords are never echoed or saved in source files.

Owner and manager roles can access the Phase 2 workspace. Customer, kitchen and delivery roles are rejected by all admin APIs. Kitchen and delivery-specific views and owner-managed granular permissions remain later work.

## Manual walkthrough

1. Register a customer, choose a delivery area, place a COD order (a future slot works when the kitchen is closed).
2. Open `/admin` and sign in as owner. Confirm the order appears under **Orders**, with the right mobile, delivery address, items, add-ons and notes.
3. Search by mobile/order number; filter by status; switch between table and board. Both views paginate after 50 orders. New visible orders trigger a visual alert; lists refresh every 10 seconds.
4. Open the order. Move **New → Accepted → Preparing → Ready → Out for delivery → Delivered**. The backend rejects skipped/backwards transitions and stale concurrent updates. Check the customer's tracking screen in another browser/session; it refreshes every 30 seconds.
5. Record cash as paid with a note only after receiving it. Correct mistaken records with another note. These controls record bookkeeping; they never transfer or refund money. Cancellation requires a reason and is blocked while cash is recorded as paid. Resolve repayment separately first.
6. Print the open order receipt. Use browser print preview to check paper sizing. Only receipt content is selected by print CSS; rendering is not browser-verified in this environment.
7. Under **Food & menu**, add a dish, select category, set regular/selling prices, portion, ingredients and preparation time, add options and upload a JPEG/PNG/WebP. Photos are limited to 5 MB and 16 million pixels, re-encoded as JPEG, with metadata removed.
8. Toggle a dish sold out. Refresh the customer menu and check the disabled add button; even an old cart cannot order the unavailable dish. Archive a dish from its edit form to remove it from the customer menu while keeping past orders intact. Use **Show archived** to restore it.
9. Under **Categories**, add/edit display order and visibility. Inactive categories and their dishes disappear from the customer menu and cannot be ordered.
10. Return to **Overview** and select a date range. Food revenue includes delivered food subtotal, excluding delivery fees and tax. Average order value uses delivered order totals, including charges. Collections are separately labelled cash/payment amounts; neither measure is labelled profit. Dates use Asia/Kolkata, and orders are grouped by their placement date.
11. Sign in as a customer and request any `/api/admin/*` endpoint with that token. Expect 403; without a token expect 401.

## Existing running servers

FastAPI without `--reload` does not pick up code edits. Stop it with Ctrl+C and restart after migration. `/openapi.json` should report version `0.2.0`. If login succeeds but admin access is denied, verify that you promoted the exact registered email and signed in again. If images fail locally, restart Vite so it loads the `/uploads` proxy.

## Data integrity

Order rows are locked for status/payment updates; clients send `expected_status` to reject stale edits. Updates, actor-attributed status history and `admin_events` commit together. Food add-on IDs are retained when editing an existing option; removed options are rejected by checkout. Historic order names, prices and add-ons are stored snapshots and do not follow menu edits. Audit events record staff actor IDs and status/payment notes; do not put secrets in notes.

Delivery assignment, category images, stock deductions, gross-profit estimates and staff permission management are not included in this release.
