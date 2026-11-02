import { Pool, type PoolClient } from "pg";
import {
  getDatabase,
  getConnectionString,
  MissingDatabaseConnectionError,
} from "@netlify/database";

const globalDatabase = globalThis as typeof globalThis & { crmPool?: Pool };
// Official Netlify context supplies the database for the current deploy branch.
// Never cache a Netlify connection globally: contexts may carry different URLs.
const requestPools = new WeakSet<Pool>();
export function getPool(): Pool {
  let netlifyConnection: string | undefined;
  try {
    netlifyConnection = getConnectionString();
  } catch (error) {
    if (!(error instanceof MissingDatabaseConnectionError)) throw error;
  }
  if (netlifyConnection) {
    // The SDK documents both pools as node-postgres compatible. Its serverless
    // type also contains WebSocket-specific members; our SQL uses the pg contract.
    const pool = getDatabase().pool as unknown as Pool;
    pool.options.max = 2;
    pool.options.connectionTimeoutMillis = 5000;
    pool.options.idleTimeoutMillis = 1000;
    pool.on("error", () => undefined);
    requestPools.add(pool);
    return pool;
  }
  if (process.env.NETLIFY === "true")
    throw new Error("NETLIFY_DATABASE_NOT_CONFIGURED");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (globalDatabase.crmPool) return globalDatabase.crmPool;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
    application_name: "meu-crm",
  });
  pool.on("error", () => {
    console.error(
      "Conexão PostgreSQL encerrada. O pool tentará reconectar na próxima requisição.",
    );
  });
  globalDatabase.crmPool = pool;
  return pool;
}
export async function releaseRequestPool(pool: Pool) {
  if (requestPools.has(pool)) {
    requestPools.delete(pool);
    await pool.end();
  }
}

export async function transaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
  readOnly = false,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(
      readOnly ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN",
    );
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
