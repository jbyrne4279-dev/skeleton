// Pulls product data out of a product page's HTML. Pure functions so they can
// be tested against saved pages without a browser.
//
// Most UK retailers publish schema.org Product data as JSON-LD for Google
// Shopping; that's the primary source. Open Graph price meta tags and sizes /
// colours read from the rendered page (passed in as `dom`) fill any gaps.

import { baseColour, categorise, detectGender, packSize } from '../lib/catalog.js';

export function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const [, body] of html.matchAll(re)) {
    try { out.push(JSON.parse(body.trim())); } catch { /* retailers ship broken blocks sometimes */ }
  }
  return out;
}

function flatten(node, acc = []) {
  if (Array.isArray(node)) node.forEach(n => flatten(n, acc));
  else if (node && typeof node === 'object') {
    acc.push(node);
    if (node['@graph']) flatten(node['@graph'], acc);
  }
  return acc;
}

const isType = (n, ...types) => [].concat(n['@type'] || []).some(t => types.includes(t));
const asArray = x => (x == null ? [] : [].concat(x));
const text = x => (typeof x === 'string' ? x : x && typeof x === 'object' ? x.name || x['@id'] || '' : '').trim();

function offerPrice(offers) {
  const prices = [];
  for (const o of asArray(offers)) {
    for (const k of ['price', 'lowPrice']) {
      const p = parseFloat(String(o?.[k] ?? '').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(p) && p > 0) prices.push(p);
    }
    if (o?.priceSpecification) prices.push(...offerPrice(o.priceSpecification).prices);
  }
  const currency = asArray(offers).map(o => o?.priceCurrency).find(Boolean) || null;
  return { prices, currency };
}

function metaContent(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

const decode = s => s?.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();

const SIZE_RE = /^(?:(?:\d?X{0,3}[SL]|M|XS|XXS|XXXS|\dXL)(?:\s*\/\s*(?:\d?X{0,3}[SL]|M))?|(?:UK\s*)?\d{1,2}(?:\.5)?(?:\s*[-–\/]\s*\d{1,2}(?:\.5)?)?(?:\s*(?:yrs?|years|R|S|L|short|long|reg(?:ular)?))?|\d{2}["”]?\s*(?:W|waist)?(?:\s*\d{2}["”]?\s*L)?|W\d{2}\s*L\d{2}|one size|os)$/i;

export function cleanSizes(list) {
  const seen = new Set();
  for (let s of list) {
    s = String(s).replace(/\s+/g, ' ').replace(/\b(out of stock|low stock|sold out|notify me|- ?coming soon)\b.*$/i, '').trim();
    if (s && s.length <= 20 && SIZE_RE.test(s)) seen.add(s.toUpperCase() === s ? s : s.replace(/^(xs|s|m|l|xl|xxl|os)$/i, m => m.toUpperCase()));
  }
  return [...seen];
}

export function cleanColours(list) {
  const seen = new Map();
  for (let c of list) {
    c = String(c).replace(/\s+/g, ' ').replace(/^(colou?r:?\s*)/i, '').trim();
    if (c && c.length <= 40 && !/^\d+$/.test(c) && !/select|choose|size/i.test(c)) {
      const key = c.toLowerCase();
      if (!seen.has(key)) seen.set(key, c);
    }
  }
  return [...seen.values()];
}

/**
 * @param {string} html   Product page HTML.
 * @param {object} ctx    { url, retailer, categoryHint, dom: { name, price, sizes[], colours[] } }
 * @returns product record, or null if no usable name + price was found.
 */
