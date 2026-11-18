import { PGlite } from "@electric-sql/pglite";
import { Database, Sql } from "../../src/database/database";

/** Isolated test storage; never imported by the request-serving application. */
export class MemoryDatabase extends Database {
  private engine?: PGlite;
  private serial: Promise<unknown> = Promise.resolve();
  override async init() { this.engine = new PGlite(); await this.engine.waitReady; }
  override async internal<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    const task = this.serial.then(() => work({
      query: (sql, params) => this.engine!.query(sql, params),
      exec: async (sql) => { await this.engine!.exec(sql); },
    }));
    this.serial = task.catch(() => undefined);
    return task;
  }
  override async onModuleDestroy() { await this.engine?.close(); }
}
