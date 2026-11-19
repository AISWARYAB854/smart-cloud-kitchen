from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from urllib.parse import urlparse
import re

Money = Field(ge=0, max_digits=10, decimal_places=2)

class CategoryInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    position: int = Field(default=0, ge=0, le=999)
    active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Enter a category name")
        return value.strip()

class AddonInput(BaseModel):
    id: int | None = None
    name: str = Field(min_length=2, max_length=80)
    price: Decimal = Money

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Enter an add-on name")
        return value.strip()

class FoodInput(BaseModel):
    category_id: int
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=5, max_length=500)
    ingredients: str = Field(min_length=2, max_length=500)
    portion: str = Field(min_length=2, max_length=80)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    sale_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    image: str = Field(max_length=500)
    vegetarian: bool = False
    available: bool = True
    bestseller: bool = False
    special: bool = False
    preparation_minutes: int = Field(ge=1, le=240)
    archived: bool = False
    addons: list[AddonInput] = Field(default_factory=list, max_length=20)

    @field_validator("name", "description", "ingredients", "portion")
    @classmethod
    def clean_text(cls, value):
        if len(value.strip()) < 2:
            raise ValueError("Please enter a meaningful value")
        return value.strip()

    @field_validator("image")
    @classmethod
    def safe_image(cls, value):
        url = urlparse(value)
        if re.fullmatch(r"/uploads/[a-f0-9]{32}\.jpg", value) or (url.scheme == "https" and url.netloc and not url.username and not url.password):
            return value
        raise ValueError("Use an HTTPS image URL or upload a photo")

    @model_validator(mode="after")
    def prices(self):
        if self.sale_price > self.price:
            raise ValueError("Selling price cannot exceed the regular price")
        ids=[a.id for a in self.addons if a.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate add-on IDs")
        return self

class AvailabilityInput(BaseModel):
    available: bool

class StatusInput(BaseModel):
    status: Literal["accepted", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]
    expected_status: str
    note: str = Field(default="", max_length=300)

class PaymentInput(BaseModel):
    status: Literal["pending", "paid"]
    expected_status: Literal["pending", "paid"]
    note: str = Field(min_length=3, max_length=300)
