import "../config/environment";
import { Database } from "../database/database";
(async () => {
  if (!process.env.MIGRATION_DATABASE_URL) throw new Error("Set MIGRATION_DATABASE_URL.");
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  const db = new Database();
  await db.init();
  await db.migrate();
  await db.onModuleDestroy();
  console.log("Database migrations applied.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
