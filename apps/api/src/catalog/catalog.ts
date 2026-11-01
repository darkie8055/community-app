import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUUID,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { Identity, Sql, Row } from "../database/database";
import { PlatformService, Access } from "../communities/community.service";
import { attachPhoto } from '../storage/object-storage';

export class ItemDto {
  @IsIn(["post", "notice", "listing", "property", "service"]) kind!: string;
  @IsString() @MinLength(3) @MaxLength(120) title!: string;
  @IsString() @MaxLength(3000) description = "";
  @IsString() @MaxLength(60) category = "";
  @IsInt() @Min(0) @Max(2000000000) price = 0;
  @IsIn([
    "community",
    "house",
    "chair",
    "sofa",
    "car",
    "decor",
    "bicycle",
    "cleaning",
    "painting",
    "moving",
    "ac",
  ])
  image_asset = "community";
  @IsOptional() @IsString() @MaxLength(500) photo_key?: string;
  @IsOptional() @IsUUID() unit_id?: string;
  @IsOptional() @IsIn(["sell", "rent"]) listing_type?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) bedrooms?: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) available_on?: string;
  @IsIn(["draft", "published"]) status = "published";
}
export class ItemQuery {
  @IsOptional()
  @IsIn(["post", "notice", "listing", "property", "service"])
  kind?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsIn(["true", "false"]) saved?: string;
  @IsOptional() @IsIn(["true", "false"]) mine?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class ItemStatusDto {
  @IsIn(["draft", "published", "closed"]) status!: string;
}
export class MessageDto {
  @IsString() @MinLength(2) @MaxLength(1000) message!: string;
}
export class ServiceRequestDto {
  @IsUUID() unit_id!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) scheduled_on!: string;
  @IsString() @MaxLength(1000) note = "";
}
export class ServiceStatusDto {
  @IsIn(["accepted", "completed", "cancelled"]) status!: string;
}
const columns = `SELECT i.*,u.name AS author,c.name AS community,un.label AS unit,
  EXISTS(SELECT 1 FROM item_bookmarks b WHERE b.item_id=i.id AND b.user_id=$1) AS saved,
  (SELECT count(*)::int FROM item_comments x WHERE x.item_id=i.id) AS comment_count
  FROM community_items i JOIN users u ON u.id=i.author_id JOIN communities c ON c.id=i.community_id LEFT JOIN units un ON un.id=i.unit_id`;
