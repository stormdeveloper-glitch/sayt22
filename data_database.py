"""PostgreSQL (onlayn) ma'lumotlar bazasi moduli.

Barcha platforma ma'lumotlari PostgreSQL bazasidagi `app_data` jadvalida
JSONB formatida saqlanadi. Mahalliy (SQLite/fayl) saqlash olib tashlangan.
DATABASE_URL mavjud bo'lmasa, dastur ishga tushmaydi.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger("data_database")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS app_data (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _get_connection():
    """PostgreSQL ulanishini qaytaradi. DATABASE_URL bo'lmasa xato beradi."""
    if not DATABASE_URL:
        raise RuntimeError(
            "XATOLIK: DATABASE_URL muhit o'zgaruvchisi sozlanmagan! "
            "Railway yoki server sozlamalarida PostgreSQL DATABASE_URL ni kiriting."
        )
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)


def init_data_db() -> None:
    """`app_data` jadvalini PostgreSQL bazasida yaratadi."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)
        conn.commit()
    logger.info("PostgreSQL `app_data` jadvali muvaffaqiyatli tekshirildi/yaratildi.")


def save_data_dict(key: str, data: Dict[str, Any]) -> None:
    """Berilgan kalit bo'yicha ma'lumotlarni PostgreSQL'ga yozadi (UPSERT)."""
    json_str = json.dumps(data, ensure_ascii=False)
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_data (key, data, updated_at)
                VALUES (%s, %s::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE
                SET data = EXCLUDED.data,
                    updated_at = NOW();
                """,
                (key, json_str),
            )
        conn.commit()


def get_data_by_key(key: str) -> Optional[Dict[str, Any]]:
    """Kalit bo'yicha JSON ma'lumotini PostgreSQL'dan oladi."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT data FROM app_data WHERE key = %s;", (key,))
            row = cur.fetchone()
            if not row:
                return None
            val = row["data"] if isinstance(row, dict) else row[0]
            if isinstance(val, dict):
                return val
            if isinstance(val, str):
                try:
                    return json.loads(val)
                except Exception:
                    return None
            return val


def get_all_data() -> Dict[str, Any]:
    """Asosiy 'app_data' ma'lumotlarini PostgreSQL bazasidan o'qiydi."""
    data = get_data_by_key("app_data")
    if isinstance(data, dict) and data:
        return data
    return {
        "students": [],
        "teachers": [],
        "admins": [],
        "groups": [],
        "posts": [],
        "tasks": [],
        "homeworks": [],
        "chat_messages": [],
        "analytics": {},
    }


def migrate_json_to_db(json_path: Path) -> None:
    """Eski `data.json` faylidan PostgreSQL'ga bir martalik migratsiya."""
    if not json_path or not json_path.is_file():
        return

    # Agar PostgreSQL bazasida allaqachon ma'lumotlar mavjud bo'lsa, qayta yozmaymiz
    existing = get_data_by_key("app_data")
    if existing and (existing.get("students") or existing.get("teachers") or existing.get("admins")):
        logger.info("PostgreSQL'da ma'lumotlar mavjud, JSON migratsiyasi o'tkazilmadi.")
        return

    try:
        with json_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data:
            save_data_dict("app_data", data)
            logger.info("Eski data.json ma'lumotlari PostgreSQL bazasiga muvaffaqiyatli ko'chirildi.")
    except Exception as exc:
        logger.warning("data.json migratsiyasida ogohlantirish: %s", exc)
