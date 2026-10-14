import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.API_PORT ?? 4310);
const SECRET = process.env.AUTH_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const DB_PATH = process.env.DB_PATH ?? "./server/data/finance.db";

if (!SECRET || SECRET.length < 16) {
  console.error("Falta AUTH_SECRET (mínimo 16 caracteres, ver server/README.md)");
  process.exit(1);
}

mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
)`);

// Migra la tabla de la versión sin usuarios: el primer usuario que se registre hereda esos datos.
const oldColumns = db.prepare("PRAGMA table_info(records)").all().map((c) => c.name);
if (oldColumns.length && !oldColumns.includes("user_id")) db.exec("ALTER TABLE records RENAME TO records_legacy");
db.exec(`CREATE TABLE IF NOT EXISTS records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
)`);

const upsert = db.prepare("INSERT INTO records (user_id, id, data) VALUES (?, ?, ?) ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data");
const remove = db.prepare("DELETE FROM records WHERE user_id = ? AND id = ?");
const list = db.prepare("SELECT data FROM records WHERE user_id = ?");
const clear = db.prepare("DELETE FROM records WHERE user_id = ?");
const userByName = db.prepare("SELECT * FROM users WHERE username = ?");
const userByGoogle = db.prepare("SELECT * FROM users WHERE google_sub = ?");
const userById = db.prepare("SELECT * FROM users WHERE id = ?");
const insertUser = db.prepare("INSERT INTO users (id, username, password_hash, google_sub, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?)");

function createUser({ username = null, passwordHash = null, googleSub = null, displayName }) {
  const id = randomUUID();
  insertUser.run(id, username, passwordHash, googleSub, displayName, new Date().toISOString());
  const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records_legacy'").get();
  if (legacy) {
    db.exec("BEGIN");
    try {
      for (const row of db.prepare("SELECT id, data FROM records_legacy").all()) upsert.run(id, row.id, row.data);
      db.exec("DROP TABLE records_legacy");
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return userById.get(id);
}

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sign = (payload) => createHmac("sha256", SECRET).update(payload).digest("base64url");

function issueToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

function userFromRequest(req) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const [payload, signature] = header.slice(7).split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return userById.get(uid) ?? null;
  } catch {
    return null;
  }
}

const hashPassword = (password) => {
  const salt = randomBytes(16);
  return `${salt.toString("base64")}:${scryptSync(password, salt, 64).toString("base64")}`;
};

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Limita intentos de autenticación por IP (ventana de 15 min).
const attempts = new Map();
function rateLimited(req) {
  const ip = req.headers["x-client-ip"] ?? req.headers["cf-connecting-ip"] ?? req.socket.remoteAddress ?? "?";
  const now = Date.now();
  const entry = attempts.get(ip) ?? { count: 0, reset: now + 15 * 60_000 };
  if (entry.reset < now) { entry.count = 0; entry.reset = now + 15 * 60_000; }
  entry.count += 1;
  attempts.set(ip, entry);
  return entry.count > 30;
}

async function verifyGoogle(credential) {
  if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID no configurado");
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return null;
  const info = await res.json();
  const issuerOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
  if (info.aud !== GOOGLE_CLIENT_ID || !issuerOk || !info.sub || info.exp * 1000 < Date.now()) return null;
  return info;
}

const publicUser = (user) => ({ id: user.id, name: user.display_name });
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000_000) reject(new Error("Payload demasiado grande"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "null")); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload === undefined ? "" : JSON.stringify(payload));
}

const isRecord = (r) => r && typeof r === "object" && typeof r.id === "string" && typeof r.kind === "string";

async function handleAuth(req, res, action) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (rateLimited(req)) return send(res, 429, { error: "Demasiados intentos, espera unos minutos" });
  const body = (await readJson(req)) ?? {};

  if (action === "register") {
    const { username, password } = body;
    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
      return send(res, 400, { error: "Usuario: 3-32 caracteres (letras, números, . _ -)" });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 200) {
      return send(res, 400, { error: "La contraseña debe tener al menos 8 caracteres" });
    }
    if (userByName.get(username)) return send(res, 409, { error: "Ese usuario ya existe" });
    const user = createUser({ username, passwordHash: hashPassword(password), displayName: username });
    return send(res, 200, { token: issueToken(user), user: publicUser(user) });
  }

  if (action === "login") {
    const { username, password } = body;
    const user = typeof username === "string" ? userByName.get(username) : undefined;
    // Se calcula siempre el hash para no revelar si el usuario existe por tiempo de respuesta.
    const ok = verifyPassword(typeof password === "string" ? password : "", user?.password_hash ?? `${randomBytes(16).toString("base64")}:${randomBytes(64).toString("base64")}`);
    if (!user || !ok) return send(res, 401, { error: "Usuario o contraseña incorrectos" });
    return send(res, 200, { token: issueToken(user), user: publicUser(user) });
  }

  if (action === "google") {
    if (typeof body.credential !== "string") return send(res, 400, { error: "Falta credencial" });
    const info = await verifyGoogle(body.credential);
    if (!info) return send(res, 401, { error: "Credencial de Google inválida" });
    const user = userByGoogle.get(info.sub)
      ?? createUser({ googleSub: info.sub, displayName: info.name || info.email || "Usuario" });
    return send(res, 200, { token: issueToken(user), user: publicUser(user) });
  }

  send(res, 404, { error: "No encontrado" });
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    const parts = pathname.split("/").filter(Boolean);

    if (parts[0] === "auth" && parts[1]) return await handleAuth(req, res, parts[1]);

    const user = userFromRequest(req);
    if (!user) return send(res, 401, { error: "No autorizado" });

    if (parts[0] === "me" && req.method === "GET") return send(res, 200, publicUser(user));
    if (parts[0] !== "records") return send(res, 404, { error: "No encontrado" });
    const id = parts[1] ? decodeURIComponent(parts[1]) : undefined;

    if (req.method === "GET" && !id) {
      return send(res, 200, list.all(user.id).map((row) => JSON.parse(row.data)));
    }
    if (req.method === "PUT" && id) {
      const record = await readJson(req);
      if (!isRecord(record) || record.id !== id) return send(res, 400, { error: "Registro inválido" });
      upsert.run(user.id, id, JSON.stringify(record));
      return send(res, 200, record);
    }
    if (req.method === "DELETE" && id) {
      remove.run(user.id, id);
      return send(res, 204);
    }
    if (req.method === "PUT" && !id) {
      const records = await readJson(req);
      if (!Array.isArray(records) || !records.every(isRecord)) return send(res, 400, { error: "Registros inválidos" });
      db.exec("BEGIN");
      try {
        clear.run(user.id);
        for (const r of records) upsert.run(user.id, r.id, JSON.stringify(r));
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return send(res, 200, records);
    }
    send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Error interno" });
  }
}).listen(PORT, () => console.log(`API escuchando en :${PORT}, DB: ${DB_PATH}`));
