import "dotenv/config";
import { Client } from "pg";
// One-time operator command. Never run from the request-serving process.
async function main() {
  if (!process.env.MIGRATION_DATABASE_URL || !process.env.DATABASE_URL)
    throw new Error("Set MIGRATION_DATABASE_URL and DATABASE_URL.");
  const runtime = new URL(process.env.DATABASE_URL);
  const username = decodeURIComponent(runtime.username),
    password = decodeURIComponent(runtime.password);
  if (!username || password.length < 16)
    throw new Error(
      "Use a distinct runtime username and a password of at least 16 characters.",
    );
  if (username === new URL(process.env.MIGRATION_DATABASE_URL).username)
    throw new Error("Runtime and migration identities must differ.");
  const name = '"' + username.replaceAll('"', '""') + '"';
  const secret = "'" + password.replaceAll("'", "''") + "'";
  const client = new Client({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  await client.connect();
  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname=$1",
      [username],
    );
    if (!exists.rows.length)
      await client.query(`CREATE ROLE ${name} LOGIN PASSWORD ${secret}`);
    await client.query(
      `GRANT community_app,community_worker,community_platform TO ${name}`,
    );
    console.log("Runtime database roles provisioned.");
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
