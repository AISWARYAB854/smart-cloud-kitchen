from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select, or_, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .db import get_db
from .models import Food, Category, Addon, User, Order, OrderItem, Payment, StatusHistory, AdminEvent
from .security import require_roles
from .admin_schemas import FoodInput, CategoryInput, AvailabilityInput, StatusInput, PaymentInput

router=APIRouter(prefix="/api/admin",tags=["Admin"],dependencies=[Depends(require_roles("owner","manager"))])
UPLOAD_DIR=Path(__file__).resolve().parents[1]/"uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
IST=ZoneInfo("Asia/Kolkata")
TRANSITIONS={"placed":["accepted","cancelled"],"accepted":["preparing","cancelled"],"preparing":["ready","cancelled"],"ready":["out_for_delivery","cancelled"],"out_for_delivery":["delivered"],"delivered":[],"cancelled":[]}

def audit(db, actor, action, entity, details):
    db.add(AdminEvent(actor_id=actor.id,action=action,entity=str(entity),details=details))

def detail(order, db):
    return {"order":order,"items":db.scalars(select(OrderItem).where(OrderItem.order_id==order.id)).all(),"payment":db.scalar(select(Payment).where(Payment.order_id==order.id)),"history":db.scalars(select(StatusHistory).where(StatusHistory.order_id==order.id).order_by(StatusHistory.id)).all()}

def get_order(db,number,lock=False):
    statement=select(Order).where(Order.number==number)
    if lock:
        statement=statement.with_for_update()
    order=db.scalar(statement)
    if not order:
        raise HTTPException(404,"Order not found")
    return order

@router.get("/overview")
def overview(start:date|None=None,end:date|None=None,db:Session=Depends(get_db)):
    start=start or datetime.now(IST).date()
    end=end or start
    if end<start or (end-start).days>365:
        raise HTTPException(400,"Choose a date range of up to 366 days")
    lower=datetime.combine(start,time.min,IST).astimezone(timezone.utc)
    upper=datetime.combine(end+timedelta(days=1),time.min,IST).astimezone(timezone.utc)
    orders=db.scalars(select(Order).where(Order.created_at>=lower,Order.created_at<upper)).all()
    delivered=[o for o in orders if o.status=="delivered"]
    revenue=sum((o.total-o.tax-o.delivery_charge for o in delivered),Decimal(0))
    collected=db.scalar(select(func.coalesce(func.sum(Payment.amount),0)).join(Order,Payment.order_id==Order.id).where(Order.created_at>=lower,Order.created_at<upper,Payment.status=="paid",Order.status!="cancelled"))
    daily={str(start+timedelta(days=i)):{"date":str(start+timedelta(days=i)),"revenue":Decimal(0),"orders":0} for i in range((end-start).days+1)}
    for order in orders:
        stamp=order.created_at
        if stamp.tzinfo is None:
            stamp=stamp.replace(tzinfo=ZoneInfo("UTC"))
        bucket=daily[str(stamp.astimezone(IST).date())]
        bucket["orders"]+=1
        if order.status=="delivered":
            bucket["revenue"]+=order.subtotal
    best=db.execute(select(OrderItem.name,func.sum(OrderItem.quantity).label("quantity"),func.sum(OrderItem.quantity*OrderItem.unit_price).label("revenue")).join(Order,Order.id==OrderItem.order_id).where(Order.created_at>=lower,Order.created_at<upper,Order.status=="delivered").group_by(OrderItem.name).order_by(func.sum(OrderItem.quantity).desc()).limit(5)).all()
    return {"start":start,"end":end,"orders":len(orders),"pending":sum(o.status not in ("delivered","cancelled") for o in orders),"delivered":len(delivered),"cancelled":sum(o.status=="cancelled" for o in orders),"revenue":revenue,"collected":collected,"average_order":sum((o.total for o in delivered),Decimal(0))/len(delivered) if delivered else 0,"daily":list(daily.values()),"best_sellers":[dict(r._mapping) for r in best]}

@router.get("/orders")
def orders(q:str=Query(default="",max_length=100),status:str="",page:int=Query(default=1,ge=1),db:Session=Depends(get_db)):
    statement=select(Order)
    if status:
        if status not in TRANSITIONS:
            raise HTTPException(400,"Unknown order status")
        statement=statement.where(Order.status==status)
    if q.strip():
        pattern="%"+q.strip().replace("%","\\%").replace("_","\\_")+"%"
        statement=statement.where(or_(Order.number.ilike(pattern,escape="\\"),Order.phone.ilike(pattern,escape="\\"),Order.customer_name.ilike(pattern,escape="\\")))
    total=db.scalar(select(func.count()).select_from(statement.subquery()))
    rows=db.scalars(statement.order_by(Order.created_at.desc(),Order.id.desc()).offset((page-1)*50).limit(50)).all()
    return {"total":total,"page":page,"page_size":50,"items":[detail(o,db) for o in rows]}

@router.get("/orders/{number}")
def order(number:str,db:Session=Depends(get_db)):
    return detail(get_order(db,number),db)

