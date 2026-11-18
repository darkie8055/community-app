import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { ExpressAdapter } from "@nestjs/platform-express";
import { Database } from "../src/database/database";
import { MemoryDatabase } from "./helpers/memory-database";
import { AppModule, ApiErrors } from "../src/main";
import { seed } from "./fixtures/seed";

async function main() {
  if (process.env.NODE_ENV !== "test") throw new Error("This bootstrap is restricted to isolated tests.");
  const db = new MemoryDatabase();
  await db.init();
  await db.migrate();
  await seed(db);
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Database).useValue(db).compile();
  const app = module.createNestApplication(new ExpressAdapter());
  app.setGlobalPrefix("v1");
  app.enableCors({ origin: ["http://127.0.0.1:3000", "http://127.0.0.1:8080"] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiErrors());
  await app.listen(Number(process.env.PORT), "127.0.0.1");
  console.log("My Home API ready (isolated test process)");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
