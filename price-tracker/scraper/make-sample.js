#!/usr/bin/env node
// Writes SAMPLE (made-up) data so the dashboard can be previewed before the
// first real scrape. Files are flagged `"sample": true`; the dashboard shows a
// banner, and the real scraper discards sample data on its first run.
// Product images are drawn garment outlines rendered to WebP and stamped
// "SAMPLE" - real runs replace them with screenshots from the retailers.

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { RETAILERS } from '../lib/retailers.js';
import { CATEGORIES, baseColour, detectGender } from '../lib/catalog.js';
import { summarise } from '../lib/stats.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data');
const IMG_DIR = path.join(DATA, 'images', 'sample');

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = a => a[Math.floor(rand() * a.length)];
const some = (a, min) => a.filter(() => rand() > 0.45).concat(a.slice(0, min)).filter((x, i, s) => s.indexOf(x) === i);
const isoDay = d => d.toISOString().slice(0, 10);

// Illustrative price bands (GBP) per retailer x category - not real data.
const BANDS = {
  't-shirts':    { next: [8, 22],  mands: [7, 25],   hm: [5, 18],   primark: [2.5, 8] },
  shirts:        { next: [20, 40], mands: [18, 45],  hm: [15, 35],  primark: [8, 18] },
  hoodies:       { next: [26, 45], mands: [25, 45],  hm: [18, 35],  primark: [10, 20] },
  jumpers:       { next: [26, 55], mands: [25, 69],  hm: [18, 40],  primark: [10, 22] },
  sweatshirts:   { next: [24, 38], mands: [22, 39],  hm: [15, 28],  primark: [8, 16] },
  coats:         { next: [50, 140],mands: [55, 169], hm: [40, 120], primark: [22, 60] },
  jeans:         { next: [26, 45], mands: [25, 45],  hm: [18, 35],  primark: [10, 20] },
  joggers:       { next: [20, 35], mands: [19, 35],  hm: [15, 28],  primark: [8, 14] },
  socks:         { next: [8, 18],  mands: [8, 20],   hm: [5, 13],   primark: [3, 8] },
  underwear:     { next: [15, 28], mands: [14, 30],  hm: [10, 20],  primark: [5, 12] },
};
const NAMES = {
  't-shirts': ['Crew Neck T-Shirt', 'Oversized T-Shirt', 'Slim Fit T-Shirt', 'V-Neck T-Shirt', 'Heavyweight T-Shirt'],
  shirts: ['Oxford Shirt', 'Linen Blend Shirt', 'Easy Iron Shirt', 'Flannel Shirt'],
  hoodies: ['Overhead Hoodie', 'Zip Through Hoodie', 'Relaxed Fit Hoodie'],
  jumpers: ['Crew Neck Jumper', 'Merino Wool Jumper', 'Cable Knit Jumper', 'Rib Knit Jumper'],
  sweatshirts: ['Crew Neck Sweatshirt', 'Relaxed Sweatshirt'],
  coats: ['Padded Jacket', 'Wool Blend Coat', 'Hooded Parka', 'Shower Resistant Jacket', 'Puffer Coat'],
  jeans: ['Straight Fit Jeans', 'Slim Fit Jeans', 'Wide Leg Jeans', 'Mom Jeans'],
  joggers: ['Cuffed Joggers', 'Open Hem Joggers'],
  socks: ['5 Pack Cotton Rich Socks', '7 Pack Trainer Socks', '3 Pack Wool Blend Socks', 'Socks'],
  underwear: ['3 Pack Cotton Stretch Boxers', '5 Pack Knickers', 'Pack of 4 Trunks'],
};
// Colour name -> [fill, outline]
const COLOURS = {
  White: ['#fbfbf9', '#b9b7b0'], Black: ['#1d1d1f', '#000'], Navy: ['#23314f', '#141c30'], 'Grey Marl': ['#9c9c9a', '#6d6d6b'],
  Stone: ['#cfc4ae', '#9d927d'], Khaki: ['#6f7248', '#4c4e2f'], Blue: ['#4f7fc0', '#35598d'], Burgundy: ['#7a2335', '#521522'],
  Pink: ['#eab3c5', '#bf8497'], Ecru: ['#efe8d6', '#bdb49d'],
};
const SIZES = {
  default: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  jeans: ['28W 30L', '30W 30L', '32W 32L', '34W 32L', '36W 32L', '8', '10', '12', '14', '16'],
  socks: ['4-7', '6-8', '8-11', '12-14'],
};

