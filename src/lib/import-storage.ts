export type ImportDocumentKey = "alarms" | "itsm" | "inventory" | "subtasks";

export interface StoredImportDocument {
  key: ImportDocumentKey;
  name: string;
  buffer: ArrayBuffer;
  sheetName?: string;
  options?: {
    hostColumnIndex?: number | null;
    categoryColumnIndex?: number | null;
    localityColumnIndex?: number | null;
    operatorColumnIndex?: number | null;
  };
}

const DATABASE_NAME = "operadash-local-data";
const DATABASE_VERSION = 1;
const STORE_NAME = "imported-documents";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("O armazenamento local deste navegador não está disponível."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento local."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveImportedDocument(document: StoredImportDocument): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(document);
    transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar o documento localmente."));
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

export async function loadImportedDocument(key: ImportDocumentKey): Promise<StoredImportDocument | null> {
  const database = await openDatabase();
  const document = await new Promise<StoredImportDocument | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível ler o documento salvo."));
    request.onsuccess = () => resolve((request.result as StoredImportDocument | undefined) ?? null);
  });
  database.close();
  return document;
}

export async function removeImportedDocument(key: ImportDocumentKey): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível remover o documento local."));
    transaction.oncomplete = () => resolve();
  });
  database.close();
}
