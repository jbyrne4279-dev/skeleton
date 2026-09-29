// Shared by the scraper (Node) and the dashboard (browser).
// Categories: `search` terms are what we type into each retailer's search box,
// `match` must appear in a product name for it to count, `exclude` rules it out.

export const CATEGORIES = [
  { id: 't-shirts',  label: 'T-shirts',          search: ['t-shirt'],               match: /\b(t-?shirts?|tees?)\b/i,                 exclude: /\b(dress|nightie|pyjama|pack of cards)\b/i },
  { id: 'shirts',    label: 'Shirts',            search: ['shirt'],                 match: /\bshirts?\b/i,                            exclude: /\b(t-?shirt|sweatshirt|overshirt|dress)\b/i },
  { id: 'hoodies',   label: 'Hoodies',           search: ['hoodie'],                match: /\bhood(ie|y|ed)s?\b/i,                    exclude: /\b(coat|jacket|dress|towel|blanket)\b/i },
  { id: 'jumpers',   label: 'Jumpers & sweaters',search: ['jumper', 'sweater'],     match: /\b(jumpers?|sweaters?|cardigans?|knit)\b/i, exclude: /\b(dress|sweatshirt|hood)/i },
  { id: 'sweatshirts',label: 'Sweatshirts',      search: ['sweatshirt'],            match: /\bsweatshirts?\b/i,                       exclude: /\bhood/i },
  { id: 'coats',     label: 'Coats & jackets',   search: ['coat', 'jacket'],        match: /\b(coats?|jackets?|parkas?|puffers?|anoraks?|gilets?)\b/i, exclude: /\b(suit jacket|blazer|rain cover)\b/i },
  { id: 'jeans',     label: 'Jeans',             search: ['jeans'],                 match: /\bjeans?\b/i,                             exclude: /\b(jacket|shirt|skirt|shorts)\b/i },
  { id: 'joggers',   label: 'Joggers',           search: ['joggers'],               match: /\b(joggers?|jogging bottoms|sweatpants|track ?pants)\b/i, exclude: null },
  { id: 'socks',     label: 'Socks',             search: ['socks'],                 match: /\bsocks?\b/i,                             exclude: /\b(slipper|boot|shoe)\b/i },
  { id: 'underwear', label: 'Underwear',         search: ['boxers', 'knickers'],    match: /\b(boxers?|trunks|briefs|knickers|pants)\b/i, exclude: /\b(jogging|track|cargo|wide leg|trousers)\b/i },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Base colours we normalise every retailer colour name to ("Optic White" -> white).
// Order matters: first match wins, so specific shades come before broad ones.
export const COLOURS = [
  ['cream',  /\b(cream|ecru|ivory|off[- ]?white|oatmeal|stone|natural)\b/i],
  ['white',  /\bwhite\b/i],
  ['black',  /\b(black|jet|onyx)\b/i],
  ['navy',   /\b(navy|midnight)\b/i],
  ['grey',   /\b(grey|gray|charcoal|marl|slate|silver)\b/i],
  ['blue',   /\b(blue|denim|indigo|cobalt|sky|teal|turquoise|aqua)\b/i],
  ['green',  /\b(green|khaki|olive|sage|mint|forest|emerald)\b/i],
  ['red',    /\b(red|burgundy|wine|berry|maroon|rust)\b/i],
  ['pink',   /\b(pink|rose|blush|fuchsia|coral)\b/i],
  ['purple', /\b(purple|lilac|lavender|plum|violet|mauve)\b/i],
  ['yellow', /\b(yellow|mustard|lemon|gold)\b/i],
  ['orange', /\b(orange|peach|apricot|terracotta)\b/i],
  ['brown',  /\b(brown|chocolate|tan|camel|mocha|taupe|toffee|beige|sand)\b/i],
  ['multi',  /\b(multi|print|stripe|check|floral|mix)\w*\b/i],
];

export function baseColour(name) {
  if (!name) return null;
  for (const [base, re] of COLOURS) if (re.test(name)) return base;
  return 'other';
}

export function categorise(name, hintId) {
  // Prefer the category we searched for if the name agrees with it, otherwise
  // fall back to whichever category the name matches first.
  const fits = c => c.match.test(name) && !(c.exclude && c.exclude.test(name));
  if (hintId && CATEGORY_BY_ID[hintId] && fits(CATEGORY_BY_ID[hintId])) return hintId;
  const hit = CATEGORIES.find(fits);
  return hit ? hit.id : null;
}

export function detectGender(text) {
  const t = (text || '').toLowerCase();
  if (/\b(kids?|boys?|girls?|baby|toddler|junior|older|younger|children)\b|\/(kids|boys|girls|baby)\b/.test(t)) return 'kids';
  if (/\b(women'?s?|womens|ladies|female)\b|\/(women|womens|ladies)\b/.test(t)) return 'women';
  if (/\b(men'?s?|mens|male)\b|\/(men|mens)\b/.test(t)) return 'men';
  return 'unisex';
}

// "5 Pack", "Pack of 3", "3pk", "multipack of 7" -> number of items.
export function packSize(name) {
  const m = (name || '').match(/\b(\d{1,2})\s*(?:-|\s)?(?:pack|pk|pairs?)\b|\bpack of (\d{1,2})\b|\bmultipack of (\d{1,2})\b/i);
  const n = m ? Number(m[1] || m[2] || m[3]) : 1;
  return n >= 1 && n <= 20 ? n : 1;
}
