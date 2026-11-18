import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export type Row = Record<string, any>;
export interface Sql {
  exec?(sql: string): Promise<void>;
  query<T extends Row = Row>(
    sql: string,
    params?: any[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
export type Identity = { sub: string; name: string; platformAdmin: boolean };

@Injectable()
export class Database implements OnModuleDestroy {
  private pg?: Pool;
  async init() {
    if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL before starting the API.');
    this.pg = new Pool({connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 10000});
    await this.pg.query('SELECT 1');
  }
  async internal<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    if (!this.pg) throw new Error('The database connection is not initialized.');
    const sql = await this.pg.connect();
    try { return await work(sql as Sql); } finally { (sql as PoolClient).release(); }
  }
  async scoped<T>(
    userId: string,
    communityId: string | null,
    work: (sql: Sql) => Promise<T>,
    worker = false,
  ): Promise<T> {
    return this.internal(async (sql) => {
      await sql.query("BEGIN");
      try {
        await sql.query(
          worker
            ? "SET LOCAL ROLE community_worker"
            : "SET LOCAL ROLE community_app",
        );
        await sql.query(
          "SELECT set_config('app.user_id',$1,true), set_config('app.community_id',$2,true)",
          [userId, communityId || ""],
        );
        const result = await work(sql);
        await sql.query("COMMIT");
        return result;
      } catch (error) {
        await sql.query("ROLLBACK");
        throw error;
      }
    });
  }
  async migrate() {
    await this.internal(async (sql) => {
      await sql.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const directory = resolve(process.cwd(), "../../database/migrations");
      for (const filename of readdirSync(directory)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        if (
          (
            await sql.query(
              "SELECT version FROM schema_migrations WHERE version=$1",
              [filename],
            )
          ).rows.length
        )
          continue;
        const migration = readFileSync(resolve(directory, filename), "utf8");
        await sql.query("BEGIN");
        try {
          if (sql.exec) await sql.exec(migration);
          else await sql.query(migration);
          await sql.query("INSERT INTO schema_migrations(version) VALUES($1)", [
            filename,
          ]);
          await sql.query("COMMIT");
        } catch (error) {
          await sql.query("ROLLBACK");
          throw error;
        }
      }
    });
  }
  async onModuleDestroy() {
    await this.pg?.end();
  }
}
