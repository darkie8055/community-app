import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { attachPhoto } from '../storage/object-storage';
import { Database, Identity, Sql, Row } from "../database/database";
import {
  BlockDto,
  CommunityDto,
  FloorDto,
  UnitDto,
  MembershipDto,
  VisitorDto,
  VisitQuery,
} from "./community.dto";

const projection = `SELECT e.*,v.name,v.phone,v.photo_key,u.label AS unit FROM visitor_entries e JOIN visitors v ON v.id=e.visitor_id AND v.community_id=e.community_id JOIN units u ON u.id=e.unit_id AND u.community_id=e.community_id`;
export type Access = { role: string; units: string[] };
@Injectable()
export class PlatformService {
  constructor(@Inject(Database) public db: Database) {}
  async withCommunity<T>(
    user: Identity,
    community: string,
    roles: string[] | null,
    work: (sql: Sql, access: Access) => Promise<T>,
  ) {
    return this.db.scoped(user.sub, community, async (sql) => {
      const memberships = (
        await sql.query(
          "SELECT role,unit_id FROM memberships WHERE user_id=$1 AND community_id=$2 AND status=$3",
          [user.sub, community, "approved"],
        )
      ).rows;
      const role = user.platformAdmin
        ? "admin"
        : memberships.find((m) => m.role === "admin")?.role ||
          memberships.find((m) => m.role === "guard")?.role ||
          memberships[0]?.role;
      if (!role || (roles && !roles.includes(role)))
        throw new ForbiddenException(
          "Your membership does not allow this action.",
        );
      if (
        !(
          await sql.query("SELECT id FROM communities WHERE id=$1", [community])
        ).rows.length
      )
        throw new NotFoundException("Community not found.");
      return work(sql, {
        role,
        units: memberships.map((m) => m.unit_id).filter(Boolean),
      });
    });
  }
  async communities(user: Identity) {
    if (user.platformAdmin)
      return this.db.internal(
        async (sql) =>
          (
            await sql.query(
              "SELECT id,name,address,city,created_at FROM communities ORDER BY name",
            )
          ).rows,
      );
    const memberships = await this.db.scoped(
      user.sub,
      null,
      async (sql) =>
        (
          await sql.query(
            "SELECT DISTINCT community_id FROM memberships WHERE user_id=$1 AND status=$2",
            [user.sub, "approved"],
          )
        ).rows,
    );
    return Promise.all(
      memberships.map((m) =>
        this.withCommunity(
          user,
          m.community_id,
          null,
          async (sql) =>
            (
              await sql.query("SELECT * FROM communities WHERE id=$1", [
                m.community_id,
              ])
            ).rows[0],
        ),
      ),
    );
  }
  async createCommunity(user: Identity, dto: CommunityDto) {
    if (!user.platformAdmin)
      throw new ForbiddenException(
        "Only platform administrators can create societies.",
      );
    return this.db.internal(async (sql) => {
      await sql.query("BEGIN");
      try {
        const community = (
          await sql.query(
            "INSERT INTO communities(name,address,city) VALUES($1,$2,$3) RETURNING *",
            [dto.name, dto.address, dto.city],
          )
        ).rows[0];
        await sql.query(
          "INSERT INTO memberships(community_id,user_id,role,status) VALUES($1,$2,'admin','approved')",
          [community.id, user.sub],
        );
        await this.audit(
          sql,
          community.id,
          user.sub,
          "community.created",
          community.id,
          {},
        );
        await sql.query("COMMIT");
        return community;
      } catch (e) {
        await sql.query("ROLLBACK");
        throw e;
      }
    });
  }
  async overview(user: Identity, community: string) {
    return this.withCommunity(user, community, ["admin"], async (sql) => {
      const stats = (
        await sql.query(`SELECT
        (SELECT count(*)::int FROM units) AS units,
        (SELECT count(*)::int FROM blocks) AS blocks,
        (SELECT count(*)::int FROM memberships WHERE status='pending') AS pending_memberships,
        (SELECT count(*)::int FROM memberships WHERE status='approved' AND role IN ('owner','tenant','family')) AS residents,
        (SELECT count(*)::int FROM visitor_entries WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS visits_today,
        (SELECT count(*)::int FROM visitor_entries WHERE status='inside') AS inside,
        (SELECT count(*)::int FROM visitor_entries WHERE status='pending') AS waiting`)
      ).rows[0];
      return {
        stats,
        recent: (
          await sql.query(
            `${projection} ORDER BY e.created_at DESC,e.id DESC LIMIT 6`,
          )
        ).rows,
        trend: (
          await sql.query(
            "SELECT to_char(d,'Dy') AS label, count(e.id)::int AS count FROM generate_series(date_trunc('day',now())-interval '6 days',date_trunc('day',now()),interval '1 day') d LEFT JOIN visitor_entries e ON e.created_at>=d AND e.created_at<d+interval '1 day' GROUP BY d ORDER BY d",
          )
        ).rows,
      };
    });
  }
  async structure(user: Identity, community: string) {
    return this.withCommunity(user, community, null, async (sql) => ({
      blocks: (await sql.query("SELECT * FROM blocks ORDER BY name")).rows,
      floors: (await sql.query("SELECT * FROM floors ORDER BY number")).rows,
      units: (
        await sql.query(
          "SELECT u.*,f.number AS floor,b.name AS block FROM units u JOIN floors f ON f.id=u.floor_id JOIN blocks b ON b.id=f.block_id ORDER BY b.name,f.number,u.label",
        )
      ).rows,
    }));
  }
  async createStructure(
    user: Identity,
    community: string,
    kind: "block" | "floor" | "unit",
    dto: BlockDto | FloorDto | UnitDto,
  ) {
    return this.withCommunity(user, community, ["admin"], async (sql) => {
      let row: Row;
      if (kind === "block")
        row = (
          await sql.query(
            "INSERT INTO blocks(community_id,name) VALUES($1,$2) RETURNING *",
            [community, (dto as BlockDto).name],
          )
        ).rows[0];
      else if (kind === "floor")
        row = (
          await sql.query(
            "INSERT INTO floors(community_id,block_id,number) VALUES($1,$2,$3) RETURNING *",
            [community, (dto as FloorDto).block_id, (dto as FloorDto).number],
          )
        ).rows[0];
      else
        row = (
          await sql.query(
            "INSERT INTO units(community_id,floor_id,label,kind) VALUES($1,$2,$3,$4) RETURNING *",
            [
              community,
              (dto as UnitDto).floor_id,
              (dto as UnitDto).label,
              (dto as UnitDto).kind || "flat",
            ],
          )
        ).rows[0];
      await this.audit(sql, community, user.sub, `${kind}.created`, row.id, {});
      return row;
    });
  }
  async memberships(user: Identity, community: string) {
    return this.withCommunity(
      user,
      community,
      ["admin"],
      async (sql) =>
        (
          await sql.query(
            "SELECT m.*,u.name,u.phone,un.label AS unit FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN units un ON un.id=m.unit_id ORDER BY m.created_at DESC",
          )
        ).rows,
    );
  }
  async requestMembership(
    user: Identity,
    community: string,
    dto: MembershipDto,
  ) {
    // New residents need not already be members; the request grants no access.
    return this.db.scoped(user.sub, community, async (sql) => {
      if (
        !(await sql.query("SELECT id FROM units WHERE id=$1", [dto.unit_id]))
          .rows.length
      )
        throw new NotFoundException("Flat not found.");
      const row = (
        await sql.query(
          "INSERT INTO memberships(community_id,user_id,unit_id,role,status) VALUES($1,$2,$3,$4,'pending') RETURNING *",
          [community, user.sub, dto.unit_id, dto.role],
        )
      ).rows[0];
      await this.audit(
        sql,
        community,
        user.sub,
        "membership.requested",
        row.id,
        {},
      );
      return row;
    });
  }
  async decideMembership(
    user: Identity,
    community: string,
    id: string,
    status: string,
  ) {
    return this.withCommunity(user, community, ["admin"], async (sql) => {
      const row = (
        await sql.query(
          "UPDATE memberships SET status=$1,decided_at=now(),decided_by=$2 WHERE id=$3 AND status='pending' RETURNING *",
          [status, user.sub, id],
        )
      ).rows[0];
      if (!row)
        throw new ConflictException(
          "This request has already been handled or is not available.",
        );
      await this.audit(
        sql,
        community,
        user.sub,
        `membership.${status}`,
        id,
        {},
      );
      return row;
    });
  }
  async visits(user: Identity, community: string, query: VisitQuery) {
    return this.withCommunity(user, community, null, async (sql, access) => {
      const rows = (
        await sql.query(
          `${projection} WHERE ($1::text IS NULL OR e.status=$1) AND ($2::text IS NULL OR v.name ILIKE '%'||$2||'%' OR e.company ILIKE '%'||$2||'%' OR v.phone ILIKE '%'||$2||'%' OR u.label ILIKE '%'||$2||'%') AND ($3::uuid IS NULL OR e.unit_id=$3) AND ($4::boolean OR e.unit_id=ANY($5::uuid[])) AND ($6::uuid IS NULL OR (e.created_at,e.id)<(SELECT created_at,id FROM visitor_entries WHERE id=$6)) AND ($8::text IS NULL OR e.type=$8) AND ($9::timestamptz IS NULL OR e.created_at>=$9) AND ($10::timestamptz IS NULL OR e.created_at<$10) ORDER BY e.created_at DESC,e.id DESC LIMIT $7`,
          [
            query.status || null,
            query.search || null,
            query.unit_id || null,
            ["admin", "guard"].includes(access.role),
            access.units,
            query.cursor || null,
            (query.limit || 50) + 1,
            query.type || null, query.from || null, query.until || null,
          ],
        )
      ).rows;
      const hasMore = rows.length > (query.limit || 50);
      if (hasMore) rows.pop();
      return { items: await Promise.all(rows.map(attachPhoto)), next_cursor: hasMore ? rows.at(-1)!.id : null };
    });
  }
  async visit(user: Identity, community: string, id: string) {
    return this.withCommunity(user, community, null, async (sql, access) => {
      const row = (await sql.query(`${projection} WHERE e.id=$1`, [id]))
        .rows[0];
      if (
        !row ||
        (!["admin", "guard"].includes(access.role) &&
          !access.units.includes(row.unit_id))
      )
        throw new NotFoundException("Visit not found.");
      return attachPhoto(row);
    });
  }
  async createVisit(
    user: Identity,
    community: string,
    dto: VisitorDto,
    key: string,
  ) {
    return this.withCommunity(user, community, null, async (sql, access) => {
      const resident = !["guard", "admin"].includes(access.role);
      if (resident && (!dto.preapproved || !access.units.includes(dto.unit_id)))
        throw new ForbiddenException(
          "Residents may only invite visitors to their own flat.",
        );
      if (!resident && dto.preapproved)
        throw new ForbiddenException(
          "Security cannot approve on behalf of a resident.",
        );
      const prior = (
        await sql.query(
          `${projection} WHERE e.created_by=$1 AND e.idempotency_key=$2`,
          [user.sub, key],
        )
      ).rows[0];
      if (prior) return prior;
      if (
        dto.photo_key &&
        !dto.photo_key.startsWith(`${community}/${user.sub}/`)
      )
        throw new BadRequestException("Invalid photo reference.");
      const visitor = (
        await sql.query(
          "INSERT INTO visitors(community_id,name,phone,photo_key) VALUES($1,$2,$3,$4) RETURNING id",
          [community, dto.name, dto.phone, dto.photo_key || null],
        )
      ).rows[0];
      const entry = (
        await sql.query(
          `INSERT INTO visitor_entries(community_id,visitor_id,unit_id,guard_id,created_by,type,status,company,purpose,people,vehicle,idempotency_key,approved_at,decided_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [
            community,
            visitor.id,
            dto.unit_id,
            resident ? null : user.sub,
            user.sub,
            dto.type,
            dto.preapproved ? "approved" : "pending",
            dto.company || "",
            dto.purpose || "",
            dto.people || 1,
            dto.vehicle || "",
            key,
            dto.preapproved ? new Date() : null,
            dto.preapproved ? user.sub : null,
          ],
        )
      ).rows[0];
      await this.audit(
        sql,
        community,
        user.sub,
        "visitor.registered",
        entry.id,
        { status: dto.preapproved ? "approved" : "pending" },
      );
      await this.notify(
        sql,
        community,
        entry.id,
        dto.unit_id,
        `${dto.name} ${dto.preapproved ? "is expected" : "is at the gate"}`,
        dto.preapproved
          ? "Your visitor was pre-approved."
          : "A visitor is waiting for your approval.",
      );
      return (await sql.query(`${projection} WHERE e.id=$1`, [entry.id]))
        .rows[0];
    });
  }
  async transition(
    user: Identity,
    community: string,
    id: string,
    next: "approved" | "denied" | "inside" | "exited",
    validate?: (sql: Sql, entry: Row) => Promise<void>,
  ) {
    const residentDecision = next === "approved" || next === "denied";
    return this.withCommunity(
      user,
      community,
      residentDecision ? ["owner", "tenant", "family"] : ["guard", "admin"],
      async (sql, access) => {
        const entry = (
          await sql.query(
            "SELECT * FROM visitor_entries WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!entry) throw new NotFoundException("Visit not found.");
        await validate?.(sql, entry);
        if (residentDecision && !access.units.includes(entry.unit_id))
          throw new ForbiddenException(
            "You can only decide visits to your flat.",
          );
        if (entry.status === next || (next === "approved" && entry.approved_at))
          return (await sql.query(`${projection} WHERE e.id=$1`, [id])).rows[0];
        const expected = residentDecision
          ? "pending"
          : next === "inside"
            ? "approved"
            : "inside";
        if (entry.status !== expected)
          throw new ConflictException(
            `A ${entry.status} visitor cannot be marked ${next}.`,
          );
        const timeField = {
          approved: "approved_at",
          denied: "denied_at",
          inside: "entered_at",
          exited: "exited_at",
        }[next];
        await sql.query(
          `UPDATE visitor_entries SET status=$1,${timeField}=now()${residentDecision ? ",decided_by=$3" : ""} WHERE id=$2`,
          residentDecision ? [next, id, user.sub] : [next, id],
        );
        await this.audit(sql, community, user.sub, `visitor.${next}`, id, {
          previous: entry.status,
          status: next,
        });
        const view = (await sql.query(`${projection} WHERE e.id=$1`, [id]))
          .rows[0];
        await this.notify(
          sql,
          community,
          id,
          entry.unit_id,
          `${view.name} · ${next}`,
          `Visitor status updated for ${view.unit}.`,
        );
        return view;
      },
    );
  }
  async auditLogs(user: Identity, community: string) {
    return this.withCommunity(
      user,
      community,
      ["admin"],
      async (sql) =>
        (
          await sql.query(
            "SELECT a.*,u.name AS actor FROM audit_logs a JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 100",
          )
        ).rows,
    );
  }
  private async audit(
    sql: Sql,
    community: string,
    actor: string,
    action: string,
    entity: string,
    details: Row,
  ) {
    await sql.query(
      "INSERT INTO audit_logs(community_id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)",
      [community, actor, action, entity, JSON.stringify(details)],
    );
  }
  private async notify(
    sql: Sql,
    community: string,
    entry: string,
    unit: string,
    title: string,
    body: string,
  ) {
    await sql.query(
      "INSERT INTO notification_outbox(community_id,user_id,entry_id,title,body) SELECT $1,user_id,$2,$3,$4 FROM memberships WHERE unit_id=$5 AND status='approved' AND role IN ('owner','tenant','family')",
      [community, entry, title, body, unit],
    );
  }
}
