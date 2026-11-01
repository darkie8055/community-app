import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Req,
  Body,
  Inject,
  ParseUUIDPipe,
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsIn,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
} from "class-validator";
import { Database, Identity } from "../database/database";
import { PlatformService } from "../communities/community.service";
class SearchDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
class StaffDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(/^[6-9]\d{9}$/) phone!: string;
  @IsIn(["guard", "admin"]) role!: string;
}
@ApiTags("Onboarding")
@ApiBearerAuth()
@Controller()
export class OnboardingController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(PlatformService) private platform: PlatformService,
  ) {}
  @Get("onboarding/communities") search(@Query() q: SearchDto) {
    return this.db.internal(
      async (sql) =>
        (
          await sql.query(
            "SELECT id,name,city FROM communities WHERE name ILIKE $1 ORDER BY name LIMIT 100",
            [`%${q.search || ""}%`],
          )
        ).rows,
    );
  }
  @Get("onboarding/communities/:community/units") units(
    @Req() r: { user: Identity },
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.db.scoped(
      r.user.sub,
      c,
      async (sql) =>
        (
          await sql.query(
            "SELECT id,label FROM units ORDER BY label LIMIT 2000",
          )
        ).rows,
    );
  }
  @Get("onboarding/memberships") memberships(@Req() r: { user: Identity }) {
    return this.db.scoped(
      r.user.sub,
      null,
      async (sql) =>
        (
          await sql.query(
            "SELECT id,community_id,unit_id,role,status FROM memberships WHERE user_id=$1 ORDER BY created_at DESC",
            [r.user.sub],
          )
        ).rows,
    );
  }
  @Get("communities/:community/directory") directory(
    @Req() r: { user: Identity },
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.platform.withCommunity(r.user, c, null, async (sql) => ({
      people: (
        await sql.query(
          "SELECT u.name,m.role,un.label AS unit,CASE WHEN m.role IN ('guard','admin') THEN u.phone ELSE NULL END AS phone FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN units un ON un.id=m.unit_id WHERE m.status='approved' ORDER BY m.role,u.name LIMIT 200",
        )
      ).rows,
      stats: (
        await sql.query(
          "SELECT (SELECT count(*)::int FROM units) AS homes,(SELECT count(*)::int FROM blocks) AS blocks,(SELECT count(*)::int FROM memberships WHERE status='approved' AND role IN ('owner','tenant','family')) AS residents",
        )
      ).rows[0],
    }));
  }
  @Post("communities/:community/staff") staff(
    @Req() r: { user: Identity },
    @Param("community", ParseUUIDPipe) c: string,
    @Body() d: StaffDto,
  ) {
    return this.platform.withCommunity(r.user, c, ["admin"], async (sql) => {
      if (d.role === "admin" && !r.user.platformAdmin)
        throw new ForbiddenException(
          "Only a platform administrator can appoint another administrator.",
        );
      const user = (
        await sql.query(
          "INSERT INTO users(name,phone) VALUES($1,$2) ON CONFLICT(phone) DO UPDATE SET updated_at=now() RETURNING id",
          [d.name.trim(), d.phone],
        )
      ).rows[0];
      const row = (
        await sql.query(
          "INSERT INTO memberships(community_id,user_id,role,status) VALUES($1,$2,$3,'approved') ON CONFLICT(community_id,user_id,unit_id) DO UPDATE SET role=EXCLUDED.role,status='approved',decided_by=$4,decided_at=now() RETURNING *",
          [c, user.id, d.role, r.user.sub],
        )
      ).rows[0];
      await sql.query(
        "INSERT INTO audit_logs(community_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)",
        [c, r.user.sub, "staff.assigned", row.id],
      );
      return row;
    });
  }
}
