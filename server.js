const express = require('express');
const puppeteer = require('puppeteer');
const proxy = require('express-http-proxy');

const RENDER_CACHE = new Map();

async function ssr(url) {
  console.log('ssr,', url);
  if (RENDER_CACHE.has(url)) {
    console.log('From cache');
    return {html: RENDER_CACHE.get(url), ttRenderMs: 0};
  }

  const start = Date.now();

  const browser = await puppeteer.launch({headless: true,args: ['--no-sandbox']});

  const page = await browser.newPage();
  try {
    await page.goto(url, {waitUntil: 'networkidle0'});
    await page.waitForSelector('.navheader'); // ensure nav is loaded
  } catch (err) {
    console.error(err);
    throw new Error('page.goto/waitForSelector timed out.');
    await browser.close();
    return null;
  }

  const html = await page.content();
  await browser.close();

  const ttRenderMs = Date.now() - start;
  console.info(`Headless rendered page in: ${ttRenderMs}ms`);

  RENDER_CACHE.set(url, html);
  return {html, ttRenderMs};
}

const app = express();

app.get('/mobil/mobiltelefoner/*', async (req, res, next) => {
  const params = req.params ? req.params[0] : '';
  if (params.includes('favicon') || params.includes('undefined')) {
    console.log('Return 404 on favicon and undefined, as they take up browser');

    return res.status(404).send('No content');
  }
  const {html, ttRenderMs} = await ssr('https://yousee.dk/mobil/mobiltelefoner/' + params);
  res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Headless render time (ms)"`);
  return res.status(200).send(html);
});

app.use('/', proxy('https://yousee.dk/'));

app.listen(3001, () => console.log('Wicked?'));
