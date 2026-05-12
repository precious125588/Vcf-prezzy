import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mode; // 'pg' or 'json'
let pool;

// JSON fallback state
let jsonPath;
let settingsPath;
let store = { contacts: [] };
let settings = { suffix: "" };

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadJson(p, fallback) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error("Failed to read", p, e.message);
  }
  return fallback;
}

function saveJson(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='suffix'");
    settings.suffix = rows[0]?.value || "";
    console.log("Database ready (PostgreSQL).");
  } else {
    mode = "json";
    ensureDir(DATA_DIR);
    jsonPath = path.join(DATA_DIR, "contacts.json");
    settingsPath = path.join(DATA_DIR, "settings.json");
    store = loadJson(jsonPath, { contacts: [] });
    settings = loadJson(settingsPath, { suffix: "" });
    console.log("Database ready (JSON file at " + jsonPath + ").");
    if (!process.env.DATABASE_URL) {
      console.warn(
        "⚠  No DATABASE_URL set. Using JSON file storage. On ephemeral hosts (Vercel, Railway without volume) data may not persist across restarts. Set DATABASE_URL to a Postgres URL for guaranteed persistence."
      );
    }
  }
}

function uuid() {
  return crypto.randomUUID();
}

function dupErr() {
  const e = new Error("duplicate");
  e.code = "23505";
  return e;
}

export async function getCount() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT COUNT(*) AS total FROM contacts");
    return parseInt(rows[0].total, 10);
  }
  return store.contacts.length;
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
  if (store.contacts.some((c) => c.country_code === countryCode && c.phone === phone)) {
    throw dupErr();
  }
  const id = uuid();
  const now = new Date().toISOString();
  const row = { id, name, country_code: countryCode, phone, created_at: now, updated_at: null };
  store.contacts.push(row);
  saveJson(jsonPath, store);
  return { id, name, countryCode, phone, createdAt: now };
}

function mapRow(r) {
  return {
    id: r.id,
    name: r.name,
    countryCode: r.country_code,
    phone: r.phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
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
  return [...store.contacts]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map(mapRow);
}

export async function getContact(id) {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT * FROM contacts WHERE id = $1", [id]);
    return rows[0] || null;
  }
  return store.contacts.find((c) => c.id === id) || null;
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
  const idx = store.contacts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  if (
    store.contacts.some(
      (c, i) => i !== idx && c.country_code === countryCode && c.phone === phone
    )
  ) {
    throw dupErr();
  }
  const now = new Date().toISOString();
  store.contacts[idx] = {
    ...store.contacts[idx],
    name,
    country_code: countryCode,
    phone,
    updated_at: now,
  };
  saveJson(jsonPath, store);
  return mapRow(store.contacts[idx]);
}

export async function deleteContact(id) {
  if (mode === "pg") {
    const r = await pool.query("DELETE FROM contacts WHERE id = $1", [id]);
    return r.rowCount > 0;
  }
  const before = store.contacts.length;
  store.contacts = store.contacts.filter((c) => c.id !== id);
  if (store.contacts.length === before) return false;
  saveJson(jsonPath, store);
  return true;
}

export async function deleteAllContacts() {
  if (mode === "pg") {
    await pool.query("DELETE FROM contacts");
  } else {
    store.contacts = [];
    saveJson(jsonPath, store);
  }
}

export async function getAllContactsRaw() {
  if (mode === "pg") {
    const { rows } = await pool.query(
      "SELECT name, country_code, phone FROM contacts ORDER BY created_at ASC"
    );
    return rows;
  }
  return [...store.contacts]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((c) => ({ name: c.name, country_code: c.country_code, phone: c.phone }));
}

export async function getSuffix() {
  if (mode === "pg") {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='suffix'");
    return rows[0]?.value || "";
  }
  return settings.suffix || "";
}

export async function setSuffix(value) {
  const v = String(value || "");
  if (mode === "pg") {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('suffix', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [v]
    );
  } else {
    settings.suffix = v;
    saveJson(settingsPath, settings);
  }
  return v;
}