@Injectable()
export class ContentService {
  constructor(@Inject(PlatformService) private platform: PlatformService) {}
  private work<T>(
    user: Identity,
    c: string,
    fn: (sql: Sql, a: Access) => Promise<T>,
  ) {
    return this.platform.withCommunity(user, c, null, fn);
  }
  private async item(sql: Sql, user: Identity, id: string, access: Access) {
    const item = (
      await sql.query(
        `${columns} WHERE i.id=$2 AND (i.status='published' OR i.author_id=$1 OR $3)`,
        [user.sub, id, access.role === "admin"],
      )
    ).rows[0];
    if (!item) throw new NotFoundException("This item is no longer available.");
    return attachPhoto(item);
  }
  list(user: Identity, c: string, q: ItemQuery) {
    return this.work(user, c, async (sql, a) => {
      const rows = (
        await sql.query(
          `${columns} WHERE (i.status='published' OR i.author_id=$1 OR $2)
      AND ($3::text IS NULL OR i.kind=$3) AND ($4::text IS NULL OR i.title ILIKE '%'||$4||'%' OR i.description ILIKE '%'||$4||'%')
      AND ($5::text IS NULL OR i.category=$5) AND (NOT $6 OR EXISTS(SELECT 1 FROM item_bookmarks b WHERE b.item_id=i.id AND b.user_id=$1))
      AND (NOT $7 OR i.author_id=$1) AND ($8::uuid IS NULL OR (i.created_at,i.id)<(SELECT created_at,id FROM community_items WHERE id=$8))
      ORDER BY i.created_at DESC,i.id DESC LIMIT $9`,
          [
            user.sub,
            a.role === "admin",
            q.kind || null,
            q.search || null,
            q.category || null,
            q.saved === "true",
            q.mine === "true",
            q.cursor || null,
            q.limit + 1,
          ],
        )
      ).rows;
      const more = rows.length > q.limit;
      if (more) rows.pop();
      return { items: await Promise.all(rows.map(attachPhoto)), next_cursor: more ? rows.at(-1)!.id : null };
    });
  }
  create(user: Identity, c: string, d: ItemDto) {
    return this.work(user, c, async (sql, a) => {
      if (["service", "notice"].includes(d.kind) && a.role !== "admin")
        throw new ForbiddenException(
          "Only the society administrator can publish services or notices.",
        );
      if (a.role === "guard")
        throw new ForbiddenException(
          "Use a resident account to post in your community.",
        );
      if (d.kind === "property") {
        if (!d.unit_id || !d.listing_type || !d.available_on)
          throw new BadRequestException(
            "Select your flat, listing type and available date.",
          );
        const owner = (
          await sql.query(
            "SELECT id FROM memberships WHERE user_id=$1 AND unit_id=$2 AND role='owner' AND status='approved'",
            [user.sub, d.unit_id],
          )
        ).rows.length;
        if (a.role !== "admin" && !owner)
          throw new ForbiddenException(
            "An approved owner membership is required to list this property.",
          );
      }
      if (d.photo_key && !d.photo_key.startsWith(`${c}/${user.sub}/`))
        throw new BadRequestException("Invalid uploaded photo.");
      const row = (
        await sql.query(
          `INSERT INTO community_items(community_id,author_id,kind,title,description,category,price,image_asset,photo_key,unit_id,listing_type,bedrooms,available_on,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
          [
            c,
            user.sub,
            d.kind,
            d.title.trim(),
            d.description.trim(),
            d.category,
            d.price,
            d.image_asset,
            d.photo_key || null,
            d.unit_id || null,
            d.listing_type || null,
            d.bedrooms ?? null,
            d.available_on || null,
            d.status,
          ],
        )
      ).rows[0];
      await sql.query(
        "INSERT INTO audit_logs(community_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)",
        [c, user.sub, `${d.kind}.created`, row.id],
      );
      return row;
    });
  }
  detail(user: Identity, c: string, id: string):Promise<Row & {comments:Row[]}> {
    return this.work(user, c, async (sql, a) => ({
      ...(await this.item(sql, user, id, a)),
      comments: (
        await sql.query(
          "SELECT x.id,x.body,x.created_at,u.name AS author FROM item_comments x JOIN users u ON u.id=x.author_id WHERE x.item_id=$1 ORDER BY x.created_at LIMIT 100",
          [id],
        )
      ).rows,
    }));
  }
  status(user: Identity, c: string, id: string, status: string) {
    return this.work(user, c, async (sql, a) => {
      const item = await this.item(sql, user, id, a);
      if (item.author_id !== user.sub && a.role !== "admin")
        throw new ForbiddenException(
          "Only the author or administrator can change this item.",
        );
      const row = (
        await sql.query(
          "UPDATE community_items SET status=$1,updated_at=now() WHERE id=$2 RETURNING *",
          [status, id],
        )
      ).rows[0];
      await sql.query(
        "INSERT INTO audit_logs(community_id,actor_id,action,entity_id) VALUES($1,$2,$3,$4)",
        [c, user.sub, `${item.kind}.${status}`, id],
      );
      return row;
    });
  }
  bookmark(user: Identity, c: string, id: string) {
    return this.work(user, c, async (sql, a) => {
      await this.item(sql, user, id, a);
      const removed = await sql.query(
        "DELETE FROM item_bookmarks WHERE item_id=$1 AND user_id=$2 RETURNING item_id",
        [id, user.sub],
      );
      if (!removed.rows.length)
        await sql.query(
          "INSERT INTO item_bookmarks(community_id,item_id,user_id) VALUES($1,$2,$3)",
          [c, id, user.sub],
        );
      return { saved: !removed.rows.length };
    });
  }
  comment(user: Identity, c: string, id: string, d: MessageDto) {
    return this.work(user, c, async (sql, a) => {
      const item = await this.item(sql, user, id, a);
      if (
        item.status !== "published" ||
        !["post", "notice"].includes(item.kind)
      )
        throw new BadRequestException(
          "Comments are available on published community posts and notices.",
        );
      return (
        await sql.query(
          "INSERT INTO item_comments(community_id,item_id,author_id,body) VALUES($1,$2,$3,$4) RETURNING *",
          [c, id, user.sub, d.message.trim()],
        )
      ).rows[0];
    });
  }
  inquire(user: Identity, c: string, id: string, d: MessageDto) {
    return this.work(user, c, async (sql, a) => {
      const item = await this.item(sql, user, id, a);
      if (
        item.status !== "published" ||
        !["property", "listing"].includes(item.kind)
      )
        throw new BadRequestException(
          "Enquiries are available on active listings.",
        );
      if (item.author_id === user.sub)
        throw new BadRequestException("This is your own listing.");
      return (
        await sql.query(
          "INSERT INTO item_inquiries(community_id,item_id,sender_id,recipient_id,message) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [c, id, user.sub, item.author_id, d.message.trim()],
        )
      ).rows[0];
    });
  }
  inquiries(user: Identity, c: string) {
    return this.work(
      user,
      c,
      async (sql) =>
        (
          await sql.query(
            `SELECT x.*,i.title,s.name AS sender,r.name AS recipient FROM item_inquiries x JOIN community_items i ON i.id=x.item_id JOIN users s ON s.id=x.sender_id JOIN users r ON r.id=x.recipient_id WHERE x.sender_id=$1 OR x.recipient_id=$1 ORDER BY x.created_at DESC LIMIT 100`,
            [user.sub],
          )
        ).rows,
    );
  }
  reply(user: Identity, c: string, id: string, d: MessageDto) {
    return this.work(user, c, async (sql) => {
      const row = (
        await sql.query(
          "UPDATE item_inquiries SET reply=$1,replied_at=now() WHERE id=$2 AND recipient_id=$3 RETURNING *",
          [d.message.trim(), id, user.sub],
        )
      ).rows[0];
      if (!row) throw new NotFoundException("Enquiry not found.");
      return row;
    });
  }
  book(user: Identity, c: string, id: string, d: ServiceRequestDto) {
    return this.work(user, c, async (sql, a) => {
      const item = await this.item(sql, user, id, a);
      if (item.kind !== "service" || item.status !== "published")
        throw new BadRequestException("This service is not available.");
      if (!a.units.includes(d.unit_id))
        throw new ForbiddenException(
          "Choose a home linked to your approved membership.",
        );
      const date = new Date(`${d.scheduled_on}T00:00:00Z`);
      if (
        !Number.isFinite(+date) ||
        date.toISOString().slice(0, 10) !== d.scheduled_on ||
        +date < Date.now() - 86400000
      )
        throw new BadRequestException("Choose today or a future date.");
      return (
        await sql.query(
          "INSERT INTO service_requests(community_id,item_id,user_id,unit_id,scheduled_on,note) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [c, id, user.sub, d.unit_id, d.scheduled_on, d.note.trim()],
        )
      ).rows[0];
    });
  }
  requests(user: Identity, c: string) {
    return this.work(
      user,
      c,
      async (sql, a) =>
        (
          await sql.query(
            "SELECT s.*,i.title,u.name,un.label AS unit FROM service_requests s JOIN community_items i ON i.id=s.item_id JOIN users u ON u.id=s.user_id JOIN units un ON un.id=s.unit_id WHERE s.user_id=$1 OR $2 ORDER BY s.created_at DESC LIMIT 100",
            [user.sub, a.role === "admin"],
          )
        ).rows,
    );
  }
  requestStatus(user: Identity, c: string, id: string, next: string) {
    return this.work(user, c, async (sql, a) => {
      const row = (
        await sql.query(
          "SELECT * FROM service_requests WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row || (a.role !== "admin" && row.user_id !== user.sub))
        throw new NotFoundException("Request not found.");
      if (a.role !== "admin" && next !== "cancelled")
        throw new ForbiddenException(
          "Only an administrator can confirm or complete a request.",
        );
      if (
        row.status === "completed" ||
        row.status === "cancelled" ||
        (next === "completed" && row.status !== "accepted") ||
        (next === "accepted" && row.status !== "requested")
      )
        throw new ConflictException("That status change is not available.");
      return (
        await sql.query(
          "UPDATE service_requests SET status=$1,updated_at=now() WHERE id=$2 RETURNING *",
          [next, id],
        )
      ).rows[0];
    });
  }
}
type Request = { user: Identity };
@ApiTags("Community, homes, marketplace and services")
@ApiBearerAuth()
@Controller("communities/:community")
export class ContentController {
  constructor(@Inject(ContentService) private service: ContentService) {}
  @Get("items") list(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Query() q: ItemQuery,
  ) {
    return this.service.list(r.user, c, q);
  }
  @Post("items") create(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Body() d: ItemDto,
  ) {
    return this.service.create(r.user, c, d);
  }
  @Get("items/:id") detail(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(r.user, c, id);
  }
  @Post("items/:id/status") status(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ItemStatusDto,
  ) {
    return this.service.status(r.user, c, id, d.status);
  }
  @Post("items/:id/bookmark") bookmark(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.bookmark(r.user, c, id);
  }
  @Post("items/:id/comments") comment(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.comment(r.user, c, id, d);
  }
  @Post("items/:id/inquiries") inquiry(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.inquire(r.user, c, id, d);
  }
  @Get("inquiries") inquiries(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.inquiries(r.user, c);
  }
  @Post("inquiries/:id/reply") reply(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    return this.service.reply(r.user, c, id, d);
  }
  @Post("items/:id/requests") book(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ServiceRequestDto,
  ) {
    return this.service.book(r.user, c, id, d);
  }
  @Get("service-requests") requests(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
  ) {
    return this.service.requests(r.user, c);
  }
  @Post("service-requests/:id/status") requestStatus(
    @Req() r: Request,
    @Param("community", ParseUUIDPipe) c: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ServiceStatusDto,
  ) {
    return this.service.requestStatus(r.user, c, id, d.status);
  }
}
