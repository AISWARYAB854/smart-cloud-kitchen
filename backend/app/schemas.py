from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class Register(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    password: str = Field(min_length=10, max_length=128)

class Login(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(max_length=128)

class CartLine(BaseModel):
    food_id: int
    quantity: int = Field(ge=1, le=30)
    addon_ids: list[int] = Field(default_factory=list, max_length=10)
    instructions: str = Field(default="", max_length=300)

class Checkout(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=50)
    area_id: int
    customer_name: str = Field(min_length=2, max_length=100)
    phone: str = Field(pattern=r"^[6-9][0-9]{9}$")
    address: str = Field(min_length=10, max_length=500)
    landmark: str = Field(default="", max_length=150)
    instructions: str = Field(default="", max_length=500)
    scheduled_at: datetime | None = None
    payment_method: str = "cod"
