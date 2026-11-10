import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPortal } from './portal.mjs';

const directory = resolve(process.env.OPERADASH_DATA_DIR || '.local/portal');
mkdirSync(directory, { recursive: true });
const password = process.env.OPERADASH_ADMIN_PASSWORD_FILE
  ? readFileSync(process.env.OPERADASH_ADMIN_PASSWORD_FILE, 'utf8').replace(/\r?\n$/, '')
  : process.env.OPERADASH_ADMIN_PASSWORD;
const server = createPortal({
  database: resolve(directory, 'portal.sqlite'),
  webRoot: resolve('dist'),
  secure: process.env.OPERADASH_ALLOW_HTTP !== '1',
  trustProxy: process.env.OPERADASH_TRUST_PROXY === '1',
  adminLogin: process.env.OPERADASH_ADMIN_LOGIN,
  adminPassword: password,
});
server.listen(Number(process.env.PORT || 80), process.env.HOST || '0.0.0.0', () => {
  console.log('OperaDash pronto.');
});
