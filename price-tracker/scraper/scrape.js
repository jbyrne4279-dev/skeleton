#!/usr/bin/env node
// Collects prices, sizes and colours from each retailer and writes
// data/products.json (latest snapshot) and appends to data/history.json.
//
//   npm run scrape                       # everything
//   npm run scrape -- --retailer hm      # one retailer
//   npm run scrape -- --category socks   # one category
//   npm run scrape -- --max 10 --headful --debug
//   npm run scrape -- --refresh-images     # re-shoot images that already exist

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { RETAILERS } from '../lib/retailers.js';
import { CATEGORIES } from '../lib/catalog.js';
import { summarise } from '../lib/stats.js';
import { extractProduct } from './extract.js';
import { mergeRun } from './merge.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');

const args = process.argv.slice(2);
const flag = n => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const MAX_PER_SEARCH = Number(opt('max', 24));
const CONCURRENCY = Number(opt('concurrency', 3));
const DEBUG = flag('debug');
const REFRESH_IMAGES = flag('refresh-images');
const retailers = RETAILERS.filter(r => !opt('retailer') || r.id === opt('retailer'));
const categories = CATEGORIES.filter(c => !opt('category') || c.id === opt('category'));

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function acceptCookies(page) {
  for (const sel of ['#onetrust-accept-btn-handler', 'button:has-text("Accept all")', 'button:has-text("Accept All Cookies")', 'button:has-text("Accept")']) {
    const b = page.locator(sel).first();
    if (await b.isVisible({ timeout: 500 }).catch(() => false)) { await b.click().catch(() => {}); return; }
  }
}

async function productLinks(page, retailer, term) {
  const url = retailer.searchUrl(encodeURIComponent(term));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await acceptCookies(page);
  // Search results lazy-load as you scroll.
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(700);
  }
  const hrefs = await page.$$eval('a[href]', as => as.map(a => a.href));
  const links = [...new Set(hrefs.filter(h => retailer.productLink.test(h)).map(h => h.split('#')[0]))];
  if (DEBUG) await dump(page, `${retailer.id}-search-${term}`);
  return links.slice(0, MAX_PER_SEARCH);
}

// Runs inside the page: sizes, colours and price as a shopper sees them.
function readDom() {
  const txt = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-value') || el.textContent || '').trim();
  const pick = sels => [...document.querySelectorAll(sels)].map(txt).filter(Boolean);
  const priceText = pick('[data-testid*="price" i], [class*="price" i], [itemprop="price"]').find(t => /£\s?\d/.test(t)) || '';
  const m = priceText.match(/£\s?(\d+(?:\.\d{2})?)/);
  return {
    name: document.querySelector('h1')?.textContent?.trim() || '',
    price: m ? parseFloat(m[1]) : NaN,
    sizes: pick([
      'select[id*="size" i] option', 'select[name*="size" i] option',
      '[data-testid*="size" i] button', '[data-testid*="size" i] li', '[data-testid*="size" i] label',
      '[class*="size-selector" i] button', '[class*="sizeSelector" i] button', '[class*="size-list" i] li',
      '[aria-label*="size" i][role="radiogroup"] [role="radio"]', 'fieldset[class*="size" i] label',
    ].join(',')),
    colours: pick([
      '[data-testid*="colour" i] [aria-label]', '[data-testid*="color" i] [aria-label]',
      '[class*="colour-selector" i] [title]', '[class*="colorSelector" i] [title]', '[class*="swatch" i] [aria-label]',
      '[data-testid*="colour" i] [data-value]', 'select[id*="colour" i] option',
      '[class*="selected-colour" i]', '[class*="selectedColour" i]', '[data-testid*="selected-colour" i]',
    ].join(',')),
  };
}

async function scrapeProduct(context, retailer, url, categoryHint) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const [html, dom] = await Promise.all([page.content(), page.evaluate(readDom)]);
    const product = extractProduct(html, { url, retailer: retailer.id, categoryHint, dom });
    if (!product && DEBUG) await dump(page, `${retailer.id}-product-miss`);
    if (product) product.image = await productImage(page, retailer, product);
    return product;
  } catch (e) {
    log(`  ! ${url}: ${e.message.split('\n')[0]}`);
    return null;
  } finally {
    await page.close();
  }
}

