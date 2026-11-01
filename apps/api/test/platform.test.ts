import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Database, Identity } from "../src/database/database";
import { PlatformService } from "../src/communities/community.service";
import { DEMO, seed } from "../src/database/seed";
import { VisitorDto, VisitQuery } from "../src/communities/community.dto";
import { ContentService, ItemDto } from '../src/catalog/catalog';
import { VisitorPassService } from '../src/visitors/visitor-pass.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
const db = new Database();
const service = new PlatformService(db);
process.env.JWT_SECRET = 'test-only-visitor-pass-secret-with-more-than-32-characters';
const passes = new VisitorPassService(service);
const admin: Identity = { sub: DEMO.admin, name: "Admin", platformAdmin: true };
const resident: Identity = {
  sub: DEMO.resident,
  name: "Resident",
  platformAdmin: false,
};
const guard: Identity = {
  sub: DEMO.guard,
  name: "Guard",
  platformAdmin: false,
};
before(async () => {
  await db.init({ memory: true });
  await db.migrate();
  await seed(db);
});
after(async () => db.onModuleDestroy());
test('visitor QR passes enforce ownership, tenant, expiry, rotation, revocation and one entry', async () => {
  const dto = Object.assign(new VisitorDto(), {name:'QR Guest',phone:'9876543210',unit_id:DEMO.unit,type:'guest',preapproved:true});
  const visit = await service.createVisit(resident, DEMO.community, dto, randomUUID());
  await assert.rejects(passes.create(guard, DEMO.community, visit.id));
  const pass = await passes.create(resident, DEMO.community, visit.id, 1);
  assert.match(pass.code, /^[2-9A-HJ-NP-Z]{12}$/);
  assert.equal((await passes.get(resident, DEMO.community, visit.id))!.code, pass.code);
  assert.ok(!pass.payload.includes('9876543210'));
  assert.equal((await passes.verify(guard, DEMO.community, pass.code)).id, visit.id);
  await assert.rejects(passes.verify(resident, DEMO.community, pass.code));
  const other = await service.createCommunity(admin, {name:'QR Other',address:'Other society',city:'Pune'});
  await assert.rejects(passes.verify(admin, other.id, pass.code));
  await db.scoped(admin.sub, other.id, async sql => {
    assert.equal((await sql.query('SELECT * FROM visitor_passes WHERE entry_id=$1',[visit.id])).rows.length, 0);
  });
  const replacement = await passes.create(resident, DEMO.community, visit.id, 6);
  assert.notEqual(replacement.code, pass.code);
  await assert.rejects(passes.verify(guard, DEMO.community, pass.code));
  await passes.revoke(resident, DEMO.community, visit.id);
  await assert.rejects(passes.checkIn(guard, DEMO.community, replacement.code));
  const expired = await passes.create(resident, DEMO.community, visit.id);
  await db.scoped(admin.sub, DEMO.community, sql => sql.query("UPDATE visitor_passes SET expires_at=now()-interval '1 minute' WHERE entry_id=$1",[visit.id]));
  assert.equal(await passes.get(resident, DEMO.community, visit.id), null);
  await assert.rejects(passes.verify(guard, DEMO.community, expired.code));
  const active = await passes.create(resident, DEMO.community, visit.id);
  const results = await Promise.allSettled([passes.checkIn(guard,DEMO.community,active.code),passes.checkIn(guard,DEMO.community,active.code)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await service.visit(guard,DEMO.community,visit.id)).status,'inside');
  await assert.rejects(passes.verify(guard,DEMO.community,active.code));
  await assert.rejects(passes.create(resident,DEMO.community,visit.id));
  const otherUnit = (await service.structure(admin,DEMO.community)).units.find(u=>u.id!==DEMO.unit)!;
  const foreign = await service.createVisit(guard,DEMO.community,Object.assign(new VisitorDto(),dto,{unit_id:otherUnit.id,preapproved:false}),randomUUID());
  await assert.rejects(passes.create(resident,DEMO.community,foreign.id));
  await assert.rejects(passes.get(resident,DEMO.community,foreign.id));
  await assert.rejects(passes.revoke(resident,DEMO.community,foreign.id));
});
test('history paginates beyond 100 and filters name, phone, flat, type and date', async () => {
  for (let i=0;i<105;i++) await service.createVisit(guard,DEMO.community,Object.assign(new VisitorDto(),{
    name:`Pagination Guest ${i}`,phone:'9876543210',unit_id:DEMO.unit,type:'cab',company:'History QA'
  }),randomUUID());
  const ids: string[]=[];
  let cursor: string | undefined;
  do {
    const page = await service.visits(guard,DEMO.community,Object.assign(new VisitQuery(),{search:'History QA',type:'cab',limit:40,cursor}));
    ids.push(...page.items.map(i=>i.id)); cursor=page.next_cursor ?? undefined;
  } while(cursor);
  assert.equal(ids.length,105); assert.equal(new Set(ids).size,105);
  const none = await service.visits(guard,DEMO.community,Object.assign(new VisitQuery(),{search:'History QA',type:'delivery'}));
  assert.equal(none.items.length,0);
  const future = await service.visits(guard,DEMO.community,Object.assign(new VisitQuery(),{from:'2099-01-01T00:00:00Z'}));
  assert.equal(future.items.length,0);
  assert.ok((await service.visits(guard,DEMO.community,Object.assign(new VisitQuery(),{search:'9876543210'}))).items.length);
  const flat = (await service.structure(admin,DEMO.community)).units.find(u=>u.id===DEMO.unit)!.label;
  assert.ok((await service.visits(resident,DEMO.community,Object.assign(new VisitQuery(),{search:flat}))).items.length);
});
test('whitespace names are rejected after trimming', async () => {
  const dto=plainToInstance(VisitorDto,{name:'   ',phone:'9876543210',unit_id:DEMO.unit,type:'guest'});
  assert.ok((await validate(dto)).some(e=>e.property==='name'));
});
test("complete visit journey commits timestamps and audit events", async () => {
  const dto = Object.assign(new VisitorDto(), {
    name: "Test Guest",
    phone: "9876543210",
    unit_id: DEMO.unit,
    type: "guest",
  });
  const key = randomUUID();
  const visit = await service.createVisit(guard, DEMO.community, dto, key);
  assert.equal(visit.status, "pending");
  assert.equal(
    (await service.createVisit(guard, DEMO.community, dto, key)).id,
    visit.id,
  );
  await assert.rejects(
    service.transition(guard, DEMO.community, visit.id, "inside"),
  );
  await assert.rejects(
    service.transition(guard, DEMO.community, visit.id, "approved"),
  );
  await service.transition(resident, DEMO.community, visit.id, "approved");
  await service.transition(guard, DEMO.community, visit.id, "inside");
  const exited = await service.transition(
    guard,
    DEMO.community,
    visit.id,
    "exited",
  );
  assert.ok(exited.approved_at && exited.entered_at && exited.exited_at);
  assert.equal(exited.status, "exited");
  await service.transition(guard, DEMO.community, visit.id, "exited");
  const logs = await service.auditLogs(admin, DEMO.community);
  assert.equal(logs.filter((l) => l.entity_id === visit.id).length, 4);
});
test("denial cannot be bypassed and is timestamped", async () => {
  const dto = Object.assign(new VisitorDto(), {
    name: "Denied Guest",
    phone: "9876543210",
    unit_id: DEMO.unit,
    type: "guest",
  });
  const visit = await service.createVisit(
    guard,
    DEMO.community,
    dto,
    randomUUID(),
  );
  const denied = await service.transition(
    resident,
    DEMO.community,
    visit.id,
    "denied",
  );
  assert.ok(denied.denied_at);
  await assert.rejects(
    service.transition(guard, DEMO.community, visit.id, "inside"),
  );
});
test("RLS hides other tenants and composite foreign keys reject cross-tenant units", async () => {
  const other = await service.createCommunity(admin, {
    name: "Other Society",
    address: "Other address",
    city: "Mumbai",
  });
  await assert.rejects(service.structure(resident, other.id));
  await db.scoped(admin.sub, other.id, async (sql) => {
    assert.equal(
      (await sql.query("SELECT * FROM units WHERE id=$1", [DEMO.unit])).rows
        .length,
      0,
    );
    assert.equal(
      (
        await sql.query("SELECT * FROM memberships WHERE community_id=$1", [
          DEMO.community,
        ])
      ).rows.length,
      0,
    );
  });
  await assert.rejects(
    db.scoped(admin.sub, other.id, (sql) =>
      sql.query(
        "INSERT INTO memberships(community_id,user_id,unit_id,role) VALUES($1,$2,$3,'tenant')",
        [other.id, resident.sub, DEMO.unit],
      ),
    ),
  );
  await assert.rejects(
    db.scoped(admin.sub, other.id, (sql) =>
      sql.query("INSERT INTO blocks(community_id,name) VALUES($1,$2)", [
        DEMO.community,
        "Invalid",
      ]),
    ),
  );
});
test("membership approval changes access only through admin", async () => {
  const rows = await service.memberships(admin, DEMO.community);
  const pending = rows.find((r) => r.user_id === DEMO.pending)!;
  await assert.rejects(
    service.decideMembership(guard, DEMO.community, pending.id, "approved"),
  );
  const approved = await service.decideMembership(
    admin,
    DEMO.community,
    pending.id,
    "approved",
  );
  assert.equal(approved.status, "approved");
  assert.ok(approved.decided_at);
  await assert.rejects(
    service.decideMembership(admin, DEMO.community, pending.id, "rejected"),
  );
});
test("residents only list their own visits and cannot create for another unit", async () => {
  const structure = await service.structure(admin, DEMO.community);
  const other = structure.units.find((u) => u.id !== DEMO.unit)!;
  const dto = Object.assign(new VisitorDto(), {
    name: "Other Guest",
    phone: "9876543210",
    unit_id: other.id,
    type: "guest",
  });
  const entry = await service.createVisit(
    guard,
    DEMO.community,
    dto,
    randomUUID(),
  );
  const list = await service.visits(resident, DEMO.community, new VisitQuery());
  assert.ok(list.items.every((e) => e.unit_id === DEMO.unit));
  await assert.rejects(service.visit(resident, DEMO.community, entry.id));
  await assert.rejects(
    service.transition(resident, DEMO.community, entry.id, "approved"),
  );
  await assert.rejects(
    service.createVisit(
      resident,
      DEMO.community,
      { ...dto, preapproved: true },
      randomUUID(),
    ),
  );
});
test("audit log records cannot be changed or deleted", async () => {
  await assert.rejects(
    db.scoped(admin.sub, DEMO.community, (sql) =>
      sql.query("UPDATE audit_logs SET action='tampered'"),
    ),
  );
  await assert.rejects(
    db.internal((sql) => sql.query("DELETE FROM audit_logs")),
  );
});
test("cursor pagination returns distinct visits", async () => {
  const page = await service.visits(admin, DEMO.community, { limit: 2 });
  assert.equal(page.items.length, 2);
  assert.ok(page.next_cursor);
  const next = await service.visits(admin, DEMO.community, {
    limit: 2,
    cursor: page.next_cursor,
  });
  assert.ok(next.items.every((e) => !page.items.some((p) => p.id === e.id)));
});

