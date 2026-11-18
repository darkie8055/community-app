const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const { mkdirSync } = require("node:fs");
async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(process.env.MOBILE_PREVIEW_URL || "http://127.0.0.1:8080/");
    const setup = page.getByText("Your community is not connected yet", {
      exact: true,
    });
    const login = page.getByText("Send verification code", { exact: true });
    const onboarding = page.getByText("Welcome to My Home", { exact: true });
    const demo = page
      .getByText("Demo · Sample data", { exact: true })
      .or(onboarding);
    await setup.or(login).or(demo).first().waitFor({ timeout: 60000 });
    const isDemo = await demo.isVisible();
    if (process.env.APP_MODE === "live") assert.equal(isDemo, false);
    if (isDemo && (await onboarding.isVisible())) {
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await page
        .getByRole("button", { name: "View More", exact: true })
        .waitFor();
    } else if (isDemo)
      await page
        .getByRole("button", { name: /^Switch to (guard|resident)$/ })
        .waitFor();
    assert.deepEqual(errors, []);
    const output = path.resolve(__dirname, "../../.local/logs");
    mkdirSync(output, { recursive: true });
    await page.screenshot({
      path: path.join(
        output,
        isDemo
          ? "demo-preview.png"
          : (await setup.count())
            ? "setup-required.png"
            : "phone-login.png",
      ),
    });
    console.log(
      `PASS React Native preview: ${isDemo ? "local demo" : "live sign-in/setup"} renders without errors`,
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
