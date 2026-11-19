import { useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Layers,
  LogOut,
  ShieldCheck,
  Menu as MenuIcon,
  X,
} from "lucide-react";
import { api } from "../api";
import type { User, Catalog } from "../types";
import { Button } from "../components/ui/button";
import { Dashboard } from "./Dashboard";
import { AdminOrders } from "./Orders";
import { MenuManager, Categories } from "./Menu";
import "./admin.css";

const schema = z.object({
  identifier: z.string().min(3, "Enter your email or mobile"),
  password: z.string().min(1, "Enter your password"),
});
export default function Admin() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("kitchen-token"),
  );
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    enabled: !!token,
    retry: false,
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const allowed = me.data && ["owner", "manager"].includes(me.data.role);
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => api<Catalog>("/catalog"),
  });
  const businessName = catalog.data?.business.name || "Kitchen workspace";
  async function login(v: z.infer<typeof schema>) {
    setError("");
    try {
      const result = await api<{ access_token: string; user: User }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify(v) },
      );
      if (!["owner", "manager"].includes(result.user.role)) {
        setError(
          "This account does not have admin access. Use an owner or manager account.",
        );
        return;
      }
      client.clear();
      sessionStorage.setItem("kitchen-token", result.access_token);
      client.setQueryData(["me"], result.user);
      setToken(result.access_token);
      navigate("/admin");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function logout() {
    sessionStorage.removeItem("kitchen-token");
    setToken(null);
    client.clear();
    form.reset();
    navigate("/admin");
  }
  if (token && me.isPending)
    return <main className="admin-loading">Checking your kitchen access…</main>;
  if (!allowed)
    return (
      <main className="admin-login">
        <section className="admin-login-story">
          <Link to="/" className="admin-wordmark">
            <UtensilsCrossed /> {businessName}
          </Link>
          <span className="admin-story-label">
            YOUR KITCHEN. IN GOOD HANDS.
          </span>
          <h1>
            A calmer kitchen.
            <br />A better business.
          </h1>
          <p>
            Every order, every dish, every small detail.
            <br />
            One simple place to keep it all moving.
          </p>
          <div className="admin-story-mark">
            <UtensilsCrossed size={110} />
          </div>
          <small>Rooted in Kozhikode. Built around your day.</small>
        </section>
        <section className="admin-login-form">
          <Link to="/" className="admin-back">
            <ArrowLeft size={15} /> Back to customer menu
          </Link>
          <div className="admin-login-box">
            <span className="admin-label">
              <ShieldCheck size={16} /> KITCHEN WORKSPACE
            </span>
            <h1>Welcome to your kitchen.</h1>
            <p className="muted">Sign in with your owner or manager account.</p>
            {token && me.data && !allowed && (
              <p className="admin-error">
                You are signed in as a customer. Enter your staff credentials
                below.
              </p>
            )}
            {token && me.isError && (
              <p className="admin-error">
                Your session could not be verified. Sign in again.
              </p>
            )}
            <form className="form" onSubmit={form.handleSubmit(login)}>
              <label>
                Email or mobile number
                <input
                  autoComplete="username"
                  {...form.register("identifier")}
                />
                <span className="error">
                  {form.formState.errors.identifier?.message}
                </span>
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                <span className="error">
                  {form.formState.errors.password?.message}
                </span>
              </label>
              {error && (
                <p role="alert" className="admin-error">
                  {error}
                </p>
              )}
              <Button disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Signing in…"
                  : "Open my dashboard"}
                <ArrowRight size={16} />
              </Button>
            </form>
            <details className="admin-setup">
              <summary>First time? Set up owner access</summary>
              <p>
                In PowerShell, open the <code>backend</code> folder and run:
              </p>
              <code>.venv\Scripts\python.exe -m app.create_owner</code>
              <p>To grant owner access to your existing customer account:</p>
              <code>
                .venv\Scripts\python.exe -m app.create_owner --promote-email
                your@email.com
              </code>
              <p>Then sign in here with that account’s email and password.</p>
            </details>
          </div>
        </section>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobile ? "is-open" : ""}`}>
        <div className="admin-side-brand">
          <span>
            <UtensilsCrossed size={22} />
          </span>
          <div>
            {businessName}
            <small>BUSINESS WORKSPACE</small>
          </div>
          <button
            className="admin-close"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <p className="admin-nav-label">YOUR WORKSPACE</p>
        <nav onClick={() => setMobile(false)}>
          <NavLink to="/admin" end>
            <LayoutDashboard size={18} />
            Overview
          </NavLink>
          <NavLink to="/admin/orders">
            <ShoppingBag size={18} />
            Orders
          </NavLink>
          <NavLink to="/admin/menu">
            <UtensilsCrossed size={18} />
            Food & menu
          </NavLink>
          <NavLink to="/admin/categories">
            <Layers size={18} />
            Categories
          </NavLink>
        </nav>
        <div className="admin-side-bottom">
          <div className="admin-side-note">
            <ShieldCheck size={20} />
            <div>
              Made for your everyday.
              <small>Simple tools. More time for food.</small>
            </div>
          </div>
          <Link to="/">
            <ArrowLeft size={16} /> Visit customer menu
          </Link>
          <button onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="admin-mobile-shade"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="admin-main">
        <div className="admin-topbar">
          <button
            className="admin-menu-button"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <span className="admin-top-title">Your kitchen, at a glance</span>
          <div className="admin-top-right">
            <span className="admin-local-time">
              {catalog.data?.business.address}
            </span>
            <span className="admin-avatar">
              {me.data?.name[0]?.toUpperCase()}
            </span>
            <div>
              <b>{me.data?.name}</b>
              <small>{me.data?.role}</small>
            </div>
          </div>
        </div>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="menu" element={<MenuManager />} />
          <Route path="categories" element={<Categories />} />
          <Route
            path="*"
            element={
              <section className="admin-content">
                <h1>Page not found</h1>
                <Link to="/admin">Return to overview</Link>
              </section>
            }
          />
        </Routes>
      </div>
    </div>
  );
}
