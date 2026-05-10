"""Initialize the diary SQLite database from protocol/schema.sql.

Usage:
    python -m diary.init_db                    # default path: diary/diary.db
    python -m diary.init_db --db /tmp/foo.db   # custom path
    python -m diary.init_db --force            # drop existing tables first
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "protocol" / "schema.sql"
DEFAULT_DB_PATH = REPO_ROOT / "diary" / "diary.db"


def init_db(db_path: Path = DEFAULT_DB_PATH, *, force: bool = False) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    schema_sql = SCHEMA_PATH.read_text()

    conn = sqlite3.connect(str(db_path))
    try:
        if force:
            for table in ("entries", "prompts", "sessions", "scenarios"):
                conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize the diary database.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="path to SQLite file")
    parser.add_argument("--force", action="store_true", help="drop existing tables first")
    args = parser.parse_args()
    init_db(args.db, force=args.force)
    print(f"Initialized {args.db}")


if __name__ == "__main__":
    main()
