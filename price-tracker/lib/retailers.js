// Retailers to track. To add one: give it a search URL and a regex that
// recognises its product-page links. `searchUrl` receives the URL-encoded term.
// Retailers change their sites often - if a retailer starts returning 0
// products, check these two fields first (run the scraper with --debug).

export const RETAILERS = [
  {
    id: 'next',
    name: 'Next',
    colour: 1,
    searchUrl: q => `https://www.next.co.uk/search?w=${q}`,
    productLink: /next\.co\.uk\/style\/[a-z0-9]+\/[a-z0-9]+/i,
  },
  {
    id: 'mands',
    name: 'M&S',
    colour: 2,
    searchUrl: q => `https://www.marksandspencer.com/search?searchTerm=${q}`,
    productLink: /marksandspencer\.com\/[^?#]*\/p\/[a-z0-9]+/i,
  },
  {
    id: 'hm',
    name: 'H&M',
    colour: 3,
    searchUrl: q => `https://www2.hm.com/en_gb/search-results.html?q=${q}`,
    productLink: /hm\.com\/en_gb\/productpage\.\d+\.html/i,
  },
  {
    id: 'primark',
    name: 'Primark',
    colour: 4,
    searchUrl: q => `https://www.primark.com/en-gb/search?q=${q}`,
    productLink: /primark\.com\/en-gb\/p\/[^?#]+/i,
  },
];

// Browser-safe view (no functions/regexes) for the dashboard.
export const RETAILER_INFO = RETAILERS.map(({ id, name, colour }) => ({ id, name, colour }));
