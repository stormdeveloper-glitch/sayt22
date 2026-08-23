"""PostgreSQL chat storage.

Every chat message is stored independently in PostgreSQL.  The sender/recipient
identity and conversation key are persisted with each row so messages from
separate users can never be mixed merely because they share the same numeric ID.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id TEXT PRIMARY KEY,
    sender_type TEXT NOT NULL,
    sender_id BIGINT NOT NULL,
    recipient_type TEXT NOT NULL,
    recipient_id TEXT NOT NULL DEFAULT '',
    conversation_key TEXT NOT NULL,
    message_text TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    reply_to TEXT,
    created_at BIGINT NOT NULL,
    created_at_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sender
    ON chat_messages (sender_type, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_recipient
    ON chat_messages (recipient_type, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversation
    ON chat_messages (conversation_key, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_chat_sender_conversation
    ON chat_messages (sender_type, sender_id, conversation_key, created_at DESC);
"""


def _connect():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL PostgreSQL ulanish manzili sozlanmagan")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)


def init_chat_db() -> None:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)
        conn.commit()


def _safe_id(value: Any) -> str:
    return str(value if value is not None else "")


def conversation_key(sender_type: str, sender_id: Any, recipient_type: str, recipient_id: Any) -> str:
    left = f"{sender_type}:{_safe_id(sender_id)}"
    right = f"{recipient_type}:{_safe_id(recipient_id)}"
    return "dm:" + "|".join(sorted((left, right)))


def normalize_message(message: dict[str, Any]) -> dict[str, Any]:
    sender_type = str(message.get("fromType") or "unknown")
    sender_id = int(message.get("fromId") or 0)
    recipient_type = str(message.get("toType") or "unknown")
    recipient_id = _safe_id(message.get("toId"))
    created_at = int(message.get("timestamp") or int(time.time() * 1000))

    raw_id = message.get("id")
    message_id = _safe_id(raw_id) if raw_id is not None else str(uuid.uuid4())
    if not message_id:
        message_id = str(uuid.uuid4())

    if recipient_type in {"student", "teacher", "admin", "specific_student", "specific_teacher"}:
        conv = conversation_key(sender_type, sender_id, recipient_type, recipient_id)
    elif recipient_type == "group":
        conv = f"group:{recipient_id}"
    elif recipient_type in {"all", "all_students", "all_teachers"}:
        conv = f"broadcast:{recipient_type}"
    elif recipient_type == "teacher_students":
        conv = f"teacher_students:{recipient_id}"
    else:
        conv = f"other:{recipient_type}:{recipient_id}"

    return {
        "message_id": message_id,
        "sender_type": sender_type,
        "sender_id": sender_id,
        "recipient_type": recipient_type,
        "recipient_id": recipient_id,
        "conversation_key": conv,
        "message_text": str(message.get("text") or ""),
        "media_url": message.get("media"),
        "reply_to": _safe_id(message.get("replyTo")) or None,
        "created_at": created_at,
    }


def upsert_messages(messages: list[dict[str, Any]]) -> None:
    if not messages:
        return
    init_chat_db()
    rows = [normalize_message(m) for m in messages if isinstance(m, dict)]
    with _connect() as conn:
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(
                    """
                    INSERT INTO chat_messages
                    (message_id, sender_type, sender_id, recipient_type, recipient_id,
                     conversation_key, message_text, media_url, reply_to, created_at)
                    VALUES (%(message_id)s, %(sender_type)s, %(sender_id)s, %(recipient_type)s,
                            %(recipient_id)s, %(conversation_key)s, %(message_text)s,
                            %(media_url)s, %(reply_to)s, %(created_at)s)
                    ON CONFLICT (message_id) DO UPDATE SET
                        sender_type = EXCLUDED.sender_type,
                        sender_id = EXCLUDED.sender_id,
                        recipient_type = EXCLUDED.recipient_type,
                        recipient_id = EXCLUDED.recipient_id,
                        conversation_key = EXCLUDED.conversation_key,
                        message_text = EXCLUDED.message_text,
                        media_url = EXCLUDED.media_url,
                        reply_to = EXCLUDED.reply_to,
                        created_at = EXCLUDED.created_at
                    """,
                    row,
                )
        conn.commit()


def message_to_client(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["message_id"],
        "fromType": row["sender_type"],
        "fromId": row["sender_id"],
        "toType": row["recipient_type"],
        "toId": row["recipient_id"],
        "text": row["message_text"],
        "media": row["media_url"],
        "timestamp": row["created_at"],
        "replyTo": row["reply_to"],
    }


def get_messages_for_user(
    user_type: str,
    user_id: int,
    *,
    teacher_ids: list[int] | None = None,
    group: str | None = None,
    limit: int = 1000,
) -> list[dict[str, Any]]:
    init_chat_db()
    user_id = int(user_id)
    teacher_ids = [int(x) for x in (teacher_ids or [])]
    conditions = ["(sender_type = %s AND sender_id = %s)"]
    params: list[Any] = [user_type, user_id]

    # Direct messages are matched by BOTH identity type and ID.
    # This prevents e.g. student #1 from seeing teacher #1's messages.
    if user_type == "student":
        conditions.append("(recipient_type IN ('student', 'specific_student') AND recipient_id = %s)")
        params.append(str(user_id))
        if teacher_ids:
            conditions.append("(recipient_type = 'specific_teacher' AND recipient_id = ANY(%s))")
            params.append([str(x) for x in teacher_ids])
        conditions.append("recipient_type IN ('all', 'all_students')")
        if teacher_ids:
            conditions.append("(recipient_type = 'teacher_students' AND recipient_id = ANY(%s))")
            params.append([str(x) for x in teacher_ids])
        if group:
            conditions.append("(recipient_type = 'group' AND recipient_id = %s)")
            params.append(str(group))
    elif user_type == "teacher":
        conditions.append("(recipient_type IN ('teacher', 'specific_teacher') AND recipient_id = %s)")
        params.append(str(user_id))
        conditions.append("recipient_type IN ('all', 'all_teachers')")
        conditions.append("(recipient_type = 'teacher_students' AND recipient_id = %s)")
        params.append(str(user_id))
    elif user_type == "admin":
        conditions.append("(recipient_type IN ('admin', 'specific_admin') AND recipient_id = %s)")
        params.append(str(user_id))
        conditions.append("recipient_type IN ('all', 'all_teachers')")

    sql = f"""
        SELECT message_id, sender_type, sender_id, recipient_type, recipient_id,
               conversation_key, message_text, media_url, reply_to, created_at
        FROM chat_messages
        WHERE {' OR '.join(conditions)}
        ORDER BY created_at ASC
        LIMIT %s
    """
    params.append(max(1, min(int(limit), 5000)))

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    return [message_to_client(row) for row in rows]


def delete_user_messages(user_type: str, user_id: int) -> int:
    init_chat_db()
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM chat_messages WHERE sender_type = %s AND sender_id = %s",
                (user_type, int(user_id)),
            )
            deleted = cur.rowcount
        conn.commit()
    return deleted
