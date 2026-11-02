import { Pool, type PoolClient } from "pg";

const globalDatabase = globalThis as typeof globalThis & { crmPool?: Pool };
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (globalDatabase.crmPool) return globalDatabase.crmPool;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
    application_name: "meu-crm",
  });
  // A PostgreSQL restart closes idle connections. Handle that event so the
  // application remains alive and the pool can reconnect on the next request.
  pool.on("error", () => {
    console.error(
      "Conexão PostgreSQL encerrada. O pool tentará reconectar na próxima requisição.",
    );
  });
  globalDatabase.crmPool = pool;
  return pool;
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
