import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPortal } from '../server/portal.mjs';

const app = createPortal({ database: ':memory:', secure: false, trustProxy: true, adminPassword: 'Senha-inicial-admin-123' });
app.listen(0, '127.0.0.1');
await once(app, 'listening');
const base = 'http://127.0.0.1:' + app.address().port;
const send = (path, method = 'GET', data, cookie = '', ip = '198.51.100.10') => fetch(base + '/api/' + path, {
  method, headers: { Cookie: cookie, 'X-OperaDash': '1', 'Content-Type': 'application/json', 'X-Real-IP': ip },
  body: data === undefined ? undefined : JSON.stringify(data),
});
const cookie = response => response.headers.get('set-cookie').split(';')[0];
try {
  assert.equal((await send('clients/1/files/alarms')).status, 401);
  for (let i = 0; i < 15; i++) {
    assert.equal((await send('login', 'POST', { login: 'invalido-' + i, password: 'invalida' }, '', '198.51.100.11')).status, 401);
  }
  assert.equal((await send('login', 'POST', { login: 'invalido-extra', password: 'invalida' }, '', '198.51.100.11')).status, 429);
  const admin = cookie(await send('login', 'POST', { login: 'admlocal', password: 'Senha-inicial-admin-123' }));
  const a = await (await send('admin/clients', 'POST', { name: 'Cliente A' }, admin)).json();
  const b = await (await send('admin/clients', 'POST', { name: 'Cliente B' }, admin)).json();
  const user = await (await send('admin/users', 'POST', { login: 'leitor', password: 'Senha-temporaria-123', clientId: a.id }, admin)).json();
  const initial = cookie(await send('login', 'POST', { login: 'leitor', password: 'Senha-temporaria-123' }));
  const path = 'clients/' + a.id + '/files/alarms';
  assert.equal((await send(path, 'GET', undefined, initial)).status, 403);
  const reader = cookie(await send('password', 'POST', { current: 'Senha-temporaria-123', password: 'Senha-definitiva-123' }, initial));
  assert.equal((await send(path, 'GET', undefined, initial)).status, 401);
  const upload = await fetch(base + '/api/' + path, { method: 'PUT', headers: { Cookie: admin, 'X-OperaDash': '1', 'X-File-Metadata': encodeURIComponent(JSON.stringify({ name: 'alertas.csv' })) }, body: 'Coluna\nvalor' });
  assert.equal(upload.status, 204);
  assert.equal(await (await send(path, 'GET', undefined, reader)).text(), 'Coluna\nvalor');
  assert.equal((await send('clients/' + b.id + '/files/alarms', 'GET', undefined, reader)).status, 403);
  assert.equal((await send(path, 'DELETE', undefined, reader)).status, 403);
  assert.equal((await send('admin/users', 'GET', undefined, reader)).status, 403);
  assert.equal((await send('admin/users/' + user.id, 'PATCH', { role: 'manager' }, admin)).status, 204);
  assert.equal((await send(path, 'GET', undefined, reader)).status, 401);
  const promoted = await send('login', 'POST', { login: 'leitor', password: 'Senha-definitiva-123' });
  const manager = cookie(promoted);
  assert.equal((await promoted.json()).role, 'manager');
  assert.equal((await send('clients/' + b.id + '/files/alarms', 'DELETE', undefined, manager)).status, 403);
  assert.equal((await send('admin/users', 'GET', undefined, manager)).status, 403);
  assert.equal((await send(path, 'DELETE', undefined, manager)).status, 204);
  assert.equal((await send(path, 'GET', undefined, manager)).status, 404);
  assert.equal((await send('admin/users/' + user.id, 'PATCH', { active: false }, admin)).status, 204);
  assert.equal((await send(path, 'GET', undefined, manager)).status, 401);
} finally {
  app.close();
}
