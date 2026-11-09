import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const FILE_LIMIT = 64 * 1024 * 1024;
const SESSION_SECONDS = 8 * 60 * 60;
const cookieName = 'operadash_session';
const hashToken = token => createHash('sha256').update(token).digest('hex');
const sessionDigest = req => {
  const token = /(?:^|;\s*)operadash_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
  return token ? hashToken(token) : '';
};
const normalizeLogin = value => String(value ?? '').trim().toLowerCase();
const validLogin = value => /^[a-z0-9][a-z0-9._@+-]{2,127}$/.test(value);
const validPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const derive = (password, salt) => scryptSync(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
const passwordHash = password => {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + derive(password, salt).toString('hex');
};
function matches(password, hash) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, key] = hash.split(':');
  return timingSafeEqual(derive(password, salt), Buffer.from(key, 'hex'));
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) { throw new HttpError(status, message); }

async function readBody(req, limit) {
  if (Number(req.headers['content-length']) > limit) fail(413, 'Arquivo acima do limite permitido.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) fail(413, 'Arquivo acima do limite permitido.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readBody(req, 8192);
  try {
    const value = JSON.parse(body.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { fail(400, 'Dados inválidos.'); }
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const mime = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  woff: 'font/woff', woff2: 'font/woff2', svg: 'image/svg+xml', png: 'image/png', json: 'application/json',
};

function serveWeb(req, res, pathname, webRoot) {
  if (!webRoot || !['GET', 'HEAD'].includes(req.method)) fail(404, 'Página indisponível.');
  const asset = /^\/assets\/[a-zA-Z0-9._-]+$/.test(pathname);
  const file = resolve(webRoot, asset ? pathname.slice(1) : pathname === '/brand-icon.svg' ? 'brand-icon.svg' : 'index.html');
  let stat;
  try { stat = statSync(file); } catch { fail(404, 'Arquivo indisponível.'); }
  if (!stat.isFile()) fail(404, 'Arquivo indisponível.');
  res.writeHead(200, {
    'Content-Type': mime[file.split('.').at(-1)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': asset ? 'public, max-age=604800, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

export function createPortal({ database, webRoot, secure = true, trustProxy = false, adminLogin = 'admlocal', adminPassword } = {}) {
  const db = new DatabaseSync(database ?? ':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'reader')), client_id INTEGER REFERENCES clients(id),
      active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      client_id INTEGER NOT NULL REFERENCES clients(id), key TEXT NOT NULL, metadata TEXT NOT NULL, content BLOB NOT NULL,
      PRIMARY KEY(client_id, key)
    );
  `);
  const query = (sql, ...params) => db.prepare(sql).get(...params);
  const write = (sql, ...params) => db.prepare(sql).run(...params);
  if (!query("SELECT id FROM users WHERE role = 'admin'")) {
    const login = normalizeLogin(adminLogin);
    if (!validLogin(login) || !validPassword(adminPassword)) {
      db.close();
      throw new Error('Configure o usuário inicial e uma senha de 12 a 128 caracteres.');
    }
    write("INSERT INTO users(login, hash, role) VALUES (?, ?, 'admin')", login, passwordHash(adminPassword));
    // The installation password is already chosen by the operator.
    write("UPDATE users SET must_change = 0 WHERE role = 'admin'");
  }
  const dummy = passwordHash(randomBytes(24).toString('hex'));
  const identity = user => ({ id: user.id, login: user.login, role: user.role, clientId: user.client_id, mustChange: Boolean(user.must_change) });
  const getUser = id => query('SELECT * FROM users WHERE id = ?', id);
  const revoke = id => write('DELETE FROM sessions WHERE user_id = ?', id);
  const setCookie = (res, token, age) => res.setHeader('Set-Cookie', cookieName + '=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (secure ? '; Secure' : ''));
  function loginSession(res, user) {
    const now = Math.floor(Date.now() / 1000);
    write('DELETE FROM sessions WHERE expires <= ?', now);
    const token = randomBytes(32).toString('hex');
    write('INSERT INTO sessions VALUES (?, ?, ?)', hashToken(token), user.id, now + SESSION_SECONDS);
    setCookie(res, token, SESSION_SECONDS);
    json(res, 200, identity(user));
  }

  const attempts = new Map();
  function checkAttempts(key) {
    const now = Date.now();
    for (const [name, attempt] of attempts) if (attempt.expires <= now) attempts.delete(name);
    const attempt = attempts.get(key) ?? { count: 0, expires: now + 60_000 };
    if (attempt.count >= 15 || (attempts.size >= 10000 && !attempts.has(key))) fail(429, 'Muitas tentativas. Aguarde um minuto.');
    attempt.count++;
    attempts.set(key, attempt);
  }

  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const method = req.method;
      if (pathname === '/healthz' && ['GET', 'HEAD'].includes(method)) { res.writeHead(200); res.end('ok'); return; }
      if (!pathname.startsWith('/api/')) return serveWeb(req, res, pathname, webRoot);
      if (!['GET', 'HEAD'].includes(method) && req.headers['x-operadash'] !== '1') fail(403, 'Origem da requisição inválida.');
      const digest = sessionDigest(req);

      if (pathname === '/api/login' && method === 'POST') {
        const { login, password } = await readJson(req);
        const forwarded = req.headers['x-real-ip'];
        if (trustProxy && (typeof forwarded !== 'string' || !isIP(forwarded))) fail(400, 'Endereço do cliente ausente no proxy.');
        checkAttempts('ip:' + (trustProxy ? forwarded : req.socket.remoteAddress));
        const name = normalizeLogin(login);
        if (validLogin(name)) checkAttempts('login:' + name);
        const user = validLogin(name) ? query('SELECT * FROM users WHERE login = ?', name) : null;
        const matched = matches(password, user?.hash ?? dummy);
        if (!matched || !user?.active) fail(401, 'Usuário ou senha inválidos.');
        if (digest) write('DELETE FROM sessions WHERE token = ?', digest);
        loginSession(res, user);
        return;
      }

      const requireUser = () => {
        const current = query('SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE token = ? AND expires > ? AND active = 1',
          digest, Math.floor(Date.now() / 1000));
        if (!current) fail(401, 'Entre para continuar.');
        return current;
      };
      const user = requireUser();
      const authenticatedJson = async () => {
        const body = await readJson(req);
        requireUser();
        return body;
      };
      if (pathname === '/api/session' && method === 'GET') return json(res, 200, identity(user));
      if (pathname === '/api/logout' && method === 'POST') {
        write('DELETE FROM sessions WHERE token = ?', digest);
        setCookie(res, '', 0);
        res.writeHead(204).end();
        return;
      }
      if (pathname === '/api/password' && method === 'POST') {
        const { current, password } = await authenticatedJson();
        checkAttempts('password:' + user.id);
        if (!matches(current, user.hash)) fail(400, 'Senha atual incorreta.');
        if (!validPassword(password) || password === current) fail(400, 'Use uma nova senha de 12 a 128 caracteres.');
        write('UPDATE users SET hash = ?, must_change = 0 WHERE id = ?', passwordHash(password), user.id);
        revoke(user.id);
        loginSession(res, getUser(user.id));
        return;
      }
      if (user.must_change) fail(403, 'Altere sua senha inicial para continuar.');

      const admin = user.role === 'admin';
      if (pathname === '/api/clients' && method === 'GET') {
        const clients = admin ? db.prepare('SELECT * FROM clients ORDER BY name').all() : [query('SELECT * FROM clients WHERE id = ?', user.client_id)];
        return json(res, 200, clients.filter(Boolean));
      }

      if (pathname.startsWith('/api/admin/')) {
        if (!admin) fail(403, 'Acesso restrito à administração.');
        if (pathname === '/api/admin/clients' && method === 'POST') {
          const { name } = await authenticatedJson();
          const clean = typeof name === 'string' ? name.trim() : '';
          if (!clean || clean.length > 100) fail(400, 'Informe um nome de cliente de até 100 caracteres.');
          if (query('SELECT id FROM clients WHERE name = ?', clean)) fail(409, 'Este cliente já existe.');
          const result = write('INSERT INTO clients(name) VALUES (?)', clean);
          return json(res, 201, { id: Number(result.lastInsertRowid), name: clean });
        }
        if (pathname === '/api/admin/users' && method === 'GET') {
          return json(res, 200, db.prepare("SELECT id, login, client_id AS clientId, active, must_change AS mustChange FROM users WHERE role = 'reader' ORDER BY login").all());
        }
        if (pathname === '/api/admin/users' && method === 'POST') {
          const { login, password, clientId } = await authenticatedJson();
          const name = normalizeLogin(login);
          if (!validLogin(name) || !validPassword(password)) fail(400, 'Informe um usuário válido e uma senha de 12 a 128 caracteres.');
          if (!Number.isSafeInteger(clientId) || !query('SELECT id FROM clients WHERE id = ?', clientId)) fail(400, 'Selecione um cliente cadastrado.');
          if (query('SELECT id FROM users WHERE login = ?', name)) fail(409, 'Este usuário já existe.');
          const result = write("INSERT INTO users(login, hash, role, client_id) VALUES (?, ?, 'reader', ?)", name, passwordHash(password), clientId);
          return json(res, 201, { id: Number(result.lastInsertRowid) });
        }
        const userId = /^\/api\/admin\/users\/(\d+)$/.exec(pathname)?.[1];
        if (userId && method === 'PATCH') {
          const id = Number(userId);
          if (getUser(id)?.role !== 'reader') fail(404, 'Conta de cliente não encontrada.');
          const { active, password } = await authenticatedJson();
          if (typeof active !== 'boolean' && password === undefined) fail(400, 'Informe uma alteração.');
          if (password !== undefined && !validPassword(password)) fail(400, 'Use uma senha de 12 a 128 caracteres.');
          if (password !== undefined) write('UPDATE users SET hash = ?, must_change = 1 WHERE id = ?', passwordHash(password), id);
          if (typeof active === 'boolean') write('UPDATE users SET active = ? WHERE id = ?', Number(active), id);
          revoke(id);
          res.writeHead(204).end();
          return;
        }
      }

      const file = /^\/api\/clients\/(\d+)\/files\/(alarms|itsm|inventory|subtasks)$/.exec(pathname);
      if (file) {
        const clientId = Number(file[1]), key = file[2];
        if (!admin && (user.client_id !== clientId || method !== 'GET')) fail(403, 'Acesso ao arquivo não autorizado.');
        if (!query('SELECT id FROM clients WHERE id = ?', clientId)) fail(404, 'Cliente não encontrado.');
        if (method === 'GET') {
          const stored = query('SELECT metadata, content FROM files WHERE client_id = ? AND key = ?', clientId, key);
          if (!stored) fail(404, 'Arquivo ainda não enviado.');
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stored.content.length, 'X-File-Metadata': encodeURIComponent(stored.metadata) });
          res.end(stored.content);
          return;
        }
        if (method === 'PUT') {
          let metadata;
          try { metadata = JSON.parse(decodeURIComponent(req.headers['x-file-metadata'] ?? '')); } catch { fail(400, 'Nome do arquivo inválido.'); }
          if (typeof metadata?.name !== 'string' || metadata.name.length > 240 || !/\.(csv|xlsx)$/i.test(metadata.name)) fail(400, 'Envie um arquivo CSV ou XLSX.');
          const buffer = await readBody(req, FILE_LIMIT);
          if (!buffer.length) fail(400, 'O arquivo está vazio.');
          requireUser();
          write('INSERT OR REPLACE INTO files VALUES (?, ?, ?, ?)', clientId, key, JSON.stringify(metadata), buffer);
          res.writeHead(204).end();
          return;
        }
        if (method === 'DELETE') {
          write('DELETE FROM files WHERE client_id = ? AND key = ?', clientId, key);
          res.writeHead(204).end();
          return;
        }
      }
      fail(404, 'Rota não encontrada.');
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      if (!(error instanceof HttpError)) console.error(error);
      json(res, error.status ?? 500, { error: error instanceof HttpError ? error.message : 'O servidor não conseguiu concluir a operação.' });
    }
  });
  server.once('close', () => db.close());
  return server;
}
