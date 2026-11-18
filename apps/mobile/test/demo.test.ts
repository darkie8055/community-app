import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoWorkspace, DEMO_DETAILS } from "../src/demo";
import {
  parsePass,
  passPayload,
  type Activity,
  type Item,
  type Membership,
  type Page,
  type Visitor,
  type VisitorPass,
} from "../src/domain";

async function setup() {
  const workspace = createDemoWorkspace();
  const resident = workspace.session("resident");
  const guard = workspace.session("guard");
  await resident.signIn(DEMO_DETAILS.residentName);
  await guard.signIn(DEMO_DETAILS.guardName);
  return { workspace, resident, guard };
}

test("demo starts with no credentials or network and both roles use one local workspace", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected network request");
  };
  try {
    const { resident, guard } = await setup();
    assert.equal(resident.isDemo, true);
    assert.equal(resident.snapshot.community?.name, "Maple Grove");
    assert.equal(resident.snapshot.user?.name, "Ananya Sharma");
    assert.equal(guard.snapshot.user?.name, "Ravi Kumar");
    assert.ok(guard.snapshot.entries.length > resident.snapshot.entries.length);
    const pending = resident.snapshot.entries.find(
      (v) => v.status === "pending",
    )!;
    await assert.rejects(
      guard.transition(pending.id, "approved"),
      /resident demo/,
    );
    await resident.transition(pending.id, "approved");
    await guard.refresh();
    assert.equal(
      guard.snapshot.entries.find((v) => v.id === pending.id)?.status,
      "approved",
    );
    await guard.transition(pending.id, "inside");
    await resident.refresh();
    assert.equal(
      resident.snapshot.entries.find((v) => v.id === pending.id)?.status,
      "inside",
    );
    await guard.transition(pending.id, "exited");
    await assert.rejects(
      guard.transition(pending.id, "inside"),
      /cannot make that transition/,
    );
    await assert.rejects(resident.request("/v1/unsupported"), /not available/);
    resident.origin = "https://real-api.invalid";
    await assert.rejects(
      resident.request("/v1/communities"),
      /does not contact external services/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("demo invitation retries are idempotent and passes rotate, revoke and check in once", async () => {
  const { resident, guard } = await setup();
  const body = {
    name: "Invited Demo Guest",
    phone: "9000000020",
    type: "guest",
    unit_id: resident.ownUnits[0].id,
    people: 2,
    preapproved: true,
  };
  const visit = await resident.register(body, "demo-invite-1");
  assert.equal((await resident.register(body, "demo-invite-1")).id, visit.id);
  await assert.rejects(
    resident.register({ ...body, name: "Different guest" }, "demo-invite-1"),
    /different visitor/,
  );
  const path = `${resident.base}/visitor-entries/${visit.id}/pass`;
  const generate = () =>
    resident.request<VisitorPass>(path, "POST", { hours: 1 });
  const first = await generate();
  assert.equal(
    parsePass(passPayload(first), DEMO_DETAILS.communityId),
    first.code,
  );
  const second = await generate();
  assert.notEqual(first.code, second.code);
  await assert.rejects(
    guard.request(`${guard.base}/visitor-passes/verify`, "POST", {
      code: first.code,
    }),
    /invalid, expired or revoked/,
  );
  const verified = await guard.request<Visitor>(
    `${guard.base}/visitor-passes/verify`,
    "POST",
    { code: second.code },
  );
  assert.equal(verified.id, visit.id);
  await resident.request(path, "DELETE");
  await assert.rejects(
    guard.request(`${guard.base}/visitor-passes/verify`, "POST", {
      code: second.code,
    }),
    /invalid, expired or revoked/,
  );
  const third = await generate();
  const entered = await guard.request<Visitor>(
    `${guard.base}/visitor-passes/check-in`,
    "POST",
    { code: third.code },
  );
  assert.equal(entered.status, "inside");
  await assert.rejects(
    guard.request(`${guard.base}/visitor-passes/check-in`, "POST", {
      code: third.code,
    }),
    /invalid, expired or revoked/,
  );
});

test("demo visitor history supports search, filters, dates and stable pagination", async () => {
  const { resident } = await setup();
  const first = await resident.request<Page<Visitor>>(
    `${resident.base}/visitor-entries?limit=2`,
  );
  assert.equal(first.items.length, 2);
  assert.ok(first.next_cursor);
  const second = await resident.request<Page<Visitor>>(
    `${resident.base}/visitor-entries?limit=2&cursor=${first.next_cursor}`,
  );
  assert.equal(
    first.items.some((a) => second.items.some((b) => a.id === b.id)),
    false,
  );
  const filtered = await resident.request<Page<Visitor>>(
    `${resident.base}/visitor-entries?type=delivery&status=pending&search=fresh`,
  );
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].name, "Aarav Patel");
  const dateFilter = new URLSearchParams({
    from: new Date(Date.now() - 3600000).toISOString(),
    until: new Date().toISOString(),
  });
  const recent = await resident.request<Page<Visitor>>(
    `${resident.base}/visitor-entries?${dateFilter}`,
  );
  assert.ok(recent.items.length >= 2);
  assert.ok(
    recent.items.every((v) => Date.now() - Date.parse(v.created_at) <= 3600000),
  );
});

