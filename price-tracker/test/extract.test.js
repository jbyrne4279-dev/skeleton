import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractProduct, cleanSizes } from '../scraper/extract.js';
import { categorise, baseColour, packSize, detectGender } from '../lib/catalog.js';
import { marketStats, sortSizes } from '../lib/stats.js';

const fixture = f => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

test('reads price, colours and sizes from JSON-LD ProductGroup', () => {
  const p = extractProduct(fixture('jsonld-group.html'), { url: 'https://www.marksandspencer.com/x/p/clp1', retailer: 'mands', categoryHint: 't-shirts' });
  assert.equal(p.name, 'Pure Cotton Crew Neck T-Shirt');
  assert.equal(p.price, 9.5);
  assert.equal(p.category, 't-shirts');
  assert.deepEqual(p.colours, ['White', 'Navy']);
  assert.deepEqual(p.baseColours, ['white', 'navy']);
  assert.deepEqual(p.sizes, ['S', 'M', 'XL']);
  assert.equal(p.imageUrl, 'https://asset1.cxnmarksandspencer.com/is/image/mands/white_T28');
  assert.deepEqual(p.colourImages, {
    White: 'https://asset1.cxnmarksandspencer.com/is/image/mands/white_T28?w=600',
    Navy: 'https://asset1.cxnmarksandspencer.com/is/image/mands/navy_T28',
  });
});

test('falls back to meta tags + DOM, and prices multipacks per item', () => {
  const p = extractProduct(fixture('meta-only.html'), {
    url: 'https://www.next.co.uk/style/st1/a1', retailer: 'next', categoryHint: 'socks',
    dom: { sizes: ['4-7', '8-11', 'Select size', '12-14 Out of stock'], colours: ['Colour: Black'] },
  });
  assert.equal(p.name, '5 Pack Cotton Rich Socks');
  assert.equal(p.price, 12);
  assert.equal(p.packSize, 5);
  assert.equal(p.unitPrice, 2.4);
  assert.deepEqual(p.sizes, ['4-7', '8-11', '12-14']);
  assert.deepEqual(p.colours, ['Black']);
});

test('rejects pages without a price or with a non-clothing name', () => {
  assert.equal(extractProduct('<html><h1>x</h1></html>', { url: 'u', retailer: 'hm' }), null);
  const html = '<meta property="og:title" content="Scented Candle"><meta property="product:price:amount" content="5">';
  assert.equal(extractProduct(html, { url: 'u', retailer: 'hm', categoryHint: 't-shirts' }), null);
});

test('catalog helpers', () => {
  assert.equal(categorise('Relaxed Fit Hoodie'), 'hoodies');
  assert.equal(categorise('Oversized T-Shirt Dress', 't-shirts'), null);
  assert.equal(categorise('Zip Through Hooded Jacket', 'hoodies'), 'coats');
  assert.equal(baseColour('Optic White'), 'white');
  assert.equal(baseColour('Off White'), 'cream');
  assert.equal(packSize('Pack of 3 Boxers'), 3);
  assert.equal(packSize('Crew Socks 7 Pairs'), 7);
  assert.equal(detectGender("Women's Rib Jumper"), 'women');
  assert.equal(detectGender('https://www2.hm.com/en_gb/productpage.1.html Boys T-shirt'), 'kids');
  assert.deepEqual(cleanSizes(['XS', 'xl', 'UK 10', '32W 30L', 'Size guide']), ['XS', 'XL', 'UK 10', '32W 30L']);
  assert.deepEqual(sortSizes(['XL', 'S', '10', 'M', '8']), ['S', 'M', 'XL', '8', '10']);
});

test('market average weights retailers equally', () => {
  const products = [
    ...Array(9).fill({ retailer: 'a', unitPrice: 2 }),
    { retailer: 'b', unitPrice: 10 },
  ];
  const s = marketStats(products, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(s.market.avg, 6);
  assert.equal(s.market.pooledAvg, 2.8);
});
