from sqlalchemy import select
from .db import SessionLocal
from .models import Role, Category, Food, Addon, DeliveryArea, BusinessSetting

def seed(db):
    for name in ["customer", "owner", "manager", "kitchen", "delivery"]:
        if not db.scalar(select(Role).where(Role.name == name)):
            db.add(Role(name=name))
    if db.scalar(select(Category)):
        db.commit()
        return
    names = ["Biryani", "Malabar Meals", "Chicken Specials", "Beef Specials", "Vegetarian", "Snacks", "Drinks", "Combos"]
    categories = [Category(name=n, position=i) for i, n in enumerate(names)]
    db.add_all(categories)
    db.flush()
    dishes = [
        (0, "Malabar Chicken Biryani", "Fragrant kaima rice, tender chicken and the warmth of Malabar spices. Served with raita and pickle.", 229, 199, False, "photo-1563379091339-03246963d96c", "Kaima rice, chicken, onion, ghee, whole spices"),
        (7, "Ghee Rice & Chicken Curry", "A comforting Kozhikode classic. Aromatic ghee rice with slow-cooked coconut chicken curry.", 259, 239, False, "photo-1603894584373-5ac82b2ae398", "Rice, ghee, chicken, coconut, spices"),
        (2, "Chicken Roast & Porotta", "Flaky layered porottas meet a rich, caramelised Kerala chicken roast.", 249, 219, False, "photo-1603894584373-5ac82b2ae398", "Chicken, wheat flour, onion, tomato, spices"),
        (1, "Appam & Mutta Roast", "Soft lace-edged appams with eggs in a beautifully spiced onion masala.", 169, 149, False, "photo-1547592180-85f173990554", "Rice, coconut, egg, onion"),
        (3, "Beef Ularthiyathu", "Slow-roasted beef with coconut slivers, curry leaves and crushed black pepper.", 289, 269, False, "photo-1544025162-d76694265947", "Beef, coconut, pepper, curry leaves"),
        (4, "Malabar Veg Meals", "A little of everything: Kerala rice, sambar, avial, thoran, pickle and papad.", 179, 159, True, "photo-1546833999-b9f581a1996d", "Rice, lentils, seasonal vegetables, coconut"),
        (5, "Pazhampori", "Golden, crisp banana fritters. The perfect excuse for an afternoon chai.", 69, 59, True, "photo-1484723091739-30a097e8f929", "Ripe banana, flour, turmeric"),
        (6, "Fresh Lime Mint", "Freshly squeezed lime, muddled mint and a refreshing splash of soda.", 79, 69, True, "photo-1513558161293-cdaf765edfd7", "Lime, mint, sugar, soda"),
    ]
    for i, (cat, name, desc, price, sale, veg, photo, ingredients) in enumerate(dishes):
        food = Food(category_id=categories[cat].id, name=name, description=desc, ingredients=ingredients, price=price, sale_price=sale, image=f"https://images.unsplash.com/{photo}?auto=format&fit=crop&w=900&q=85", vegetarian=veg, bestseller=i in [0, 2, 4], special=i in [0, 1], preparation_minutes=25 if i < 6 else 10, portion="Serves 1 · freshly prepared")
        db.add(food)
        db.flush()
        if i < 6:
            db.add(Addon(food_id=food.id, name="Extra portion of rice" if i != 2 else "Extra porotta", price=35))
    db.add_all([DeliveryArea(name=n, charge=c, minimum=m) for n,c,m in [("Kozhikode Beach",30,149),("Nadakkavu",30,149),("Palayam",25,149),("Mavoor Road",35,199),("West Hill",40,199)]])
    db.add(BusinessSetting(key="business", value={"name":"The Malabar Kitchen", "tagline":"Made with heart. Served with warmth.", "phone":"", "whatsapp":"", "address":"Kozhikode, Kerala", "opening":"11:00", "closing":"22:00", "cutoff":"21:30", "preparation_minutes":35, "tax_rate":0, "payment_methods":["cod"], "delivery_slots":["12:00","13:00","14:00","18:00","19:00","20:00","21:00"], "cancellation_policy":"Contact the kitchen before preparation begins."}))
    db.commit()

if __name__ == "__main__":
    with SessionLocal() as db:
        seed(db)
    print("Seed data ready. No default accounts or passwords were created.")
