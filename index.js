// index.js  ──────────────────────────────────────────────────────────
const express     = require('express');
const puppeteer   = require('puppeteer');
const cloudinary  = require('cloudinary').v2;
const streamifier = require('streamifier');

const app  = express();
const PORT = process.env.PORT || 8080;

/* ------------ Cloudinary init (unchanged) ------------ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ------------ keep dyno warm every 5 min via cron ------------ */
app.get('/ping', (_, res) => res.sendStatus(200));

/* ------------ launch one browser when the process starts ------------ */
const browserPromise = puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
  ],
  timeout: 0,
});

/* ------------ helper: screenshot & upload one page ------------ */
async function snapAndUpload({ url, public_id }) {
  const browser = await browserPromise;
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const element = (await page.$('.waffle')) || page;     // fallback if class not found
  const buf = await element.screenshot();
  await page.close();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id,
        folder: 'screenshots',
        overwrite: true,
        invalidate: true,
      },
      (err, result) => {
        if (err) return reject(err);
        const staticUrl =
          `https://res.cloudinary.com/${cloudinary.config().cloud_name}` +
          `/image/upload/screenshots/${public_id}.png`;
        resolve(staticUrl);
      }
    );
    streamifier.createReadStream(buf).pipe(stream);
  });
}

/* ------------ pool: run up to 5 jobs in parallel ------------ */
async function runPool(jobs, concurrency = 5) {
  const results = [];
  let i = 0;
  while (i < jobs.length) {
    const slice = jobs.slice(i, i + concurrency).map(snapAndUpload);
    results.push(...(await Promise.all(slice)));
    i += concurrency;
  }
  return results;
}

/* ------------ main route (same query params as before) ------------ */
app.get('/', async (req, res) => {
  const { url, public_id } = req.query;
  if (!url || !public_id) {
    return res.status(400).send('❌ Missing ?url or ?public_id parameter');
  }

  try {
    const [imageUrl] = await runPool([{ url, public_id }]);
    res.json({ status: 'success', image_url: imageUrl });
  } catch (err) {
    console.error('🔥 Error:', err.message);
    res.status(500).send('❌ ' + err.message);
  }
});

/* ------------ start server ------------ */
app.listen(PORT, () => {
  console.log('🚀 Puppeteer API listening on', PORT);
});
