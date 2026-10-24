import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

// Set PLAYWRIGHT_MODULE to an existing local installation; no package download.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.TEST_OUTPUT || '/tmp/x15-browser';
await mkdir(output, { recursive: true });
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const base = 'https://x15.local.test';
async function serve(page) { await page.route('**/*', async route => {
  try {
    const request = new URL(route.request().url());
    assert.equal(request.origin, base);
    const pathname = request.pathname;
    const file = resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    assert(file.startsWith(root + '/'));
    await route.fulfill({ contentType: mime[extname(file)] || 'application/octet-stream', body: await readFile(file) });
  } catch { await route.fulfill({ status: 404, body: '' }); }
}); }
const url = `${base}/blog/werkstattbericht-3d-organe-schritt-fuer-schritt/`;
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await serve(page);
  const requests = [];
  const errors = [];
  page.on('request', req => requests.push(req.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForTimeout(1900);
  assert.equal(requests.filter(x => /vendor\/three|\.glb|organ-viewer.js/.test(x)).length, 0, 'No heavy offscreen loads');
  const first = page.locator('[data-organ-viewer]').first();
  await first.scrollIntoViewIfNeeded();
  await first.locator('canvas').waitFor({ timeout: 20000 });
  assert.equal(await first.locator('.organ-poster').isVisible(), false);
  const before = await first.locator('canvas').screenshot();
  await page.waitForTimeout(800);
  const after = await first.locator('canvas').screenshot();
  assert(!before.equals(after), 'Auto rotation changes the rendered frame');
  await first.locator('[data-rotate]').click();
  const paused = await first.locator('canvas').screenshot();
  await page.waitForTimeout(400);
  assert(paused.equals(await first.locator('canvas').screenshot()), 'Pause stops rotation');
  await page.locator('.organ-card').first().screenshot({ path: `${output}/desktop-heart.png` });
  const ids = await page.locator('.organ-card').evaluateAll(nodes => nodes.map(n => n.id));
  for (const id of ids) {
    const card = page.locator(`#${id}`);
    await card.locator('[data-organ-viewer]').scrollIntoViewIfNeeded();
    const button = card.locator('[data-load]');
    if (await button.isVisible() && await button.isEnabled()) await button.click();
    await card.locator('canvas').waitFor({ timeout: 20000 });
    await card.screenshot({ path: `${output}/${id}.png` });
  }
  assert.equal(requests.filter(x => x.endsWith('.glb')).length, 6);
  assert.deepEqual(errors, []);
  assert(requests.every(x => x.startsWith(base) || x.startsWith('blob:')), 'No CDN requests');
  for (const slug of ['digital-health-twin-unsere-idee', 'health-graph-engine-des-dht', 'mitbauen-wie-nutzer-den-dht-mitgestalten']) {
    await page.goto(`${base}/blog/${slug}/`);
    const nodes = await page.locator('script[type="application/ld+json"]').textContent();
    const graph = JSON.parse(nodes)['@graph'];
    assert(graph.some(x => x['@type'] === '3DModel'));
    assert(graph.some(x => x['@type'] === 'ImageObject'));
    assert((await page.locator('meta[property="og:image"]').getAttribute('content')).includes('/anatomy/og/'));
    if (slug.startsWith('health-graph')) assert.equal(await page.locator('img[src="/images/blog/healthgraph-panel-1440.jpg"]').count(), 1);
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await serve(mobile);
  const mobileRequests = [];
  mobile.on('request', req => mobileRequests.push(req.url()));
  await mobile.goto(url);
  const mobileViewer = mobile.locator('[data-organ-viewer]').first();
  await mobileViewer.scrollIntoViewIfNeeded();
  await mobile.waitForTimeout(2000);
  assert.equal(mobileRequests.filter(x => /vendor\/three|\.glb/.test(x)).length, 0, 'Reduced motion requires click');
  await mobileViewer.locator('[data-load]').click();
  await mobileViewer.locator('canvas').waitFor();
  assert.equal(await mobileViewer.locator('[data-rotate]').isDisabled(), true);
  const still = await mobileViewer.locator('canvas').screenshot();
  await mobile.waitForTimeout(500);
  assert(still.equals(await mobileViewer.locator('canvas').screenshot()));
  await mobileViewer.locator('canvas').focus();
  await mobile.keyboard.press('ArrowRight');
  assert(!still.equals(await mobileViewer.locator('canvas').screenshot()), 'Keyboard rotates');
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.locator('.organ-card').first().screenshot({ path: `${output}/mobile-heart.png` });
  const broken = await browser.newPage({ reducedMotion: 'reduce' });
  await serve(broken);
  await broken.route('**/*.glb', route => route.abort());
  await broken.goto(url);
  const fallback = broken.locator('[data-organ-viewer]').first();
  await fallback.locator('[data-load]').click();
  await fallback.locator('[data-load]').filter({ hasText: 'erneut' }).waitFor();
  assert(await fallback.locator('.organ-poster').isVisible());
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await serve(noJS);
  await noJS.goto(url);
  assert.equal(await noJS.locator('.organ-poster').count(), 6);
  assert.equal(await noJS.locator('[data-load]:visible').count(), 0);
  console.log('PASS: six models, lazy/idle/click, rotation/pause, reduced motion, keyboard, mobile, fallback, no-JS, JSON-LD, OG, preserved image, local requests.');
} finally {
  await browser?.close();
}
