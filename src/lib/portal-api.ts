import type { ImportDocumentKey, StoredImportDocument } from './import-storage';

export interface PortalUser {
  id: number;
  login: string;
  role: 'admin' | 'manager' | 'reader';
  clientId: number | null;
  mustChange: boolean;
}

export interface PortalClient { id: number; name: string }
export interface PortalAccount { id: number; login: string; clientId: number; active: number; mustChange: number; role: 'manager' | 'reader' }

export class PortalError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch('/api/' + path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { 'X-OperaDash': '1', ...init?.headers } });
  if (response.ok) return response;
  const body = await response.json().catch(() => null);
  throw new PortalError(response.status, body?.error ?? 'O servidor está indisponível.');
}

export async function portalJson<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await request(path, body ? { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : { method });
  return response.status === 204 ? undefined as T : response.json();
}

export function clientDocuments(clientId: number) {
  const path = (key: ImportDocumentKey) => `clients/${clientId}/files/${key}`;
  return {
    async loadImportedDocument(key: ImportDocumentKey): Promise<StoredImportDocument | null> {
      try {
        const response = await request(path(key));
        const metadata = JSON.parse(decodeURIComponent(response.headers.get('X-File-Metadata') ?? ''));
        return { ...metadata, key, buffer: await response.arrayBuffer() };
      } catch (error) {
        if (error instanceof PortalError && error.status === 404) return null;
        throw error;
      }
    },
    async saveImportedDocument(document: StoredImportDocument) {
      const { key, buffer, ...metadata } = document;
      await request(path(key), { method: 'PUT', body: buffer, headers: { 'X-File-Metadata': encodeURIComponent(JSON.stringify(metadata)) } });
    },
    async removeImportedDocument(key: ImportDocumentKey) {
      await request(path(key), { method: 'DELETE' });
    },
  };
}
