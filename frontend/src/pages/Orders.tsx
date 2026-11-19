import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { Button } from "../components/ui/button";
import { api, money } from "../api";
import type { User, OrderDetail } from "../types";

export function Orders({
  user,
  signIn,
}: {
  user: User | undefined;
  signIn: () => void;
}) {
  const orders = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => api<OrderDetail[]>("/orders"),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const stages = [
    "placed",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
  ];
  return (
    <main className="page narrow">
      <p className="eyebrow">FOLLOW THE FLAVOUR</p>
      <h1>Your orders</h1>
      {!user ? (
        <Button onClick={signIn}>Sign in to view your orders</Button>
      ) : orders.isPending ? (
        <p>Loading your orders…</p>
      ) : orders.isError ? (
        <p className="error">{orders.error.message}</p>
      ) : !orders.data?.length ? (
        <div className="state">
          <Clock size={40} />
          <h2>Your first favourite is waiting.</h2>
          <Link to="/" className="button primary">
            Browse the menu
          </Link>
        </div>
      ) : (
        orders.data.map(({ order, items, payment }) => (
          <section className="panel order-panel" key={order.number}>
            <div className="order-heading">
              <div>
                <span className="eyebrow">{order.number}</span>
                <h2>
                  {new Date(order.created_at).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "long",
                  })}
                </h2>
              </div>
              <span className="status">{order.status.replace(/_/g, " ")}</span>
            </div>
            <div className="tracker">
              {stages.map((stage, i) => (
                <div
                  key={stage}
                  className={i <= stages.indexOf(order.status) ? "done" : ""}
                >
                  <span>
                    {i < stages.indexOf(order.status) ? (
                      <Check size={13} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <small>
                    {
                      [
                        "Placed",
                        "Confirmed",
                        "Preparing",
                        "Ready",
                        "On the way",
                        "Delivered",
                      ][i]
                    }
                  </small>
                </div>
              ))}
            </div>
            {items.map((item, i) => (
              <div className="summary-line" key={i}>
                <span>
                  {item.quantity} × {item.name}
                </span>
                <b>{money(Number(item.unit_price) * item.quantity)}</b>
              </div>
            ))}
            <div className="summary-line total">
              <span>
                Total · {payment.method.toUpperCase()} · {payment.status}
              </span>
              <b>{money(order.total)}</b>
            </div>
            <p className="muted small">{order.address}</p>
            <p className="small">
              {order.scheduled_at
                ? `Scheduled for ${new Date(order.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                : "Estimated delivery: 35–50 minutes after kitchen confirmation."}
            </p>
          </section>
        ))
      )}
    </main>
  );
}
