import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsRole,
  expired,
  formatCode,
  parsePass,
  passPayload,
} from "../src/domain";

test("QR and printed codes round-trip without changing their community", () => {
  const pass = {
    entry_id: "entry",
    community_id: "society-a",
    code: "ABCD2345EFGH",
    expires_at: "2026-11-10T10:00:00Z",
  };
  assert.equal(parsePass(passPayload(pass), "society-a"), pass.code);
  assert.equal(parsePass(passPayload(pass).replace("myhome:", "mycommunity:"), "society-a"), pass.code);
  assert.equal(parsePass(" abcd-2345 efgh ", "society-a"), pass.code);
  assert.equal(formatCode(pass.code), "ABCD-2345-EFGH");
  assert.equal(expired(pass, Date.parse(pass.expires_at)), true);
  assert.equal(expired(pass, Date.parse(pass.expires_at) - 1), false);
});
test("QR rejects wrong societies, foreign URLs, duplicate parameters, credentials and ambiguous codes", () => {
  const url = "myhome://pass/v1?community=society-a&code=ABCD2345EFGH";
  assert.throws(() => parsePass(url, "society-b"), /different society/);
  for (const input of [
    url.replace("myhome:", "https:"),
    url + "&code=ABCD2345EFGH",
    url + "&community=society-a",
    url + "#fragment",
    url.replace("//pass", "//user@pass"),
    url.replace("//pass", "//pass:99"),
    url.replace("/v1", "/v2"),
    "ABCD0123EFGH",
    "ABCDI234EFGH",
    "ABCD2345EFG",
  ])
    assert.throws(() => parsePass(input, "society-a"));
});
test("resident and guard roles remain separate", () => {
  for (const role of ["owner", "tenant", "family"]) {
    assert.equal(acceptsRole("resident", role), true);
    assert.equal(acceptsRole("guard", role), false);
  }
  for (const role of ["guard", "admin"]) {
    assert.equal(acceptsRole("guard", role), true);
    assert.equal(acceptsRole("resident", role), false);
  }
});
