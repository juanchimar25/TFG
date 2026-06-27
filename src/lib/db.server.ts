import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL no está configurado en .env");
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}
