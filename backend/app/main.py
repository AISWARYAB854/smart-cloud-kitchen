from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from zoneinfo import ZoneInfo
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .admin import router as admin_router, UPLOAD_DIR
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User, Role, Category, Food, Addon, DeliveryArea, BusinessSetting, Order, OrderItem, Payment, StatusHistory
from .schemas import Register, Login, Checkout
from .security import passwords, token_for, current_user

app = FastAPI(title="Smart Cloud Kitchen", version="0.2.0", description="Customer ordering and protected admin API. All prices are INR.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST", "PUT", "PATCH"], allow_headers=["Authorization", "Content-Type"])
app.include_router(admin_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

def business(db):
    row = db.get(BusinessSetting, "business")
    if not row:
        raise HTTPException(503, "Run the seed command before opening the kitchen")
    return row.value

def public_user(user, db):
    return {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone, "role": db.get(Role,user.role_id).name}

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {"status": "ok"}

@app.post("/api/auth/register", status_code=201)
def register(data: Register, db: Session = Depends(get_db)):
    role = db.scalar(select(Role).where(Role.name == "customer"))
    if not role:
        raise HTTPException(503, "Database must be seeded")
    user = User(name=data.name.strip(), email=str(data.email).lower(), phone=data.phone, password_hash=passwords.hash(data.password), role_id=role.id)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email or phone is already registered")
    return {"access_token": token_for(user), "token_type": "bearer", "user": public_user(user, db)}

@app.post("/api/auth/login")
def login(data: Login, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(or_(User.email == data.identifier.lower(), User.phone == data.identifier)))
    # Always verify a hash so unknown users follow the same expensive path.
    valid = passwords.verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Incorrect email/mobile or password")
    return {"access_token": token_for(user), "token_type": "bearer", "user": public_user(user, db)}

DUMMY_HASH = passwords.hash("unused-dummy-password")

@app.get("/api/auth/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return public_user(user, db)

@app.get("/api/catalog")
def catalog(db: Session = Depends(get_db)):
    categories = db.scalars(select(Category).where(Category.active == True).order_by(Category.position)).all()
    foods = db.scalars(select(Food).where(Food.archived == False, Food.category_id.in_([c.id for c in categories]))).all()
    return {"business": business(db), "categories": categories, "foods": foods, "addons": db.scalars(select(Addon)).all(), "areas": db.scalars(select(DeliveryArea).where(DeliveryArea.active == True)).all()}

def quote_order(data, db):
    area = db.get(DeliveryArea, data.area_id)
    if not area or not area.active:
        raise HTTPException(400, "Choose an available delivery area")
    config = business(db)
    if data.payment_method not in config["payment_methods"]:
        raise HTTPException(400, "This payment method is not enabled yet")
    local_now = datetime.now(ZoneInfo("Asia/Kolkata"))
    if data.scheduled_at:
        if data.scheduled_at.tzinfo is None:
            raise HTTPException(400, "Delivery time must include a timezone")
        target = data.scheduled_at.astimezone(ZoneInfo("Asia/Kolkata"))
        if target < local_now + timedelta(minutes=config["preparation_minutes"]) or target > local_now + timedelta(days=7):
            raise HTTPException(400, "Select a delivery slot between preparation time and 7 days ahead")
        if target.strftime("%H:%M") not in config["delivery_slots"]:
            raise HTTPException(400, "Choose a listed delivery slot")
    else:
        target = local_now
    if not (config["opening"] <= target.strftime("%H:%M") <= config["cutoff"]):
        raise HTTPException(400, "Kitchen is closed. Please schedule a delivery slot")
    lines, subtotal = [], Decimal("0")
    for line in data.items:
        food = db.get(Food, line.food_id)
        if not food or food.archived or not food.available or not db.get(Category, food.category_id).active:
            raise HTTPException(400, "An item is no longer available; refresh your cart")
        addons = db.scalars(select(Addon).where(Addon.id.in_(set(line.addon_ids)))).all()
        if len(addons) != len(set(line.addon_ids)) or any(a.food_id != food.id for a in addons):
            raise HTTPException(400, "Invalid add-on selection")
        unit = food.sale_price + sum((a.price for a in addons), Decimal("0"))
        subtotal += unit * line.quantity
        lines.append({"food_id": food.id, "name": food.name, "quantity": line.quantity, "unit_price": unit, "addons": [{"name": a.name, "price": str(a.price)} for a in addons], "instructions": line.instructions})
    if subtotal < area.minimum:
        raise HTTPException(400, f"Minimum order for {area.name} is ₹{area.minimum}")
    tax = (subtotal * Decimal(str(config["tax_rate"])) / 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return lines, {"subtotal": subtotal, "delivery_charge": area.charge, "tax": tax, "total": subtotal + area.charge + tax}

@app.post("/api/orders/quote")
def quote(data: Checkout, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _, totals = quote_order(data, db)
    return totals

@app.post("/api/orders", status_code=201)
def create_order(data: Checkout, user: User = Depends(current_user), db: Session = Depends(get_db)):
    lines, totals = quote_order(data, db)
    order = Order(number="CK-" + uuid4().hex[:10].upper(), user_id=user.id, **data.model_dump(exclude={"items", "payment_method"}), **totals)
    db.add(order)
    db.flush()
    db.add_all([OrderItem(order_id=order.id, **line) for line in lines])
    db.add(Payment(order_id=order.id, method=data.payment_method, amount=order.total))
    db.add(StatusHistory(order_id=order.id, status="placed"))
    db.commit()
    return order_detail(order, db)

def order_detail(order, db):
    return {"order": order, "items": db.scalars(select(OrderItem).where(OrderItem.order_id == order.id)).all(), "payment": db.scalar(select(Payment).where(Payment.order_id == order.id)), "history": db.scalars(select(StatusHistory).where(StatusHistory.order_id == order.id)).all()}

@app.get("/api/orders")
def orders(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [order_detail(o, db) for o in db.scalars(select(Order).where(Order.user_id == user.id).order_by(Order.id.desc())).all()]

@app.get("/api/orders/{number}")
def get_order(number: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    order = db.scalar(select(Order).where(Order.number == number, Order.user_id == user.id))
    if not order:
        raise HTTPException(404, "Order not found")
    return order_detail(order, db)
