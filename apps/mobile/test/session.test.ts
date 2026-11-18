import { test } from "node:test";
import assert from "node:assert/strict";
import { Session, ApiError } from "../src/api";
import type { Role } from "../src/domain";

function harness(role: Role = "resident", membershipRole = "owner") {
  const calls: { path: string; method: string; body: any; headers: Headers }[] =
    [];
  let revoked = false;
  let status = 200;
  let failedPath = "";
  let gate: Promise<void> | undefined;
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method, body, headers: new Headers(init?.headers) });
    if (path === failedPath)
      return new Response(JSON.stringify({ message: "Rejected by server" }), {
        status,
      });
    if (path.endsWith("/visitor-entries") && method === "GET" && gate)
      await gate;
    const grant = {
      id: "membership",
      community_id: "society-a",
      unit_id: "unit-a",
      unit: "A-101",
      status: revoked ? "revoked" : "approved",
      role: membershipRole,
    };
    const result =
      path === "/v1/auth/firebase"
        ? {
            access_token: "server-token",
            user: { sub: "user-a", name: "Test Resident", phone: "9876543210" },
          }
        : path === "/v1/onboarding/memberships" ||
            path.endsWith("/my-memberships")
          ? [grant]
          : path === "/v1/communities"
            ? [{ id: "society-a", name: "Test society" }]
            : path.endsWith("/structure")
              ? { units: [{ id: "unit-a", label: "A-101" }] }
              : path === "/v1/notifications"
                ? []
                : path.endsWith("/visitor-entries")
                  ? method === "GET"
                    ? { items: [], next_cursor: null }
                    : { id: "visit-a", ...body, community_id: "society-a" }
                  : {};
    return new Response(JSON.stringify(result), { status: 200 });
  };
  const session = new Session(
    "https://api.example.invalid",
    role,
    async () => "firebase-id-token",
    transport,
  );
  return {
    session,
    calls,
    revoke: () => {
      revoked = true;
    },
    fail: (path: string, s: number) => {
      failedPath = path;
      status = s;
    },
    delay: (p: Promise<void>) => {
      gate = p;
    },
  };
}
test("Firebase exchange selects only an approved matching workspace and sends server authorization", async () => {
  const { session, calls } = harness();
  await session.signIn("Test Resident");
  assert.equal(session.snapshot.community?.id, "society-a");
  assert.deepEqual(session.ownUnits, [{ id: "unit-a", label: "A-101" }]);
  assert.deepEqual(calls[0].body, {
    id_token: "firebase-id-token",
    name: "Test Resident",
  });
  assert.equal(calls[1].headers.get("Authorization"), "Bearer server-token");
});
test("wrong-role memberships do not open a workspace", async () => {
  const { session } = harness("guard", "owner");
  await session.signIn("Test Resident");
  assert.equal(session.snapshot.community, null);
  assert.ok(session.snapshot.user);
  await assert.rejects(
    () => session.selectCommunity("society-a"),
    /approved access/,
  );
});
test("revoked access clears sensitive workspace snapshots", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  h.revoke();
  await h.session.refresh();
  assert.equal(h.session.snapshot.community, null);
  assert.deepEqual(h.session.snapshot.memberships, []);
  assert.deepEqual(h.session.snapshot.entries, []);
});
test("server failures never fabricate a successful visitor mutation", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  h.fail("/v1/communities/society-a/visitor-entries", 503);
  await assert.rejects(
    () => h.session.register({ name: "Visitor" }, "stable-key"),
    ApiError,
  );
  assert.deepEqual(h.session.snapshot.entries, []);
});
test("registration preserves idempotency key across retries", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  const body = {
    name: "Visitor",
    phone: "9876543210",
    unit_id: "unit-a",
    type: "guest",
    people: 1,
    preapproved: true,
  };
  await h.session.register(body, "stable-key");
  await h.session.register(body, "stable-key");
  const writes = h.calls.filter(
    (c) => c.method === "POST" && c.path.endsWith("/visitor-entries"),
  );
  assert.equal(writes.length, 2);
  for (const c of writes) {
    assert.equal(c.headers.get("Idempotency-Key"), "stable-key");
    assert.deepEqual(c.body, body);
  }
  assert.equal(h.session.snapshot.entries.length, 1);
});
test("decisions and gate transitions match existing API routes", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  for (const state of ["approved", "denied", "inside", "exited"])
    await h.session.transition("visit-a", state);
  const actions = h.calls.filter(
    (c) => c.method === "POST" && c.path.includes("/visitor-entries/"),
  );
  assert.deepEqual(
    actions.map((a) => [a.path.split("/").at(-1), a.body]),
    [
      ["decision", { decision: "approved" }],
      ["decision", { decision: "denied" }],
      ["check-in", undefined],
      ["check-out", undefined],
    ],
  );
});
test("late requests cannot repopulate a signed-out workspace", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  let release!: () => void;
  h.delay(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const loading = h.session.refresh();
  h.session.clear();
  release();
  await loading;
  assert.equal(h.session.snapshot.user, null);
  assert.equal(h.session.snapshot.community, null);
  assert.deepEqual(h.session.snapshot.units, []);
});
test("401 clears identity; a 503 retains the last loaded workspace and exposes connection state", async () => {
  const h = harness();
  await h.session.signIn("Test Resident");
  h.fail("/v1/communities/society-a/visitor-entries", 503);
  await assert.rejects(() => h.session.refresh());
  assert.ok(h.session.snapshot.community);
  assert.match(h.session.snapshot.error!, /Connection interrupted/);
  h.fail("/v1/notifications", 401);
  await assert.rejects(() => h.session.request("/v1/notifications"));
  assert.equal(h.session.snapshot.user, null);
  assert.equal(h.session.snapshot.community, null);
});
