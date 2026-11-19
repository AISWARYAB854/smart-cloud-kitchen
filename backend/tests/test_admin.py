from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from sqlalchemy import select, func
from PIL import Image
import pytest
from test_workflow import client, auth, payload
from app.models import User, Role, Order, Food, Category, Addon, StatusHistory, AdminEvent
from app.admin import UPLOAD_DIR

def staff(client, role="owner", suffix="1"):
    headers=auth(client,suffix)
    with client.factory() as db:
        user=db.scalar(select(User).where(User.email==f"food{suffix}@example.com"))
        user.role_id=db.scalar(select(Role.id).where(Role.name==role))
        db.commit()
    return headers

def create_order(client,headers):
    response=client.post("/api/orders",headers=headers,json=payload(client))
    assert response.status_code==201,response.text
    return response.json()["order"]["number"]

def change(client,headers,number,expected,target,note=""):
    return client.patch(f"/api/admin/orders/{number}/status",headers=headers,json={"status":target,"expected_status":expected,"note":note})

def food_payload(client):
    food=client.get('/api/catalog').json()['foods'][0]
    keys=['category_id','name','description','ingredients','portion','price','sale_price','image','vegetarian','available','bestseller','special','preparation_minutes']
    return {**{k:food[k] for k in keys},'name':'Test Chicken Biryani','addons':[{'name':'Extra egg','price':20}]}

@pytest.mark.parametrize("path",['overview','orders','menu'])
def test_admin_read_requires_staff(client,path):
    assert client.get('/api/admin/'+path).status_code==401
    headers=auth(client)
    assert client.get('/api/admin/'+path,headers=headers).status_code==403

def test_admin_writes_reject_customer_and_role_spoofing(client):
    headers=auth(client)
    assert client.get('/api/auth/me',headers=headers).json()['role']=='customer'
    assert client.post('/api/admin/menu',headers=headers,json=food_payload(client)).status_code==403
    assert client.patch('/api/admin/menu/1/availability',headers=headers,json={'available':False}).status_code==403
    assert client.put('/api/admin/categories/1',headers=headers,json={'name':'Hijacked'}).status_code==403
    response=client.post('/api/auth/register',json={'name':'Pretend Owner','email':'fake@example.com','phone':'9876543212','password':'StrongPassword!42','role':'owner','role_id':1})
    assert response.status_code==201
    assert response.json()['user']['role']=='customer'

def test_order_lifecycle_and_audit(client):
    headers=staff(client)
    number=create_order(client,headers)
    assert change(client,headers,number,'placed','delivered').status_code==409
    for before,after in [('placed','accepted'),('accepted','preparing'),('preparing','ready'),('ready','out_for_delivery'),('out_for_delivery','delivered')]:
        response=change(client,headers,number,before,after,'Handled by kitchen')
        assert response.status_code==200,response.text
    assert change(client,headers,number,'delivered','preparing').status_code==409
    assert change(client,headers,number,'placed','accepted').status_code==409
    detail=client.get('/api/orders/'+number,headers=headers).json()
    assert detail['order']['status']=='delivered'
    assert len(detail['history'])==6
    with client.factory() as db:
        assert db.scalar(select(func.count()).select_from(AdminEvent))==5
        assert db.scalar(select(func.count()).select_from(StatusHistory).where(StatusHistory.actor_id.is_not(None)))==5

def test_cancellation_payment_rules(client):
    headers=staff(client,'manager')
    number=create_order(client,headers)
    endpoint=f'/api/admin/orders/{number}/payment'
    assert change(client,headers,number,'placed','cancelled').status_code==400
    assert client.patch(endpoint,headers=headers,json={'status':'paid','expected_status':'pending','note':'Cash received'}).status_code==200
    assert change(client,headers,number,'placed','cancelled','Customer request').status_code==409
    assert client.patch(endpoint,headers=headers,json={'status':'paid','expected_status':'pending','note':'Duplicate update'}).status_code==409
    assert client.patch(endpoint,headers=headers,json={'status':'pending','expected_status':'paid','note':'Cash returned to customer'}).status_code==200
    assert change(client,headers,number,'placed','cancelled','Customer requested cancellation').status_code==200
    assert client.patch(endpoint,headers=headers,json={'status':'paid','expected_status':'pending','note':'Cash received'}).status_code==409

