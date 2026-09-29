import { CATEGORIES, CATEGORY_BY_ID, COLOURS } from '../lib/catalog.js';
import { RETAILER_INFO as RETAILERS } from '../lib/retailers.js';
import { marketStats, summarise, tally, sortSizes } from '../lib/stats.js';

const $ = id => document.getElementById(id);
const gbp = n => (n == null ? '–' : `£${n.toFixed(2)}`);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seriesVar = r => `var(--s${r.colour})`;
const retailerById = Object.fromEntries(RETAILERS.map(r => [r.id, r]));
const SWATCH = { white: '#ffffff', cream: '#efe6d2', black: '#111', navy: '#1c2b4a', grey: '#8a8a8a', blue: '#3f7fd0', green: '#4f7a3a', red: '#b8322f', pink: '#e79ab5', purple: '#7d5ba6', yellow: '#e8c33a', orange: '#e0813a', brown: '#8a5a3b', multi: 'conic-gradient(#e0813a,#3f7fd0,#4f7a3a,#e79ab5,#e0813a)', other: 'transparent' };

const state = { category: 't-shirts', colour: '', gender: '', size: '', search: '', sort: 'unitPrice', dir: 1, limit: 50 };
let DATA = { products: [] };
let HISTORY = { rows: [] };

// --- state <-> URL hash, so a view like "white t-shirts, men" can be shared ---
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of ['category', 'colour', 'gender', 'size']) if (h.has(k)) state[k] = h.get(k);
  if (!CATEGORY_BY_ID[state.category]) state.category = 't-shirts';
}
function writeHash() {
  const h = new URLSearchParams();
  for (const k of ['category', 'colour', 'gender', 'size']) if (state[k]) h.set(k, state[k]);
  history.replaceState(null, '', `#${h}`);
}

// Filters other than category - used by both the main view and the matrix.
function passesFilters(p) {
  return (!state.colour || p.baseColours.includes(state.colour))
    && (!state.gender || p.gender === state.gender)
    && (!state.size || p.sizes.includes(state.size));
}
const current = () => DATA.products.filter(p => p.category === state.category && passesFilters(p));

function describe() {
  const cat = CATEGORY_BY_ID[state.category].label.toLowerCase();
  const who = { men: "men's ", women: "women's ", kids: "kids' ", unisex: 'unlabelled ' }[state.gender] || '';
  const size = state.size ? ` in size ${state.size}` : '';
  return `${who}${state.colour ? `${state.colour} ` : ''}${cat}${size}`;
}