// Simple garment outlines on a 400 x 500 canvas.
const SHAPES = {
  't-shirts': `<path d="M150 70 L95 88 L40 150 L85 195 L118 168 L118 450 L282 450 L282 168 L315 195 L360 150 L305 88 L250 70 Q200 118 150 70 Z"/>`,
  shirts: `<path d="M160 64 L100 84 L60 300 L100 312 L125 175 L125 455 L275 455 L275 175 L300 312 L340 300 L300 84 L240 64 L200 110 Z"/><path d="M160 64 L200 110 L182 128 L150 82 Z M240 64 L200 110 L218 128 L250 82 Z" fill-opacity=".85"/><path d="M200 112 V450" fill="none"/>`,
  hoodies: `<path d="M150 90 Q150 20 200 18 Q250 20 250 90 L305 108 L345 330 L302 340 L280 200 L280 452 L120 452 L120 200 L98 340 L55 330 L95 108 Z"/><path d="M165 92 Q200 60 235 92 Q220 125 200 125 Q180 125 165 92 Z" fill-opacity=".6"/><path d="M150 330 H250 L262 392 H138 Z" fill="none"/>`,
  jumpers: `<path d="M160 72 L98 92 L55 332 L98 342 L122 188 L122 440 L278 440 L278 188 L302 342 L345 332 L302 92 L240 72 Q200 104 160 72 Z"/><path d="M122 420 H278 M55 316 L98 326 M302 326 L345 316" fill="none"/>`,
  sweatshirts: `<path d="M160 72 L98 92 L55 332 L98 342 L122 188 L122 440 L278 440 L278 188 L302 342 L345 332 L302 92 L240 72 Q200 110 160 72 Z"/><path d="M122 424 H278" fill="none"/>`,
  coats: `<path d="M165 60 L100 82 L58 380 L102 388 L125 200 L118 478 L282 478 L275 200 L298 388 L342 380 L300 82 L235 60 L200 100 Z"/><path d="M165 60 L200 100 L178 150 L140 80 Z M235 60 L200 100 L222 150 L260 80 Z" fill-opacity=".8"/><path d="M200 102 V478 M135 330 H175 M225 330 H265" fill="none"/>`,
  jeans: `<path d="M125 50 H275 L300 470 H218 L200 190 L182 470 H100 Z"/><path d="M125 82 H275 M160 82 Q162 130 130 136 M240 82 Q238 130 270 136" fill="none"/>`,
  joggers: `<path d="M128 50 H272 L292 440 L300 470 H222 L220 440 L200 190 L180 440 L178 470 H100 L108 440 Z"/><path d="M128 80 H272 M108 440 H178 M222 440 H292" fill="none"/>`,
  socks: `<path d="M120 60 H190 V300 Q190 350 150 380 L110 410 Q80 430 70 400 Q62 375 95 355 L120 335 Z"/><path d="M215 90 H285 V330 Q285 380 245 410 L205 440 Q175 460 165 430 Q157 405 190 385 L215 365 Z"/><path d="M120 92 H190 M215 122 H285" fill="none"/>`,
  underwear: `<path d="M80 150 H320 L330 190 Q290 200 270 320 L210 340 Q200 300 190 340 L130 320 Q110 200 70 190 Z"/><path d="M80 176 H320" fill="none"/>`,
};

