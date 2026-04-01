import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  initDb,
  getCount,
  addContact,
  getAllContacts,
  getContact,
  updateContact,
  deleteContact,
  deleteAllContacts,
  getAllContactsRaw,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "080205";

function requireAdmin(req, res, next) {
  const pw = req.headers["x-admin-password"] || req.query["pw"];
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// PUBLIC: total count only
app.get("/api/contacts", async (req, res) => {
  try {
    const total = await getCount();
    res.json({ total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUBLIC: add a contact
app.post("/api/contacts", async (req, res) => {
  const { name, countryCode, phone } = req.body;
  if (!name || !countryCode || !phone) {
    return res.status(400).json({ error: "name, countryCode, and phone are required" });
  }
  const cleanPhone = String(phone).replace(/\s+/g, "");
  try {
    const contact = await addContact(String(name), String(countryCode), cleanPhone);
    return res.status(201).json(contact);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "This phone number already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: get all contacts
app.get("/api/admin/contacts", requireAdmin, async (req, res) => {
  try {
    const contacts = await getAllContacts();
    res.json({ contacts, total: contacts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: edit a contact
app.patch("/api/admin/contacts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, countryCode, phone } = req.body;
  try {
    const existing = await getContact(id);
    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }
    const updatedName = name !== undefined ? String(name) : existing.name;
    const updatedCountry = countryCode ? String(countryCode) : existing.country_code;
    const updatedPhone = phone ? String(phone).replace(/\s+/g, "") : existing.phone;

    const contact = await updateContact(id, updatedName, updatedCountry, updatedPhone);
    return res.json(contact);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "This phone number already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: delete a contact
app.delete("/api/admin/contacts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteContact(id);
    if (!deleted) return res.status(404).json({ error: "Contact not found" });
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: delete ALL contacts
app.delete("/api/admin/contacts", requireAdmin, async (req, res) => {
  try {
    await deleteAllContacts();
    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: download VCF
app.get("/api/admin/contacts/vcf", requireAdmin, async (req, res) => {
  try {
    const rows = await getAllContactsRaw();
    const lines = [];
    for (const c of rows) {
      lines.push("BEGIN:VCARD");
      lines.push("VERSION:3.0");
      lines.push(`FN:${c.name}`);
      lines.push(`TEL;TYPE=CELL:${c.country_code}${c.phone}`);
      lines.push("END:VCARD");
    }
    res.setHeader("Content-Type", "text/vcard");
    res.setHeader("Content-Disposition", "attachment; filename=contacts.vcf");
    return res.send(lines.join("\r\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`VCF Collector running at http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
