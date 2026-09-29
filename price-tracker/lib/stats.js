// Price statistics, shared by the scraper (history snapshots) and the dashboard.

export function summarise(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return { count: 0, avg: null, median: null, min: null, max: null };
  const mid = Math.floor(v.length / 2);
  return {
    count: v.length,
    avg: v.reduce((s, x) => s + x, 0) / v.length,
    median: v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2,
    min: v[0],
    max: v[v.length - 1],
  };
}

// Per-retailer stats plus a UK market figure. The market average is the mean of
// the retailers' own averages, so a retailer listing 200 T-shirts doesn't
// outweigh one listing 20.
export function marketStats(products, retailers) {
  const byRetailer = retailers.map(r => ({
    retailer: r,
    ...summarise(products.filter(p => p.retailer === r.id).map(p => p.unitPrice)),
  }));
  const withData = byRetailer.filter(r => r.count);
  const all = summarise(products.map(p => p.unitPrice));
  return {
    byRetailer,
    market: {
      ...all,
      avg: withData.length ? withData.reduce((s, r) => s + r.avg, 0) / withData.length : null,
      pooledAvg: all.avg,
      retailerCount: withData.length,
    },
  };
}

export function tally(lists) {
  const counts = new Map();
  for (const list of lists) for (const x of new Set(list)) counts.set(x, (counts.get(x) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const SIZE_ORDER = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL'];
export function sortSizes(sizes) {
  const rank = s => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase());
    if (i >= 0) return [0, i];
    const n = parseFloat(s.replace(/^UK\s*/i, ''));
    return Number.isFinite(n) ? [1, n] : [2, 0];
  };
  return [...sizes].sort((a, b) => {
    const [ga, ra] = rank(a), [gb, rb] = rank(b);
    return ga - gb || ra - rb || a.localeCompare(b);
  });
}
