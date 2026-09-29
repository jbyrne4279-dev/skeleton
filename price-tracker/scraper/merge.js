// Folds one scrape run into the running product catalogue.
//
// Every product ever seen is kept, so the dashboard can show what was released
// when and what has since disappeared:
//   firstSeen - first scrape day it appeared (or the retailer's own releaseDate)
//   lastSeen  - most recent scrape day it was listed
//   active    - listed in the latest run for its retailer + category
//   priceLog  - [{ date, price }] each time the price changed

export const keyOf = p => `${p.url}|${p.category}`;

/**
 * @param {object[]} prev   Products from the previous products.json.
 * @param {object[]} fresh  Products scraped this run.
 * @param {Set<string>} done  "retailer|category" pairs that returned data this run.
 * @param {string} today    YYYY-MM-DD
 */
export function mergeRun(prev, fresh, done, today) {
  const old = new Map(prev.map(p => [keyOf(p), p]));
  const out = new Map();

  for (const p of fresh) {
    const was = old.get(keyOf(p));
    const firstSeen = [was?.firstSeen, p.releaseDate?.slice(0, 10), today].filter(Boolean).sort()[0];
    const priceLog = [...(was?.priceLog || [])];
    if (!priceLog.length || priceLog.at(-1).price !== p.price) priceLog.push({ date: today, price: p.price });
    out.set(keyOf(p), {
      ...p,
      image: p.image || was?.image || null,
      firstSeen,
      lastSeen: today,
      active: true,
      priceLog,
    });
  }

  for (const [k, p] of old) {
    if (out.has(k)) continue;
    // A category that returned data this run but no longer lists this product
    // means it's been dropped. A category that failed entirely tells us nothing,
    // so its products keep their previous status.
    out.set(k, done.has(`${p.retailer}|${p.category}`) ? { ...p, active: false } : p);
  }
  return [...out.values()];
}
