const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const mobile = path.join(root, "apps/mobile");
const output = path.join(root, ".local/demo-ui");
const logs = path.join(root, ".local/logs");

async function main() {
  const packageFile = path.join(mobile, "package.json");
  const originalPackage = fs.readFileSync(packageFile, "utf8");
  assert.equal(JSON.parse(originalPackage).main, "index.js");
  const run = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/expo/bin/cli"),
      "export",
      "--platform",
      "web",
      "--output-dir",
      output,
    ],
    {
      cwd: mobile,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        APP_MODE: "demo",
        APP_VARIANT: "resident",
        EXPO_NO_TELEMETRY: "1",
      },
    },
  );
  if (run.status !== 0)
    throw new Error(run.error?.message || run.stderr + "\n" + run.stdout);
  assert.equal(fs.readFileSync(packageFile, "utf8"), originalPackage);
  const server = http.createServer((req, res) => {
    const file = path.resolve(
      output,
      "." + new URL(req.url, "http://localhost").pathname,
    );
    if (!file.startsWith(output + path.sep) && file !== output) {
      res.writeHead(403).end();
      return;
    }
    const resolved =
      fs.existsSync(file) && fs.statSync(file).isDirectory()
        ? path.join(file, "index.html")
        : file;
    if (!fs.existsSync(resolved)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".ttf": "font/ttf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
      }[path.extname(resolved)] || "application/octet-stream",
    );
    fs.createReadStream(resolved).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let page;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const externalRequests = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) {
        externalRequests.push(
          `${route.request().method()} ${url.origin}${url.pathname}`,
        );
        return route.abort();
      }
      return route.continue();
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.accept());
    const button = (name) => page.getByRole("button", { name, exact: true });
    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const text = (value) =>
      page.getByText(value, { exact: true }).filter({ visible: true });
    await page.goto(origin);
    fs.mkdirSync(logs, { recursive: true });
    await text("Welcome to My Home").waitFor();
    await page.screenshot({ path: path.join(logs, "my-home-onboarding.png") });
    await button("Continue").click();
    await text("Know who’s at the gate").waitFor();
    await button("Back").click();
    await button("Continue").click();
    await button("Continue").click();
    await button("Enter My Home").click();
    await text("At your gate").waitFor();
    await page.screenshot({ path: path.join(logs, "demo-resident.png") });
    await button("View More").click();
    await button("Society bills").waitFor();
    await page.screenshot({ path: path.join(logs, "my-home-features.png") });
    const search = page.getByLabel("Search features", { exact: true });
    await search.fill("unmatched feature");
    await text("No matching features").waitFor();
    await search.fill("amenities");
    await button("Amenities").click();
    const bookingDay = new Date();
    bookingDay.setDate(bookingDay.getDate() + 1);
    const nextDay = [
      bookingDay.getFullYear(),
      String(bookingDay.getMonth() + 1).padStart(2, "0"),
      String(bookingDay.getDate()).padStart(2, "0"),
    ].join("-");
    await page.getByLabel("Date (YYYY-MM-DD)", { exact: true }).fill(nextDay);
    await button("Reserve slot").click();
    await text(nextDay + " · 9–10 am").waitFor();
    await button("Go back").click();
    await search.fill("pets");
    await button("My pets").click();
    await page.getByLabel("Pet name", { exact: true }).fill("Mango");
    await button("Add pet").click();
    await text("Mango").waitFor();
    await button("Go back").click();
    await button("My pets").click();
    await text("Mango").waitFor();
    await tab("Social").click();

    const approvals = button("Approve entry");
    const initialApprovals = await approvals.count();
    assert.ok(
      initialApprovals > 0,
      "The demo includes an actionable visitor approval",
    );
    await approvals.first().click();
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll('[aria-label="Approve entry"]').length ===
        count,
      initialApprovals - 1,
    );

    await button("Invite guest").click();
    await page
      .getByLabel("Visitor name", { exact: true })
      .fill("Presentation Guest");
    await page
      .getByLabel("Mobile number · +91", { exact: true })
      .fill("9876543210");
    await button("Pre-approve visitor").click();
    await text("Visit timeline").waitFor();
    await button("Visitor QR pass").click();
    await button("Generate QR pass").click();
    const codeLocator = page.getByText(
      /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/,
    );
    await codeLocator.waitFor();
    const passCode = (await codeLocator.textContent()).trim();
    await codeLocator.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(logs, "demo-pass.png") });
    const png = require("pngjs").PNG.sync.read(
      fs.readFileSync(path.join(logs, "demo-pass.png")),
    );
    const qr = require("jsqr")(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    assert.ok(qr?.data.startsWith("myhome://pass/v1?community="));
    assert.equal(
      new URL(qr.data).searchParams.get("code"),
      passCode.replaceAll("-", ""),
    );

    await tab("Homes").click();
    await button("Open A bright 2 BHK overlooking the garden").click();
    await button("Remove from saved").click();
    await button("Save item").click();
    await button("Remove from saved").waitFor();

    await tab("Buy & Sell").click();
    await button("Sell something").click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Presentation bookshelf");
    await page
      .getByLabel("Description", { exact: true })
      .fill("A locally saved sample listing for the team walkthrough.");
    await button("Save draft").click();
    await button("My listings").click();
    await button("Open Presentation bookshelf").click();
    await button("Publish listing").click();
    await button("Mark unavailable").waitFor();

    await tab("Community").click();
    await button("Resident directory").waitFor();
    await page.screenshot({ path: path.join(logs, "my-home-community.png") });
    await button("Posts").click();
    await button("Open Anyone up for an evening walking group?").click();
    await page
      .getByLabel("Your comment", { exact: true })
      .fill("Looking forward to meeting our neighbours!");
    await button("Add a comment").click();
    await text("Looking forward to meeting our neighbours!").waitFor();

    await tab("Stores").click();
    const serviceButton = button("Open Home deep cleaning");
    const serviceName = (
      await serviceButton.getAttribute("aria-label")
    ).replace(/^Open /, "");
    await serviceButton.click();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await page
      .getByLabel("Preferred date (YYYY-MM-DD)", { exact: true })
      .fill(date);
    await page
      .getByLabel("Service requirements", { exact: true })
      .fill("Presentation service request");
    await button("Request a service").click();
    await button("My profile").click();
    await button("Your activity").click();
    await text(serviceName).first().waitFor();
    await button("Cancel request").first().click();
    await text("Status: cancelled").first().waitFor();

    await button("My profile").click();
    await button("Switch to guard").first().click();
    await text("A safe community starts here.").waitFor();
    await page.screenshot({ path: path.join(logs, "demo-guard.png") });
    await button("Scan QR / verify visitor code").click();
    await page.getByLabel("Visitor code", { exact: true }).fill(passCode);
    await button("Verify pass").click();
    await text("Presentation Guest").waitFor();
    await button("Record entry").click();
    await text("Status: inside").waitFor();

    await button("My profile").click();
    await button("Reset demo data").click();
    await text("A safe community starts here.").waitFor();
    await tab("Visitors").click();
    await page
      .getByRole("textbox", { name: "Search visitors", exact: true })
      .fill("Presentation Guest");
    await text("No visitors found").waitFor();
    await button("My profile").click();
    await button("Sign out").click();
    await button("Open resident demo").click();
    await text("At your gate").waitFor();
    assert.ok(
      (await button("Approve entry").count()) > 0,
      "Reset restores the original approval",
    );
    assert.deepEqual(errors, [], "Demo must not raise browser runtime errors");
    assert.deepEqual(
      externalRequests,
      [],
      "Demo must not contact remote providers",
    );
    assert.equal(fs.readFileSync(packageFile, "utf8"), originalPackage);
    console.log(
      "PASS credential-free production demo: local-only data, approvals, invites/QR, saved homes, draft/publish, comments, service requests, shared resident/guard check-in, reset and sign-out",
    );
  } catch (error) {
    if (page) {
      fs.mkdirSync(logs, { recursive: true });
      await page
        .screenshot({ path: path.join(logs, "demo-failure.png") })
        .catch(() => {});
    }
    throw error;
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