// ---------------------------------------------------------------- controls
function renderControls() {
  $('category-chips').innerHTML = CATEGORIES.map(c =>
    `<button class="chip" role="tab" data-cat="${c.id}" aria-selected="${c.id === state.category}">${esc(c.label)}</button>`).join('');

  const inCat = DATA.products.filter(p => p.category === state.category);
  const colours = COLOURS.map(([c]) => c).filter(c => inCat.some(p => p.baseColours.includes(c)));
  $('f-colour').innerHTML = `<option value="">Any colour</option>` + colours.map(c => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('');
  if (state.colour && !colours.includes(state.colour)) $('f-colour').insertAdjacentHTML('beforeend', `<option value="${esc(state.colour)}">${esc(state.colour)}</option>`);
  $('f-colour').value = state.colour;

  const sizes = sortSizes(tally(inCat.map(p => p.sizes)).filter(([, n]) => n >= 2).map(([s]) => s));
  $('f-size').innerHTML = `<option value="">Any size</option>` + sizes.map(s => `<option>${esc(s)}</option>`).join('');
  if (state.size && !sizes.includes(state.size)) $('f-size').insertAdjacentHTML('beforeend', `<option>${esc(state.size)}</option>`);
  $('f-size').value = state.size;
  $('f-gender').value = state.gender;
}

// ---------------------------------------------------------------- hero
function renderHero(stats) {
  const m = stats.market;
  $('hero-label').textContent = `Average price of ${describe()} in the UK`;
  $('hero-num').textContent = gbp(m.avg);
  const cheapest = stats.byRetailer.filter(r => r.count).sort((a, b) => a.avg - b.avg)[0];
  const dearest = stats.byRetailer.filter(r => r.count).sort((a, b) => b.avg - a.avg)[0];
  $('hero-sub').textContent = m.count
    ? `Across ${m.count} products from ${m.retailerCount} retailer${m.retailerCount === 1 ? '' : 's'}.` +
      (cheapest && dearest && cheapest !== dearest ? ` Cheapest on average at ${cheapest.retailer.name} (${gbp(cheapest.avg)}), dearest at ${dearest.retailer.name} (${gbp(dearest.avg)}).` : '')
    : 'No products match these filters yet.';
  const items = [['Median', gbp(m.median)], ['Lowest', gbp(m.min)], ['Highest', gbp(m.max)], ['All products pooled', gbp(m.pooledAvg)]];
  $('hero-stats').innerHTML = m.count ? items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') : '';
}

// ---------------------------------------------------------------- retailer bars + table
function renderRetailers(stats) {
  const max = Math.max(...stats.byRetailer.map(r => r.max || 0), 1) * 1.05;
  const pct = v => `${(v / max) * 100}%`;
  const m = stats.market.avg;
  $('retailer-chart').innerHTML = stats.byRetailer.map(r => `
    <div class="bar-row" data-tip-retailer="${r.retailer.id}">
      <span class="bar-name"><span class="dot" style="background:${seriesVar(r.retailer)}"></span>${esc(r.retailer.name)}</span>
      ${r.count ? `<div class="bar-track">
        <div class="bar-fill" style="width:${pct(r.avg)};background:${seriesVar(r.retailer)}"></div>
        <div class="bar-range" style="left:${pct(r.min)};width:calc(${pct(r.max)} - ${pct(r.min)})"></div>
        ${m ? `<div class="bar-market" style="left:${pct(m)}" title="UK average"></div>` : ''}
      </div><span class="bar-val">${gbp(r.avg)}</span>`
      : `<span class="bar-empty">No matching products</span><span></span>`}
    </div>`).join('') + (m ? `<p class="hint">Dashed line = UK average ${gbp(m)}.</p>` : '');

  const rows = [...stats.byRetailer, { retailer: { name: 'UK average' }, ...stats.market, market: true }];
  const cheapestAvg = Math.min(...stats.byRetailer.filter(r => r.count).map(r => r.avg));
  $('retailer-table').innerHTML = `<thead><tr><th>Retailer</th><th class="n">Products</th><th class="n">Average</th><th class="n">Median</th><th class="n">Lowest</th><th class="n">Highest</th></tr></thead><tbody>` +
    rows.map(r => `<tr class="${r.market ? 'market' : ''}">
      <td>${esc(r.retailer.name)}</td><td class="n">${r.count}</td>
      <td class="n"><span class="${!r.market && r.avg === cheapestAvg ? 'cheapest' : ''}">${gbp(r.avg)}</span></td>
      <td class="n">${gbp(r.median)}</td><td class="n">${gbp(r.min)}</td><td class="n">${gbp(r.max)}</td></tr>`).join('') + '</tbody>';
}

// ---------------------------------------------------------------- trend (SVG line chart)
function renderTrend() {
  const rows = HISTORY.rows.filter(r => r.category === state.category);
  const dates = [...new Set(rows.map(r => r.date))].sort();
  $('trend-hint').textContent = `Average ${CATEGORY_BY_ID[state.category].label.toLowerCase()} price per retailer on each scrape day (all colours and sizes).`;
  const series = RETAILERS.map(r => ({ r, pts: dates.map(d => rows.find(x => x.date === d && x.retailer === r.id)).map((x, i) => x && { i, v: x.avg }).filter(Boolean) })).filter(s => s.pts.length);
  $('trend-legend').innerHTML = series.map(s => `<span><span class="dot" style="background:${seriesVar(s.r)}"></span>${esc(s.r.name)}</span>`).join('');
  if (dates.length < 2) {
    $('trend').innerHTML = `<p class="trend-empty">The trend appears after the scraper has run on at least two different days.</p>`;
    return;
  }
  const W = 900, H = 280, L = 44, R = 70, T = 12, B = 28;
  const vals = series.flatMap(s => s.pts.map(p => p.v));
  const step = niceStep((Math.max(...vals) - 0) / 4);
  const yMax = Math.ceil(Math.max(...vals) / step) * step;
  const x = i => L + (i / (dates.length - 1)) * (W - L - R);
  const y = v => T + (1 - v / yMax) * (H - T - B);
  const ticks = []; for (let v = 0; v <= yMax + 1e-9; v += step) ticks.push(v);
  const xTicks = pickTicks(dates.length, 6);
  const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  // End labels, nudged apart so they don't overlap.
  const ends = series.map(s => ({ s, y: y(s.pts.at(-1).v) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);

  $('trend').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average price over time by retailer">
    ${ticks.map(v => `<line class="${v ? 'gridline' : 'baseline'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">£${v}</text>`).join('')}
    ${xTicks.map(i => `<text class="tick" x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDate(dates[i])}</text>`).join('')}
    ${series.map(s => `<polyline fill="none" stroke="${seriesVar(s.r)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${s.pts.map(p => `${x(p.i)},${y(p.v)}`).join(' ')}"/>`).join('')}
    ${ends.map(e => `<text class="endlabel" x="${W - R + 8}" y="${e.y + 4}">${esc(e.s.r.name)}</text>`).join('')}
    <line class="cross" id="cross" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <g id="cross-dots"></g>
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/>
  </svg>`;

  const svg = $('trend').querySelector('svg');
  svg.querySelector('#hit').addEventListener('pointermove', e => {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const sx = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
    const i = Math.max(0, Math.min(dates.length - 1, Math.round(((sx - L) / (W - L - R)) * (dates.length - 1))));
    const cross = svg.querySelector('#cross');
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    const at = series.map(s => ({ s, p: s.pts.find(p => p.i === i) })).filter(a => a.p).sort((a, b) => b.p.v - a.p.v);
    svg.querySelector('#cross-dots').innerHTML = at.map(a => `<circle cx="${x(i)}" cy="${y(a.p.v)}" r="4.5" fill="${seriesVar(a.s.r)}" stroke="var(--surface)" stroke-width="2"/>`).join('');
    showTip(e, `<strong>${fmtDate(dates[i])}</strong>` + at.map(a => `<div class="row"><span><span class="dot" style="background:${seriesVar(a.s.r)}"></span>${esc(a.s.r.name)}</span><b>${gbp(a.p.v)}</b></div>`).join(''));
  });
  svg.querySelector('#hit').addEventListener('pointerleave', () => {
    svg.querySelector('#cross').setAttribute('visibility', 'hidden');
    svg.querySelector('#cross-dots').innerHTML = '';
    hideTip();
  });
}
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) || 10 * p;
}
function pickTicks(n, max) {
  const every = Math.ceil(n / max);
  const out = []; for (let i = 0; i < n; i += every) out.push(i);
  if (out.at(-1) !== n - 1 && n - 1 - out.at(-1) < every / 2) out.pop();
  if (out.at(-1) !== n - 1) out.push(n - 1);
  return out;
}

// ---------------------------------------------------------------- sizes & colours
function renderAvailability(products) {
  $('availability').innerHTML = RETAILERS.map(r => {
    const ps = products.filter(p => p.retailer === r.id);
    if (!ps.length) return `<div><h3><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)}</h3><p class="muted">No matching products.</p></div>`;
    const share = n => `${Math.round((n / ps.length) * 100)}%`;
    const sizes = tally(ps.map(p => p.sizes));
    const sizeOrder = sortSizes(sizes.map(([s]) => s)).slice(0, 18);
    const colours = tally(ps.map(p => p.baseColours));
    return `<div><h3><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)} <span class="muted">· ${ps.length}</span></h3>
      <h4>Sizes</h4><div class="pills">${sizeOrder.length ? sizeOrder.map(s => `<span class="pill"><b>${esc(s)}</b><i>${share(sizes.find(x => x[0] === s)[1])}</i></span>`).join('') : '<span class="muted">Not listed</span>'}</div>
      <h4>Colours</h4><div class="pills">${colours.length ? colours.slice(0, 14).map(([c, n]) => `<span class="pill"><span class="swatch" style="background:${SWATCH[c] || 'transparent'}"></span>${esc(c)}<i>${share(n)}</i></span>`).join('') : '<span class="muted">Not listed</span>'}</div>
    </div>`;
  }).join('');
}

// ---------------------------------------------------------------- category matrix
function renderMatrix() {
  const head = `<thead><tr><th>Category</th><th class="n">UK average</th>${RETAILERS.map(r => `<th class="n"><span class="bar-name" style="justify-content:flex-end"><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)}</span></th>`).join('')}<th class="n">Products</th></tr></thead>`;
  const body = CATEGORIES.map(c => {
    const ps = DATA.products.filter(p => p.category === c.id && passesFilters(p));
    const s = marketStats(ps, RETAILERS);
    const low = Math.min(...s.byRetailer.filter(r => r.count).map(r => r.avg));
    return `<tr data-cat="${c.id}" class="${c.id === state.category ? 'current' : ''}"><td>${esc(c.label)}</td><td class="n"><b>${gbp(s.market.avg)}</b></td>
      ${s.byRetailer.map(r => `<td class="n">${r.count ? `<span class="${r.avg === low && s.market.retailerCount > 1 ? 'cheapest' : ''}">${gbp(r.avg)}</span>` : '<span class="muted">–</span>'}</td>`).join('')}
      <td class="n muted">${s.market.count}</td></tr>`;
  }).join('');
  $('matrix').innerHTML = head + `<tbody>${body}</tbody>`;
}

// ---------------------------------------------------------------- products table
function renderProducts(products) {
  const q = state.search.toLowerCase();
  let list = q ? products.filter(p => `${p.name} ${retailerById[p.retailer]?.name} ${p.colours.join(' ')}`.toLowerCase().includes(q)) : products;
  const key = state.sort;
  list = [...list].sort((a, b) => {
    const va = key === 'retailer' ? retailerById[a.retailer].name : a[key], vb = key === 'retailer' ? retailerById[b.retailer].name : b[key];
    return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * state.dir;
  });
  $('product-count').textContent = `· ${list.length}`;
  const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-sort" data-sort="${k}">${label}${state.sort === k ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  $('products').innerHTML = `<thead><tr>${th('retailer', 'Retailer')}${th('name', 'Product')}${th('unitPrice', 'Price per item', 'n')}<th>Colours</th><th>Sizes</th></tr></thead><tbody>` +
    list.slice(0, state.limit).map(p => {
      const r = retailerById[p.retailer];
      return `<tr>
        <td><span class="bar-name"><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)}</span></td>
        <td class="name">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}</td>
        <td class="n">${gbp(p.unitPrice)}${p.packSize > 1 ? `<div class="muted">${gbp(p.price)} for ${p.packSize}</div>` : ''}</td>
        <td class="opts">${esc(p.colours.join(', ')) || '<span class="muted">–</span>'}</td>
        <td class="opts">${esc(sortSizes(p.sizes).join(', ')) || '<span class="muted">–</span>'}</td></tr>`;
    }).join('') + '</tbody>';
  $('more').hidden = list.length <= state.limit;
}

// ---------------------------------------------------------------- tooltip
function showTip(e, html) {
  const tip = $('tip');
  tip.innerHTML = html; tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  let left = e.clientX + 14, top = e.clientY + 14;
  if (left + width > innerWidth - 8) left = e.clientX - width - 14;
  if (top + height > innerHeight - 8) top = e.clientY - height - 14;
  tip.style.left = `${Math.max(8, left)}px`; tip.style.top = `${Math.max(8, top)}px`;
}
const hideTip = () => { $('tip').hidden = true; };

// ---------------------------------------------------------------- wiring
function render() {
  writeHash();
  renderControls();
  const products = current();
  const stats = marketStats(products, RETAILERS);
  renderHero(stats);
  renderRetailers(stats);
  renderTrend();
  renderAvailability(products);
  renderMatrix();
  renderProducts(products);
}

document.addEventListener('click', e => {
  const cat = e.target.closest('[data-cat]');
  if (cat) { state.category = cat.dataset.cat; state.limit = 50; render(); if (cat.tagName === 'TR') scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const sort = e.target.closest('[data-sort]');
  if (sort) { const k = sort.dataset.sort; state.dir = state.sort === k ? -state.dir : 1; state.sort = k; renderProducts(current()); }
});
for (const [id, k] of [['f-colour', 'colour'], ['f-gender', 'gender'], ['f-size', 'size']])
  $(id).addEventListener('change', e => { state[k] = e.target.value; state.limit = 50; render(); });
$('f-search').addEventListener('input', e => { state.search = e.target.value; renderProducts(current()); });
$('more').addEventListener('click', () => { state.limit += 100; renderProducts(current()); });
$('retailer-chart').addEventListener('pointermove', e => {
  const row = e.target.closest('[data-tip-retailer]');
  if (!row) return hideTip();
  const s = summarise(current().filter(p => p.retailer === row.dataset.tipRetailer).map(p => p.unitPrice));
  if (!s.count) return hideTip();
  showTip(e, `<strong>${esc(retailerById[row.dataset.tipRetailer].name)}</strong>
    <div class="row"><span>Average</span><b>${gbp(s.avg)}</b></div><div class="row"><span>Median</span><b>${gbp(s.median)}</b></div>
    <div class="row"><span>Range</span><b>${gbp(s.min)}–${gbp(s.max)}</b></div><div class="row"><span>Products</span><b>${s.count}</b></div>`);
});
$('retailer-chart').addEventListener('pointerleave', hideTip);
addEventListener('hashchange', () => { readHash(); render(); });

async function load() {
  const get = async f => { const r = await fetch(f, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.json(); };
  try {
    [DATA, HISTORY] = await Promise.all([get('data/products.json'), get('data/history.json').catch(() => ({ rows: [] }))]);
  } catch (err) {
    $('hero-label').textContent = 'No data yet';
    $('hero-sub').textContent = 'Run "npm run scrape" (or "npm run sample" for demo data), then serve this folder with "npm run serve".';
    console.error(err);
    return;
  }
  $('sample-banner').hidden = !DATA.sample;
  $('retailer-names').textContent = RETAILERS.map(r => r.name).join(', ').replace(/, ([^,]*)$/, ' and $1');
  $('updated').textContent = `Updated ${new Date(DATA.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
  readHash();
  render();
}
load();
