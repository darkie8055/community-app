import "reflect-metadata";
import "dotenv/config";
import {
  Module,
  ValidationPipe,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory, APP_GUARD } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { JwtModule } from "@nestjs/jwt";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import helmet from "helmet";
import { Database } from "./database/database";
import { PlatformService } from "./communities/community.service";
import { JobsService } from "./notifications/notification.service";
import { AuthController, AuthGuard, AuthService } from "./auth/auth";
import { PlatformController, DevicesController } from "./communities/community.controller";
import { seed } from "./database/seed";
import { ContentController, ContentService } from "./catalog/catalog";
import { OnboardingController } from "./memberships/membership.controller";
import { VisitorPassController } from './visitors/visitor-pass.controller';
import { VisitorPassService } from './visitors/visitor-pass.service';

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof HttpException)
      return res.status(error.getStatus()).json(error.getResponse());
    if (error.code === "23505")
      return res.status(409).json({ message: "This record already exists." });
    if (error.code === "23503" || error.code === "23514")
      return res
        .status(400)
        .json({
          message:
            "The selected records do not belong to this community or the data is invalid.",
        });
    if (error.code === "42501")
      return res
        .status(403)
        .json({ message: "This operation is not permitted." });
    console.error("Unhandled API error:", error.message);
    return res
      .status(500)
      .json({
        message: "The request could not be completed. Please try again.",
      });
  }
}
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: "mycommunity",
        audience: "mycommunity-apps",
      },
      verifyOptions: { issuer: "mycommunity", audience: "mycommunity-apps" },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [
    AuthController,
    PlatformController,
    DevicesController,
    ContentController,
    OnboardingController,
    VisitorPassController,
  ],
  providers: [
    Database,
    PlatformService,
    AuthService,
    JobsService,
    ContentService,
    VisitorPassService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("Set JWT_SECRET to at least 32 random characters.");
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.DEMO_MODE === "true" || process.env.SEED_DEMO === "true")
  )
    throw new Error("Demo mode must be disabled in production.");
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    logger: ["error", "warn", "log"],
  });
  app.use(helmet());
  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: (process.env.CORS_ORIGINS || "http://127.0.0.1:3000").split(","),
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiErrors());
  app.enableShutdownHooks();
  const db = app.get(Database);
  await db.init();
  if (process.env.DB_MODE !== "postgres") await db.migrate();
  if (process.env.SEED_DEMO === "true") await seed(db);
  await app.get(JobsService).init();
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("MyCommunity API")
      .setDescription(
        "Tenant-scoped resident, security and administration API.",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, document);
  await app.listen(
    Number(process.env.PORT) || 4000,
    process.env.HOST || "127.0.0.1",
  );
  console.log(
    `MyCommunity API ready at http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 4000}/docs`,
  );
}
if (require.main === module)
  bootstrap().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
