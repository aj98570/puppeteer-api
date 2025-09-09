// Re-usable 5-tab Puppeteer pool for fast parallel screenshots
const puppeteer = require('puppeteer');
const upload = require('./upload');     

const browserPromise = puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox']
});

/**
 * jobs = [{ url, public_id }]
 * returns  Array<string>  Cloudinary URLs in same order
 */
module.exports = async function runPool(jobs, concurrency = 5) {
  const browser = await browserPromise;
  const out = [];
  let i = 0;

  while (i < jobs.length) {
    const slice = jobs.slice(i, i + concurrency).map(async j => {
      const page = await browser.newPage();
      await page.goto(j.url, { waitUntil: 'networkidle2', timeout: 0 });
      const buf = await page.screenshot();
      await page.close();
      return upload(buf, j.public_id);
    });
    out.push(...await Promise.all(slice));
    i += concurrency;
  }
  return out;
};