// Screenshots the product's main photo as it appears on the retailer's page
// and saves it as a WebP thumbnail: data/images/<retailer>/<hash>.webp.
// Existing images are reused unless --refresh-images is passed.
async function productImage(page, retailer, product) {
  const rel = `data/images/${retailer.id}/${createHash('sha1').update(product.url).digest('hex').slice(0, 16)}.webp`;
  const file = path.join(ROOT, rel);
  if (existsSync(file) && !REFRESH_IMAGES) return rel;
  try {
    await acceptCookies(page);
    // The main photo is the largest image near the top of the page.
    const handle = await page.evaluateHandle(() => {
      const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height; };
      const imgs = [...document.querySelectorAll('img, picture')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width >= 150 && r.height >= 150 && r.top + scrollY < innerHeight * 1.5 && getComputedStyle(el).visibility !== 'hidden';
      });
      return imgs.sort((a, b) => area(b) - area(a))[0] || null;
    });
    let png;
    const el = handle.asElement();
    if (el) {
      await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await el.evaluate(img => img.tagName !== 'IMG' || img.complete || new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000); }));
      png = await el.screenshot({ type: 'png', timeout: 10000 });
    } else if (product.imageUrl) {
      // No usable <img> on screen (e.g. canvas gallery) - fall back to the published photo.
      const res = await page.request.get(product.imageUrl, { timeout: 15000 });
      if (res.ok()) png = await res.body();
    }
    if (!png) return null;
    await mkdir(path.dirname(file), { recursive: true });
    await sharp(png).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
    return rel;
  } catch (e) {
    log(`  ! image for ${product.url}: ${e.message.split('\n')[0]}`);
    return existsSync(file) ? rel : null;
  }
}

async function dump(page, label) {
  const dir = path.join(DATA, 'debug');
  await mkdir(dir, { recursive: true });
  const f = path.join(dir, `${label.replace(/[^a-z0-9-]+/gi, '_')}-${Date.now()}`);
  await writeFile(`${f}.html`, await page.content());
  await page.screenshot({ path: `${f}.png`, fullPage: false }).catch(() => {});
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

async function main() {
  const browser = await chromium.launch({ headless: !flag('headful'), executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1366, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });

  const fresh = [];
  const done = new Set(); // "retailer|category" pairs that returned data this run
  for (const retailer of retailers) {
    for (const category of categories) {
      const seen = new Set();
      for (const term of category.search) {
        const search = await context.newPage();
        let links = [];
        try {
          links = await productLinks(search, retailer, term);
        } catch (e) {
          log(`! ${retailer.name} search "${term}" failed: ${e.message.split('\n')[0]}`);
        } finally {
          await search.close();
        }
        links = links.filter(l => !seen.has(l) && seen.add(l));
        log(`${retailer.name} · ${category.label} · "${term}": ${links.length} product links`);
        const products = (await pool(links, CONCURRENCY, u => scrapeProduct(context, retailer, u, category.id))).filter(Boolean);
        log(`  -> ${products.length} products with a price`);
        for (const p of products) { fresh.push(p); done.add(`${p.retailer}|${p.category}`); }
      }
    }
  }
  await browser.close();

  if (!fresh.length) {
    log('No products scraped - retailers may be blocking the browser. Try --headful --debug. Existing data left untouched.');
    process.exitCode = 1;
    return;
  }

  // Every product ever seen is kept (see merge.js) so the dashboard can show
  // releases over time; categories that failed this run keep their old data.
  const prev = await readJson(path.join(DATA, 'products.json'), { products: [] });
  const today = new Date().toISOString().slice(0, 10);
  const products = mergeRun(prev.sample ? [] : prev.products, fresh, done, today);
  const active = products.filter(p => p.active);
  if (prev.sample) await rm(path.join(DATA, 'images', 'sample'), { recursive: true, force: true });

  await mkdir(DATA, { recursive: true });
  const generatedAt = new Date().toISOString();
  await writeFile(path.join(DATA, 'products.json'), JSON.stringify({ generatedAt, sample: false, products }, null, 1));

  // One history row per retailer x category per day.
  const history = await readJson(path.join(DATA, 'history.json'), { rows: [] });
  const day = generatedAt.slice(0, 10);
  if (history.sample) history.rows = [];
  history.sample = false;
  history.rows = history.rows.filter(r => r.date !== day);
  for (const r of RETAILERS) for (const c of CATEGORIES) {
    const s = summarise(active.filter(p => p.retailer === r.id && p.category === c.id).map(p => p.unitPrice));
    if (s.count) history.rows.push({ date: day, retailer: r.id, category: c.id, count: s.count, avg: +s.avg.toFixed(2), median: s.median });
  }
  await writeFile(path.join(DATA, 'history.json'), JSON.stringify(history, null, 1));

  const known = new Set(prev.sample ? [] : prev.products.map(p => p.url));
  const isNew = fresh.filter(p => !known.has(p.url)).length;
  log(`Saved ${products.length} products: ${fresh.length} scraped (${isNew} new), ${active.length} currently listed, ${fresh.filter(p => p.image).length} with images.`);
}

export { productImage, readDom };

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
