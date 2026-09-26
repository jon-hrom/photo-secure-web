"""Списание и возврат энергии за ретушь. Атомарно, через одну транзакцию."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p28211681_photo_secure_web")


def _conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_balance(user_id: int) -> int:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"SELECT COALESCE(energy_balance, 0) AS b FROM {SCHEMA}.users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            return int(row["b"]) if row else 0
    finally:
        conn.close()


def is_admin(user_id: int) -> bool:
    """Отладочные действия (каталог моделей, пробный прогон) — только админу."""
    if not user_id:
        return False
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return bool(row and row.get("role") == "admin")
    except Exception:
        return False
    finally:
        conn.close()


def spend(user_id: int, amount: int, description: str):
    """Списывает amount энергии. Возвращает (ok, balance, error)."""
    if amount <= 0:
        return True, get_balance(user_id), None
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                UPDATE {SCHEMA}.users
                SET energy_balance = COALESCE(energy_balance, 0) - %s
                WHERE id = %s AND COALESCE(energy_balance, 0) >= %s
                RETURNING energy_balance
                """,
                (amount, user_id, amount),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return False, get_balance(user_id), "insufficient_energy"
            balance = int(row["energy_balance"])
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.energy_transactions
                (user_id, amount, type, rub_amount, description)
                VALUES (%s, %s, 'usage', 0, %s)
                """,
                (user_id, -amount, description),
            )
            conn.commit()
            return True, balance, None
    except Exception as e:
        conn.rollback()
        return False, 0, f"energy error: {e}"
    finally:
        conn.close()


def refund_once(user_id: int, amount: int, description: str) -> bool:
    """Возврат, который нельзя получить дважды за одну задачу.

    Ключ идемпотентности — текст описания (в нём id задачи). Если строка
    возврата с таким описанием уже есть, второй раз не начисляем: иначе
    повторный запрос с фронта дорисовывал бы энергию из воздуха.
    Возвращает True, если возврат реально произошёл.
    """
    if amount <= 0 or not user_id:
        return False
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT 1 FROM {SCHEMA}.energy_transactions
                WHERE user_id = %s AND type = 'refund' AND description = %s
                LIMIT 1
                """,
                (user_id, description),
            )
            if cur.fetchone():
                conn.rollback()
                return False
            cur.execute(
                f"""
                UPDATE {SCHEMA}.users
                SET energy_balance = COALESCE(energy_balance, 0) + %s
                WHERE id = %s
                """,
                (amount, user_id),
            )
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.energy_transactions
                (user_id, amount, type, rub_amount, description)
                VALUES (%s, %s, 'refund', 0, %s)
                """,
                (user_id, amount, description),
            )
            conn.commit()
            return True
    except Exception as e:
        conn.rollback()
        print(f"[ENERGY] refund_once failed for user {user_id}: {e}")
        return False
    finally:
        conn.close()


def refund(user_id: int, amount: int, description: str):
    """Возврат энергии при неудачной операции. Ошибки глушим."""
    if amount <= 0:
        return
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {SCHEMA}.users
                SET energy_balance = COALESCE(energy_balance, 0) + %s
                WHERE id = %s
                """,
                (amount, user_id),
            )
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.energy_transactions
                (user_id, amount, type, rub_amount, description)
                VALUES (%s, %s, 'refund', 0, %s)
                """,
                (user_id, amount, description),
            )
            conn.commit()
    except Exception as e:
        print(f"[ENERGY] refund failed for user {user_id}: {e}")
    finally:
        conn.close()