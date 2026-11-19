-- PostgreSQL schema for phases 1 and 2. Apply with Alembic, not this reference file.

BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001

CREATE TABLE roles (
    id SERIAL NOT NULL, 
    name VARCHAR(30) NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE food_categories (
    id SERIAL NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    position INTEGER NOT NULL, 
    active BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE delivery_areas (
    id SERIAL NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    charge NUMERIC(10, 2) NOT NULL, 
    minimum NUMERIC(10, 2) NOT NULL, 
    active BOOLEAN NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE TABLE business_settings (
    key VARCHAR(80) NOT NULL, 
    value JSON NOT NULL, 
    PRIMARY KEY (key)
);

CREATE TABLE users (
    id SERIAL NOT NULL, 
    name VARCHAR(100) NOT NULL, 
    email VARCHAR(254) NOT NULL, 
    phone VARCHAR(10) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    role_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(role_id) REFERENCES roles (id)
);

CREATE UNIQUE INDEX ix_users_phone ON users (phone);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE food_items (
    id SERIAL NOT NULL, 
    category_id INTEGER NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    description VARCHAR(500) NOT NULL, 
    ingredients VARCHAR(500) NOT NULL, 
    portion VARCHAR(80) NOT NULL, 
    price NUMERIC(10, 2) NOT NULL, 
    sale_price NUMERIC(10, 2) NOT NULL, 
    image VARCHAR(500) NOT NULL, 
    vegetarian BOOLEAN NOT NULL, 
    available BOOLEAN NOT NULL, 
    bestseller BOOLEAN NOT NULL, 
    special BOOLEAN NOT NULL, 
    preparation_minutes INTEGER NOT NULL, 
    archived BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    CHECK (price > 0 AND sale_price > 0 AND sale_price <= price), 
    FOREIGN KEY(category_id) REFERENCES food_categories (id)
);

CREATE INDEX ix_food_items_category_id ON food_items (category_id);

CREATE TABLE customer_addresses (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(150) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_customer_addresses_user_id ON customer_addresses (user_id);

CREATE TABLE food_addons (
    id SERIAL NOT NULL, 
    food_id INTEGER NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    price NUMERIC(10, 2) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(food_id) REFERENCES food_items (id)
);

CREATE INDEX ix_food_addons_food_id ON food_addons (food_id);

CREATE TABLE orders (
    id SERIAL NOT NULL, 
    number VARCHAR(30) NOT NULL, 
    user_id INTEGER NOT NULL, 
    area_id INTEGER NOT NULL, 
    customer_name VARCHAR(100) NOT NULL, 
    phone VARCHAR(10) NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(150) NOT NULL, 
    instructions VARCHAR(500) NOT NULL, 
    scheduled_at TIMESTAMP WITH TIME ZONE, 
    status VARCHAR(30) NOT NULL, 
    subtotal NUMERIC(10, 2) NOT NULL, 
    delivery_charge NUMERIC(10, 2) NOT NULL, 
    tax NUMERIC(10, 2) NOT NULL, 
    total NUMERIC(10, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    FOREIGN KEY(area_id) REFERENCES delivery_areas (id)
);

CREATE UNIQUE INDEX ix_orders_number ON orders (number);

CREATE INDEX ix_orders_user_id ON orders (user_id);

CREATE TABLE order_items (
    id SERIAL NOT NULL, 
    order_id INTEGER NOT NULL, 
    food_id INTEGER NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    quantity INTEGER NOT NULL, 
    unit_price NUMERIC(10, 2) NOT NULL, 
    addons JSON NOT NULL, 
    instructions VARCHAR(300) NOT NULL, 
    PRIMARY KEY (id), 
    CHECK (quantity > 0 AND unit_price >= 0), 
    FOREIGN KEY(order_id) REFERENCES orders (id), 
    FOREIGN KEY(food_id) REFERENCES food_items (id)
);

CREATE INDEX ix_order_items_order_id ON order_items (order_id);

CREATE TABLE payments (
    id SERIAL NOT NULL, 
    order_id INTEGER NOT NULL, 
    method VARCHAR(20) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    amount NUMERIC(10, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (order_id), 
    FOREIGN KEY(order_id) REFERENCES orders (id)
);

CREATE TABLE order_status_history (
    id SERIAL NOT NULL, 
    order_id INTEGER NOT NULL, 
    status VARCHAR(30) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(order_id) REFERENCES orders (id)
);

CREATE INDEX ix_order_status_history_order_id ON order_status_history (order_id);

INSERT INTO alembic_version (version_num) VALUES ('0001') RETURNING alembic_version.version_num;

-- Running upgrade 0001 -> 0002

ALTER TABLE order_status_history ADD COLUMN actor_id INTEGER;

ALTER TABLE order_status_history ADD COLUMN note VARCHAR(300) DEFAULT '' NOT NULL;

ALTER TABLE order_status_history ADD CONSTRAINT fk_status_history_actor FOREIGN KEY(actor_id) REFERENCES users (id);

CREATE TABLE admin_events (
    id SERIAL NOT NULL, 
    actor_id INTEGER NOT NULL, 
    action VARCHAR(80) NOT NULL, 
    entity VARCHAR(80) NOT NULL, 
    details JSON NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(actor_id) REFERENCES users (id)
);

CREATE INDEX ix_admin_events_actor_id ON admin_events (actor_id);

CREATE INDEX ix_admin_events_created_at ON admin_events (created_at);

UPDATE alembic_version SET version_num='0002' WHERE alembic_version.version_num = '0001';

COMMIT;

