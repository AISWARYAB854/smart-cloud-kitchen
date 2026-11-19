import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Pencil,
  Upload,
  Leaf,
  Archive,
  Check,
  X,
  ImagePlus,
  Layers,
} from "lucide-react";
import { api, money } from "../api";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { type AdminMenu, type AdminFood, type Category } from "./types";

function useMenu() {
  return useQuery({
    queryKey: ["admin", "menu"],
    queryFn: () => api<AdminMenu>("/admin/menu"),
  });
}
function useRefresh() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ["admin"] });
    client.invalidateQueries({ queryKey: ["catalog"] });
  };
}
export function MenuManager() {
  const menu = useMenu();
  const refresh = useRefresh();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<AdminFood | null | undefined>(
    undefined,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const toggle = useMutation({
    mutationFn: (food: AdminFood) =>
      api(`/admin/menu/${food.id}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ available: !food.available }),
      }),
    onSuccess: () => {
      refresh();
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  const foods =
    menu.data?.foods.filter(
      (f) =>
        f.archived === archived &&
        (!category || f.category_id === Number(category)) &&
        f.name.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-label">THE HEART OF YOUR KITCHEN</p>
          <h1>
            A menu worth coming back for<span>.</span>
          </h1>
          <p className="muted">
            Keep dishes fresh, prices clear and availability up to date.
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add a dish
        </Button>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          <Check size={15} />
          {notice}
        </p>
      )}
      <div className="admin-order-toolbar">
        <label className="admin-search">
          <Search size={17} />
          <input
            placeholder="Find a dish…"
            aria-label="Search admin menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {menu.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          <Archive size={14} />
          Show archived
        </label>
        <span className="admin-refresh-hint">{foods.length} dishes</span>
      </div>
      {menu.isPending ? (
        <p className="admin-empty">Loading your menu…</p>
      ) : menu.isError ? (
        <p className="admin-error">{menu.error.message}</p>
      ) : !foods.length ? (
        <div className="admin-panel admin-empty">
          <ImagePlus size={35} />
          <h2>No dishes found.</h2>
          <p>Add your first dish or change the filters.</p>
        </div>
      ) : (
        <div className="admin-menu-grid">
          {foods.map((food) => (
            <article
              key={food.id}
              className={`admin-dish ${!food.available ? "sold-out" : ""}`}
            >
              <div className="admin-dish-image">
                <img src={food.image} alt={food.name} />
                <span
                  className={food.vegetarian ? "admin-diet veg" : "admin-diet"}
                >
                  {food.vegetarian ? (
                    <>
                      <Leaf size={11} />
                      Veg
                    </>
                  ) : (
                    "Non-veg"
                  )}
                </span>
                {food.bestseller && (
                  <span className="admin-best-tag">Bestseller</span>
                )}
              </div>
              <div className="admin-dish-content">
                <p>
                  {
                    menu.data?.categories.find((c) => c.id === food.category_id)
                      ?.name
                  }{" "}
                  · {food.preparation_minutes} min
                </p>
                <h2>{food.name}</h2>
                <div className="admin-dish-price">
                  <strong>{money(food.sale_price)}</strong>
                  {Number(food.price) > Number(food.sale_price) && (
                    <del>{money(food.price)}</del>
                  )}
                  <button
                    aria-label={`Edit ${food.name}`}
                    onClick={() => setEditing(food)}
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                </div>
                <div className="admin-dish-availability">
                  <span>
                    {food.archived
                      ? "Archived"
                      : food.available
                        ? "Available to order"
                        : "Sold out"}
                  </span>
                  <button
                    className={`admin-toggle ${food.available ? "on" : ""}`}
                    role="switch"
                    aria-checked={food.available}
                    aria-label={`Availability of ${food.name}`}
                    disabled={toggle.isPending || food.archived}
                    onClick={() => toggle.mutate(food)}
                  >
                    <i />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {menu.data && (
        <FoodEditor
          key={editing?.id ?? (editing === null ? "new" : "closed")}
          food={editing}
          menu={menu.data}
          close={() => setEditing(undefined)}
          saved={() => {
            setEditing(undefined);
            refresh();
            setNotice("Menu saved. Customers will see the updated dish.");
          }}
        />
      )}
    </section>
  );
}

const foodSchema = z
  .object({
    category_id: z.number().int().positive("Choose a category"),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(5).max(500),
    ingredients: z.string().trim().min(2).max(500),
    portion: z.string().trim().min(2).max(80),
    price: z.number().positive().max(99999999),
    sale_price: z.number().positive().max(99999999),
    image: z.string().min(1, "Upload a photo or enter its URL"),
    vegetarian: z.boolean(),
    available: z.boolean(),
    bestseller: z.boolean(),
    special: z.boolean(),
    preparation_minutes: z.number().int().min(1).max(240),
    archived: z.boolean(),
  })
  .refine((v) => v.sale_price <= v.price, {
    path: ["sale_price"],
    message: "Selling price cannot exceed the regular price",
  });
type FoodValues = z.infer<typeof foodSchema>;
function FoodEditor({
  food,
  menu,
  close,
  saved,
}: {
  food: AdminFood | null | undefined;
  menu: AdminMenu;
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addons, setAddons] = useState<
    { id?: number; name: string; price: number }[]
  >(
    menu.addons
      .filter((a) => a.food_id === food?.id)
      .map((a) => ({ id: a.id, name: a.name, price: Number(a.price) })),
  );
  const form = useForm<FoodValues>({
    resolver: zodResolver(foodSchema),
    defaultValues: food
      ? {
          ...food,
          price: Number(food.price),
          sale_price: Number(food.sale_price),
        }
      : {
          category_id: menu.categories[0]?.id || 0,
          name: "",
          description: "",
          ingredients: "",
          portion: "Serves 1",
          price: 199,
          sale_price: 199,
          image: "",
          vegetarian: false,
          available: true,
          bestseller: false,
          special: false,
          preparation_minutes: 25,
          archived: false,
        },
  });
  const mutation = useMutation({
    mutationFn: (values: FoodValues) =>
      api(food ? `/admin/menu/${food.id}` : "/admin/menu", {
        method: food ? "PUT" : "POST",
        body: JSON.stringify({ ...values, addons }),
      }),
    onSuccess: saved,
    onError: (e) => setError(e.message),
  });
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a photo smaller than 5 MB");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/admin/images", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      form.setValue("image", result.url, { shouldValidate: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const image = form.watch("image");
  return (
    <Dialog
      open={food !== undefined}
      onOpenChange={(v) => !v && !mutation.isPending && !uploading && close()}
      title={food ? "Edit your dish" : "Add something delicious"}
    >
      <form
        className="form admin-food-form"
        onSubmit={form.handleSubmit((v) => {
          setError("");
          mutation.mutate(v);
        })}
      >
        <div className="admin-upload">
          {image && <img src={image} alt="Dish preview" />}
          <label>
            <Upload size={19} />
            {uploading ? "Uploading photo…" : "Upload food photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || mutation.isPending}
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <small>JPEG, PNG or WebP · up to 5 MB</small>
          </label>
        </div>
        <label>
          Or use an HTTPS image URL
          <input {...form.register("image")} placeholder="https://…" />
          <span className="error">{form.formState.errors.image?.message}</span>
        </label>
        <label>
          Dish name
          <input {...form.register("name")} maxLength={120} />
          <span className="error">{form.formState.errors.name?.message}</span>
        </label>
        <div className="admin-form-row">
          <label>
            Category
            <select {...form.register("category_id", { valueAsNumber: true })}>
              {menu.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            <span className="error">
              {form.formState.errors.category_id?.message}
            </span>
          </label>
          <label>
            Preparation (minutes)
            <input
              type="number"
              min={1}
              max={240}
              {...form.register("preparation_minutes", { valueAsNumber: true })}
            />
            <span className="error">
              {form.formState.errors.preparation_minutes?.message}
            </span>
          </label>
        </div>
        <label>
          Description
          <textarea {...form.register("description")} maxLength={500} />
          <span className="error">
            {form.formState.errors.description?.message}
          </span>
        </label>
        <label>
          Ingredients
          <textarea {...form.register("ingredients")} maxLength={500} />
          <span className="error">
            {form.formState.errors.ingredients?.message}
          </span>
        </label>
        <label>
          Portion size
          <input {...form.register("portion")} maxLength={80} />
          <span className="error">
            {form.formState.errors.portion?.message}
          </span>
        </label>
        <div className="admin-form-row">
          <label>
            Regular price (₹)
            <input
              type="number"
              min="0.01"
              step="0.01"
              {...form.register("price", { valueAsNumber: true })}
            />
            <span className="error">
              {form.formState.errors.price?.message}
            </span>
          </label>
          <label>
            Selling price (₹)
            <input
              type="number"
              min="0.01"
              step="0.01"
              {...form.register("sale_price", { valueAsNumber: true })}
            />
            <span className="error">
              {form.formState.errors.sale_price?.message}
            </span>
          </label>
        </div>
        <div className="admin-form-checks">
          {[
            ["vegetarian", "Vegetarian"],
            ["available", "Available to order"],
            ["bestseller", "Bestseller"],
            ["special", "Kitchen special"],
            ["archived", "Archive this dish"],
          ].map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" {...form.register(key as "vegetarian")} />
              {label}
            </label>
          ))}
        </div>
        <div className="admin-addon-editor">
          <div>
            <h3>Optional add-ons</h3>
            <button
              type="button"
              onClick={() => setAddons((a) => [...a, { name: "", price: 0 }])}
              disabled={addons.length >= 20}
            >
              <Plus size={14} />
              Add option
            </button>
          </div>
          {addons.map((addon, i) => (
            <div className="admin-addon-row" key={i}>
              <input
                placeholder="Add-on name"
                aria-label={`Add-on ${i + 1} name`}
                minLength={2}
                maxLength={80}
                required
                value={addon.name}
                onChange={(e) =>
                  setAddons((old) =>
                    old.map((a, j) =>
                      i === j ? { ...a, name: e.target.value } : a,
                    ),
                  )
                }
              />
              <input
                type="number"
                aria-label={`Add-on ${i + 1} price`}
                min="0"
                step="0.01"
                required
                value={addon.price}
                onChange={(e) =>
                  setAddons((old) =>
                    old.map((a, j) =>
                      i === j ? { ...a, price: Number(e.target.value) } : a,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label="Remove add-on"
                onClick={() =>
                  setAddons((old) => old.filter((_, j) => j !== i))
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        <div className="admin-editor-actions">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || uploading}
            onClick={close}
          >
            Cancel
          </Button>
          <Button disabled={mutation.isPending || uploading}>
            {mutation.isPending ? "Saving…" : "Save dish"}
            <Check size={16} />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Categories() {
  const menu = useMenu();
  const refresh = useRefresh();
  const [editing, setEditing] = useState<Category | null | undefined>(
    undefined,
  );
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (data: {
      id?: number;
      name: string;
      position: number;
      active: boolean;
    }) =>
      api(data.id ? `/admin/categories/${data.id}` : "/admin/categories", {
        method: data.id ? "PUT" : "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      refresh();
      setEditing(undefined);
      setError("");
    },
    onError: (e) => setError(e.message),
  });
  return (
    <section className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="admin-label">A PLACE FOR EVERY FLAVOUR</p>
          <h1>
            Make your menu easy to explore<span>.</span>
          </h1>
          <p className="muted">
            Organise dishes into categories customers can browse.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setError("");
          }}
        >
          <Plus size={16} />
          New category
        </Button>
      </div>
      {menu.isPending ? (
        <p className="admin-empty">Loading categories…</p>
      ) : menu.isError ? (
        <p className="admin-error">{menu.error.message}</p>
      ) : (
        <div className="admin-panel admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Menu dishes</th>
                <th>Display order</th>
                <th>Visibility</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {menu.data.categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="admin-category-icon">
                      <Layers size={17} />
                    </span>
                    <b>{c.name}</b>
                  </td>
                  <td>
                    {
                      menu.data.foods.filter(
                        (f) => f.category_id === c.id && !f.archived,
                      ).length
                    }{" "}
                    dishes
                  </td>
                  <td>{c.position}</td>
                  <td>
                    <span
                      className={`admin-status ${c.active ? "status-delivered" : "status-cancelled"}`}
                    >
                      {c.active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="admin-category-edit"
                      onClick={() => {
                        setEditing(c);
                        setError("");
                      }}
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(v) => !v && !mutation.isPending && setEditing(undefined)}
        title={editing ? "Edit category" : "New category"}
      >
        {editing !== undefined && (
          <form
            key={editing?.id || "new"}
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              mutation.mutate({
                id: editing?.id,
                name: String(values.get("name")),
                position: Number(values.get("position")),
                active: values.get("active") === "on",
              });
            }}
          >
            <label>
              Category name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={editing?.name || ""}
              />
            </label>
            <label>
              Display order
              <input
                name="position"
                type="number"
                min={0}
                max={999}
                required
                defaultValue={
                  editing?.position ?? menu.data?.categories.length ?? 0
                }
              />
            </label>
            <label className="admin-check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing?.active ?? true}
              />
              Visible to customers
            </label>
            <p className="muted small">
              Hiding a category hides its dishes from the customer menu and
              prevents new orders for them.
            </p>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save category"}
              <Check size={16} />
            </Button>
          </form>
        )}
      </Dialog>
    </section>
  );
}