function garmentSvg(category, colour) {
  const [fill, stroke] = COLOURS[colour];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f2ee"/><stop offset="1" stop-color="#e7e4dd"/></linearGradient></defs>
    <rect width="400" height="500" fill="url(#bg)"/>
    <g fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round">${SHAPES[category]}</g>
    <text x="388" y="488" text-anchor="end" font-family="sans-serif" font-size="18" font-weight="700" fill="#000" fill-opacity=".28" letter-spacing="2">SAMPLE</text>
  </svg>`;
}

// ---- images: one per category x colour
await rm(IMG_DIR, { recursive: true, force: true });
await mkdir(IMG_DIR, { recursive: true });
for (const c of CATEGORIES) for (const colour of Object.keys(COLOURS)) {
  await sharp(Buffer.from(garmentSvg(c.id, colour))).resize({ width: 320 }).webp({ quality: 70 }).toFile(path.join(IMG_DIR, `${c.id}-${colour.toLowerCase().replace(/\s+/g, '-')}.webp`));
}

// ---- products, released over the last 15 months
const now = new Date();
const today = isoDay(now);
const products = [];
for (const r of RETAILERS) for (const c of CATEGORIES) {
  const [lo, hi] = BANDS[c.id][r.id];
  for (let i = 0; i < 14 + Math.floor(rand() * 12); i++) {
    const gender = pick(['Men’s', 'Women’s', 'Men’s', 'Women’s', 'Kids’']);
    const name = `${gender} ${pick(NAMES[c.id])}`;
    let price = Math.round((lo + rand() ** 1.6 * (hi - lo)) * 2) / 2 - (rand() > 0.5 ? 0.01 : 0);
    price = +price.toFixed(2);
    const pack = Number(name.match(/(\d+) Pack|Pack of (\d+)/)?.slice(1).find(Boolean) || 1);
    const colours = some(Object.keys(COLOURS), 1).slice(0, 1 + Math.floor(rand() * 5));
    const firstSeen = isoDay(new Date(now - Math.floor(rand() ** 1.3 * 455) * 864e5));
    const age = (now - new Date(firstSeen)) / 864e5;
    const active = age < 60 || rand() > 0.25;
    const lastSeen = active ? today : isoDay(new Date(now - Math.floor(rand() * Math.min(age, 120)) * 864e5));
    const priceLog = [{ date: firstSeen, price: +(price * (rand() > 0.7 ? 1.2 : 1)).toFixed(2) }];
    if (priceLog[0].price !== price) priceLog.push({ date: isoDay(new Date((Date.parse(firstSeen) + Date.parse(lastSeen)) / 2)), price });
    products.push({
      retailer: r.id, category: c.id, name, url: null,
      price, maxPrice: price, packSize: pack, unitPrice: +(price / pack).toFixed(2),
      gender: detectGender(name), colours, baseColours: [...new Set(colours.map(baseColour))],
      sizes: some(SIZES[c.id] || SIZES.default, 3),
      image: `data/images/sample/${c.id}-${colours[0].toLowerCase().replace(/\s+/g, '-')}.webp`,
      firstSeen, lastSeen, active, priceLog,
      scrapedAt: now.toISOString(),
    });
  }
}

// ---- 12 weeks of weekly history with a gentle drift
const rows = [];
for (let w = 11; w >= 0; w--) {
  const date = isoDay(new Date(now - w * 7 * 864e5));
  for (const r of RETAILERS) for (const c of CATEGORIES) {
    const s = summarise(products.filter(p => p.active && p.retailer === r.id && p.category === c.id).map(p => p.unitPrice));
    const drift = 1 + (rand() - 0.5) * 0.06 - w * 0.004;
    rows.push({ date, retailer: r.id, category: c.id, count: s.count, avg: +(s.avg * drift).toFixed(2), median: s.median });
  }
}

await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, 'products.json'), JSON.stringify({ generatedAt: now.toISOString(), sample: true, products }, null, 1));
await writeFile(path.join(DATA, 'history.json'), JSON.stringify({ sample: true, rows }, null, 1));
console.log(`Wrote ${products.length} SAMPLE products, ${CATEGORIES.length * Object.keys(COLOURS).length} sample images and ${rows.length} history rows.`);
