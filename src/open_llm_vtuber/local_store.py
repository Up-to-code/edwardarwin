"""Local SQLite storage shared by personal references and conversation history."""
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path('data/nori.sqlite3')

@contextmanager
def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    DB_PATH.chmod(0o600)
    try:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS histories(conf_uid TEXT NOT NULL, uid TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(conf_uid,uid));
        CREATE TABLE IF NOT EXISTS migrations(key TEXT PRIMARY KEY);
        ''')
        with db:
            db.execute('BEGIN IMMEDIATE')
            yield db
    finally:
        db.close()
