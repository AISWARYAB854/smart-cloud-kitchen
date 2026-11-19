import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Button } from "../components/ui/button";
import { api, money } from "../api";
import type { CartLine, Catalog, User, OrderDetail } from "../types";

const checkoutSchema = z.object({
  customer_name: z.string().min(2, "Enter your name"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile"),
  address: z.string().min(10, "Enter your full delivery address"),
  landmark: z.string(),
  instructions: z.string(),
  scheduled_at: z.string(),
  payment_method: z.string(),
});
type CheckoutValues = z.infer<typeof checkoutSchema>;
function cartSubtotal(data: Catalog, cart: CartLine[]) {
  return cart.reduce((sum, line) => {
    const food = data.foods.find((f) => f.id === line.food_id);
    return (
      sum +
      (Number(food?.sale_price || 0) +
        data.addons
          .filter(
            (a) => line.addon_ids.includes(a.id) && a.food_id === line.food_id,
          )
          .reduce((s, a) => s + Number(a.price), 0)) *
        line.quantity
    );
  }, 0);
}
function Summary({
  data,
  cart,
  area,
}: {
  data: Catalog;
  cart: CartLine[];
  area: number;
}) {
  const subtotal = cartSubtotal(data, cart);
  const delivery = Number(data.areas.find((a) => a.id === area)?.charge || 0);
  const tax = Math.round(subtotal * data.business.tax_rate) / 100;
  return (
    <>
      <div className="summary-line">
        <span>Subtotal</span>
        <b>{money(subtotal)}</b>
      </div>
      <div className="summary-line">
        <span>Delivery</span>
        <b>{money(delivery)}</b>
      </div>
      <div className="summary-line">
        <span>Tax ({data.business.tax_rate}%)</span>
        <b>{money(tax)}</b>
      </div>
      <div className="summary-line total">
        <span>To pay</span>
        <b>{money(subtotal + delivery + tax)}</b>
      </div>
      <p className="muted small">
        Final prices and availability are verified by the kitchen at checkout.
      </p>
    </>
  );
}
export function Cart({
  data,
  cart,
  update,
  area,
  user,
  signIn,
}: {
  data: Catalog;
  cart: CartLine[];
  update: (k: string, d: number) => void;
  area: number;
  user: User | undefined;
  signIn: () => void;
}) {
  return (
    <main className="page">
      <p className="eyebrow">GOOD THINGS IN YOUR BAG</p>
      <h1>Your next delicious meal.</h1>
      {!cart.length ? (
        <EmptyBag />
      ) : (
        <div className="checkout-grid">
          <section className="panel">
            {cart.map((line) => {
              const food = data.foods.find((f) => f.id === line.food_id);
              return (
                <div className="cart-line" key={line.key}>
                  {food && <img src={food.image} alt={food.name} />}
                  <div>
                    <h3>{food?.name || "Item no longer available"}</h3>
                    <p>{money(food?.sale_price || 0)}</p>
                    {data.addons
                      .filter((a) => line.addon_ids.includes(a.id))
                      .map((a) => (
                        <small key={a.id}>
                          {a.name} +{money(a.price)}{" "}
                        </small>
                      ))}
                    {line.instructions && (
                      <p className="muted small">
                        Chef note: {line.instructions}
                      </p>
                    )}
                  </div>
                  <div className="stepper">
                    <button
                      aria-label="Remove one"
                      onClick={() => update(line.key, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    {line.quantity}
                    <button
                      aria-label="Add one"
                      onClick={() => update(line.key, 1)}
                      disabled={line.quantity === 30}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            <Link to="/" className="text-link">
              Add something else <Plus size={16} />
            </Link>
          </section>
          <aside className="panel">
            <h2>Order summary</h2>
            <Summary data={data} cart={cart} area={area} />
            {user ? (
              <Link to="/checkout" className="button primary full">
                Continue to checkout <ArrowRight size={17} />
              </Link>
            ) : (
              <Button className="full" onClick={signIn}>
                Sign in to checkout <ArrowRight size={17} />
              </Button>
            )}
            <p className="muted small">
              Delivering to {data.areas.find((a) => a.id === area)?.name}.
              Change your area in the header.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
function EmptyBag() {
  return (
    <div className="state">
      <ShoppingBag size={44} />
      <h2>Your bag is waiting for something good.</h2>
      <Link to="/" className="button primary">
        Explore the menu
      </Link>
    </div>
  );
}
export function Checkout({
  data,
  cart,
  area,
  user,
  signIn,
  clear,
}: {
  data: Catalog;
  cart: CartLine[];
  area: number;
  user: User | undefined;
  signIn: () => void;
  clear: () => void;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customer_name: user?.name || "",
      phone: user?.phone || "",
      address: "",
      landmark: "",
      instructions: "",
      scheduled_at: "",
      payment_method: "cod",
    },
  });
  useEffect(() => {
    if (user) {
      form.setValue("customer_name", user.name);
      form.setValue("phone", user.phone);
    }
  }, [user, form]);
  useEffect(() => {
    setConfirmed(false);
    setServerTotal(null);
  }, [area, cart]);
  const values = form.watch();
  async function submit(v: CheckoutValues) {
    setError("");
    try {
      const payload = {
        ...v,
        area_id: area,
        items: cart.map(({ key, ...l }) => l),
        scheduled_at: v.scheduled_at
          ? new Date(v.scheduled_at).toISOString()
          : null,
      };
      if (!confirmed) {
        const quote = await api<{ total: number }>("/orders/quote", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setServerTotal(quote.total);
        setConfirmed(true);
        return;
      }
      const result = await api<OrderDetail>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      clear();
      navigate("/orders", { state: { number: result.order.number } });
    } catch (e) {
      setError((e as Error).message);
      setConfirmed(false);
    }
  }
  const slots = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return data.business.delivery_slots.map(
      (time) => `${day}T${time}:00+05:30`,
    );
  })
    .flat()
    .filter(
      (v) =>
        new Date(v).getTime() >
        Date.now() + data.business.preparation_minutes * 60000,
    );
  if (!user)
    return (
      <main className="state">
        <h1>Sign in to finish your order</h1>
        <Button onClick={signIn}>Sign in</Button>
      </main>
    );
  if (!cart.length)
    return (
      <main className="page">
        <EmptyBag />
      </main>
    );
  return (
    <main className="page">
      <p className="eyebrow">ONE LAST THING</p>
      <h1>Where should we bring the good food?</h1>
      <form
        onSubmit={form.handleSubmit(submit)}
        onChange={() => {
          setConfirmed(false);
          setServerTotal(null);
        }}
        className="checkout-grid"
      >
        <section className="panel form">
          <h2>Delivery details</h2>
          {(
            [
              "customer_name",
              "phone",
              "address",
              "landmark",
              "instructions",
            ] as const
          ).map((field, i) => (
            <label key={field}>
              {
                [
                  "Your name",
                  "Mobile number",
                  "Full delivery address",
                  "Landmark (optional)",
                  "Delivery instructions (optional)",
                ][i]
              }
              {field === "address" || field === "instructions" ? (
                <textarea {...form.register(field)} />
              ) : (
                <input
                  {...form.register(field)}
                  maxLength={field === "phone" ? 10 : 150}
                  inputMode={field === "phone" ? "tel" : "text"}
                />
              )}
              <span className="error">
                {form.formState.errors[field]?.message}
              </span>
            </label>
          ))}
          <label>
            When would you like it?
            <select {...form.register("scheduled_at")}>
              <option value="">As soon as possible</option>
              {slots.map((s) => (
                <option key={s} value={s}>
                  {new Date(s).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment method
            <select {...form.register("payment_method")}>
              {data.business.payment_methods.map((m) => (
                <option key={m} value={m}>
                  {m === "cod" ? "Cash on delivery" : m}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Online and UPI payments will be available once the kitchen connects
            its payment provider.
          </p>
        </section>
        <aside className="panel">
          <h2>Your order</h2>
          {cart.map((l) => (
            <div className="summary-line" key={l.key}>
              <span>
                {l.quantity} ×{" "}
                {data.foods.find((f) => f.id === l.food_id)?.name}
              </span>
            </div>
          ))}
          <hr />
          <Summary data={data} cart={cart} area={area} />
          <p className="small">
            Delivery area: <b>{data.areas.find((a) => a.id === area)?.name}</b>
          </p>
          <p className="small">
            {values.scheduled_at
              ? "Scheduled delivery"
              : "Freshly prepared after confirmation"}{" "}
            · {data.business.preparation_minutes}–
            {data.business.preparation_minutes + 15} minutes
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {confirmed && (
            <p className="success">
              <Check size={17} /> Kitchen verified total:{" "}
              {money(serverTotal || 0)}. Confirm to place your order.
            </p>
          )}
          <Button className="full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Please wait…"
              : confirmed
                ? "Confirm & place order"
                : "Review final total"}
            <ArrowRight size={17} />
          </Button>
        </aside>
      </form>
    </main>
  );
}
