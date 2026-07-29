"""Initial workspace schema: documents, reports, chat_messages, obligations."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_workspace"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "documents" not in tables:
        op.create_table(
            "documents",
            sa.Column("doc_id", sa.String(), primary_key=True),
            sa.Column("filename", sa.String(), nullable=False),
            sa.Column("content_type", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("file_path", sa.String(), nullable=True),
            sa.Column("section_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("flag_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("overall_risk", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    if "chat_messages" not in tables:
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("doc_id", sa.String(), sa.ForeignKey("documents.doc_id", ondelete="CASCADE"), nullable=False),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("citations_json", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_chat_messages_doc_id", "chat_messages", ["doc_id"])

    if "obligations" not in tables:
        op.create_table(
            "obligations",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("doc_id", sa.String(), sa.ForeignKey("documents.doc_id", ondelete="CASCADE"), nullable=False),
            sa.Column("party", sa.String(), nullable=True),
            sa.Column("action", sa.Text(), nullable=False),
            sa.Column("trigger", sa.Text(), nullable=True),
            sa.Column("deadline", sa.String(), nullable=True),
            sa.Column("period", sa.String(), nullable=True),
            sa.Column("recurrence", sa.String(), nullable=True),
            sa.Column("consequence", sa.Text(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="unconfirmed"),
            sa.Column("source_chunk_ids", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_obligations_doc_id", "obligations", ["doc_id"])

    if "reports" in tables:
        cols = {c["name"] for c in inspector.get_columns("reports")}
        with op.batch_alter_table("reports") as batch:
            if "created_at" not in cols:
                batch.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
            if "updated_at" not in cols:
                batch.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))
    else:
        op.create_table(
            "reports",
            sa.Column("doc_id", sa.String(), sa.ForeignKey("documents.doc_id", ondelete="CASCADE"), primary_key=True),
            sa.Column("report_json", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("obligations")
    op.drop_table("chat_messages")
    # Keep reports for safety; drop documents only if empty environments need a clean slate.
    op.drop_table("documents")
