"""Проверка роли администратора."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28211681_photo_secure_web")


def is_admin(user_id) -> bool:
    if not user_id:
        return False
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
            row = cur.fetchone()
            return bool(row and row.get("role") == "admin")
    except Exception:
        return False
    finally:
        conn.close()
