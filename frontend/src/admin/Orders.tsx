import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  LayoutList,
  Columns3,
  RefreshCw,
  ArrowRight,
  Printer,
  MapPin,
  Phone,
  Clock,
  Check,
  BellRing,
} from "lucide-react";
import { api, money } from "../api";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import {
  type AdminOrder,
  statuses,
  labels,
  transitions,
  timestamp,
} from "./types";

export function AdminOrders() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("table");
  const [selected, setSelected] = useState<string | null>(null);
  const [alert, setAlert] = useState("");
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    seen.current = null;
    setAlert("");
  }, [q, status, page]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const orders = useQuery({
    queryKey: ["admin", "orders", q, status, page],
    queryFn: () =>
      api<{ items: AdminOrder[]; total: number; page_size: number }>(
        `/admin/orders?q=${encodeURIComponent(q)}&status=${status}&page=${page}`,
      ),
    refetchInterval: 10000,
  });
  useEffect(() => {
    if (!orders.data) return;
    const ids = orders.data.items
      .filter((o) => o.order.status === "placed")
      .map((o) => o.order.number);
    if (seen.current && ids.some((id) => !seen.current!.has(id)))
      setAlert("New orders need your attention.");
    seen.current = new Set(ids);
  }, [orders.data]);
  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-label">FROM FIRST CRAVING TO LAST BITE</p>
          <h1>
            Keep every order moving<span>.</span>
          </h1>
          <p className="muted">
            Accept, prepare and deliver. Your team’s day, in one place.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => orders.refetch()}
          disabled={orders.isFetching}
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>
      {alert && (
        <div className="admin-order-alert" role="status">
          <BellRing size={18} />
          {alert}
          <button onClick={() => setAlert("")}>Dismiss</button>
        </div>
      )}
      <div className="admin-order-toolbar">
        <label className="admin-search">
          <Search size={17} />
          <input
            placeholder="Order number, customer or mobile…"
            aria-label="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Order status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
            seen.current = null;
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <div className="admin-view-switch">
          <button
            className={view === "table" ? "active" : ""}
            aria-label="Table view"
            onClick={() => setView("table")}
          >
            <LayoutList size={18} />
          </button>
          <button
            className={view === "board" ? "active" : ""}
            aria-label="Board view"
            onClick={() => setView("board")}
          >
            <Columns3 size={18} />
          </button>
        </div>
        <span className="admin-refresh-hint">
          <i />
          Updates every 10 sec
        </span>
      </div>
      {orders.isPending ? (
        <div className="admin-empty">Loading orders…</div>
      ) : orders.isError ? (
        <p className="admin-error" role="alert">
          {orders.error.message}
        </p>
      ) : !orders.data.items.length ? (
        <div className="admin-panel admin-empty">
          <Clock size={35} />
          <h2>No orders here yet.</h2>
          <p>
            {q || status
              ? "Try a different search or status."
              : "Orders placed in the customer app will appear here."}
          </p>
        </div>
      ) : view === "table" ? (
        <div className="admin-panel admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((o) => (
                <tr key={o.order.number}>
                  <td>
                    <button
                      className="admin-order-id"
                      onClick={() => setSelected(o.order.number)}
                    >
                      {o.order.number}
                    </button>
                    <small>{timestamp(o.order.created_at)}</small>
                    {o.order.scheduled_at && (
                      <small className="admin-scheduled">
                        Scheduled: {timestamp(o.order.scheduled_at)}
                      </small>
                    )}
                  </td>
                  <td>
                    <b>{o.order.customer_name}</b>
                    <small>{o.order.phone}</small>
                  </td>
                  <td>
                    {o.items.reduce((s, i) => s + i.quantity, 0)} items
                    <small>
                      {o.items[0]?.name}
                      {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                    </small>
                  </td>
                  <td>
                    <b>{money(o.order.total)}</b>
                  </td>
                  <td>
                    <span
                      className={`admin-payment ${o.payment.status === "paid" ? "paid" : ""}`}
                    >
                      {o.payment.status}
                    </span>
                    <small>{o.payment.method.toUpperCase()}</small>
                  </td>
                  <td>
                    <Status value={o.order.status} />
                  </td>
                  <td>
                    <button
                      onClick={() => setSelected(o.order.number)}
                      className="admin-order-open"
                      aria-label={`Open ${o.order.number}`}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-board">
          {statuses
            .filter((s) => !status || s === status)
            .map((s) => (
              <section className="admin-board-column" key={s}>
                <h3>
                  {labels[s]}
                  <span>
                    {
                      orders.data.items.filter((o) => o.order.status === s)
                        .length
                    }
                  </span>
                </h3>
                {orders.data.items
                  .filter((o) => o.order.status === s)
                  .map((o) => (
                    <button
                      className="admin-board-card"
                      key={o.order.number}
                      onClick={() => setSelected(o.order.number)}
                    >
                      <span>
                        {o.order.number}
                        <small>{timestamp(o.order.created_at)}</small>
                      </span>
                      <b>{o.order.customer_name}</b>
                      {o.items.map((item, i) => (
                        <p key={i}>
                          {item.quantity} × {item.name}
                        </p>
                      ))}
                      {o.order.instructions && <em>{o.order.instructions}</em>}
                      <div>
                        <Status value={s} />
                        <strong>{money(o.order.total)}</strong>
                      </div>
                    </button>
                  ))}
                {!orders.data.items.some((o) => o.order.status === s) && (
                  <p className="admin-board-empty">All clear here</p>
                )}
              </section>
            ))}
        </div>
      )}
      {orders.data && orders.data.total > 50 && (
        <div className="admin-pagination">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {Math.ceil(orders.data.total / 50)} · board shows
            this page
          </span>
          <Button
            variant="outline"
            disabled={page * 50 >= orders.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <OrderDialog number={selected} close={() => setSelected(null)} />
    </section>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`admin-status status-${value}`}>
      {labels[value] || value}
    </span>
  );
}
function OrderDialog({
  number,
  close,
}: {
  number: string | null;
  close: () => void;
}) {
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const detail = useQuery({
    queryKey: ["admin", "order", number],
    queryFn: () => api<AdminOrder>(`/admin/orders/${number}`),
    enabled: !!number,
    refetchInterval: 10000,
  });
  useEffect(() => {
    setNote("");
    setPaymentNote("");
    setError("");
    setSuccess("");
  }, [number]);
  const data = detail.data;
  const mutation = useMutation({
    mutationFn: ({
      kind,
      status,
    }: {
      kind: "status" | "payment";
      status: string;
    }) => {
      if (!data) throw new Error("Order not loaded");
      return api(`/admin/orders/${number}/${kind}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          expected_status:
            kind === "status" ? data.order.status : data.payment.status,
          note: kind === "status" ? note : paymentNote,
        }),
      });
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin"] });
      client.invalidateQueries({ queryKey: ["orders"] });
      setError("");
      setNote("");
      setPaymentNote("");
      setSuccess("Order updated successfully.");
    },
    onError: (e) => {
      setSuccess("");
      setError(e.message);
      client.invalidateQueries({ queryKey: ["admin", "order", number] });
    },
  });
  return (
    <Dialog
      open={!!number}
      onOpenChange={(v) => !v && close()}
      title={number || "Order"}
    >
      {detail.isPending ? (
        <p>Loading order…</p>
      ) : detail.isError ? (
        <p className="admin-error">{detail.error.message}</p>
      ) : (
        data && (
          <div className="admin-receipt">
            <div className="admin-receipt-heading">
              <h2>Order receipt</h2>
              <Status value={data.order.status} />
            </div>
            <p className="muted small">
              {data.order.number} · Placed {timestamp(data.order.created_at)}
            </p>
            <div className="admin-customer-info">
              <b>{data.order.customer_name}</b>
              <a href={`tel:${data.order.phone}`}>
                <Phone size={13} />
                {data.order.phone}
              </a>
              <p>
                <MapPin size={14} />
                {data.order.address}
              </p>
              {data.order.landmark && <p>Landmark: {data.order.landmark}</p>}
              {data.order.instructions && (
                <p className="admin-chef-note">
                  Delivery note: {data.order.instructions}
                </p>
              )}
              {data.order.scheduled_at && (
                <p>
                  <Clock size={14} />
                  Scheduled: {timestamp(data.order.scheduled_at)}
                </p>
              )}
            </div>
            {data.items.map((item, i) => (
              <div className="admin-receipt-item" key={i}>
                <div>
                  <b>
                    {item.quantity} × {item.name}
                  </b>
                  {item.addons.map((a, j) => (
                    <small key={j}>
                      + {a.name} ({money(a.price)})
                    </small>
                  ))}
                  {item.instructions && (
                    <p className="admin-chef-note">
                      Chef note: {item.instructions}
                    </p>
                  )}
                </div>
                <strong>
                  {money(Number(item.unit_price) * item.quantity)}
                </strong>
              </div>
            ))}
            <div className="admin-receipt-totals">
              {[
                ["Food subtotal", data.order.subtotal],
                ["Delivery", data.order.delivery_charge],
                ["Tax", data.order.tax],
                ["Total", data.order.total],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <b>{money(value)}</b>
                </div>
              ))}
            </div>
            <p className="small">
              Payment:{" "}
              <b>
                {data.payment.method.toUpperCase()} · {data.payment.status}
              </b>
            </p>
            <div className="admin-order-actions no-print">
              {error && (
                <p role="alert" className="admin-error">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="success">
                  <Check size={15} />
                  {success}
                </p>
              )}
              {transitions[data.order.status]?.length > 0 && (
                <>
                  <h3>Move this order forward</h3>
                  <label className="field">
                    Kitchen note / cancellation reason
                    <textarea
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="A reason is required when cancelling"
                    />
                  </label>
                  <div className="admin-action-buttons">
                    {transitions[data.order.status].map((s) => (
                      <Button
                        variant={s === "cancelled" ? "outline" : "default"}
                        key={s}
                        disabled={
                          mutation.isPending ||
                          (s === "cancelled" && !note.trim())
                        }
                        onClick={() =>
                          mutation.mutate({ kind: "status", status: s })
                        }
                      >
                        {s === "cancelled"
                          ? "Cancel order"
                          : `Mark ${labels[s].toLowerCase()}`}{" "}
                        {s !== "cancelled" && <ArrowRight size={14} />}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              {data.order.status !== "cancelled" && (
                <div className="admin-payment-edit">
                  <h3>Cash payment record</h3>
                  <p className="muted small">
                    Record cash received, or correct a mistaken entry. This does
                    not transfer money or issue a refund.
                  </p>
                  <label className="field">
                    Payment note
                    <input
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      maxLength={300}
                      placeholder="e.g. Cash collected by delivery partner"
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={
                      mutation.isPending || paymentNote.trim().length < 3
                    }
                    onClick={() =>
                      mutation.mutate({
                        kind: "payment",
                        status:
                          data.payment.status === "paid" ? "pending" : "paid",
                      })
                    }
                  >
                    {data.payment.status === "paid"
                      ? "Correct to pending"
                      : "Record cash as paid"}
                  </Button>
                </div>
              )}
              <details className="admin-history">
                <summary>Status history</summary>
                {data.history.map((h, i) => (
                  <div key={i}>
                    <b>{labels[h.status] || h.status}</b>
                    <small>{timestamp(h.created_at)}</small>
                    {h.note && <p>{h.note}</p>}
                  </div>
                ))}
              </details>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={15} />
                Print receipt
              </Button>
            </div>
          </div>
        )
      )}
    </Dialog>
  );
}
