from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from . import models  # noqa: F401
from .database import Base


def ensure_database_schema(engine: Engine) -> None:
    """Create missing tables and patch legacy columns that create_all cannot alter."""
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    try:
        borrow_request_columns = {
            column["name"] for column in inspector.get_columns("borrow_requests")
        }
    except Exception:
        return

    if "renewal_count" in borrow_request_columns:
        pass
    else:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE borrow_requests
                    ADD COLUMN renewal_count INT NOT NULL DEFAULT 0
                    """
                )
            )

    try:
        discussion_post_columns = {
            column["name"] for column in inspector.get_columns("discussion_posts")
        }
    except Exception:
        return

    if "tags" not in discussion_post_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    ALTER TABLE discussion_posts
                    ADD COLUMN tags VARCHAR(255) NULL
                    """
                )
            )

    legacy_columns = {
        "discussion_groups": {
            "requires_approval": "ALTER TABLE discussion_groups ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE",
            "status": "ALTER TABLE discussion_groups ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
            "rules": "ALTER TABLE discussion_groups ADD COLUMN rules TEXT",
        },
        "discussion_posts": {
            "status": "ALTER TABLE discussion_posts ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
        },
        "discussion_group_members": {
            "status": "ALTER TABLE discussion_group_members ADD COLUMN status VARCHAR(40) DEFAULT 'approved'",
        },
        "discussion_post_comments": {
            "status": "ALTER TABLE discussion_post_comments ADD COLUMN status VARCHAR(40) DEFAULT 'active'",
        },
        "library_events": {
            "speaker": "ALTER TABLE library_events ADD COLUMN speaker VARCHAR(160) NULL",
            "format": "ALTER TABLE library_events ADD COLUMN format VARCHAR(40) DEFAULT 'offline'",
            "online_link": "ALTER TABLE library_events ADD COLUMN online_link VARCHAR(500) NULL",
            "capacity": "ALTER TABLE library_events ADD COLUMN capacity INT DEFAULT 50",
            "registration_deadline": "ALTER TABLE library_events ADD COLUMN registration_deadline DATETIME NULL",
            "status": "ALTER TABLE library_events ADD COLUMN status VARCHAR(40) DEFAULT 'open'",
            "tags": "ALTER TABLE library_events ADD COLUMN tags VARCHAR(255) NULL",
            "thumbnail": "ALTER TABLE library_events ADD COLUMN thumbnail VARCHAR(500) NULL",
            "materials": "ALTER TABLE library_events ADD COLUMN materials TEXT",
            "require_checkin": "ALTER TABLE library_events ADD COLUMN require_checkin BOOLEAN DEFAULT TRUE",
            "created_by": "ALTER TABLE library_events ADD COLUMN created_by INT NULL",
            "updated_at": "ALTER TABLE library_events ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        },
        "library_tutorials": {
            "video_url": "ALTER TABLE library_tutorials ADD COLUMN video_url VARCHAR(500) NULL",
            "thumbnail": "ALTER TABLE library_tutorials ADD COLUMN thumbnail VARCHAR(500) NULL",
            "topic": "ALTER TABLE library_tutorials ADD COLUMN topic VARCHAR(120) NULL",
            "level": "ALTER TABLE library_tutorials ADD COLUMN level VARCHAR(40) DEFAULT 'beginner'",
            "view_count": "ALTER TABLE library_tutorials ADD COLUMN view_count INT DEFAULT 0",
            "is_featured": "ALTER TABLE library_tutorials ADD COLUMN is_featured BOOLEAN DEFAULT FALSE",
            "status": "ALTER TABLE library_tutorials ADD COLUMN status VARCHAR(40) DEFAULT 'published'",
            "attachments": "ALTER TABLE library_tutorials ADD COLUMN attachments TEXT",
            "created_by": "ALTER TABLE library_tutorials ADD COLUMN created_by INT NULL",
            "updated_at": "ALTER TABLE library_tutorials ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        },
    }
    with engine.begin() as connection:
        for table_name, columns in legacy_columns.items():
            try:
                existing_columns = {
                    column["name"] for column in inspector.get_columns(table_name)
                }
            except Exception:
                continue
            for column_name, ddl in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(ddl))
