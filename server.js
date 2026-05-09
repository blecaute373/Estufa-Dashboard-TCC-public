/**
 * Estufa 01 — Servidor de Autenticação
 * Stack: Express · sql.js · bcryptjs · JWT
 */
'use strict';

const express      = require('express');
const initSqlJs    = require('sql.js');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');

const PORT          = process.env.PORT || 3000;
const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES   = '8h';
const COOKIE_NAME   = 'estufa_tok';
const DB_FILE       = path.join(__dirname, 'estufa.db');

// Segredo JWT persistente
const SECRET_FILE = path.join(__dirname, '.jwt_secret');
let JWT_SECRET;
try {
  JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} catch {
  JWT_SECRET = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
  console.log('[Auth] Novo segredo JWT gerado e salvo em .jwt_secret');
}

/* ── DB ── */
let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT
  );
  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    event TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_logs_user    ON access_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_event   ON access_logs(event);
  CREATE INDEX IF NOT EXISTS idx_logs_created ON access_logs(created_at);
`;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  saveDb();
  setInterval(saveDb, 5000);
}

function dbRun(sql, p=[]) { db.run(sql, p); }
function dbGet(sql, p=[]) {
  const s = db.prepare(sql); s.bind(p);
  const r = s.step() ? s.getAsObject() : null; s.free(); return r;
}
function dbAll(sql, p=[]) {
  const rows=[]; const s=db.prepare(sql); s.bind(p);
  while(s.step()) rows.push(s.getAsObject()); s.free(); return rows;
}
function dbInsert(sql, p=[]) {
  db.run(sql, p);
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
}

const q = {
  findByUsername: (u)      => dbGet(`SELECT * FROM users WHERE lower(username)=lower(?) LIMIT 1`,[u]),
  findByEmail:    (e)      => dbGet(`SELECT * FROM users WHERE lower(email)=lower(?) LIMIT 1`,[e]),
  findById:       (id)     => dbGet(`SELECT id,username,email,is_active,created_at,last_login FROM users WHERE id=? LIMIT 1`,[id]),
  countUsers:     ()       => (dbGet(`SELECT COUNT(*) as n FROM users`)||{n:0}).n,
  insertUser:     (u,e,h)  => dbInsert(`INSERT INTO users(username,email,password_hash) VALUES(?,?,?)`,[u,e,h]),
  updateLogin:    (id)     => dbRun(`UPDATE users SET last_login=datetime('now') WHERE id=?`,[id]),
  listUsers:      ()       => dbAll(`SELECT id,username,email,is_active,created_at,last_login FROM users ORDER BY created_at DESC`),
  insertLog: (uid,un,ev,ip,ua,det) => dbRun(`INSERT INTO access_logs(user_id,username,event,ip_address,user_agent,details) VALUES(?,?,?,?,?,?)`,[uid,un,ev,ip,ua,det]),
  listLogs:       (n)      => dbAll(`SELECT l.*,u.email FROM access_logs l LEFT JOIN users u ON l.user_id=u.id ORDER BY l.created_at DESC LIMIT ?`,[n]),
};

function log(userId, username, event, req, details=null) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  q.insertLog(userId??null, username??null, event, ip, ua, details ? JSON.stringify(details) : null);
}

/* ── APP ── */
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15*60*1000, max: 20,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true, legacyHeaders: false,
});

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ','');
  if (!token) return res.redirect('/login');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.clearCookie(COOKIE_NAME); res.redirect('/login'); }
}

function requireAuthApi(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers['authorization']?.replace('Bearer ','');
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Sessão expirada' }); }
}

/* ── AUTH ROUTES ── */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    return res.status(400).json({ error: 'Usuário: 3–30 caracteres (letras, números, _).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Senha mínima: 8 caracteres.' });
  if (q.findByUsername(username))
    return res.status(409).json({ error: 'Nome de usuário já em uso.' });
  if (q.findByEmail(email))
    return res.status(409).json({ error: 'E-mail já cadastrado.' });
  try {
    const hash   = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = q.insertUser(username, email.toLowerCase(), hash);
    saveDb();
    log(userId, username, 'register', req);
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 8*60*60*1000 })
       .json({ ok: true, username });
  } catch(err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Preencha usuário e senha.' });
  const user = q.findByUsername(username) || q.findByEmail(username);
  if (!user || !user.is_active) {
    log(null, username, 'failed_login', req, { reason: 'not_found' });
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    log(user.id, user.username, 'failed_login', req, { reason: 'wrong_password' });
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  q.updateLogin(user.id);
  saveDb();
  log(user.id, user.username, 'login', req);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: 8*60*60*1000 })
     .json({ ok: true, username: user.username });
});

app.post('/api/auth/logout', requireAuthApi, (req, res) => {
  log(req.user.id, req.user.username, 'logout', req);
  res.clearCookie(COOKIE_NAME).json({ ok: true });
});

app.get('/api/auth/me',     requireAuthApi, (req, res) => res.json(q.findById(req.user.id) || { error: 'Não encontrado' }));
app.get('/api/auth/status', (req, res) => res.json({ registeredUsers: q.countUsers() }));

/* ── ADMIN ── */
app.get('/api/admin/logs',  requireAuthApi, (req, res) => res.json(q.listLogs(Math.min(parseInt(req.query.limit)||100,500))));
app.get('/api/admin/users', requireAuthApi, (req, res) => res.json(q.listUsers()));

/* ── PAGES ── */
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/',      requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public')));

/* ── START ── */
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌿 Estufa 01 rodando em http://localhost:${PORT}`);
    console.log(`   Dashboard  → http://localhost:${PORT}/`);
    console.log(`   Login      → http://localhost:${PORT}/login`);
    console.log(`   Admin/Logs → http://localhost:${PORT}/admin\n`);
  });
}).catch(err => { console.error('Erro ao inicializar DB:', err); process.exit(1); });
