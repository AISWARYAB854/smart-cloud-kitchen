from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, ForeignKey, Numeric, Boolean, DateTime, Integer, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

def now():
    return datetime.now(timezone.utc)

class Timestamp:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True)

class User(Timestamp, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))

class Address(Timestamp, Base):
    __tablename__ = "customer_addresses"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    address: Mapped[str] = mapped_column(String(500))
    landmark: Mapped[str] = mapped_column(String(150), default="")

class Category(Timestamp, Base):
    __tablename__ = "food_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    position: Mapped[int] = mapped_column(default=0)
    active: Mapped[bool] = mapped_column(default=True)

class Food(Timestamp, Base):
    __tablename__ = "food_items"
    __table_args__ = (CheckConstraint("price > 0 AND sale_price > 0 AND sale_price <= price"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("food_categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(500))
    ingredients: Mapped[str] = mapped_column(String(500))
    portion: Mapped[str] = mapped_column(String(80), default="Serves 1")
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    image: Mapped[str] = mapped_column(String(500))
    vegetarian: Mapped[bool] = mapped_column(default=False)
    available: Mapped[bool] = mapped_column(default=True)
    bestseller: Mapped[bool] = mapped_column(default=False)
    special: Mapped[bool] = mapped_column(default=False)
    preparation_minutes: Mapped[int] = mapped_column(default=25)
    archived: Mapped[bool] = mapped_column(default=False)

class Addon(Base):
    __tablename__ = "food_addons"
    id: Mapped[int] = mapped_column(primary_key=True)
    food_id: Mapped[int] = mapped_column(ForeignKey("food_items.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

class DeliveryArea(Base):
    __tablename__ = "delivery_areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    charge: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    minimum: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    active: Mapped[bool] = mapped_column(default=True)

class BusinessSetting(Base):
    __tablename__ = "business_settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)

class Order(Timestamp, Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("delivery_areas.id"))
    customer_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(10))
    address: Mapped[str] = mapped_column(String(500))
    landmark: Mapped[str] = mapped_column(String(150))
    instructions: Mapped[str] = mapped_column(String(500))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="placed")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    delivery_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))

class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity > 0 AND unit_price >= 0"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    food_id: Mapped[int] = mapped_column(ForeignKey("food_items.id"))
    name: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    addons: Mapped[list] = mapped_column(JSON)
    instructions: Mapped[str] = mapped_column(String(300))

class Payment(Timestamp, Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    method: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))

class StatusHistory(Base):
    __tablename__ = "order_status_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    status: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str] = mapped_column(String(300), default="", server_default="")

class AdminEvent(Base):
    __tablename__ = "admin_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(80))
    entity: Mapped[str] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
