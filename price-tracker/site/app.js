import { CATEGORIES, CATEGORY_BY_ID, COLOURS } from '../lib/catalog.js';
import { RETAILER_INFO as RETAILERS } from '../lib/retailers.js';
import { marketStats, summarise, tally, sortSizes } from '../lib/stats.js';

const $ = id => document.getElementById(id);
const gbp = n => (n == null ? '–' : `£${n.toFixed(2)}`);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seriesVar = r => `var(--s${r.colour})`;
const retailerById = Object.fromEntries(RETAILERS.map(r => [r.id, r]));
const SWATCH = { white: '#ffffff', cream: '#efe6d2', black: '#111', navy: '#1c2b4a', grey: '#8a8a8a', blue: '#3f7fd0', green: '#4f7a3a', red: '#b8322f', pink: '#e79ab5', purple: '#7d5ba6', yellow: '#e8c33a', orange: '#e0813a', brown: '#8a5a3b', multi: 'conic-gradient(#e0813a,#3f7fd0,#4f7a3a,#e79ab5,#e0813a)', other: 'transparent' };

const state = { category: 't-shirts', colour: '', gender: '', size: '', period: '', status: 'active', gran: 'month', search: '', sort: 'unitPrice:1', limit: 48, periods: 6 };
const HASH_KEYS = ['category', 'colour', 'gender', 'size', 'period', 'status', 'gran'];
let DATA = { products: [] };
let HISTORY = { rows: [] };
let NOW = Date.now();

// Older data files (before release tracking) have no firstSeen/active fields.
const normalise = p => ({ active: true, firstSeen: (p.scrapedAt || '').slice(0, 10), priceLog: [], image: null, ...p });

// ---------------------------------------------------------------- release periods
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
// Returns a sortable key like "month:2026-09", "quarter:2026-3" or "season:2025-4".
function periodOf(date, gran = state.gran) {
  const [y, m] = date.split('-').map(Number);
  if (gran === 'quarter') return `quarter:${y}-${Math.ceil(m / 3)}`;
  if (gran === 'season') {
    // UK retail seasons: Spring Mar-May, Summer Jun-Aug, Autumn Sep-Nov, Winter Dec-Feb.
    const s = m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4;
    return `season:${m <= 2 ? y - 1 : y}-${s}`;
  }
  return `month:${y}-${String(m).padStart(2, '0')}`;
}
function periodLabel(key) {
  const [gran, rest] = key.split(':');
  const [y, n] = rest.split('-').map(Number);
  if (gran === 'quarter') return `${MONTHS[(n - 1) * 3].slice(0, 3)}–${MONTHS[n * 3 - 1].slice(0, 3)} ${y}`;
  if (gran === 'season') return n === 4 ? `Winter ${y}/${String(y + 1).slice(2)}` : `${SEASONS[n - 1]} ${y}`;
  return `${MONTHS[n - 1]} ${y}`;
}
const fmtDay = d => new Date(`${d}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const isNew = p => NOW - Date.parse(p.firstSeen) < 30 * 864e5;

// --- state <-> URL hash, so a view like "white t-shirts, men" can be shared ---
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of HASH_KEYS) if (h.has(k)) state[k] = h.get(k);
  if (!CATEGORY_BY_ID[state.category]) state.category = 't-shirts';
  if (!['month', 'quarter', 'season'].includes(state.gran)) state.gran = 'month';
  if (state.period && !state.period.startsWith(`${state.gran}:`)) state.period = '';
}
function writeHash() {
  const h = new URLSearchParams();
  for (const k of HASH_KEYS) if (state[k] && !(k === 'status' && state[k] === 'active') && !(k === 'gran' && state[k] === 'month')) h.set(k, state[k]);
  history.replaceState(null, '', `#${h}`);
}

// Filters other than category - used by the main view, the tiles and the matrix.
// `ignore` skips some, e.g. the timeline shows every period and status.
function passesFilters(p, ignore = []) {
  return (!state.colour || p.baseColours.includes(state.colour))
    && (!state.gender || p.gender === state.gender)
    && (!state.size || p.sizes.includes(state.size))
    && (ignore.includes('period') || !state.period || periodOf(p.firstSeen) === state.period)
    && (ignore.includes('status') || state.status === 'all' || (state.status === 'gone' ? !p.active : p.active));
}
const current = () => DATA.products.filter(p => p.category === state.category && passesFilters(p));

