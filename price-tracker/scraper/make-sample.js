#!/usr/bin/env node
// Writes SAMPLE (made-up) data so the dashboard can be previewed before the
// first real scrape. Files are flagged `"sample": true`; the dashboard shows a
// banner, and the real scraper discards sample data on its first run.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RETAILERS } from '../lib/retailers.js';
import { CATEGORIES, baseColour, detectGender } from '../lib/catalog.js';
import { summarise } from '../lib/stats.js';

const DATA = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data');

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = a => a[Math.floor(rand() * a.length)];
const some = (a, min) => a.filter(() => rand() > 0.45).concat(a.slice(0, min)).filter((x, i, s) => s.indexOf(x) === i);

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
  jumpers: ['Crew Neck Jumper', 'Merino Wool Jumper', 'Cable Knit Jumper', 'Rib Knit Cardigan'],
  sweatshirts: ['Crew Neck Sweatshirt', 'Relaxed Sweatshirt'],
  coats: ['Padded Jacket', 'Wool Blend Coat', 'Hooded Parka', 'Shower Resistant Jacket', 'Puffer Gilet'],
  jeans: ['Straight Fit Jeans', 'Slim Fit Jeans', 'Wide Leg Jeans', 'Mom Jeans'],
  joggers: ['Cuffed Joggers', 'Open Hem Joggers'],
  socks: ['5 Pack Cotton Rich Socks', '7 Pack Trainer Socks', '3 Pack Wool Blend Socks', 'Socks'],
  underwear: ['3 Pack Cotton Stretch Boxers', '5 Pack Knickers', 'Pack of 4 Trunks'],
};
const COLOURS = ['White', 'Black', 'Navy', 'Grey Marl', 'Stone', 'Khaki', 'Blue', 'Burgundy', 'Pink', 'Ecru'];
const SIZES = {
  default: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  jeans: ['28W 30L', '30W 30L', '32W 32L', '34W 32L', '36W 32L', '8', '10', '12', '14', '16'],
  socks: ['4-7', '6-8', '8-11', '12-14'],
};

const products = [];
const now = new Date();
for (const r of RETAILERS) for (const c of CATEGORIES) {
  const [lo, hi] = BANDS[c.id][r.id];
  for (let i = 0; i < 12 + Math.floor(rand() * 12); i++) {
    const gender = pick(['Men’s', 'Women’s', 'Men’s', 'Women’s', 'Kids’']);
    const base = pick(NAMES[c.id]);
    const name = `${gender} ${base}`;
    const price = Math.round((lo + rand() ** 1.6 * (hi - lo)) * 2) / 2 - (rand() > 0.5 ? 0.01 : 0);
    const pack = Number(name.match(/(\d+) Pack|Pack of (\d+)/)?.slice(1).find(Boolean) || 1);
    const colours = some(COLOURS, 1).slice(0, 1 + Math.floor(rand() * 5));
    products.push({
      retailer: r.id, category: c.id, name, url: null,
      price: +price.toFixed(2), maxPrice: +price.toFixed(2), packSize: pack, unitPrice: +(price / pack).toFixed(2),
      gender: detectGender(name), colours, baseColours: [...new Set(colours.map(baseColour))],
      sizes: some(SIZES[c.id] || SIZES.default, 3),
      scrapedAt: now.toISOString(),
    });
  }
}

// 12 weeks of weekly history with a gentle drift.
const rows = [];
for (let w = 11; w >= 0; w--) {
  const date = new Date(now - w * 7 * 864e5).toISOString().slice(0, 10);
  for (const r of RETAILERS) for (const c of CATEGORIES) {
    const s = summarise(products.filter(p => p.retailer === r.id && p.category === c.id).map(p => p.unitPrice));
    const drift = 1 + (rand() - 0.5) * 0.06 - w * 0.004;
    rows.push({ date, retailer: r.id, category: c.id, count: s.count, avg: +(s.avg * drift).toFixed(2), median: s.median });
  }
}

await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, 'products.json'), JSON.stringify({ generatedAt: now.toISOString(), sample: true, products }, null, 1));
await writeFile(path.join(DATA, 'history.json'), JSON.stringify({ sample: true, rows }, null, 1));
console.log(`Wrote ${products.length} SAMPLE products and ${rows.length} history rows.`);
