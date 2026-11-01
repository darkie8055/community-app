import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PlatformService } from '../communities/community.service';
import { Identity, Row, Sql } from '../database/database';

const residents = ['owner', 'tenant', 'family'];
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const invalid = () => new NotFoundException('This pass is invalid, expired, revoked, or already used.');
const hash = (code: string) => createHash('sha256').update(code).digest('hex');

@Injectable()
export class VisitorPassService {
  constructor(@Inject(PlatformService) private platform: PlatformService) {}

  private code(row: Row) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('Visitor passes require JWT_SECRET.');
    const bytes = createHmac('sha256', secret)
      .update(`mycommunity:visitor-pass:v1:${row.community_id}:${row.entry_id}:${row.nonce}`).digest();
    // Rejection sampling avoids biased characters when the alphabet has 31 symbols.
    let code = '';
    for (const b of bytes) {
      if (b < Math.floor(256 / alphabet.length) * alphabet.length) code += alphabet[b % alphabet.length];
      if (code.length === 12) return code;
    }
    throw new Error('Could not generate a visitor pass. Try again.');
  }
  private view(row: Row) {
    const code = this.code(row);
    return { entry_id: row.entry_id, community_id: row.community_id, code,
      expires_at: row.expires_at,
      payload: `mycommunity://pass/v1?community=${row.community_id}&code=${code}` };
  }
  private normalize(code: string) {
    const clean = code.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[2-9A-HJ-NP-Z]{12}$/.test(clean)) throw new BadRequestException('Enter the 12-character visitor code.');
    return clean;
  }
  private async ownEntry(sql: Sql, units: string[], id: string) {
    const entry = (await sql.query('SELECT * FROM visitor_entries WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!entry || !units.includes(entry.unit_id)) throw new NotFoundException('Visit not found for your home.');
    return entry;
  }
  async get(user: Identity, community: string, id: string) {
    return this.platform.withCommunity(user, community, residents, async (sql, access) => {
      const entry = await this.ownEntry(sql, access.units, id);
      if (entry.status !== 'approved') return null;
      const row = (await sql.query('SELECT * FROM visitor_passes WHERE entry_id=$1 AND revoked_at IS NULL AND expires_at>now()', [id])).rows[0];
      // Rotating the signing secret invalidates existing passes; offer generation again.
      return row && hash(this.code(row)) === row.code_hash ? this.view(row) : null;
    });
  }
  async create(user: Identity, community: string, id: string, hours = 24) {
    if (!Number.isInteger(hours) || hours < 1 || hours > 48) throw new BadRequestException('Pass validity must be 1–48 hours.');
    return this.platform.withCommunity(user, community, residents, async (sql, access) => {
      const entry = await this.ownEntry(sql, access.units, id);
      if (entry.status !== 'approved') throw new ConflictException('Approve this visitor before creating a pass.');
      const row = { community_id: community, entry_id: id, nonce: randomUUID() };
      const pass = (await sql.query(`INSERT INTO visitor_passes(community_id,entry_id,nonce,code_hash,expires_at,created_by)
        VALUES($1,$2,$3,$4,now()+($5::int * interval '1 hour'),$6)
        ON CONFLICT(entry_id) DO UPDATE SET nonce=EXCLUDED.nonce,code_hash=EXCLUDED.code_hash,
        expires_at=EXCLUDED.expires_at,revoked_at=NULL,created_by=EXCLUDED.created_by,created_at=now() RETURNING *`,
        [community, id, row.nonce, hash(this.code(row)), hours, user.sub])).rows[0];
      await this.audit(sql, user, community, id, 'visitor.pass_created');
      return this.view(pass);
    });
  }
  async revoke(user: Identity, community: string, id: string) {
    return this.platform.withCommunity(user, community, residents, async (sql, access) => {
      await this.ownEntry(sql, access.units, id);
      await sql.query('UPDATE visitor_passes SET revoked_at=now() WHERE entry_id=$1 AND revoked_at IS NULL', [id]);
      await this.audit(sql, user, community, id, 'visitor.pass_revoked');
      return { revoked: true };
    });
  }
  async verify(user: Identity, community: string, input: string) {
    const codeHash = hash(this.normalize(input));
    const id = await this.platform.withCommunity(user, community, ['guard', 'admin'], async sql => {
      const row = (await sql.query(`SELECT p.entry_id FROM visitor_passes p JOIN visitor_entries e ON e.id=p.entry_id
        WHERE p.code_hash=$1 AND p.revoked_at IS NULL AND p.expires_at>now() AND e.status='approved'`, [codeHash])).rows[0];
      if (!row) throw invalid();
      return row.entry_id as string;
    });
    return this.platform.visit(user, community, id);
  }
  async checkIn(user: Identity, community: string, input: string) {
    const codeHash = hash(this.normalize(input));
    const entry = await this.verify(user, community, input);
    // Re-check under the same entry lock used by rotation/revocation and check-in.
    return this.platform.transition(user, community, entry.id, 'inside', async (sql, locked) => {
      const valid = (await sql.query(`SELECT entry_id FROM visitor_passes WHERE entry_id=$1 AND code_hash=$2
        AND revoked_at IS NULL AND expires_at>clock_timestamp()`, [entry.id, codeHash])).rows.length;
      if (!valid || locked.status !== 'approved') throw invalid();
    });
  }
  private async audit(sql: Sql, user: Identity, community: string, id: string, action: string) {
    await sql.query('INSERT INTO audit_logs(community_id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',
      [community, user.sub, action, id, '{}']);
  }
}
