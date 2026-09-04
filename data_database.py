"""Hybrid storage for application data.

The platform keeps a canonical JSON payload under the ``app_data`` key and
mirrors it to both SQLite and PostgreSQL when available. Reads prefer the most
recent copy so the app can continue working even if one database is offline.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger("data_database")

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = Path("/app/data") if Path("/app").is_dir() else BASE_DIR / "data"
DATA_DIR = Path(os.environ.get("DATA_DIR", str(DEFAULT_DATA_DIR)))
SQLITE_PATH = Path(os.environ.get("SQLITE_PATH", str(DATA_DIR / "app_data.sqlite3")))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
"""


def _json_dumps(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def _postgres_enabled() -> bool:
    return bool(DATABASE_URL)


def _get_postgres_connection():
    if not _postgres_enabled():
        raise RuntimeError("DATABASE_URL sozlanmagan")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)


def _get_sqlite_connection() -> sqlite3.Connection:
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_sqlite_db() -> None:
    with _get_sqlite_connection() as conn:
        conn.execute(_SQLITE_SCHEMA)
        conn.commit()


def init_postgres_db() -> None:
    if not _postgres_enabled():
        logger.warning("PostgreSQL init o'tkazib yuborildi: DATABASE_URL sozlanmagan.")
        return
    with _get_postgres_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_POSTGRES_SCHEMA)
        conn.commit()


def init_data_db() -> None:
    init_sqlite_db()
    try:
        init_postgres_db()
    except Exception as exc:  # noqa: BLE001
        logger.warning("PostgreSQL init xatosi, SQLite ishlashda davom etadi: %s", exc)


def _get_sqlite_record(key: str) -> Optional[tuple[Dict[str, Any], int]]:
    init_sqlite_db()
    with _get_sqlite_connection() as conn:
        row = conn.execute(
            "SELECT data, updated_at FROM app_data WHERE key = ?",
            (key,),
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["data"]), int(row["updated_at"] or 0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("SQLite record parse xatosi (%s): %s", key, exc)
        return None


def _get_postgres_record(key: str) -> Optional[tuple[Dict[str, Any], int]]:
    if not _postgres_enabled():
        return None
    try:
        with _get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT data, EXTRACT(EPOCH FROM updated_at)::bigint AS updated_epoch
                    FROM app_data
                    WHERE key = %s
                    """,
                    (key,),
                )
                row = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        logger.warning("PostgreSQL o'qish xatosi (%s): %s", key, exc)
        return None

    if not row:
        return None

    data = row["data"] if isinstance(row, dict) else row[0]
    updated_at = row["updated_epoch"] if isinstance(row, dict) else row[1]
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("PostgreSQL record parse xatosi (%s): %s", key, exc)
            return None
    if not isinstance(data, dict):
        return None
    return data, int(updated_at or 0)


def get_storage_health() -> Dict[str, bool]:
    sqlite_ok = True
    postgres_ok = False

    try:
        init_sqlite_db()
    except Exception:  # noqa: BLE001
        sqlite_ok = False

    if _postgres_enabled():
        try:
            with _get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            postgres_ok = True
        except Exception:  # noqa: BLE001
            postgres_ok = False

    return {
        "sqlite": sqlite_ok,
        "postgres": postgres_ok,
    }


def save_data_dict(key: str, data: Dict[str, Any]) -> Dict[str, bool]:
    """Persist the dataset to SQLite and, when configured, PostgreSQL."""
    payload = _json_dumps(data)
    updated_at = int(time.time())

    init_sqlite_db()
    with _get_sqlite_connection() as conn:
        conn.execute(
            """
            INSERT INTO app_data (key, data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
            """,
            (key, payload, updated_at),
        )
        conn.commit()

    postgres_ok = False
    if _postgres_enabled():
        try:
            with _get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO app_data (key, data, updated_at)
                        VALUES (%s, %s::jsonb, NOW())
                        ON CONFLICT (key) DO UPDATE
                        SET data = EXCLUDED.data,
                            updated_at = NOW()
                        """,
                        (key, payload),
                    )
                conn.commit()
            postgres_ok = True
        except Exception as exc:  # noqa: BLE001
            logger.warning("PostgreSQL yozish xatosi (%s), SQLite saqlandi: %s", key, exc)

    return {
        "sqlite": True,
        "postgres": postgres_ok,
    }


def get_data_by_key(key: str) -> Optional[Dict[str, Any]]:
    sqlite_record = _get_sqlite_record(key)
    postgres_record = _get_postgres_record(key)

    records = [record for record in (sqlite_record, postgres_record) if record]
    if not records:
        return None

    records.sort(key=lambda item: item[1], reverse=True)
    return records[0][0]


def get_all_data() -> Dict[str, Any]:
    data = get_data_by_key("app_data")
    return data if isinstance(data, dict) else {}


def migrate_json_to_db(json_path: Path) -> None:
    if not json_path or not json_path.is_file():
        return

    existing = get_data_by_key("app_data")
    if existing and (
        existing.get("students")
        or existing.get("teachers")
        or existing.get("admins")
    ):
        logger.info("Bazalarda ma'lumot bor, JSON migratsiyasi o'tkazilmadi.")
        return

    try:
        with json_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict) and data:
            save_data_dict("app_data", data)
            logger.info("JSON ma'lumotlari SQLite va PostgreSQL'ga yozildi.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("JSON migratsiyasida ogohlantirish: %s", exc)
