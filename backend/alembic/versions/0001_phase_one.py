"""Phase 1 customer ordering schema (frozen PostgreSQL DDL)."""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.execute('CREATE TABLE roles (\n\tid SERIAL NOT NULL, \n\tname VARCHAR(30) NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (name)\n)')
    op.execute('CREATE TABLE food_categories (\n\tid SERIAL NOT NULL, \n\tname VARCHAR(80) NOT NULL, \n\tposition INTEGER NOT NULL, \n\tactive BOOLEAN NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (name)\n)')
    op.execute('CREATE TABLE delivery_areas (\n\tid SERIAL NOT NULL, \n\tname VARCHAR(80) NOT NULL, \n\tcharge NUMERIC(10, 2) NOT NULL, \n\tminimum NUMERIC(10, 2) NOT NULL, \n\tactive BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (name)\n)')
    op.execute('CREATE TABLE business_settings (\n\tkey VARCHAR(80) NOT NULL, \n\tvalue JSON NOT NULL, \n\tPRIMARY KEY (key)\n)')
    op.execute('CREATE TABLE users (\n\tid SERIAL NOT NULL, \n\tname VARCHAR(100) NOT NULL, \n\temail VARCHAR(254) NOT NULL, \n\tphone VARCHAR(10) NOT NULL, \n\tpassword_hash VARCHAR(255) NOT NULL, \n\trole_id INTEGER NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(role_id) REFERENCES roles (id)\n)')
    op.execute('CREATE UNIQUE INDEX ix_users_phone ON users (phone)')
    op.execute('CREATE UNIQUE INDEX ix_users_email ON users (email)')
    op.execute('CREATE TABLE food_items (\n\tid SERIAL NOT NULL, \n\tcategory_id INTEGER NOT NULL, \n\tname VARCHAR(120) NOT NULL, \n\tdescription VARCHAR(500) NOT NULL, \n\tingredients VARCHAR(500) NOT NULL, \n\tportion VARCHAR(80) NOT NULL, \n\tprice NUMERIC(10, 2) NOT NULL, \n\tsale_price NUMERIC(10, 2) NOT NULL, \n\timage VARCHAR(500) NOT NULL, \n\tvegetarian BOOLEAN NOT NULL, \n\tavailable BOOLEAN NOT NULL, \n\tbestseller BOOLEAN NOT NULL, \n\tspecial BOOLEAN NOT NULL, \n\tpreparation_minutes INTEGER NOT NULL, \n\tarchived BOOLEAN NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tCHECK (price > 0 AND sale_price > 0 AND sale_price <= price), \n\tFOREIGN KEY(category_id) REFERENCES food_categories (id)\n)')
    op.execute('CREATE INDEX ix_food_items_category_id ON food_items (category_id)')
    op.execute('CREATE TABLE customer_addresses (\n\tid SERIAL NOT NULL, \n\tuser_id INTEGER NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(150) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id)\n)')
    op.execute('CREATE INDEX ix_customer_addresses_user_id ON customer_addresses (user_id)')
    op.execute('CREATE TABLE food_addons (\n\tid SERIAL NOT NULL, \n\tfood_id INTEGER NOT NULL, \n\tname VARCHAR(80) NOT NULL, \n\tprice NUMERIC(10, 2) NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(food_id) REFERENCES food_items (id)\n)')
    op.execute('CREATE INDEX ix_food_addons_food_id ON food_addons (food_id)')
    op.execute('CREATE TABLE orders (\n\tid SERIAL NOT NULL, \n\tnumber VARCHAR(30) NOT NULL, \n\tuser_id INTEGER NOT NULL, \n\tarea_id INTEGER NOT NULL, \n\tcustomer_name VARCHAR(100) NOT NULL, \n\tphone VARCHAR(10) NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(150) NOT NULL, \n\tinstructions VARCHAR(500) NOT NULL, \n\tscheduled_at TIMESTAMP WITH TIME ZONE, \n\tstatus VARCHAR(30) NOT NULL, \n\tsubtotal NUMERIC(10, 2) NOT NULL, \n\tdelivery_charge NUMERIC(10, 2) NOT NULL, \n\ttax NUMERIC(10, 2) NOT NULL, \n\ttotal NUMERIC(10, 2) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id), \n\tFOREIGN KEY(area_id) REFERENCES delivery_areas (id)\n)')
    op.execute('CREATE UNIQUE INDEX ix_orders_number ON orders (number)')
    op.execute('CREATE INDEX ix_orders_user_id ON orders (user_id)')
    op.execute('CREATE TABLE order_items (\n\tid SERIAL NOT NULL, \n\torder_id INTEGER NOT NULL, \n\tfood_id INTEGER NOT NULL, \n\tname VARCHAR(120) NOT NULL, \n\tquantity INTEGER NOT NULL, \n\tunit_price NUMERIC(10, 2) NOT NULL, \n\taddons JSON NOT NULL, \n\tinstructions VARCHAR(300) NOT NULL, \n\tPRIMARY KEY (id), \n\tCHECK (quantity > 0 AND unit_price >= 0), \n\tFOREIGN KEY(order_id) REFERENCES orders (id), \n\tFOREIGN KEY(food_id) REFERENCES food_items (id)\n)')
    op.execute('CREATE INDEX ix_order_items_order_id ON order_items (order_id)')
    op.execute('CREATE TABLE payments (\n\tid SERIAL NOT NULL, \n\torder_id INTEGER NOT NULL, \n\tmethod VARCHAR(20) NOT NULL, \n\tstatus VARCHAR(20) NOT NULL, \n\tamount NUMERIC(10, 2) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (order_id), \n\tFOREIGN KEY(order_id) REFERENCES orders (id)\n)')
    op.execute('CREATE TABLE order_status_history (\n\tid SERIAL NOT NULL, \n\torder_id INTEGER NOT NULL, \n\tstatus VARCHAR(30) NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(order_id) REFERENCES orders (id)\n)')
    op.execute('CREATE INDEX ix_order_status_history_order_id ON order_status_history (order_id)')

def downgrade():
    op.drop_table('payments')
    op.drop_table('order_status_history')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('food_addons')
    op.drop_table('customer_addresses')
    op.drop_table('users')
    op.drop_table('food_items')
    op.drop_table('roles')
    op.drop_table('food_categories')
    op.drop_table('delivery_areas')
    op.drop_table('business_settings')
