import "dotenv/config";
import { hash } from "bcryptjs";
import { Database } from "../database/database";
async function main() {
  const email = process.env.ADMIN_EMAIL,
    password = process.env.ADMIN_PASSWORD,
    name = process.env.ADMIN_NAME || "Platform administrator";
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).",
    );
  // An operator command, never exposed as an HTTP endpoint.
  if (process.env.MIGRATION_DATABASE_URL)
    process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
  const db = new Database();
  await db.init();
  const passwordHash = await hash(password, 12);
  try {
    await db.internal((sql) =>
      sql.query(
        "INSERT INTO users(name,email,password_hash,is_platform_admin) VALUES($1,$2,$3,true)",
        [name, email.toLowerCase(), passwordHash],
      ),
    );
    console.log("Platform administrator created.");
  } finally {
    await db.onModuleDestroy();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
