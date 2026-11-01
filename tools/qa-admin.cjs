const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { randomUUID, randomBytes } = require("node:crypto");
const { mkdirSync, createWriteStream } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

// Runs against its own PostgreSQL data directory. Never resets the preview DB.
const root = path.resolve(__dirname, "..");
const apiBase = "http://127.0.0.1:4001/v1";
const community = "937540ee-54e4-424f-85c6-a4db3d06a18a";
const unit = "4060fc1c-f148-4e50-8cde-1671ea052607";
mkdirSync(path.join(root, "tmp"), { recursive: true });
const log = createWriteStream(path.join(root, "tmp/qa-api.log"));
const child = spawn(
  process.execPath,
  ["-r", "ts-node/register/transpile-only", "src/main.ts"],
  {
    cwd: path.join(root, "apps/api"),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: "4001",
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      DB_MODE: "embedded",
      PGLITE_PATH: path.join(root, "tmp", `qa-db-${Date.now()}`),
      JWT_SECRET: randomBytes(32).toString("hex"),
      DEMO_MODE: "true",
      SEED_DEMO: "true",
      REDIS_URL: "",
      FCM_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.pipe(log);
child.stderr.pipe(log);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(route, token, body, method = "POST", headers = {}) {
  const result = await fetch(`${apiBase}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json();
  assert.ok(result.ok, `${method} ${route}: ${JSON.stringify(data)}`);
  return data;
}
async function main() {
  let ready = false;
  for (let i = 0; i < 240; i++) {
    try {
      if ((await fetch(`${apiBase}/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null)
      throw new Error("QA API failed: see tmp/qa-api.log");
    await delay(500);
  }
  assert.ok(ready, "QA API started");
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("http://127.0.0.1:4000/v1/**", async (route) => {
      const response = await route.fetch({
        url: route.request().url().replace(":4000/", ":4001/"),
      });
      await route.fulfill({ response });
    });
    await page.goto("http://127.0.0.1:3000");
    await page
      .getByRole("button", { name: "Sign in to your community" })
      .click();
    await page
      .getByRole("heading", { name: "A good day for your community." })
      .waitFor();
    await page.getByText("Neha Kapoor", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(root, "screenshots/admin-dashboard.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByText("No membership requests waiting for you.").waitFor();
    console.log("PASS admin login and resident membership approval");

    await page
      .getByRole("button", { name: "Society & homes", exact: true })
      .click();
    await page.getByRole("button", { name: "Add block", exact: true }).click();
    await page.getByLabel("Block name").fill("E");
    await page
      .getByRole("button", { name: "Create block", exact: true })
      .click();
    await page.getByRole("button", { name: "Tower E" }).click();
    await page.getByRole("button", { name: "Add floor", exact: true }).click();
    await page.getByLabel("Floor number").fill("1");
    await page
      .getByRole("button", { name: "Create floor", exact: true })
      .click();
    await page.getByRole("button", { name: "Add flat", exact: true }).click();
    await page
      .locator('select[name="floor_id"]')
      .selectOption({ label: "E · Floor 1" });
    await page.getByLabel("Flat label").fill("E-101");
    await page
      .getByRole("button", { name: "Create flat", exact: true })
      .click();
    await page.getByText("E-101", { exact: true }).waitFor();
    console.log("PASS create block, floor and flat");

    const guard = (await api("/auth/demo", null, { role: "guard" }))
      .access_token;
    const resident = (await api("/auth/demo", null, { role: "resident" }))
      .access_token;
    const route = `/communities/${community}/visitor-entries`;
    const visit = await api(
      route,
      guard,
      {
        name: "QA Journey Visitor",
        phone: "9876543210",
        unit_id: unit,
        type: "guest",
      },
      "POST",
      { "Idempotency-Key": randomUUID() },
    );
    assert.equal(visit.status, "pending");
    await api(`${route}/${visit.id}/decision`, resident, {
      decision: "approved",
    });
    await api(`${route}/${visit.id}/check-in`, guard);
    const exited = await api(`${route}/${visit.id}/check-out`, guard);
    assert.equal(exited.status, "exited");
    const notifications = await api("/notifications", resident, null, "GET");
    assert.ok(notifications.some((n) => n.entry_id === visit.id));
    await api("/notifications/read", resident);
    assert.ok(
      (await api("/notifications", resident, null, "GET")).every(
        (n) => n.read_at,
      ),
    );
    await page
      .getByRole("button", { name: "Visitor logs", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search visitors" })
      .fill("QA Journey Visitor");
    await page.getByRole("row", { name: "View QA Journey Visitor" }).click();
    await page
      .getByRole("dialog")
      .getByText("Checked out", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export loaded visits" }).click();
    await (
      await downloadPromise
    ).saveAs(path.join(root, "tmp/qa-visitors.csv"));
    console.log(
      "PASS visitor lifecycle, inbox/read status, searchable admin timeline and CSV export",
    );

    const adminSession = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mycommunity.admin")),
    );
    const services = await api(
      `/communities/${community}/items?kind=service`,
      resident,
      null,
      "GET",
    );
    const booking = await api(
      `/communities/${community}/items/${services.items[0].id}/requests`,
      resident,
      {
        unit_id: unit,
        scheduled_on: new Date(Date.now() + 86400000)
          .toISOString()
          .slice(0, 10),
        note: "QA request",
      },
    );
    await page
      .getByRole("button", { name: "Service requests", exact: true })
      .click();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    assert.equal(
      (
        await api(
          `/communities/${community}/service-requests`,
          resident,
          null,
          "GET",
        )
      ).find((r) => r.id === booking.id).status,
      "completed",
    );
    await page
      .getByRole("button", { name: "Community & listings", exact: true })
      .click();
    await page.getByRole("button", { name: "Notices", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish notice", exact: true })
      .click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("QA Notice from admin");
    await page
      .getByLabel("Description", { exact: true })
      .fill("This notice is visible in the resident app.");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Publish", exact: true })
      .click();
    await page.getByText("QA Notice from admin", { exact: true }).waitFor();
    assert.ok(
      (
        await api(
          `/communities/${community}/items?kind=notice`,
          resident,
          null,
          "GET",
        )
      ).items.some((i) => i.title === "QA Notice from admin"),
    );
    await page
      .getByRole("button", { name: "Security team", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Assign staff", exact: true })
      .first()
      .click();
    await page.getByLabel("Name", { exact: true }).fill("QA Security Guard");
    await page.getByLabel("Mobile number", { exact: true }).fill("9876543298");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Assign staff", exact: true })
      .click();
    assert.ok(
      (
        await api(
          `/communities/${community}/memberships`,
          adminSession.token,
          null,
          "GET",
        )
      ).some((m) => m.name === "QA Security Guard" && m.role === "guard"),
    );
    console.log(
      "PASS service booking confirmation/completion, notices and staff assignment",
    );
    await page.getByRole("button", { name: "Manage societies" }).click();
    await page
      .getByRole("button", { name: "Create society", exact: true })
      .click();
    await page.getByLabel("Society name").fill("QA Courtyard");
    await page.getByLabel("Address", { exact: true }).fill("12 Test Avenue");
    await page.getByLabel("City", { exact: true }).fill("Bengaluru");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create society" })
      .click();
    await page.getByText("Add a floor, then create the flats on it.").waitFor();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page
      .locator(".stat-card")
      .first()
      .locator("strong")
      .filter({ hasText: /^0$/ })
      .waitFor();
    assert.equal(
      await page.getByRole("row", { name: "View QA Journey Visitor" }).count(),
      0,
    );
    await page.getByLabel("Select society").selectOption(community);
    await page
      .locator(".stat-card")
      .first()
      .locator("strong")
      .filter({ hasText: /^41$/ })
      .waitFor();
    console.log("PASS society creation and tenant switch without stale data");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(root, "screenshots/admin-mobile.png"),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "No mobile horizontal overflow",
    );
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("button", { name: "Activity log", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "A clear record. A little reassurance." })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log("PASS responsive navigation and no browser runtime errors");
  } finally {
    await browser.close();
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    child.kill();
    log.end();
  });
