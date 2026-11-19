import os
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-is-long-enough-for-jwt-signing"
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db import Base, get_db
from app.models import Order, OrderItem, Payment, StatusHistory, Food
from app.main import app
from app.seed import seed

@pytest.fixture()
def client():
    postgres = os.environ.get("TEST_DATABASE_URL")
    schema = "test_" + uuid4().hex
    if postgres:
        engine = create_engine(postgres, execution_options={"schema_translate_map":{None:schema}})
        with engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread":False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        seed(db)
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        c.factory = factory
        yield c
    app.dependency_overrides.clear()
    if postgres:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    engine.dispose()

def auth(client, suffix="1"):
    response = client.post("/api/auth/register", json={"name":"Food Lover", "email":f"food{suffix}@example.com", "phone":f"987654321{suffix}", "password":"StrongPassword!42"})
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}

def payload(client):
    catalog = client.get("/api/catalog").json()
    tomorrow = (datetime.now(ZoneInfo("Asia/Kolkata")) + timedelta(days=1)).replace(hour=13, minute=0, second=0, microsecond=0)
    return {"items":[{"food_id":catalog["foods"][0]["id"],"quantity":2}],"area_id":catalog["areas"][0]["id"],"customer_name":"Food Lover","phone":"9876543211","address":"12 Beach Road, Kozhikode","scheduled_at":tomorrow.isoformat(),"payment_method":"cod"}

def test_auth_and_duplicates(client):
    auth(client)
    assert client.post("/api/auth/register",json={"name":"Other", "email":"food1@example.com", "phone":"9876543212", "password":"StrongPassword!42"}).status_code==409
    assert client.post("/api/auth/login",json={"identifier":"9876543211","password":"StrongPassword!42"}).status_code==200
    assert client.post("/api/auth/login",json={"identifier":"food1@example.com","password":"wrong"}).status_code==401
    assert client.get("/api/auth/me").status_code==401

def test_order_pricing_atomic_records_and_ownership(client):
    headers=auth(client)
    data=payload(client)
    quote=client.post("/api/orders/quote",headers=headers,json=data)
    assert quote.status_code==200, quote.text
    assert float(quote.json()["total"])==428
    created=client.post("/api/orders",headers=headers,json={**data,"total":1})
    assert created.status_code==201, created.text
    body=created.json()
    assert float(body["order"]["total"])==428
    assert body["payment"]["status"]=="pending"
    with client.factory() as db:
        for model in [Order,OrderItem,Payment,StatusHistory]:
            assert db.scalar(select(func.count()).select_from(model))==1
    assert client.get('/api/orders/'+body['order']['number'],headers=auth(client,"2")).status_code==404
    assert len(client.get('/api/orders',headers=headers).json())==1

@pytest.mark.parametrize("change",[{"payment_method":"upi"},{"area_id":999},{"scheduled_at":"2020-01-01T13:00:00+05:30"},{"scheduled_at":"2099-01-01T13:00:00"},{"items":[{"food_id":1,"quantity":0}]},{"items":[{"food_id":1,"quantity":1,"addon_ids":[999]}]}])
def test_invalid_checkout_does_not_create_records(client,change):
    headers=auth(client)
    response=client.post('/api/orders',headers=headers,json={**payload(client),**change})
    assert response.status_code in [400,422],response.text
    with client.factory() as db:
        assert db.scalar(select(func.count()).select_from(Order))==0

def test_unavailable_food_and_unauthenticated_order(client):
    data=payload(client)
    assert client.post('/api/orders',json=data).status_code==401
    headers=auth(client)
    with client.factory() as db:
        db.get(Food,1).available=False
        db.commit()
    assert client.post('/api/orders',headers=headers,json=data).status_code==400
