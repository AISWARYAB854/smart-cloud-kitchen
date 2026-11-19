import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  Clock,
  Flame,
  Heart,
  Leaf,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { money } from "../api";
import type { Food, Catalog } from "../types";

export function Menu({
  data,
  add,
}: {
  data: Catalog;
  add: (f: Food, q?: number, a?: number[], i?: string) => void;
}) {
  const [category, setCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [veg, setVeg] = useState(false);
  const [available, setAvailable] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addons, setAddons] = useState<number[]>([]);
  const [instructions, setInstructions] = useState("");
  const [filters, setFilters] = useState(false);
  let foods = data.foods.filter(
    (f) =>
      (!category || category === f.category_id) &&
      (!veg || f.vegetarian) &&
      (!available || f.available) &&
      `${f.name} ${f.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  foods = [...foods].sort((a, b) =>
    sort === "low"
      ? Number(a.sale_price) - Number(b.sale_price)
      : sort === "high"
        ? Number(b.sale_price) - Number(a.sale_price)
        : Number(b.bestseller) - Number(a.bestseller),
  );
  function open(food: Food) {
    setSelected(food);
    setQuantity(1);
    setAddons([]);
    setInstructions("");
  }
  const categoryIcons = ["🍲", "🍛", "🍗", "🥘", "🥬", "🍌", "🥤", "🍱"];
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-label">
            <span /> FROM OUR KITCHEN, WITH LOVE
          </span>
          <h1>
            A little Malabar.
            <br />A lot of <em>flavour.</em>
          </h1>
          <p>
            Slow-cooked traditions. Fresh local ingredients.
            <br />
            Your favourite Kozhikode flavours, at your doorstep.
          </p>
          <a href="#menu" className="button primary">
            Explore the menu <ArrowUpRight size={18} />
          </a>
          <div className="hero-proof">
            <span>
              <span className="stars">★★★★★</span> Loved by local foodies
            </span>
            <span>
              <Clock size={14} /> Fresh in {data.business.preparation_minutes}–
              {data.business.preparation_minutes + 10} min
            </span>
          </div>
        </div>
        <div className="hero-photo">
          <img
            src={data.foods[0]?.image}
            alt="Fragrant Malabar chicken biryani with rice and spices"
          />
          <div className="photo-shade" />
          <span className="photo-tag">
            <Flame size={15} /> THE MALABAR ORIGINAL
          </span>
          <div className="photo-caption">
            <span>Tradition in every bite.</span>
            <small>Authentic Malabar Chicken Biryani</small>
          </div>
          <div className="fresh-seal">
            FRESH
            <br />
            <Leaf size={23} />
            <br />
            NOTHING LESS
          </div>
        </div>
      </section>
      <div className="promises">
        <span>
          <ChefHat /> Cooked fresh, not reheated
        </span>
        <span>
          <Leaf /> Good ingredients. Honest food.
        </span>
        <span>
          <Truck /> Delivered with care
        </span>
        <span>
          <Heart /> A taste of home
        </span>
      </div>
      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SOMETHING FOR EVERY CRAVING</p>
            <h2>
              What sounds good today?
              <span> Explore our menu, find your favourite.</span>
            </h2>
          </div>
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Search dishes"
              placeholder="Search for your favourite dish…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="categories">
          <button
            className={!category ? "active" : ""}
            onClick={() => setCategory(0)}
          >
            <span>🍽️</span>All dishes
          </button>
          {data.categories.map((c, i) => (
            <button
              key={c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => setCategory(c.id)}
            >
              <span>{categoryIcons[i]}</span>
              {c.name}
            </button>
          ))}
        </div>
        <div className="menu-toolbar">
          <div>
            <b>
              {category
                ? data.categories.find((c) => c.id === category)?.name
                : "Made for your cravings"}
            </b>
            <span>{foods.length} dishes to fall in love with</span>
          </div>
          <div className="filter-actions">
            <button
              className={veg ? "filter selected" : "filter"}
              onClick={() => setVeg(!veg)}
            >
              <Leaf size={14} /> Veg only
            </button>
            <button
              className={filters ? "filter selected" : "filter"}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={14} /> Filters
            </button>
            <select
              aria-label="Sort menu"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recommended">Recommended</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
              />{" "}
              Available dishes only
            </label>
            <button
              onClick={() => {
                setAvailable(false);
                setVeg(false);
                setSort("recommended");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
        {foods.length === 0 ? (
          <div className="state">
            <Search />
            <h3>No dishes found</h3>
            <p>Try another search or category.</p>
          </div>
        ) : (
          <div className="food-grid">
            {foods.map((food) => (
              <article className="food-card" key={food.id}>
                <button
                  className="food-image"
                  onClick={() => open(food)}
                  aria-label={`View ${food.name}`}
                >
                  <img src={food.image} alt={food.name} loading="lazy" />
                  {food.bestseller ? (
                    <span className="food-badge">
                      <Star size={11} fill="currentColor" /> Bestseller
                    </span>
                  ) : food.special ? (
                    <span className="food-badge special">
                      <Sparkles size={12} /> Kitchen special
                    </span>
                  ) : null}
                  <span
                    className={`diet ${food.vegetarian ? "veg" : "nonveg"}`}
                  >
                    <i />
                  </span>
                </button>
                <div className="food-content">
                  <div className="food-meta">
                    <span>
                      {
                        data.categories.find((c) => c.id === food.category_id)
                          ?.name
                      }
                    </span>
                    <span>
                      <Clock size={11} />
                      {food.preparation_minutes} min
                    </span>
                  </div>
                  <button className="food-title" onClick={() => open(food)}>
                    {food.name}
                  </button>
                  <p>{food.description}</p>
                  <div className="food-bottom">
                    <div>
                      <strong>{money(food.sale_price)}</strong>
                      {Number(food.price) > Number(food.sale_price) && (
                        <del>{money(food.price)}</del>
                      )}
                    </div>
                    <button
                      className="add-button"
                      disabled={!food.available}
                      onClick={() => open(food)}
                    >
                      {food.available ? (
                        <>
                          ADD <Plus size={15} />
                        </>
                      ) : (
                        "Sold out"
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="bottom-banner">
        <span className="banner-icon">
          <UtensilsCrossed size={30} />
        </span>
        <div>
          <p className="eyebrow">REAL FOOD. REAL ROOTS.</p>
          <h2>From Kozhikode, with a whole lot of love.</h2>
          <p>Our recipes have a history. Every meal makes a new memory.</p>
        </div>
        <span className="banner-script">
          Stay hungry.
          <br />
          Eat happy.
        </span>
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title={selected?.name || "Dish details"}
      >
        {selected && (
          <>
            <img
              className="detail-image"
              src={selected.image}
              alt={selected.name}
            />
            <p>{selected.description}</p>
            <p className="muted">
              {selected.portion} · {selected.preparation_minutes} min
            </p>
            <h3>What goes into it</h3>
            <p className="muted">
              {selected.ingredients}. Please contact the kitchen about allergies
              before ordering.
            </p>
            {data.addons
              .filter((a) => a.food_id === selected.id)
              .map((a) => (
                <label className="addon" key={a.id}>
                  <input
                    type="checkbox"
                    checked={addons.includes(a.id)}
                    onChange={(e) =>
                      setAddons((old) =>
                        e.target.checked
                          ? [...old, a.id]
                          : old.filter((id) => id !== a.id),
                      )
                    }
                  />
                  {a.name}
                  <b>+{money(a.price)}</b>
                </label>
              ))}
            <label className="field">
              A little note for the chef
              <textarea
                placeholder="Less spicy, no onions…"
                maxLength={300}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </label>
            <div className="detail-actions">
              <div className="stepper">
                <button
                  aria-label="Decrease quantity"
                  disabled={quantity === 1}
                  onClick={() => setQuantity((q) => q - 1)}
                >
                  <Minus size={16} />
                </button>
                {quantity}
                <button
                  aria-label="Increase quantity"
                  disabled={quantity === 30}
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                disabled={!selected.available}
                onClick={() => {
                  add(selected, quantity, addons, instructions);
                  setSelected(null);
                }}
              >
                Add to bag ·{" "}
                {money(
                  (Number(selected.sale_price) +
                    data.addons
                      .filter((a) => addons.includes(a.id))
                      .reduce((s, a) => s + Number(a.price), 0)) *
                    quantity,
                )}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </main>
  );
}
