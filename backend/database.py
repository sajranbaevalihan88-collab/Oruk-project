"""SQLite database layer for Oruk.AI (WAL mode, zero external DB servers)."""
import os
import sqlite3
import threading
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "oruk.db")

# FastAPI runs the dependency teardown in a different worker thread,
# so cross-thread usage must be allowed (each connection is still
# used by one request at a time; WAL mode serialises writers).
DB_LOCK = threading.Lock()


def connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def get_db():
    with DB_LOCK:
        conn = connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('farmer','buyer','admin')),
    region TEXT NOT NULL,
    phone TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ru TEXT NOT NULL,
    name_kg TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'кг',
    category TEXT NOT NULL DEFAULT 'fruit'
);

CREATE TABLE IF NOT EXISTS price_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    region TEXT NOT NULL,
    price_som REAL NOT NULL,
    reported_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity_kg REAL NOT NULL,
    price_som REAL NOT NULL,
    region TEXT NOT NULL,
    description TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','reserved','sold')),
    reserved_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coop_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    title TEXT NOT NULL,
    target_kg REAL NOT NULL,
    min_price_som REAL NOT NULL DEFAULT 0,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','fulfilled','closed')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coop_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES coop_requests(id),
    farmer_id INTEGER NOT NULL REFERENCES users(id),
    pledged_kg REAL NOT NULL,
    UNIQUE(request_id, farmer_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


def init_db():
    with get_db() as db:
        db.executescript(SCHEMA)
