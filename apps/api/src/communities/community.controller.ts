import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Headers,
  Query,
  Inject,
  ParseUUIDPipe,
  BadRequestException,
  Sse,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { map, takeUntil, timer } from "rxjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { Identity, Database } from "../database/database";
import { PlatformService } from "./community.service";
import { JobsService } from "../notifications/notification.service";
import {
  CommunityDto,
  BlockDto,
  FloorDto,
  UnitDto,
  MembershipDto,
  MembershipDecisionDto,
  VisitorDto,
  DecisionDto,
  VisitQuery,
  DeviceDto,
  UploadDto,
} from "./community.dto";
type Request = { user: Identity };
@ApiTags("Platform")
@ApiBearerAuth()
@Controller()
export class PlatformController {
  constructor(
    @Inject(PlatformService) private service: PlatformService,
    @Inject(JobsService) private jobs: JobsService,
  ) {}
  @Get("health") health() {
    return {
      status: "ok",
      mode: process.env.DEMO_MODE === "true" ? "demo" : "live",
      ...this.jobs.status(),
    };
  }
  @Get("notifications") notifications(@Req() r: Request) {
    return this.service.db.scoped(
      r.user.sub,
      null,
      async (sql) =>
        (
          await sql.query(
            "SELECT id,title,body,entry_id,created_at,read_at FROM notification_outbox WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
            [r.user.sub],
          )
        ).rows,
    );
  }
  @Post("notifications/read") readNotifications(@Req() r: Request) {
    return this.service.db.scoped(r.user.sub, null, async (sql) => {
      await sql.query(
        "UPDATE notification_outbox SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
        [r.user.sub],
      );
      return { read: true };
    });
  }
  @Get("communities") communities(@Req() r: Request) {
    return this.service.communities(r.user);
  }
  @Post("communities") createCommunity(
    @Req() r: Request,
    @Body() dto: CommunityDto,
  ) {
    return this.service.createCommunity(r.user, dto);
  }
  @Get("communities/:community/overview") overview(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.overview(r.user, c);
  }
  @Get("communities/:community/structure") structure(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.structure(r.user, c);
  }
  @Post("communities/:community/blocks") block(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: BlockDto,
  ) {
    return this.service.createStructure(r.user, c, "block", dto);
  }
  @Post("communities/:community/floors") floor(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: FloorDto,
  ) {
    return this.service.createStructure(r.user, c, "floor", dto);
  }
  @Post("communities/:community/units") unit(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: UnitDto,
  ) {
    return this.service.createStructure(r.user, c, "unit", dto);
  }
  @Get("communities/:community/memberships") memberships(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.memberships(r.user, c);
  }
  @Get("communities/:community/my-memberships") myMemberships(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.db.scoped(
      r.user.sub,
      c,
      async (sql) =>
        (
          await sql.query(
            "SELECT m.role,m.status,m.unit_id,u.label AS unit FROM memberships m LEFT JOIN units u ON u.id=m.unit_id WHERE m.user_id=$1 AND m.community_id=$2 ORDER BY m.created_at DESC",
            [r.user.sub, c],
          )
        ).rows,
    );
  }
  @Post("communities/:community/memberships") requestMembership(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: MembershipDto,
  ) {
    return this.service.requestMembership(r.user, c, dto);
  }
  @Post("communities/:community/memberships/:id/decision") membershipDecision(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MembershipDecisionDto,
  ) {
    return this.service.decideMembership(r.user, c, id, dto.status);
  }
  @Get("communities/:community/visitor-entries") visits(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Query() q: VisitQuery,
  ) {
    return this.service.visits(r.user, c, q);
  }
  @Get("communities/:community/visitor-entries/:id") visit(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.visit(r.user, c, id);
  }
  @Post("communities/:community/visitor-entries")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  async createVisit(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: VisitorDto,
    @Headers("idempotency-key") key: string,
  ) {
    if (!isUUID(key || ""))
      throw new BadRequestException(
        "A UUID Idempotency-Key header is required.",
      );
    const row = await this.service.createVisit(r.user, c, dto, key);
    await this.jobs.publish({
      community_id: c,
      unit_id: row.unit_id,
      visitor_entry_id: row.id,
      type: "visitor.created",
    });
    return row;
  }
  @Post("communities/:community/visitor-entries/:id/decision") async decision(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.transition(r, c, id, dto.decision as "approved" | "denied");
  }
  @Post("communities/:community/visitor-entries/:id/check-in") checkIn(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.transition(r, c, id, "inside");
  }
  @Post("communities/:community/visitor-entries/:id/check-out") checkOut(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.transition(r, c, id, "exited");
  }
  private async transition(
    r: Request,
    c: string,
    id: string,
    next: "approved" | "denied" | "inside" | "exited",
  ) {
    const row = await this.service.transition(r.user, c, id, next);
    await this.jobs.publish({
      community_id: c,
      unit_id: row.unit_id,
      visitor_entry_id: id,
      type: `visitor.${next}`,
    });
    return row;
  }
  @Get("communities/:community/audit-logs") audit(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.auditLogs(r.user, c);
  }
  @Sse("communities/:community/events") async events(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    const access = await this.service.withCommunity(
      r.user,
      c,
      null,
      async (_sql, a) => a,
    );
    return this.jobs
      .stream(c, ["admin", "guard"].includes(access.role) ? null : access.units)
      .pipe(
        takeUntil(timer(3600000)),
        map((event) => ({ id: event.id, type: "visitor", data: event })),
      );
  }
  @Post("communities/:community/uploads") async upload(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() dto: UploadDto,
  ) {
    await this.service.withCommunity(
      r.user,
      c,
        null,
      async () => true,
    );
    if (!process.env.S3_BUCKET)
      throw new ServiceUnavailableException(
          "Photo storage is not configured. Ask your administrator to connect object storage.",
      );
    const key = `${c}/${r.user.sub}/${randomUUID()}`;
    const s3 = new S3Client({
      region: process.env.S3_REGION || "ap-south-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
    });
    try {
      return {
        key,
        url: await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            ContentType: dto.content_type,
            ContentLength: dto.size,
          }),
          { expiresIn: 300 },
        ),
        expires_in: 300,
      };
    } finally {
      s3.destroy();
    }
  }
}
@ApiTags("Devices")
@ApiBearerAuth()
@Controller("devices")
export class DevicesController {
  constructor(@Inject(Database) private db: Database) {}
  @Post() register(@Req() r: Request, @Body() dto: DeviceDto) {
    return this.db.scoped(r.user.sub, null, async (sql) => {
      await sql.query(
        "INSERT INTO devices(user_id,token,platform) VALUES($1,$2,$3) ON CONFLICT(token) DO UPDATE SET platform=EXCLUDED.platform,last_seen_at=now()",
        [r.user.sub, dto.token, dto.platform],
      );
      return { registered: true };
    });
  }
  @Delete() remove(@Req() r: Request, @Body() dto: DeviceDto) {
    return this.db.scoped(r.user.sub, null, async (sql) => {
      await sql.query("DELETE FROM devices WHERE token=$1 AND user_id=$2", [
        dto.token,
        r.user.sub,
      ]);
      return { removed: true };
    });
  }
}
