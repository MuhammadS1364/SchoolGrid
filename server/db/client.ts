import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client, type InValue, type ResultSet, type Transaction } from '@libsql/client';

export type DbMode = 'turso' | 'local_file' | 'memory';

export interface DbConnectionInfo {
  mode: DbMode;
  urlMasked: string;
}

export interface SqlExecutor {
  execute: (stmt: { sql: string; args?: InValue[] } | string) => Promise<ResultSet>;
}

let cachedClient: Client | null = null;
let cachedInfo: DbConnectionInfo | null = null;

function maskUrl(rawUrl: string): string {
  if (rawUrl === ':memory:') return ':memory:';
  if (rawUrl.startsWith('file:')) return rawUrl;
  try {
    const parsed = new URL(rawUrl.replace(/^libsql:\/\//i, 'https://'));
    return `libsql://${parsed.host}`;
  } catch {
    return 'libsql://<configured>';
  }
}

export function createDbClient(options?: { url?: string; authToken?: string }): {
  client: Client;
  info: DbConnectionInfo;
} {
  const configuredUrl = (options?.url ?? process.env.TURSO_DATABASE_URL ?? '').trim();
  const configuredToken = (options?.authToken ?? process.env.TURSO_AUTH_TOKEN ?? '').trim();

  if (configuredUrl === ':memory:') {
    const client = createClient({ url: ':memory:' });
    return {
      client,
      info: { mode: 'memory', urlMasked: ':memory:' },
    };
  }

  if (configuredUrl && configuredUrl.startsWith('libsql://') && configuredToken) {
    const client = createClient({
      url: configuredUrl,
      authToken: configuredToken,
    });
    return {
      client,
      info: { mode: 'turso', urlMasked: maskUrl(configuredUrl) },
    };
  }

  if (configuredUrl && configuredUrl.startsWith('https://') && configuredToken) {
    const client = createClient({
      url: configuredUrl,
      authToken: configuredToken,
    });
    return {
      client,
      info: { mode: 'turso', urlMasked: maskUrl(configuredUrl) },
    };
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const localPath = path.join(dataDir, 'schoolgrid.db');
  const fileUrl = `file:${localPath}`;
  const client = createClient({ url: fileUrl });
  return {
    client,
    info: { mode: 'local_file', urlMasked: 'file:data/schoolgrid.db' },
  };
}

export function getDbClient(): Client {
  if (!cachedClient) {
    const created = createDbClient();
    cachedClient = created.client;
    cachedInfo = created.info;
  }
  return cachedClient;
}

export function getDbInfo(): DbConnectionInfo {
  if (!cachedInfo) {
    getDbClient();
  }
  return cachedInfo ?? { mode: 'local_file', urlMasked: 'file:data/schoolgrid.db' };
}

/**
 * Ensures SQLite foreign key constraints are active for the current client.
 */
export async function enforceForeignKeys(executor: SqlExecutor): Promise<void> {
  await executor.execute('PRAGMA foreign_keys = ON');
}

/**
 * Runs a callback inside an explicit write transaction with foreign keys enforced.
 */
export async function withTransaction<T>(
  client: Client,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  await client.execute('PRAGMA foreign_keys = ON');
  const tx = await client.transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // Ignore rollback errors if transaction already closed
    }
    throw err;
  } finally {
    try {
      tx.close();
    } catch {
      // Ignore close errors
    }
  }
}

export function resetDbClientForTests(): void {
  if (cachedClient) {
    try {
      cachedClient.close();
    } catch {
      // Ignore
    }
  }
  cachedClient = null;
  cachedInfo = null;
}
