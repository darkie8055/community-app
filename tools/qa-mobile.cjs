const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes(":4000/v1/") && r.status() >= 400)
        errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    for (const [name, route] of [
      ["social", "/"],
      ["homes", "/homes"],
      ["marketplace", "/marketplace"],
      ["stores", "/stores"],
      ["community", "/community"],
    ]) {
      await page.goto(`http://127.0.0.1:8080/#${route}`);
      await page
        .locator("flt-semantics-placeholder, flt-semantics")
        .first()
        .waitFor({ state: "attached", timeout: 60000 });
      const accessibility = page.locator("flt-semantics-placeholder");
      if (await accessibility.count())
        await accessibility.evaluate((el) => el.click());
      await page.waitForTimeout(3000);
      const text = await page.locator("body").innerText();
      assert.ok(
        !text.includes("Couldn’t load") && !text.includes("couldn’t reach"),
        `Loaded ${name}`,
      );
      assert.ok(
        text
          .toLowerCase()
          .includes(
            {
              social: "quick actions",
              homes: "homes",
              marketplace: "buy & sell",
              stores: "services",
              community: "community actions",
            }[name],
          ),
        `Rendered ${name} content: ${text.slice(0, 500)}`,
      );
      await page.screenshot({
        path: path.join(__dirname, `../screenshots/resident-${name}.png`),
      });
      console.log(`PASS Flutter ${name} screen and connected API`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
