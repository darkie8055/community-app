import { test } from "node:test";
import assert from "node:assert/strict";
import { PhoneSignInFlow } from "../src/phone-sign-in";
import { Session } from "../src/api";

test("Android automatic verification completes without requiring an SMS code", async () => {
  let verified!: () => void;
  let completes = 0;
  let stopped = 0;
  const flow = new PhoneSignInFlow({
    observe: async (_phone, callback) => {
      verified = callback;
      return () => {
        stopped++;
      };
    },
    send: async () => {
      verified();
      return {
        confirm: async () => {
          throw new Error("Should not need an OTP");
        },
      };
    },
    complete: async (name) => {
      assert.equal(name, "Test Resident");
      completes++;
    },
    onError: (error) => {
      throw error;
    },
    onCompleting: () => {},
  });
  assert.equal(await flow.start("Test Resident", "9876543210"), false);
  await flow.confirm("123456");
  assert.equal(completes, 1);
  assert.equal(stopped, 1);
});
test("automatic verification and explicit OTP confirmation share one completion", async () => {
  let verified!: () => void;
  let completes = 0;
  const flow = new PhoneSignInFlow({
    observe: async (_phone, callback) => {
      verified = callback;
      return () => {};
    },
    send: async () => ({
      confirm: async () => {
        verified();
      },
    }),
    complete: async () => {
      completes++;
    },
    onError: (error) => {
      throw error;
    },
    onCompleting: () => {},
  });
  assert.equal(await flow.start("Test Resident", "9876543210"), true);
  await flow.confirm("123456");
  assert.equal(completes, 1);
});
test("unmount cancels delayed observer setup and prevents sign-in", async () => {
  let release!: (stop: () => void) => void;
  let stopped = 0;
  let sends = 0;
  const flow = new PhoneSignInFlow({
    observe: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    send: async () => {
      sends++;
      return { confirm: async () => {} };
    },
    complete: async () => {
      throw new Error("Cancelled attempt completed");
    },
    onError: (error) => {
      throw error;
    },
    onCompleting: () => {},
  });
  const pending = flow.start("Test Resident", "9876543210");
  flow.cancel();
  release(() => {
    stopped++;
  });
  assert.equal(await pending, false);
  assert.equal(stopped, 1);
  assert.equal(sends, 0);
});
test("logout while Firebase is retrieving a token cannot restore the session", async () => {
  let release!: (token: string) => void;
  let calls = 0;
  const session = new Session(
    "https://test.invalid",
    "resident",
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    async () => {
      calls++;
      return new Response("{}");
    },
  );
  const pending = session.signIn("Test Resident");
  session.clear();
  release("old-token");
  await assert.rejects(pending, /session changed/);
  assert.equal(calls, 0);
  assert.equal(session.snapshot.user, null);
});
test("a newer sign-in supersedes a pending older identity", async () => {
  const releases: ((token: string) => void)[] = [];
  const tokens: string[] = [];
  const session = new Session(
    "https://test.invalid",
    "resident",
    () => new Promise((resolve) => releases.push(resolve)),
    async (input, init) => {
      if (String(input).endsWith("/auth/firebase")) {
        const token = JSON.parse(String(init?.body)).id_token;
        tokens.push(token);
        return new Response(
          JSON.stringify({
            access_token: "jwt",
            user: { sub: token, name: "New User", phone: "9876543210" },
          }),
        );
      }
      return new Response("[]");
    },
  );
  const old = session.signIn("Old User");
  const fresh = session.signIn("New User");
  releases[0]("old");
  await assert.rejects(old, /session changed/);
  releases[1]("fresh");
  await fresh;
  assert.deepEqual(tokens, ["fresh"]);
  assert.equal(session.snapshot.user?.sub, "fresh");
});
