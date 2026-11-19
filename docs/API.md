# Customer and admin API

Run FastAPI and visit http://127.0.0.1:8000/docs for the interactive OpenAPI specification or `/openapi.json` for machine-readable schemas.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Database readiness |
| GET | `/api/catalog` | Public | Settings, categories, menu, add-ons, areas |
| POST | `/api/auth/register` | Public | Register name, email, Indian mobile and password |
| POST | `/api/auth/login` | Public | Authenticate `identifier` (email/mobile) and password |
| GET | `/api/auth/me` | Bearer JWT | Current public profile |
| POST | `/api/orders/quote` | Bearer JWT | Validate checkout and calculate authoritative total |
| POST | `/api/orders` | Bearer JWT | Revalidate and persist order transaction |
| GET | `/api/orders` | Bearer JWT | Current user's order history |
| GET | `/api/orders/{number}` | Bearer JWT | Current user's order detail |

Set `Authorization: Bearer <access_token>` after register/login. No user-selected role is accepted at registration. Invalid credentials produce 401; another customer's order produces 404; invalid checkout rules produce 400; malformed fields produce 422; duplicate accounts produce 409.

Checkout JSON shape:

```json
{
  "items": [{"food_id": 1, "quantity": 2, "addon_ids": [], "instructions": "Less spicy"}],
  "area_id": 1,
  "customer_name": "Anjali",
  "phone": "9876543210",
  "address": "12 Beach Road, Kozhikode",
  "landmark": "Near the library",
  "instructions": "Call on arrival",
  "scheduled_at": null,
  "payment_method": "cod"
}
```

For preorders, use an ISO 8601 timestamp including offset, e.g. the next day's `13:00:00+05:30`. Times must match configured slots, allow preparation lead time and be within seven days. Immediate orders must be within configured opening/cutoff hours. Minimum order is based on food subtotal. The current seed tax rate is zero, pending real business configuration. No tax compliance assumptions are made.

Orders begin at `placed`. The admin workflow advances the same records through accepted, preparing, ready, out_for_delivery and delivered, or cancels them before dispatch. Customer pages poll every 30 seconds and reflect stored state.

## Protected admin API

Every endpoint below requires a JWT for an owner or manager. Customer/kitchen/delivery tokens receive 403. Staff permissions are checked against the database on each request, not trusted from browser state.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/overview?start=YYYY-MM-DD&end=YYYY-MM-DD` | IST date range, revenue, collections, order counts, chart, best sellers |
| GET | `/api/admin/orders?q=&status=&page=1` | Search/filter orders, 50 per page |
| GET | `/api/admin/orders/{number}` | Customer/items/payment/history detail |
| PATCH | `/api/admin/orders/{number}/status` | Validated transition with `status`, `expected_status`, `note` |
| PATCH | `/api/admin/orders/{number}/payment` | COD bookkeeping with `status`, `expected_status`, required `note` |
| GET | `/api/admin/menu` | Active/archived foods, all categories and add-ons |
| POST | `/api/admin/menu` | Create food and add-ons atomically |
| PUT | `/api/admin/menu/{id}` | Edit full food/add-on configuration, including archive flag |
| PATCH | `/api/admin/menu/{id}/availability` | Set `available` boolean |
| POST | `/api/admin/categories` | Create category |
| PUT | `/api/admin/categories/{id}` | Edit name/order/visibility |
| POST | `/api/admin/images` | Raw image bytes, `Content-Type: image/jpeg`, `image/png` or `image/webp` |

Images return `{ "url": "/uploads/<random-id>.jpg" }`; these URLs are intentionally public. Files are checked, resized, metadata stripped and re-encoded. Full food editing preserves each add-on when its own existing `id` is supplied; missing options are removed. Foreign add-on IDs are rejected. Archive foods instead of deleting historical references.

Example status update: `{ "status": "accepted", "expected_status": "placed", "note": "Accepted by kitchen" }`. Invalid or stale transitions return 409, cancellation without a reason returns 400. Paid cancellation is blocked until the cash record is corrected after repayment is resolved separately. Payment changes are audited records, not payment/refund provider operations.