@router.patch("/orders/{number}/status")
def change_status(number:str,data:StatusInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    order=get_order(db,number,lock=True)
    if order.status!=data.expected_status:
        raise HTTPException(409,"This order changed. Refresh and try again")
    if data.status not in TRANSITIONS.get(order.status,[]):
        raise HTTPException(409,"That order status change is not allowed")
    if data.status=="cancelled" and not data.note.strip():
        raise HTTPException(400,"Enter a reason for cancellation")
    payment=db.scalar(select(Payment).where(Payment.order_id==order.id))
    if data.status=="cancelled" and payment and payment.status=="paid":
        raise HTTPException(409,"Payment is recorded as paid. Resolve repayment and correct the payment record before cancellation")
    previous=order.status
    order.status=data.status
    db.add(StatusHistory(order_id=order.id,status=data.status,actor_id=actor.id,note=data.note.strip()))
    audit(db,actor,"order.status",number,{"from":previous,"to":data.status,"note":data.note})
    db.commit()
    return detail(order,db)

@router.patch("/orders/{number}/payment")
def change_payment(number:str,data:PaymentInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    order=get_order(db,number,lock=True)
    payment=db.scalar(select(Payment).where(Payment.order_id==order.id).with_for_update())
    if not payment:
        raise HTTPException(404,"Payment record not found")
    if order.status=="cancelled":
        raise HTTPException(409,"Cannot record payment on a cancelled order")
    if payment.method!="cod":
        raise HTTPException(409,"Online payments must be updated by their payment provider")
    if payment.status!=data.expected_status:
        raise HTTPException(409,"Payment changed. Refresh and try again")
    if data.status==payment.status:
        raise HTTPException(409,"Payment already has this status")
    if not data.note.strip():
        raise HTTPException(400,"Enter a payment note")
    previous=payment.status
    payment.status=data.status
    audit(db,actor,"payment.status",number,{"from":previous,"to":data.status,"note":data.note})
    db.commit()
    return detail(order,db)

@router.get("/menu")
def menu(db:Session=Depends(get_db)):
    return {"foods":db.scalars(select(Food).order_by(Food.archived,Food.id)).all(),"categories":db.scalars(select(Category).order_by(Category.position,Category.id)).all(),"addons":db.scalars(select(Addon).order_by(Addon.id)).all()}

def save_food(db,food,data,actor):
    if not db.get(Category,data.category_id):
        raise HTTPException(400,"Choose an existing category")
    existing={a.id:a for a in db.scalars(select(Addon).where(Addon.food_id==food.id)).all()} if food.id else {}
    if any(a.id is not None and a.id not in existing for a in data.addons):
        raise HTTPException(400,"An add-on does not belong to this dish")
    for key,value in data.model_dump(exclude={"addons"}).items():
        setattr(food,key,value)
    db.add(food)
    db.flush()
    retained=set()
    for addon in data.addons:
        record=existing[addon.id] if addon.id else Addon(food_id=food.id)
        record.name=addon.name.strip()
        record.price=addon.price
        db.add(record)
        if addon.id:
            retained.add(addon.id)
    for id,record in existing.items():
        if id not in retained:
            db.delete(record)
    audit(db,actor,"food.save",food.id,{"name":food.name,"archived":food.archived})
    db.commit()
    return food

@router.post("/menu",status_code=201)
def add_food(data:FoodInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    return save_food(db,Food(),data,actor)

@router.put("/menu/{id}")
def edit_food(id:int,data:FoodInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    food=db.get(Food,id)
    if not food:
        raise HTTPException(404,"Dish not found")
    return save_food(db,food,data,actor)

@router.patch("/menu/{id}/availability")
def availability(id:int,data:AvailabilityInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    food=db.get(Food,id)
    if not food:
        raise HTTPException(404,"Dish not found")
    food.available=data.available
    audit(db,actor,"food.availability",id,{"available":data.available})
    db.commit()
    return food

def save_category(db,category,data,actor):
    for key,value in data.model_dump().items():
        setattr(category,key,value)
    db.add(category)
    try:
        db.flush()
        audit(db,actor,"category.save",category.id,{"name":category.name,"active":category.active})
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409,"A category with this name already exists")
    return category

@router.post("/categories",status_code=201)
def add_category(data:CategoryInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    return save_category(db,Category(),data,actor)

@router.put("/categories/{id}")
def edit_category(id:int,data:CategoryInput,db:Session=Depends(get_db),actor:User=Depends(require_roles("owner","manager"))):
    category=db.get(Category,id)
    if not category:
        raise HTTPException(404,"Category not found")
    return save_category(db,category,data,actor)

@router.post("/images",status_code=201)
async def upload_image(request:Request):
    if request.headers.get("content-type","").split(";")[0] not in {"image/jpeg","image/png","image/webp"}:
        raise HTTPException(415,"Choose a JPEG, PNG or WebP photo")
    content=bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content)>5*1024*1024:
            raise HTTPException(413,"Photo must be smaller than 5 MB")
    try:
        Image.MAX_IMAGE_PIXELS=16_000_000
        with Image.open(BytesIO(content)) as original:
            if original.format not in {"JPEG","PNG","WEBP"} or original.width*original.height>16_000_000:
                raise ValueError()
            image=ImageOps.exif_transpose(original).convert("RGB")
            image.thumbnail((1600,1600))
            output=BytesIO()
            image.save(output,format="JPEG",quality=88)
    except (UnidentifiedImageError,OSError,ValueError,Image.DecompressionBombError):
        raise HTTPException(400,"This file is not a supported, valid photo")
    filename=uuid4().hex+".jpg"
    (UPLOAD_DIR/filename).write_bytes(output.getvalue())
    return {"url":"/uploads/"+filename}