test('listing drafts remain private, bookmarks persist, and only authors can close them',async()=>{
  const content=new ContentService(service);
  const item=await content.create(resident,DEMO.community,Object.assign(new ItemDto(),{kind:'listing',title:'Test desk',description:'A well cared for desk',category:'Furniture',price:1500,status:'draft'}));
  await assert.rejects(content.detail(guard,DEMO.community,item.id));
  await content.status(resident,DEMO.community,item.id,'published');
  assert.equal((await content.bookmark(guard,DEMO.community,item.id)).saved,true);
  assert.equal((await content.detail(guard,DEMO.community,item.id)).saved,true);
  await assert.rejects(content.status(guard,DEMO.community,item.id,'closed'));
  await content.status(resident,DEMO.community,item.id,'closed');
  await assert.rejects(content.detail(guard,DEMO.community,item.id));
});
test('property listings require ownership and community posts support comments',async()=>{
  const content=new ContentService(service);
  await assert.rejects(content.create(guard,DEMO.community,Object.assign(new ItemDto(),{kind:'property',title:'Wrong owner',unit_id:DEMO.unit,listing_type:'rent',available_on:'2027-01-01'})));
  const item=await content.create(resident,DEMO.community,Object.assign(new ItemDto(),{kind:'property',title:'Owner listed home',unit_id:DEMO.unit,listing_type:'rent',available_on:'2027-01-01'}));
  assert.equal(item.unit_id,DEMO.unit);
  const post=await content.create(resident,DEMO.community,Object.assign(new ItemDto(),{kind:'post',title:'Weekend gardening',description:'Join the neighbours'}));
  await content.comment(resident,DEMO.community,post.id,{message:'Count me in'});
  assert.equal((await content.detail(resident,DEMO.community,post.id)).comments.length,1);
});
test('enquiries are private to participants and only recipients can reply',async()=>{
  const content=new ContentService(service);
  const item=await content.create(admin,DEMO.community,Object.assign(new ItemDto(),{kind:'listing',title:'Admin listing',price:500}));
  const inquiry=await content.inquire(resident,DEMO.community,item.id,{message:'Is this still available?'});
  assert.ok((await content.inquiries(resident,DEMO.community)).some(i=>i.id===inquiry.id));
  assert.ok(!(await content.inquiries(guard,DEMO.community)).some(i=>i.id===inquiry.id));
  await assert.rejects(content.reply(resident,DEMO.community,inquiry.id,{message:'Forged reply'}));
  assert.equal((await content.reply(admin,DEMO.community,inquiry.id,{message:'Yes, available'})).reply,'Yes, available');
});
test('service requests require an approved home and administrator confirmation',async()=>{
  const content=new ContentService(service);
  await assert.rejects(content.create(resident,DEMO.community,Object.assign(new ItemDto(),{kind:'service',title:'Unauthorised service'})));
  const item=await content.create(admin,DEMO.community,Object.assign(new ItemDto(),{kind:'service',title:'Test cleaning',price:500}));
  const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await assert.rejects(content.book(guard,DEMO.community,item.id,{unit_id:DEMO.unit,scheduled_on:date,note:''}));
  const booking=await content.book(resident,DEMO.community,item.id,{unit_id:DEMO.unit,scheduled_on:date,note:'Morning please'});
  await assert.rejects(content.requestStatus(resident,DEMO.community,booking.id,'accepted'));
  await assert.rejects(content.requestStatus(admin,DEMO.community,booking.id,'completed'));
  await content.requestStatus(admin,DEMO.community,booking.id,'accepted');
  assert.equal((await content.requestStatus(admin,DEMO.community,booking.id,'completed')).status,'completed');
  await assert.rejects(content.requestStatus(resident,DEMO.community,booking.id,'cancelled'));
});
