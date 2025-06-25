const puppeteer   = require("puppeteer");
const express     = require("express");
const cloudinary  = require("cloudinary").v2;
const streamifier = require("streamifier");
const crypto      = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("❌ Missing ?url parameter");

  // 1) Derive a stable public_id from the URL (SHA1 hash)
  const hash = crypto.createHash("sha1").update(url).digest("hex");
  const publicId = `screenshots/${hash}`;

  try {
    // 2) Render the page and screenshot the .waffle element
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(".waffle", { timeout: 10000 });
    const element = await page.$(".waffle");
    const screenshotBuffer = await element.screenshot();
    await browser.close();

    // 3) Upload with overwrite & invalidate, using stable public_id
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id:      publicId,
        overwrite:      true,
        invalidate:     true,
        resource_type:  "image"
      },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload failed:", error);
          return res.status(500).send("❌ Upload failed: " + error.message);
        }
        // 4) Generate a permanent URL without the version segment
        const permanentUrl = cloudinary.url(publicId, {
          secure: true,
          version: false,
          format: "png"  // ensure the .png extension
        });
        console.log("✅ Overwritten:", permanentUrl);
        res.json({ status: "success", image_url: permanentUrl });
      }
    );

    // 5) Pipe the screenshot buffer into Cloudinary
    streamifier.createReadStream(screenshotBuffer).pipe(uploadStream);

  } catch (err) {
    console.error("❌ Screenshot failed:", err);
    res.status(500).send("❌ Screenshot failed: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