export function extractProduct(html, { url, retailer, categoryHint, dom = {} }) {
  const nodes = jsonLdBlocks(html).flatMap(b => flatten(b));
  const product = nodes.find(n => isType(n, 'ProductGroup')) || nodes.find(n => isType(n, 'Product'));

  let name = text(product?.name) || decode(metaContent(html, 'og:title')) || dom.name || '';
  name = name.replace(/\s*[|–-]\s*(Next|M&S|Marks (&|and) Spencer|H&M|Primark)( UK| GB)?\s*$/i, '').trim();

  const prices = [];
  let currency = null;
  const colours = [];
  const sizes = [];
  const colourImages = {}; // colour name -> the retailer's own photo of that colour
  if (product) {
    const main = offerPrice(product.offers);
    prices.push(...main.prices);
    currency = main.currency;
    colours.push(...asArray(product.color).map(text));
    sizes.push(...asArray(product.size).map(text));
    for (const v of asArray(product.hasVariant)) {
      const vp = offerPrice(v.offers);
      prices.push(...vp.prices);
      currency ||= vp.currency;
      colours.push(...asArray(v.color).map(text));
      sizes.push(...asArray(v.size).map(text));
      const vc = text(asArray(v.color)[0]);
      const vi = imageSrc(v.image);
      if (vc && vi && !colourImages[vc]) colourImages[vc] = absolute(vi, url);
    }
  }
  if (!prices.length) {
    const p = parseFloat(metaContent(html, 'product:price:amount') || metaContent(html, 'og:price:amount') || metaContent(html, 'price') || '');
    if (Number.isFinite(p) && p > 0) prices.push(p);
    currency ||= metaContent(html, 'product:price:currency') || metaContent(html, 'og:price:currency');
  }
  if (!prices.length && Number.isFinite(dom.price) && dom.price > 0) prices.push(dom.price);

  // Variant data wins; the rendered page fills in when JSON-LD has none.
  const sizeList = cleanSizes(sizes.length ? sizes : dom.sizes || []);
  const colourList = cleanColours(colours.length ? colours : dom.colours || []);

  if (!name || !prices.length) return null;
  if (currency && currency !== 'GBP') return null;

  const category = categorise(name, categoryHint);
  if (!category) return null;

  const img = imageSrc(product?.image) || decode(metaContent(html, 'og:image'));
  const imageUrl = img ? absolute(img, url) : null;
  const releaseDate = [product?.releaseDate, product?.datePublished].find(d => d && !Number.isNaN(Date.parse(d))) || null;

  const price = Math.min(...prices);
  const pack = packSize(name);
  return {
    retailer,
    category,
    name,
    url,
    price: round2(price),
    maxPrice: round2(Math.max(...prices)),
    packSize: pack,
    unitPrice: round2(price / pack),
    gender: detectGender(`${name} ${url}`),
    colours: colourList,
    // No colour data at all? "Pure Cotton White T-Shirt" still tells us one.
    baseColours: colourList.length
      ? [...new Set(colourList.map(baseColour).filter(Boolean))]
      : [baseColour(name)].filter(c => c && c !== 'other'),
    sizes: sizeList,
    imageUrl,
    colourImages,
    releaseDate: releaseDate && new Date(releaseDate).toISOString().slice(0, 10),
    scrapedAt: new Date().toISOString(),
  };
}

const round2 = n => Math.round(n * 100) / 100;

// The part of an image URL that identifies the photo itself, ignoring CDN size
// and format parameters: ".../mands/white_T28?w=600&fmt=webp" -> "white_t28".
// Used to find the retailer's own product photo among the <img>s on the page.
export function imageKey(url) {
  if (!url) return null;
  try {
    const seg = new URL(url, 'https://x').pathname.split('/').filter(Boolean).pop() || '';
    const key = decodeURIComponent(seg).replace(/\.(jpe?g|png|webp|avif|gif)$/i, '').toLowerCase();
    return key.length >= 5 ? key : null;
  } catch { return null; }
}
const imageSrc = img => [img].flat().map(i => (typeof i === 'string' ? i : i?.url || i?.contentUrl)).find(Boolean) || null;
const absolute = (src, base) => { try { return new URL(src, base).href; } catch { return src; } };
