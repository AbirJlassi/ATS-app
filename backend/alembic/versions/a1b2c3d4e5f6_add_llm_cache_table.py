"""add llm_cache table

Revision ID: a1b2c3d4e5f6
Revises: 0923d632191a
Create Date: 2026-04-21 11:33:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e54f69207a48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'llm_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cache_key', sa.String(length=64), nullable=False),
        sa.Column('result_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cache_key'),
    )
    op.create_index('ix_llm_cache_cache_key', 'llm_cache', ['cache_key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_llm_cache_cache_key', table_name='llm_cache')
    op.drop_table('llm_cache')
