import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRun } from '../scraper/merge.js';

const p = (url, extra = {}) => ({ url, retailer: 'hm', category: 'socks', price: 5, ...extra });

test('keeps firstSeen, logs price changes, and marks dropped products inactive', () => {
  const prev = [
    p('a', { firstSeen: '2026-01-01', lastSeen: '2026-02-01', active: true, image: 'img/a.webp', priceLog: [{ date: '2026-01-01', price: 6 }] }),
    p('gone', { firstSeen: '2026-01-01', active: true }),
    p('other-cat', { category: 'coats', firstSeen: '2026-01-01', active: true }),
  ];
  const fresh = [p('a', { price: 4 }), p('new', { releaseDate: '2026-09-20' })];
  const out = Object.fromEntries(mergeRun(prev, fresh, new Set(['hm|socks']), '2026-09-29').map(x => [x.url, x]));

  assert.equal(out.a.firstSeen, '2026-01-01');
  assert.equal(out.a.lastSeen, '2026-09-29');
  assert.equal(out.a.image, 'img/a.webp');
  assert.deepEqual(out.a.priceLog.map(l => l.price), [6, 4]);
  assert.equal(out.new.firstSeen, '2026-09-20');   // retailer's own release date wins
  assert.equal(out.new.active, true);
  assert.equal(out.gone.active, false);             // category scraped, product missing
  assert.equal(out['other-cat'].active, true);      // category not scraped: unchanged
});

test('an unchanged price is not logged twice', () => {
  const prev = [p('a', { firstSeen: '2026-01-01', priceLog: [{ date: '2026-01-01', price: 5 }] })];
  const [out] = mergeRun(prev, [p('a')], new Set(['hm|socks']), '2026-09-29');
  assert.equal(out.priceLog.length, 1);
});