function describe() {
  const cat = CATEGORY_BY_ID[state.category].label.toLowerCase();
  const who = { men: "men's ", women: "women's ", kids: "kids' ", unisex: 'unlabelled ' }[state.gender] || '';
  const size = state.size ? ` in size ${state.size}` : '';
  const when = state.period ? ` released ${state.gran === 'month' ? 'in ' : ''}${periodLabel(state.period)}` : '';
  return `${who}${state.colour ? `${state.colour} ` : ''}${cat}${size}${when}`;
}

// ---------------------------------------------------------------- shared product card
function photo(p, { tags = true } = {}) {
  const r = retailerById[p.retailer];
  const img = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
    : `<span class="noimg">No picture yet</span>`;
  const badge = !p.active ? `<span class="badge gone">No longer listed</span>` : isNew(p) ? `<span class="badge">New</span>` : '';
  return `<div class="img">${img}${tags ? `<span class="shop-tag"><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)}</span>${badge}` : ''}</div>`;
}
function card(p, { meta = true } = {}) {
  const i = DATA.products.indexOf(p);
  return `<button class="pcard" data-product="${i}">
    ${photo(p)}
    <span class="price">${gbp(p.unitPrice)}${p.packSize > 1 ? ` <small>each · ${gbp(p.price)} for ${p.packSize}</small>` : ''}</span>
    <span class="pname">${esc(p.name)}</span>
    ${meta ? `<span class="swatches">${p.baseColours.slice(0, 8).map(c => `<span class="swatch" title="${esc(c)}" style="background:${SWATCH[c] || 'transparent'}"></span>`).join('')}</span>
    <span class="meta">${p.sizes.length ? esc(sortSizes(p.sizes).join(' · ')) : 'Sizes not listed'}</span>
    <span class="meta">Released ${fmtDay(p.firstSeen)}</span>` : ''}
  </button>`;
}

