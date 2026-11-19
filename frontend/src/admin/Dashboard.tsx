import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  IndianRupee,
  ShoppingBag,
  Clock,
  CheckCheck,
  XCircle,
  Receipt,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { api, money } from "../api";
import type { Overview } from "./types";

function indiaDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function rangeFor(value: string) {
  const now = new Date(indiaDate() + "T12:00:00+05:30");
  const end = indiaDate(now);
  if (value === "yesterday") {
    now.setDate(now.getDate() - 1);
    return { start: indiaDate(now), end: indiaDate(now) };
  }
  if (value === "week") now.setDate(now.getDate() - 6);
  if (value === "month") now.setDate(1);
  return { start: indiaDate(now), end };
}
export function Dashboard() {
  const [period, setPeriod] = useState("week");
  const [range, setRange] = useState(() => rangeFor("week"));
  const result = useQuery({
    queryKey: ["admin", "overview", range],
    queryFn: () =>
      api<Overview>(`/admin/overview?start=${range.start}&end=${range.end}`),
    refetchInterval: 15000,
  });
  const data = result.data;
  const metrics = data
    ? [
        {
          label: "Food revenue",
          value: money(data.revenue),
          icon: IndianRupee,
          note: "Delivered food · excludes tax & delivery",
          accent: true,
        },
        {
          label: "Total orders",
          value: data.orders,
          icon: ShoppingBag,
          note: "All orders placed in this period",
        },
        {
          label: "In progress",
          value: data.pending,
          icon: Clock,
          note: "Waiting, cooking or on the way",
        },
        {
          label: "Delivered",
          value: data.delivered,
          icon: CheckCheck,
          note: "Meals that made it to the doorstep",
        },
        {
          label: "Cancelled",
          value: data.cancelled,
          icon: XCircle,
          note: "Excluded from food revenue",
        },
        {
          label: "Average order value",
          value: money(data.average_order),
          icon: Receipt,
          note: "Delivered orders · includes charges",
        },
      ]
    : [];
  const chart = data?.daily || [];
  const maximum = Math.max(1, ...chart.map((p) => Number(p.revenue)));
  const chartWidth = Math.max(640, chart.length * 22);
  const barWidth = Math.min(
    52,
    ((chartWidth - 80) / Math.max(chart.length, 1)) * 0.55,
  );
  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-label">LET’S MAKE TODAY A GOOD ONE</p>
          <h1>
            Your kitchen overview<span>.</span>
          </h1>
          <p className="muted">
            A clear picture of what’s cooking and how business is going.
          </p>
        </div>
        <Link className="button primary" to="/admin/orders">
          Manage orders
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="admin-datebar">
        <div className="admin-tabs">
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "Last 7 days"],
            ["month", "This month"],
            ["custom", "Custom"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={period === v ? "active" : ""}
              onClick={() => {
                setPeriod(v);
                if (v !== "custom") setRange(rangeFor(v));
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "custom" ? (
          <div className="admin-date-inputs">
            <label>
              From
              <input
                type="date"
                aria-label="Start date"
                value={range.start}
                onChange={(e) =>
                  e.target.value &&
                  setRange({ ...range, start: e.target.value })
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                aria-label="End date"
                value={range.end}
                onChange={(e) =>
                  e.target.value && setRange({ ...range, end: e.target.value })
                }
              />
            </label>
          </div>
        ) : (
          <span>
            {range.start} — {range.end} · IST
          </span>
        )}
      </div>
      {result.isPending ? (
        <p className="admin-empty">Loading your business overview…</p>
      ) : result.isError ? (
        <p className="admin-error" role="alert">
          {result.error.message}
        </p>
      ) : (
        data && (
          <>
            <div className="admin-metrics">
              {metrics.map(({ label, value, icon: Icon, note, accent }) => (
                <article
                  key={label}
                  className={`admin-metric ${accent ? "accent" : ""}`}
                >
                  <div>
                    <span>{label}</span>
                    <i>
                      <Icon size={17} />
                    </i>
                  </div>
                  <strong>{value}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </div>
            <div className="admin-dashboard-grid">
              <article className="admin-panel admin-chart">
                <div className="admin-panel-title">
                  <div>
                    <h2>Revenue, day by day</h2>
                    <p>
                      Food revenue from delivered orders placed in this period
                    </p>
                  </div>
                  <TrendingUp size={20} />
                </div>
                <div className="admin-chart-scroll">
                  <svg
                    style={{ minWidth: chart.length > 31 ? chartWidth : 420 }}
                    viewBox={`0 0 ${chartWidth} 235`}
                    role="img"
                    aria-label="Daily delivered food revenue bar chart"
                  >
                    <title>Delivered food revenue by order date</title>
                    {[0, 1, 2, 3].map((i) => (
                      <g key={i}>
                        <line
                          x1="50"
                          x2={chartWidth - 15}
                          y1={185 - i * 50}
                          y2={185 - i * 50}
                          stroke="#e9ece5"
                          strokeDasharray="3 4"
                        />
                        <text
                          x="3"
                          y={189 - i * 50}
                          fontSize="9"
                          fill="#8a9382"
                        >
                          {Math.round((maximum * i) / 3)}
                        </text>
                      </g>
                    ))}
                    {chart.map((p, i) => {
                      const x =
                        60 + ((i + 0.5) * (chartWidth - 80)) / chart.length;
                      const height = (Number(p.revenue) / maximum) * 150;
                      return (
                        <g key={p.date}>
                          <rect
                            x={x - barWidth / 2}
                            y={185 - height}
                            width={barWidth}
                            height={Math.max(2, height)}
                            fill={
                              i === chart.length - 1 ? "#d4643e" : "#aec1a0"
                            }
                            rx="4"
                          >
                            <title>
                              {p.date}: {money(p.revenue)} · {p.orders} orders
                            </title>
                          </rect>
                          {(chart.length <= 14 ||
                            i % Math.ceil(chart.length / 10) === 0) && (
                            <text
                              x={x}
                              y="210"
                              textAnchor="middle"
                              fontSize="9"
                              fill="#7d8874"
                            >
                              {new Date(
                                p.date + "T12:00:00",
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                {Number(data.revenue) === 0 && (
                  <p className="admin-chart-note">
                    Completed deliveries will bring this chart to life.
                  </p>
                )}
              </article>
              <article className="admin-panel">
                <div className="admin-panel-title">
                  <div>
                    <h2>Customer favourites</h2>
                    <p>Your best sellers in this period</p>
                  </div>
                  <span className="admin-mini-label">BY QUANTITY</span>
                </div>
                {data.best_sellers.length ? (
                  data.best_sellers.map((item, i) => (
                    <div className="admin-bestseller" key={item.name}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <b>{item.name}</b>
                        <small>{item.quantity} portions delivered</small>
                      </div>
                      <strong>{money(item.revenue)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="admin-empty compact">
                    <UtensilMark />
                    <h3>Every favourite starts with an order.</h3>
                    <p>Best sellers appear after your first delivered order.</p>
                  </div>
                )}
                <Link to="/admin/menu" className="admin-panel-link">
                  Take a look at your menu
                  <ArrowRight size={15} />
                </Link>
              </article>
            </div>
            <div className="admin-revenue-note">
              <IndianRupee size={20} />
              <div>
                <b>{money(data.collected)} recorded as collected</b>
                <p>
                  Payment collections and food revenue are different measures.
                  Food revenue is not profit.
                </p>
              </div>
              <Link to="/admin/orders">
                View orders <ArrowRight size={15} />
              </Link>
            </div>
          </>
        )
      )}
    </section>
  );
}
function UtensilMark() {
  return <ShoppingBag size={30} />;
}
