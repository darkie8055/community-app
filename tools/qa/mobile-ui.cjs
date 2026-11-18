const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../.."),
  mobile = path.join(root, "apps/mobile"),
  output = path.join(root, ".local/mobile-ui");
async function main() {
  const pkg = path.join(mobile, "package.json"),
    original = fs.readFileSync(pkg, "utf8");
  try {
    const config = JSON.parse(original);
    config.main = "test/ui-entry.tsx";
    fs.writeFileSync(pkg, JSON.stringify(config, null, 2));
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
      { cwd: mobile, encoding: "utf8" },
    );
    if (run.status !== 0) throw new Error(run.stderr + "\n" + run.stdout);
  } finally {
    fs.writeFileSync(pkg, original);
  }
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
    const ext = path.extname(resolved);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".ttf": "font/ttf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
      }[ext] || "application/octet-stream",
    );
    fs.createReadStream(resolved).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin);
    await page.getByText("At your gate", { exact: true }).waitFor();
    fs.mkdirSync(path.join(root, ".local/logs"), { recursive: true });
    await page.screenshot({
      path: path.join(root, ".local/logs/react-native-resident.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Approve entry", exact: true })
      .click();
    await page.getByText("You’re all caught up", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Invite guest", exact: true })
      .click();
    await page
      .getByLabel("Visitor name", { exact: true })
      .fill("Invited Test Guest");
    await page
      .getByLabel("Mobile number · +91", { exact: true })
      .fill("9876543210");
    await page
      .getByRole("button", { name: "Pre-approve visitor", exact: true })
      .click();
    await page.getByText("Visit timeline", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Visitor QR pass", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Generate QR pass", exact: true })
      .click();
    await page.getByText("ABCD-2345-EFGH", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(root, ".local/logs/react-native-pass.png"),
    });
    const png = require("pngjs").PNG.sync.read(
      fs.readFileSync(path.join(root, ".local/logs/react-native-pass.png")),
    );
    const decoded = require("jsqr")(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    assert.equal(
      decoded?.data,
      "myhome://pass/v1?community=11111111-1111-4111-8111-111111111111&code=ABCD2345EFGH",
    );
    await page.getByRole("tab", { name: "Homes", exact: true }).click();
    await page.getByText("Test property", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Open Test property", exact: true })
      .click();
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await page
      .getByRole("button", { name: "Remove from saved", exact: true })
      .waitFor();
    await page.getByRole("tab", { name: "Buy & Sell", exact: true }).click();
    await page.getByText("Test listing", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Sell something", exact: true })
      .click();
    await page.getByLabel("Title", { exact: true }).fill("A test listing");
    await page
      .getByLabel("Description", { exact: true })
      .fill("A test description");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByText("A test listing", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Community", exact: true }).click();
    await page.getByRole("button", { name: "Open Test notice", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Resident directory", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Society team", exact: true })
      .click();
    await page.getByText("Test Guard", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.getByRole("button", { name: "Posts", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Test post", exact: true })
      .click();
    await page
      .getByLabel("Your comment", { exact: true })
      .fill("Hello test neighbours");
    await page
      .getByRole("button", { name: "Add a comment", exact: true })
      .click();
    await page.getByText("Hello test neighbours", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Stores", exact: true }).click();
    await page
      .getByRole("button", { name: "Open Test service", exact: true })
      .click();
    await page
      .getByLabel("Preferred date (YYYY-MM-DD)", { exact: true })
      .fill("2027-01-10");
    await page
      .getByLabel("Service requirements", { exact: true })
      .fill("Test request");
    await page
      .getByRole("button", { name: "Request a service", exact: true })
      .click();
    await page.goto(origin + "?role=guard");
    await page
      .getByText("A safe community starts here.", { exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(root, ".local/logs/react-native-guard.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Scan QR / verify visitor code",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Visitor code", { exact: true })
      .fill("ABCD-2345-EFGH");
    await page
      .getByRole("button", { name: "Verify pass", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record entry", exact: true })
      .click();
    await page.getByText("Status: inside", { exact: true }).waitFor();
    await page.goto(origin + "?login");
    await page.getByText("You’re home.", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(root, ".local/logs/react-native-login.png"),
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS React Native resident/guard navigation, approvals, invitations, QR generation, catalog, comments, service requests, guard verification, login rendering",
    );
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
