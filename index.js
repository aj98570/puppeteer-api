const puppeteer = require("puppeteer");
const express = require("express");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const app = express();
const PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("❌ Missing ?url parameter");

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
      // ✅ NO executablePath!
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await page.waitForSelector(".waffle", { timeout: 10000 });
    const element = await page.$(".waffle");
    const screenshotBuffer = await element.screenshot();

    await browser.close();

    const cloudStream = cloudinary.uploader.upload_stream(
      { folder: "screenshots" },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload failed:", error.message);
          return res.status(500).send("❌ Upload failed: " + error.message);
        }
        console.log("✅ Uploaded:", result.secure_url);
        res.json({ status: "success", image_url: result.secure_url });
      }
    );

    streamifier.createReadStream(screenshotBuffer).pipe(cloudStream);
  } catch (error) {
    console.error("❌ Screenshot failed:", error.message);
    res.status(500).send("❌ Screenshot failed: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
});
