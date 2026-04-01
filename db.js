import pg from "pg";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mode; // 'pg' or 'sqlite'
let pool;
let sqlite;

export async function initDb() {
  if (process.env.DATABASE_URL) {
    mode = "pg";
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name        TEXT NOT NULL,
        country_code TEXT NOT NULL,
        phone       TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ,
        UNIQUE (country_code, phone)
      )
    `);
    console.log("Database ready (PostgreSQL).");
  } else {
    mode = "sqlite";
    const dbPath = path.join(__dirname, "data", "contacts.db");
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        country_code TEXT NOT NULL,
        phone       TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT,
        UNIQUE (country_code, phone)
      )
    `);
    console.log("Database ready (SQLite at " + dbPath + ").");
  }
}

function uuid() {
  return crypto.randomUUID();
}

export async function getCount() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT COUNT(*) AS total FROM contacts");
    return parseInt(rows[0].total, 10);
  }
  const row = sqlite.prepare("SELECT COUNT(*) AS total FROM contacts").get();
  return row.total;
}

export async function addContact(name, countryCode, phone) {
  if (mode === "pg") {
    const { rows } = await pool.query(
      `INSERT INTO contacts (name, country_code, phone)
       VALUES ($1, $2, $3)
       RETURNING id, name, country_code AS "countryCode", phone, created_at AS "createdAt"`,
      [name, countryCode, phone]
    );
    return rows[0];
  }
  const id = uuid();
  const now = new Date().toISOString();
  try {
    sqlite
      .prepare(
        "INSERT INTO contacts (id, name, country_code, phone, created_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(id, name, countryCode, phone, now);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const e = new Error("duplicate");
      e.code = "23505";
      throw e;
    }
    throw err;
  }
  return { id, name, countryCode, phone, createdAt: now };
}

export async function getAllContacts() {
  if (mode === "pg") {
    const { rows } = await pool.query(
      `SELECT id, name, country_code AS "countryCode", phone,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM contacts ORDER BY created_at ASC`
    );
    return rows;
  }
  return sqlite
    .prepare(
      'SELECT id, name, country_code AS "countryCode", phone, created_at AS "createdAt", updated_at AS "updatedAt" FROM contacts ORDER BY created_at ASC'
    )
    .all();
}

export async function getContact(id) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT * FROM contacts WHERE id = $1", [id]);
    return rows[0] || null;
  }
  return sqlite.prepare("SELECT * FROM contacts WHERE id = ?").get(id) || null;
}

export async function updateContact(id, name, countryCode, phone) {
  if (mode === "pg") {
    const { rows } = await pool.query(
      `UPDATE contacts
       SET name = $1, country_code = $2, phone = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, country_code AS "countryCode", phone,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, countryCode, phone, id]
    );
    return rows[0];
  }
  const now = new Date().toISOString();
  try {
    sqlite
      .prepare(
        "UPDATE contacts SET name = ?, country_code = ?, phone = ?, updated_at = ? WHERE id = ?"
      )
      .run(name, countryCode, phone, now, id);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const e = new Error("duplicate");
      e.code = "23505";
      throw e;
    }
    throw err;
  }
  return sqlite
    .prepare(
      'SELECT id, name, country_code AS "countryCode", phone, created_at AS "createdAt", updated_at AS "updatedAt" FROM contacts WHERE id = ?'
    )
    .get(id);
}

export async function deleteContact(id) {
  if (mode === "pg") {
    const result = await pool.query("DELETE FROM contacts WHERE id = $1", [id]);
    return result.rowCount > 0;
  }
  const info = sqlite.prepare("DELETE FROM contacts WHERE id = ?").run(id);
  return info.changes > 0;
}

export async function deleteAllContacts() {
  if (mode === "pg") {
    await pool.query("DELETE FROM contacts");
  } else {
    sqlite.prepare("DELETE FROM contacts").run();
  }
}

export async function getAllContactsRaw() {
  if (mode === "pg") {
    const { rows } = await pool.query(
      "SELECT name, country_code, phone FROM contacts ORDER BY created_at ASC"
    );
    return rows;
  }
  return sqlite
    .prepare("SELECT name, country_code, phone FROM contacts ORDER BY created_at ASC")
    .all();
}