def test_menu_crud_addons_archive_and_snapshot(client):
    headers=staff(client)
    data=food_payload(client)
    response=client.post('/api/admin/menu',headers=headers,json=data)
    assert response.status_code==201,response.text
    id=response.json()['id']
    menu=client.get('/api/admin/menu',headers=headers).json()
    addon=next(a for a in menu['addons'] if a['food_id']==id)
    data['addons']=[{'id':addon['id'],'name':'Extra egg','price':25}]
    data['sale_price']=179
    assert client.put(f'/api/admin/menu/{id}',headers=headers,json=data).status_code==200
    order_data=payload(client)
    order_data['items']=[{'food_id':id,'quantity':2,'addon_ids':[addon['id']]}]
    placed=client.post('/api/orders',headers=headers,json=order_data)
    assert placed.status_code==201,placed.text
    number=placed.json()['order']['number']
    assert client.patch(f'/api/admin/menu/{id}/availability',headers=headers,json={'available':False}).status_code==200
    order=payload(client)
    order['items']=[{'food_id':id,'quantity':2}]
    assert client.post('/api/orders',headers=headers,json=order).status_code==400
    data['archived']=True
    data['name']='Renamed dish'
    assert client.put(f'/api/admin/menu/{id}',headers=headers,json=data).status_code==200
    assert id not in [f['id'] for f in client.get('/api/catalog').json()['foods']]
    snapshot=client.get('/api/orders/'+number,headers=headers).json()
    assert snapshot['items'][0]['name']=='Test Chicken Biryani'
    assert float(snapshot['items'][0]['unit_price'])==204
    assert len([a for a in client.get('/api/admin/menu',headers=headers).json()['addons'] if a['food_id']==id])==1

def test_menu_validation_and_category_visibility(client):
    headers=staff(client)
    data=food_payload(client)
    assert client.post('/api/admin/menu',headers=headers,json={**data,'sale_price':999}).status_code==422
    assert client.post('/api/admin/menu',headers=headers,json={**data,'image':'javascript:alert(1)'}).status_code==422
    assert client.post('/api/admin/menu',headers=headers,json={**data,'category_id':999}).status_code==400
    other=client.get('/api/admin/menu',headers=headers).json()['addons'][-1]
    assert client.post('/api/admin/menu',headers=headers,json={**data,'addons':[{'id':other['id'],'name':'Stolen','price':2}]}).status_code==400
    response=client.post('/api/admin/categories',headers=headers,json={'name':'Seasonal','position':10})
    assert response.status_code==201
    assert client.post('/api/admin/categories',headers=headers,json={'name':'Seasonal'}).status_code==409
    assert client.put('/api/admin/categories/1',headers=headers,json={'name':'Biryani','active':False}).status_code==200
    assert 1 not in [c['id'] for c in client.get('/api/catalog').json()['categories']]
    assert all(f['category_id']!=1 for f in client.get('/api/catalog').json()['foods'])

def test_admin_order_search_and_revenue(client):
    headers=staff(client)
    first=create_order(client,headers)
    second=create_order(client,headers)
    # Pin creation times so reporting remains deterministic near midnight.
    today=datetime.now(timezone.utc).replace(hour=6,minute=0,second=0,microsecond=0)
    with client.factory() as db:
        for order in db.scalars(select(Order)).all():
            order.created_at=today
        db.commit()
    assert client.get('/api/admin/orders?q=9876543211',headers=headers).json()['total']==2
    assert client.get('/api/admin/orders?q='+first,headers=headers).json()['total']==1
    for before,after in [('placed','accepted'),('accepted','preparing'),('preparing','ready'),('ready','out_for_delivery'),('out_for_delivery','delivered')]:
        assert change(client,headers,first,before,after).status_code==200
    assert change(client,headers,second,'placed','cancelled','Customer request').status_code==200
    day=today.date().isoformat()
    overview=client.get(f'/api/admin/overview?start={day}&end={day}',headers=headers)
    assert overview.status_code==200,overview.text
    result=overview.json()
    assert result['orders']==2
    assert float(result['revenue'])==398
    assert result['delivered']==1 and result['cancelled']==1
    assert float(result['average_order'])==428
    assert result['best_sellers'][0]['quantity']==2
    assert float(result['daily'][0]['revenue'])==398
    assert client.get('/api/admin/overview?start=2026-11-13&end=2026-11-12',headers=headers).status_code==400

def test_image_upload_validation_and_public_image(client):
    customer=auth(client)
    assert client.post('/api/admin/images',headers={**customer,'Content-Type':'image/png'},content=b'bad').status_code==403
    headers=staff(client,suffix='2')
    assert client.post('/api/admin/images',headers={**headers,'Content-Type':'image/svg+xml'},content=b'<svg/>').status_code==415
    assert client.post('/api/admin/images',headers={**headers,'Content-Type':'image/png'},content=b'not a photo').status_code==400
    assert client.post('/api/admin/images',headers={**headers,'Content-Type':'image/png'},content=b'x'*(5*1024*1024+1)).status_code==413
    output=BytesIO()
    Image.new('RGB',(20,20),'orange').save(output,format='PNG')
    response=client.post('/api/admin/images',headers={**headers,'Content-Type':'image/png'},content=output.getvalue())
    assert response.status_code==201,response.text
    url=response.json()['url']
    try:
        public=client.get(url)
        assert public.status_code==200
        assert public.headers['content-type']=='image/jpeg'
    finally:
        (UPLOAD_DIR/Path(url).name).unlink(missing_ok=True)
