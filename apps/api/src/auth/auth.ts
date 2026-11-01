import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
  Controller,
  Post,
  Body,
  Get,
  Req,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { compare } from "bcryptjs";
import { Database, Identity } from "../database/database";
import { DEMO } from "../database/seed";
import { Throttle } from "@nestjs/throttler";
import { verifyFirebaseIdentity } from "./firebase-identity";
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class DemoLoginDto {
  @IsIn(["resident", "guard"]) role!: "resident" | "guard";
}
export class FirebaseLoginDto {
  @IsString() @MinLength(20) @MaxLength(5000) id_token!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}
@Injectable()
export class AuthService {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  async login(dto: LoginDto) {
    const user = await this.db.internal(
      async (sql) =>
        (
          await sql.query("SELECT * FROM users WHERE lower(email)=lower($1)", [
            dto.email,
          ])
        ).rows[0],
    );
    // Equal-cost password work for unknown identities avoids a quick timing oracle.
    const valid = await compare(
      dto.password,
      user?.password_hash ||
        "$2b$12$U9ioZwp2g8F4vflF8kmwEOJIUOPoGKkQsETIdQ3SGI5Vlb9ctV42i",
    );
    if (!user || !valid)
      throw new UnauthorizedException("Email or password is incorrect.");
    return this.session(user);
  }
  async demo(role: "resident" | "guard") {
    if (
      process.env.DEMO_MODE !== "true" ||
      process.env.NODE_ENV === "production"
    )
      throw new ForbiddenException("Demo identities are disabled.");
    const user = await this.db.internal(
      async (sql) =>
        (await sql.query("SELECT * FROM users WHERE id=$1", [DEMO[role]]))
          .rows[0],
    );
    if (!user) throw new UnauthorizedException("Demo is not seeded.");
    return this.session(user);
  }
  async firebase(dto: FirebaseLoginDto) {
    const identity = await verifyFirebaseIdentity(dto.id_token);
    const user = await this.db.internal(
      async (sql) =>
        (
          await sql.query(
            `INSERT INTO users(name,phone,firebase_uid) VALUES($1,$2,$3)
      ON CONFLICT(phone) DO UPDATE SET firebase_uid=EXCLUDED.firebase_uid,updated_at=now()
      WHERE users.firebase_uid IS NULL OR users.firebase_uid=EXCLUDED.firebase_uid RETURNING *`,
            [dto.name.trim(), identity.phone, identity.uid],
          )
        ).rows[0],
    );
    if (!user)
      throw new UnauthorizedException(
        "This number is linked to a different identity. Contact your administrator.",
      );
    return this.session(user);
  }
  private async session(user: Record<string, any>) {
    const identity: Identity = {
      sub: user.id,
      name: user.name,
      platformAdmin: user.is_platform_admin,
    };
    return {
      access_token: await this.jwt.signAsync(identity),
      expires_in: 3600,
      user: { ...identity, phone: user.phone },
    };
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (
      [
        "/v1/health",
        "/v1/auth/login",
        "/v1/auth/demo",
        "/v1/auth/firebase",
      ].includes(req.path)
    )
      return true;
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new UnauthorizedException("Sign in to continue.");
    try {
      req.user = await this.jwt.verifyAsync<Identity>(header.slice(7), {
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException(
        "Your session has expired. Please sign in again.",
      );
    }
    return true;
  }
}
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Post("login") @Throttle({ default: { limit: 8, ttl: 60000 } }) login(
    @Body() dto: LoginDto,
  ) {
    return this.auth.login(dto);
  }
  @Post("demo") @Throttle({ default: { limit: 20, ttl: 60000 } }) demo(
    @Body() dto: DemoLoginDto,
  ) {
    return this.auth.demo(dto.role);
  }
  @Post("firebase") @Throttle({ default: { limit: 12, ttl: 60000 } }) firebase(
    @Body() dto: FirebaseLoginDto,
  ) {
    return this.auth.firebase(dto);
  }
  @Get("me") @ApiBearerAuth() me(@Req() req: { user: Identity }) {
    return req.user;
  }
}
