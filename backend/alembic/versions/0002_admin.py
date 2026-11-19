"""Admin change attribution and audit events."""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("order_status_history", sa.Column("actor_id", sa.Integer(), nullable=True))
    op.add_column("order_status_history", sa.Column("note", sa.String(300), nullable=False, server_default=""))
    op.create_foreign_key("fk_status_history_actor", "order_status_history", "users", ["actor_id"], ["id"])
    op.create_table("admin_events", sa.Column("id",sa.Integer(),primary_key=True),sa.Column("actor_id",sa.Integer(),sa.ForeignKey("users.id"),nullable=False),sa.Column("action",sa.String(80),nullable=False),sa.Column("entity",sa.String(80),nullable=False),sa.Column("details",sa.JSON(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False))
    op.create_index("ix_admin_events_actor_id","admin_events",["actor_id"])
    op.create_index("ix_admin_events_created_at","admin_events",["created_at"])

def downgrade():
    op.drop_table("admin_events")
    op.drop_constraint("fk_status_history_actor","order_status_history",type_="foreignkey")
    op.drop_column("order_status_history","note")
    op.drop_column("order_status_history","actor_id")