test("demo catalog supports private drafts, publishing, bookmarks and comments", async () => {
  const { resident, guard } = await setup();
  const draft = await resident.request<Item>(`${resident.base}/items`, "POST", {
    kind: "listing",
    title: "Local demo bookshelf",
    description: "A bookshelf created during the presentation.",
    price: 1200,
    category: "Furniture",
    status: "draft",
  });
  const publicItems = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=listing`,
  );
  assert.equal(
    publicItems.items.some((i) => i.id === draft.id),
    false,
  );
  const ownItems = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=listing&mine=true`,
  );
  assert.ok(ownItems.items.some((i) => i.id === draft.id));
  await assert.rejects(
    guard.request(`${guard.base}/items/${draft.id}`),
    /not found/,
  );
  await resident.request(`${resident.base}/items/${draft.id}/status`, "POST", {
    status: "published",
  });
  assert.equal(
    (await guard.request<Item>(`${guard.base}/items/${draft.id}`)).status,
    "published",
  );
  await resident.request(`${resident.base}/items/${draft.id}/bookmark`, "POST");
  const saved = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=listing&saved=true`,
  );
  assert.ok(saved.items.some((i) => i.id === draft.id && i.saved));
  const posts = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=post`,
  );
  await resident.request(
    `${resident.base}/items/${posts.items[0].id}/comments`,
    "POST",
    { message: "Looking forward to joining!" },
  );
  const post = await resident.request<Item>(
    `${resident.base}/items/${posts.items[0].id}`,
  );
  assert.equal(post.comments?.at(-1)?.body, "Looking forward to joining!");
  assert.equal(
    posts.items[0].comments?.some(
      (c) => c.body === "Looking forward to joining!",
    ),
    false,
    "Previously loaded snapshots must not mutate behind React",
  );
});

test("demo enquiries, replies and dated service requests persist until reset", async () => {
  const { resident } = await setup();
  const listings = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=listing`,
  );
  const otherListing = listings.items.find(
    (i) => i.author_id !== resident.snapshot.user?.sub,
  )!;
  await resident.request(
    `${resident.base}/items/${otherListing.id}/inquiries`,
    "POST",
    { message: "Can I collect this on Sunday?" },
  );
  const enquiries = await resident.request<Activity[]>(
    `${resident.base}/inquiries`,
  );
  assert.equal(enquiries[0].message, "Can I collect this on Sunday?");
  const incoming = enquiries.find(
    (i) => i.recipient_id === resident.snapshot.user?.sub,
  )!;
  await resident.request(
    `${resident.base}/inquiries/${incoming.id}/reply`,
    "POST",
    { message: "Yes, Saturday morning works." },
  );
  assert.equal(
    (await resident.request<Activity[]>(`${resident.base}/inquiries`)).find(
      (i) => i.id === incoming.id,
    )?.reply,
    "Yes, Saturday morning works.",
  );
  const services = await resident.request<Page<Item>>(
    `${resident.base}/items?kind=service`,
  );
  const request = await resident.request<Activity>(
    `${resident.base}/items/${services.items[0].id}/requests`,
    "POST",
    {
      unit_id: resident.ownUnits[0].id,
      scheduled_on: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      note: "Please arrive after breakfast.",
    },
  );
  assert.equal(request.status, "requested");
  await resident.request(
    `${resident.base}/service-requests/${request.id}/status`,
    "POST",
    { status: "cancelled" },
  );
  assert.equal(
    (
      await resident.request<Activity[]>(`${resident.base}/service-requests`)
    ).find((r) => r.id === request.id)?.status,
    "cancelled",
  );
});

test("demo memberships, notification read state and reset behave predictably", async () => {
  const { workspace, resident, guard } = await setup();
  const otherUnit = resident.snapshot.units[1];
  await resident.request(`${resident.base}/memberships`, "POST", {
    unit_id: otherUnit.id,
    role: "family",
  });
  const memberships = await resident.request<Membership[]>(
    "/v1/onboarding/memberships",
  );
  assert.equal(
    memberships.find((m) => m.unit_id === otherUnit.id)?.status,
    "pending",
  );
  await resident.request("/v1/notifications/read", "POST");
  await resident.refresh();
  assert.ok(resident.snapshot.notifications.every((n) => n.read_at));
  assert.equal(
    resident.ownUnits.length,
    1,
    "Pending membership must not unlock another flat",
  );
  workspace.reset();
  assert.equal(resident.snapshot.user, null);
  assert.equal(guard.snapshot.user, null);
  assert.equal(workspace.session("resident"), resident);
  await resident.signIn(DEMO_DETAILS.residentName);
  await guard.signIn(DEMO_DETAILS.guardName);
  assert.equal(resident.snapshot.memberships.length, 1);
  assert.ok(resident.snapshot.notifications.some((n) => !n.read_at));
  const sample = await guard.request<Visitor>(
    `${guard.base}/visitor-passes/verify`,
    "POST",
    { code: DEMO_DETAILS.passCode },
  );
  assert.equal(sample.name, "Priya Mehta");
});

test("demo uploads stay on device and expiring passes are rejected", async () => {
  const { resident, guard } = await setup();
  assert.equal(
    await resident.upload("file:///local/photo.jpg", "image/jpeg"),
    "file:///local/photo.jpg",
  );
  await assert.rejects(
    resident.upload("https://external.invalid/photo.jpg", "image/jpeg"),
    /from this device/,
  );
  const originalNow = Date.now;
  Date.now = () => originalNow() + 25 * 3600000;
  try {
    await assert.rejects(
      guard.request(`${guard.base}/visitor-passes/verify`, "POST", {
        code: DEMO_DETAILS.passCode,
      }),
      /invalid, expired or revoked/,
    );
  } finally {
    Date.now = originalNow;
  }
});