// ---------------------------------------------------------------- controls
function renderControls() {
  // Category tiles: picture of the newest matching product + its average price.
  $('category-tiles').innerHTML = CATEGORIES.map(c => {
    const ps = DATA.products.filter(p => p.category === c.id && passesFilters(p));
    const pic = [...ps].filter(p => p.image).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen))[0]
      || DATA.products.find(p => p.category === c.id && p.image);
    const avg = marketStats(ps, RETAILERS).market.avg;
    return `<button class="cat-tile" role="tab" data-cat="${c.id}" aria-selected="${c.id === state.category}">
      ${pic ? `<img src="${esc(pic.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}
      <b>${esc(c.label)}</b><span>${avg == null ? 'No matches' : `avg ${gbp(avg)}`}</span></button>`;
  }).join('');

  const inCat = DATA.products.filter(p => p.category === state.category);
  const colours = COLOURS.map(([c]) => c).filter(c => inCat.some(p => p.baseColours.includes(c)));
  $('f-colour').innerHTML = `<option value="">Any colour</option>` + colours.map(c => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('');
  if (state.colour && !colours.includes(state.colour)) $('f-colour').insertAdjacentHTML('beforeend', `<option value="${esc(state.colour)}">${esc(state.colour)}</option>`);
  $('f-colour').value = state.colour;

  const sizes = sortSizes(tally(inCat.map(p => p.sizes)).filter(([, n]) => n >= 2).map(([s]) => s));
  $('f-size').innerHTML = `<option value="">Any size</option>` + sizes.map(s => `<option>${esc(s)}</option>`).join('');
  if (state.size && !sizes.includes(state.size)) $('f-size').insertAdjacentHTML('beforeend', `<option>${esc(state.size)}</option>`);
  $('f-size').value = state.size;

  const periods = [...new Set(inCat.map(p => periodOf(p.firstSeen)))].sort().reverse();
  if (state.period && !periods.includes(state.period)) periods.unshift(state.period);
  $('f-period').innerHTML = `<option value="">Any time</option>` + periods.map(k => `<option value="${k}">${periodLabel(k)}</option>`).join('');
  $('f-period').value = state.period;
  $('f-gender').value = state.gender;
  $('f-status').value = state.status;
  for (const b of document.querySelectorAll('[data-gran]')) b.setAttribute('aria-pressed', b.dataset.gran === state.gran);
}

// ---------------------------------------------------------------- hero
function renderHero(stats) {
  const m = stats.market;
  $('hero-label').textContent = `Average UK price of ${describe()}`;
  $('hero-num').textContent = gbp(m.avg);
  const cheapest = stats.byRetailer.filter(r => r.count).sort((a, b) => a.avg - b.avg)[0];
  const dearest = stats.byRetailer.filter(r => r.count).sort((a, b) => b.avg - a.avg)[0];
  $('hero-sub').textContent = m.count
    ? `Across ${m.count} products from ${m.retailerCount} retailer${m.retailerCount === 1 ? '' : 's'}.` +
      (cheapest && dearest && cheapest !== dearest ? ` Cheapest on average at ${cheapest.retailer.name} (${gbp(cheapest.avg)}), dearest at ${dearest.retailer.name} (${gbp(dearest.avg)}).` : '')
    : 'No products match these filters yet.';
  const items = [['Median', gbp(m.median)], ['Lowest', gbp(m.min)], ['Highest', gbp(m.max)], ['All products pooled', gbp(m.pooledAvg)]];
  $('hero-stats').innerHTML = m.count ? items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('') : '';

  $('picks').innerHTML = RETAILERS.map(r => {
    const p = current().filter(x => x.retailer === r.id).sort((a, b) => a.unitPrice - b.unitPrice)[0];
    return p ? card(p, { meta: false }) : `<div class="pick-empty">No matching products at ${esc(r.name)}</div>`;
  }).join('');
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

// ---------------------------------------------------------------- released over time
function renderTimeline() {
  // Every release in this category with the colour / who-for / size filters,
  // regardless of the period and on-sale filters, so all periods stay visible.
  const ps = DATA.products.filter(p => p.category === state.category && passesFilters(p, ['period', 'status']));
  const groups = new Map();
  for (const p of ps) {
    const k = periodOf(p.firstSeen);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const keys = [...groups.keys()].sort().reverse();
  if (!keys.length) { $('timeline').innerHTML = '<p class="gallery-empty">No releases match these filters.</p>'; $('timeline-more').hidden = true; return; }
  $('timeline').innerHTML = keys.slice(0, state.periods).map(k => {
    const list = groups.get(k).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
    const s = marketStats(list, RETAILERS);
    const live = list.filter(p => p.active).length;
    const shown = list.slice(0, 11);
    return `<div class="period">
      <div class="period-head">
        <button data-period="${k}" aria-pressed="${state.period === k}" title="Filter the page to this period">${periodLabel(k)}</button>
        <span class="stat">${list.length} new · average ${gbp(s.market.avg)} · ${live} still on sale</span>
      </div>
      <div class="period-mix">${s.byRetailer.filter(r => r.count).map(r => `<span><span class="dot" style="background:${seriesVar(r.retailer)}"></span>${esc(r.retailer.name)} ${r.count} · ${gbp(r.avg)}</span>`).join('')}</div>
      <div class="strip">${shown.map(p => card(p, { meta: false })).join('')}
        ${list.length > shown.length ? `<button class="more-tile" data-period="${k}" data-jump="1">See all ${list.length}</button>` : ''}</div>
    </div>`;
  }).join('');
  $('timeline-more').hidden = keys.length <= state.periods;
}

// ---------------------------------------------------------------- product gallery
function renderProducts(products) {
  const q = state.search.toLowerCase();
  let list = q ? products.filter(p => `${p.name} ${retailerById[p.retailer]?.name} ${p.colours.join(' ')}`.toLowerCase().includes(q)) : products;
  const [key, dir] = state.sort.split(':');
  list = [...list].sort((a, b) => {
    const va = key === 'retailer' ? retailerById[a.retailer].name : a[key], vb = key === 'retailer' ? retailerById[b.retailer].name : b[key];
    return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * Number(dir) || a.unitPrice - b.unitPrice;
  });
  $('product-count').textContent = `· ${list.length}`;
  $('gallery').innerHTML = list.length ? list.slice(0, state.limit).map(p => card(p)).join('') : '<p class="gallery-empty">No products match these filters.</p>';
  $('more').hidden = list.length <= state.limit;
}

// ---------------------------------------------------------------- lightbox
function openProduct(p) {
  const r = retailerById[p.retailer];
  const log = p.priceLog?.length > 1 ? `<div class="plog">${p.priceLog.map(l => `<span>${fmtDay(l.date)}: ${gbp(l.price)}</span>`).join('')}</div>` : null;
  const rows = [
    ['Shop', `<span class="bar-name"><span class="dot" style="background:${seriesVar(r)}"></span>${esc(r.name)}</span>`],
    ['Category', esc(CATEGORY_BY_ID[p.category]?.label)],
    ['Colours', esc(p.colours.join(', ')) || '–'],
    ['Sizes', esc(sortSizes(p.sizes).join(', ')) || '–'],
    ['Released', `${fmtDay(p.firstSeen)} <span class="muted">(${periodLabel(periodOf(p.firstSeen, 'season'))})</span>`],
    ['Status', p.active ? 'On sale now' : `No longer listed (last seen ${fmtDay(p.lastSeen)})`],
    log && ['Price history', log],
  ].filter(Boolean);
  $('lb-body').innerHTML = `${photo(p, { tags: false })}
    <div class="lb-info">
      <h3>${esc(p.name)}</h3>
      <div class="lb-price">${gbp(p.unitPrice)}${p.packSize > 1 ? ` <span class="muted" style="font-size:15px;font-weight:400">each · ${gbp(p.price)} for ${p.packSize}</span>` : ''}</div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${p.url ? `<a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">View at ${esc(r.name)} ↗</a>` : ''}
    </div>`;
  $('lightbox').showModal();
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
  renderTimeline();
  renderRetailers(stats);
  renderTrend();
  renderAvailability(products);
  renderMatrix();
  renderProducts(products);
}
const set = changes => { Object.assign(state, changes, { limit: 48 }); render(); };

document.addEventListener('click', e => {
  const prod = e.target.closest('[data-product]');
  if (prod) return openProduct(DATA.products[prod.dataset.product]);
  const cat = e.target.closest('[data-cat]');
  if (cat) { set({ category: cat.dataset.cat, period: '', periods: 6 }); if (cat.tagName === 'TR') scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const period = e.target.closest('[data-period]');
  if (period) {
    const k = period.dataset.period;
    set({ period: state.period === k && !period.dataset.jump ? '' : k });
    if (period.dataset.jump) $('gallery-card').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const gran = e.target.closest('[data-gran]');
  if (gran) set({ gran: gran.dataset.gran, period: '', periods: 6 });
});
for (const [id, k] of [['f-colour', 'colour'], ['f-gender', 'gender'], ['f-size', 'size'], ['f-period', 'period'], ['f-status', 'status']])
  $(id).addEventListener('change', e => set({ [k]: e.target.value }));
$('f-search').addEventListener('input', e => { state.search = e.target.value; renderProducts(current()); });
$('f-sort').addEventListener('change', e => { state.sort = e.target.value; renderProducts(current()); });
$('more').addEventListener('click', () => { state.limit += 96; renderProducts(current()); });
$('timeline-more').addEventListener('click', () => { state.periods += 12; renderTimeline(); });
$('lb-close').addEventListener('click', () => $('lightbox').close());
$('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) $('lightbox').close(); });
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
  DATA.products = DATA.products.map(normalise);
  NOW = Date.parse(DATA.generatedAt) || Date.now();
  $('sample-banner').hidden = !DATA.sample;
  $('retailer-names').textContent = RETAILERS.map(r => r.name).join(', ').replace(/, ([^,]*)$/, ' and $1');
  $('updated').textContent = `Updated ${new Date(DATA.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
  readHash();
  render();
}
load();
