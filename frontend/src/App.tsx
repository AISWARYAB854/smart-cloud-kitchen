import { useEffect, useState } from "react";
import { Link, NavLink, Routes, Route, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  ChefHat,
  Check,
  Clock,
  Home,
  Leaf,
  MapPin,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
  LogOut,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Dialog } from "./components/ui/dialog";
import { api } from "./api";
import type { Food, CartLine, Catalog, User } from "./types";

import { Menu } from "./pages/Menu";
import { Cart, Checkout } from "./pages/Ordering";
import { Orders } from "./pages/Orders";

function readCart(): CartLine[] {
  try {
    const v = JSON.parse(localStorage.getItem("kitchen-cart") || "[]");
    return z
      .array(
        z.object({
          key: z.string(),
          food_id: z.number().int(),
          quantity: z.number().int().min(1).max(30),
          addon_ids: z.array(z.number().int()),
          instructions: z.string(),
        }),
      )
      .parse(v);
  } catch {
    return [];
  }
}
const authSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  identifier: z.string(),
  password: z.string().min(10, "Use at least 10 characters"),
});

export default function App() {
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => api<Catalog>("/catalog"),
  });
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [auth, setAuth] = useState(false);
  const [register, setRegister] = useState(false);
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const navigate = useNavigate();
  const userQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    enabled: !!sessionStorage.getItem("kitchen-token"),
    retry: false,
  });
  const user = userQuery.data;
  const data = catalog.data;
  const [area, setArea] = useState(() =>
    Number(localStorage.getItem("kitchen-area") || "0"),
  );
  useEffect(() => {
    localStorage.setItem("kitchen-cart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("kitchen-area", String(area));
  }, [area]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    if (data && !data.areas.some((a) => a.id === area))
      setArea(data.areas[0]?.id || 0);
  }, [data, area]);
  const add = (
    food: Food,
    quantity = 1,
    addon_ids: number[] = [],
    instructions = "",
  ) => {
    const key = `${food.id}-${[...addon_ids].sort().join(",")}-${instructions}`;
    setCart((old) => {
      const exists = old.find((l) => l.key === key);
      return exists
        ? old.map((l) =>
            l.key === key
              ? { ...l, quantity: Math.min(30, l.quantity + quantity) }
              : l,
          )
        : [
            ...old,
            { key, food_id: food.id, quantity, addon_ids, instructions },
          ];
    });
    setNotice(`${food.name} added to your bag`);
  };
  const update = (key: string, delta: number) =>
    setCart((old) =>
      old
        .map((l) =>
          l.key === key
            ? { ...l, quantity: Math.min(30, l.quantity + delta) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const authForm = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      identifier: "",
      password: "",
    },
  });
  const [authError, setAuthError] = useState("");
  async function authenticate(values: z.infer<typeof authSchema>) {
    setAuthError("");
    try {
      if (register) {
        z.string().min(2).parse(values.name);
        z.string().email().parse(values.email);
        z.string()
          .regex(/^[6-9]\d{9}$/)
          .parse(values.phone);
      }
      const result = await api<{ access_token: string; user: User }>(
        register ? "/auth/register" : "/auth/login",
        { method: "POST", body: JSON.stringify(values) },
      );
      sessionStorage.setItem("kitchen-token", result.access_token);
      client.setQueryData(["me"], result.user);
      setAuth(false);
      authForm.reset();
      setNotice(`Welcome, ${result.user.name}`);
    } catch (e) {
      setAuthError(
        e instanceof z.ZodError
          ? "Check your name, email and mobile number."
          : (e as Error).message,
      );
    }
  }
  return (
    <>
      <div className="announcement">
        <span>Good food. Good mood. A little taste of Malabar.</span>
        <span>
          <Leaf size={12} /> Freshly prepared, every single day
        </span>
      </div>
      <header>
        <div className="header-inner">
          <Link to="/" className="brand">
            <div className="brand-icon">
              <UtensilsCrossed size={24} />
            </div>
            <div>
              {data?.business.name || "The Malabar Kitchen"}
              <small>ROOTED IN KOZHIKODE</small>
            </div>
          </Link>
          <label className="location">
            <MapPin size={19} />
            <span>
              Delivering to
              <select
                aria-label="Delivery area"
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
              >
                {data?.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <nav>
            <NavLink to="/" end>
              Our menu
            </NavLink>
            <NavLink to="/orders">My orders</NavLink>
          </nav>
          <button
            className="account"
            onClick={() => (user ? navigate("/account") : setAuth(true))}
          >
            <UserRound size={19} />
            <span>{user?.name.split(" ")[0] || "Sign in"}</span>
          </button>
          <Link className="bag" to="/cart">
            <ShoppingBag size={18} />
            <span>My bag</span>
            <b>{count}</b>
          </Link>
        </div>
      </header>
      {catalog.isPending ? (
        <main className="state">
          <ChefHat size={42} />
          <h1>Getting the kitchen ready…</h1>
        </main>
      ) : catalog.isError ? (
        <main className="state">
          <ChefHat size={42} />
          <h1>The kitchen is a connection away</h1>
          <p>Start the API, run migrations and seed the menu to begin.</p>
          <p className="error">{catalog.error.message}</p>
          <Button onClick={() => catalog.refetch()}>Try again</Button>
        </main>
      ) : (
        data && (
          <Routes>
            <Route path="/" element={<Menu data={data} add={add} />} />
            <Route
              path="/cart"
              element={
                <Cart
                  data={data}
                  cart={cart}
                  update={update}
                  area={area}
                  user={user}
                  signIn={() => setAuth(true)}
                />
              }
            />
            <Route
              path="/checkout"
              element={
                <Checkout
                  data={data}
                  cart={cart}
                  area={area}
                  user={user}
                  signIn={() => setAuth(true)}
                  clear={() => setCart([])}
                />
              }
            />
            <Route
              path="/orders"
              element={<Orders user={user} signIn={() => setAuth(true)} />}
            />
            <Route
              path="/account"
              element={
                <main className="page narrow">
                  <p className="eyebrow">YOUR LITTLE CORNER</p>
                  <h1>Your account</h1>
                  {user ? (
                    <section className="panel">
                      <h2>{user.name}</h2>
                      <p>{user.email}</p>
                      <p>{user.phone}</p>
                      <Link to="/orders" className="text-link">
                        View order history <ArrowRight size={16} />
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => {
                          sessionStorage.removeItem("kitchen-token");
                          client.removeQueries({ queryKey: ["me"] });
                          client.removeQueries({ queryKey: ["orders"] });
                          navigate("/");
                          setNotice("Signed out");
                        }}
                      >
                        <LogOut size={16} /> Sign out
                      </Button>
                    </section>
                  ) : (
                    <Button onClick={() => setAuth(true)}>Sign in</Button>
                  )}
                </main>
              }
            />
            <Route
              path="*"
              element={
                <main className="state">
                  <h1>Page not found</h1>
                  <Link to="/">Back to the menu</Link>
                </main>
              }
            />
          </Routes>
        )
      )}
      <footer>
        <Link to="/" className="brand">
          <UtensilsCrossed size={22} />
          <div>
            {data?.business.name || "The Malabar Kitchen"}
            <small>A LITTLE MALABAR. A LOT OF LOVE.</small>
          </div>
        </Link>
        <p>
          {data?.business.address || "Kozhikode, Kerala"} ·{" "}
          {data?.business.opening}–{data?.business.closing}
        </p>
        {data?.business.phone && (
          <a href={`tel:${data.business.phone}`}>Call the kitchen</a>
        )}
        {data?.business.whatsapp && (
          <a
            href={`https://wa.me/91${data.business.whatsapp}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp support
          </a>
        )}
        <span>Made fresh. Made for you.</span>
        <Link to="/admin">Kitchen workspace</Link>
      </footer>
      <div className="mobile-nav">
        <NavLink to="/">
          <Home />
          Menu
        </NavLink>
        <NavLink to="/orders">
          <Clock />
          Orders
        </NavLink>
        <NavLink to="/cart">
          <ShoppingBag />
          Bag ({count})
        </NavLink>
        <button onClick={() => (user ? navigate("/account") : setAuth(true))}>
          <UserRound />
          Account
        </button>
      </div>
      <Dialog
        open={auth}
        onOpenChange={setAuth}
        title={register ? "Make yourself at home" : "Welcome back"}
      >
        <p className="muted">
          {register
            ? "Create an account to place your first order."
            : "Sign in to order your Malabar favourites."}
        </p>
        <form onSubmit={authForm.handleSubmit(authenticate)} className="form">
          {register ? (
            <>
              <label>
                Your name
                <input
                  {...authForm.register("name")}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  {...authForm.register("email")}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Mobile number
                <input
                  {...authForm.register("phone")}
                  inputMode="tel"
                  maxLength={10}
                  autoComplete="tel-national"
                  required
                />
              </label>
            </>
          ) : (
            <label>
              Email or mobile number
              <input
                {...authForm.register("identifier")}
                autoComplete="username"
                required
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              {...authForm.register("password")}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
          </label>
          {authForm.formState.errors.password && (
            <p className="error">
              {authForm.formState.errors.password.message}
            </p>
          )}
          {authError && (
            <p className="error" role="alert">
              {authError}
            </p>
          )}
          <Button disabled={authForm.formState.isSubmitting}>
            {authForm.formState.isSubmitting
              ? "Please wait…"
              : register
                ? "Create account"
                : "Sign in"}{" "}
            <ArrowRight size={17} />
          </Button>
        </form>
        <button
          className="auth-switch"
          onClick={() => {
            setRegister(!register);
            setAuthError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </Dialog>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
    </>
  );
}
