const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("❌ Missing ?url parameter");

  try {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/chromium",
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(".waffle", { timeout: 10000 });

    const element = await page.$(".waffle");
    const screenshotBuffer = await element.screenshot({ type: "png" });

    await browser.close();

    res.set("Content-Type", "image/png").send(screenshotBuffer);
  } catch (error) {
    console.error("❌ Screenshot failed:", error.message);
    res.status(500).send("❌ Screenshot failed: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
