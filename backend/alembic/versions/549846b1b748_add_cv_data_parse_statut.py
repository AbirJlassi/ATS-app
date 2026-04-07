from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '549846b1b748'
down_revision = '313c67e7b441'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Créer le type ENUM d'abord
    parsestatut_enum = postgresql.ENUM(
        'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ECHEC',
        name='parsestatut'
    )
    parsestatut_enum.create(op.get_bind())

    # 2. Ajouter les colonnes
    op.add_column('candidatures',
        sa.Column('parse_statut', sa.Enum(
            'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ECHEC',
            name='parsestatut'
        ), nullable=False, server_default='EN_ATTENTE')
    )
    op.add_column('candidatures',
        sa.Column('cv_data', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('candidatures', 'cv_data')
    op.drop_column('candidatures', 'parse_statut')

    # Supprimer le type ENUM
    postgresql.ENUM(name='parsestatut').drop(op.get_bind())