import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";
import { Pool, PoolClient } from "pg";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export type Row = Record<string, any>;
export interface Sql {
  query<T extends Row = Row>(
    sql: string,
    params?: any[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}
export type Identity = { sub: string; name: string; platformAdmin: boolean };

@Injectable()
export class Database implements OnModuleDestroy {
  private pg?: Pool;
  private embedded?: PGlite;
  private serial: Promise<unknown> = Promise.resolve();
  async init(options?: { memory?: boolean }) {
    if (process.env.DB_MODE === "postgres" && !options?.memory) {
      if (!process.env.DATABASE_URL)
        throw new Error("DATABASE_URL is required");
      this.pg = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
      });
    } else {
      if (process.env.NODE_ENV === "production")
        throw new Error("Production requires native PostgreSQL");
      const path = options?.memory
        ? undefined
        : resolve(process.env.PGLITE_PATH || "../../.local/postgres");
      if (path) mkdirSync(path, { recursive: true });
      this.embedded = new PGlite(path);
      await this.embedded.waitReady;
    }
  }
  private async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (!this.embedded) return work();
    const task = this.serial.then(work, work);
    this.serial = task.catch(() => undefined);
    return task;
  }
  async internal<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const sql = this.pg ? await this.pg.connect() : this.embedded!;
      try {
        return await work(sql as Sql);
      } finally {
        if (this.pg) (sql as PoolClient).release();
      }
    });
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
          if (this.embedded) await this.embedded.exec(migration);
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
    await this.embedded?.close();
  }
}
