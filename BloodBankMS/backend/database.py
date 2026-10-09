import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bloodbank.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin', 'donor', 'hospital')),
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donors (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    blood_group        TEXT NOT NULL,
    age                INTEGER NOT NULL,
    gender             TEXT,
    weight             REAL NOT NULL,
    haemoglobin        REAL,
    phone              TEXT,
    city               TEXT,
    last_donation_date TEXT
);

CREATE TABLE IF NOT EXISTS hospitals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    hospital_name TEXT NOT NULL,
    license_no    TEXT,
    phone         TEXT,
    city          TEXT
);

CREATE TABLE IF NOT EXISTS camps (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    venue     TEXT NOT NULL,
    city      TEXT,
    camp_date TEXT NOT NULL,
    capacity  INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS appointments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    donor_id   INTEGER NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    camp_id    INTEGER NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (donor_id, camp_id)
);

CREATE TABLE IF NOT EXISTS requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hospital_id  INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    blood_group  TEXT NOT NULL,
    units        INTEGER NOT NULL CHECK (units > 0),
    urgency      TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'critical')),
    status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected', 'cancelled')),
    remarks      TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS blood_units (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    blood_group  TEXT NOT NULL,
    donor_id     INTEGER REFERENCES donors(id) ON DELETE SET NULL,
    collected_on TEXT NOT NULL,
    expiry_date  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'expired')),
    request_id   INTEGER REFERENCES requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_units_group_status ON blood_units (blood_group, status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_db():
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
