import { config } from "dotenv";
import { resolve } from "node:path";

// npm workspace commands run from apps/api; Docker sets the same working directory.
export const workspaceRoot = resolve(process.cwd(), "../..");
config({ path: resolve(workspaceRoot, ".env"), quiet: true });
if (process.env.GOOGLE_APPLICATION_CREDENTIALS)
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(workspaceRoot, process.env.GOOGLE_APPLICATION_CREDENTIALS);

export function validateEnvironment() {
  const required = ["DATABASE_URL", "JWT_SECRET", "FIREBASE_PROJECT_ID", "REDIS_URL"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Complete the root .env before starting: ${missing.join(", ")}.`);
  if (process.env.JWT_SECRET!.length < 32) throw new Error("JWT_SECRET must contain at least 32 random characters.");
  for (const name of ["DATABASE_URL", "REDIS_URL"]) {
    const value = new URL(process.env[name]!);
    const allowed = name === "DATABASE_URL" ? ["postgres:", "postgresql:"] : ["redis:", "rediss:"];
    if (!allowed.includes(value.protocol)) throw new Error(`Invalid ${name} protocol.`);
  }
}
