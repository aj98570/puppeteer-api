const puppeteer = require("puppeteer");
const express = require("express");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const app = express();
const PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/", async (req, res) => {
  const url = req.query.url;
  const publicId = req.query.public_id;

  if (!url || !publicId)
    return res.status(400).send("❌ Missing ?url or ?public_id parameter");

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      timeout: 0,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    // Load faster: wait for minimal events instead of full "networkidle2"
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const element = await page.$(".waffle") || page; // fallback if .waffle not found
    const screenshotBuffer = await element.screenshot();

    await browser.close();

    const cloudStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: "screenshots",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload failed:", error.message);
          return res.status(500).send("❌ Upload failed: " + error.message);
        }

        const staticUrl = `https://res.cloudinary.com/${cloudinary.config().cloud_name}/image/upload/screenshots/${publicId}.png`;
        console.log("✅ Uploaded:", staticUrl);
        res.json({ status: "success", image_url: staticUrl });
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
