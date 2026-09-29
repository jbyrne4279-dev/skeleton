# UK Clothing Price Index

Tracks what everyday clothes cost on the UK high street. A scraper visits
**Next, M&S, H&M and Primark**, searches each one for every category
(T-shirts, shirts, hoodies, jumpers, sweatshirts, coats, jeans, joggers, socks,
underwear) and records each product's **price, colours and sizes**. It also
**screenshots each product's photo** on the retailer's site (saved as a small
WebP) and remembers **when each product first appeared**, so you can see what
was released when. The dashboard turns that into:

- **picture tiles** for every category, and a **photo gallery** of every product
  (click one for a larger view, colours, sizes, release date and price history)
- **Released over time**: new products grouped by month, quarter or season
  (Spring/Summer/Autumn/Winter), with each drop's average price per shop.
  Click a period to filter the whole page to it
- **cheapest product at each shop**, with pictures
- **UK average price** for any category, narrowed by colour, men/women/kids and
  size — e.g. "average price of a white T-shirt in the UK"
- average / median / cheapest / dearest **per retailer**
- a **price trend** over time (one data point per scrape day)
- which **sizes and colours** each retailer stocks
- an **every-category matrix** and a searchable, sortable **product list**

Views are shareable: the filters live in the URL, e.g.
`index.html#category=t-shirts&colour=white&gender=men&period=month:2026-09`.

## Quick start

```bash
cd price-tracker
npm install
npx playwright install chromium   # one-off browser download

npm run scrape    # collect real products, prices and photos (takes a while)
npm run serve     # open http://localhost:8080
```

The repo ships with no product data: everything on the dashboard comes from
the retailers' own sites. (`npm run sample` makes clearly-marked fake data if
you just want to try the layout; it is ignored by git and replaced by the
first real scrape.)

Scraper options:

```bash
npm run scrape -- --retailer hm            # one retailer (next | mands | hm | primark)
npm run scrape -- --category socks         # one category
npm run scrape -- --max 10                 # products per search term (default 24)
npm run scrape -- --headful --debug        # watch the browser; save pages to data/debug/
npm run scrape -- --refresh-images         # re-take screenshots that already exist
```

## How prices are worked out

- **Price** is the lowest current price on the product page (sale prices count).
- **Multipacks** ("5 Pack Socks", "Pack of 3 Boxers") are divided by pack size,
  so socks and underwear compare per item.
- **UK average** = the mean of each retailer's average, so a retailer with 200
  T-shirts doesn't outweigh one with 20. The pooled average of every product is
  shown next to it.
- **Colours** are normalised to base colours ("Optic White" → white,
  "Ecru" → cream) so you can filter across retailers.

## Pictures and release dates

- **Pictures are the exact product.** Each retailer's product page names its
  own product photo in its schema.org data. The scraper finds that photo on the
  page and screenshots it (`on-page`); if it isn't on screen, it downloads that
  same photo (`official`). Only if the retailer names no photo at all does it
  fall back to the largest image near the top of the page (`guess`), and the
  product's detail view then says the picture may not match. The method used
  is saved per product as `imageMatch`.
- **One picture per colour.** When the retailer publishes a photo for each
  colour, each is saved too. Filtering by a colour shows that colour's photo,
  and the detail view shows every colour as a thumbnail.
- Pictures are saved as 480px WebP files in `data/images/<retailer>/`. Each is
  taken once; later runs reuse the file (`--refresh-images` re-takes them).
- **Released** is the date the product first appeared on the retailer's site.
  If the retailer publishes its own release date, that's used; otherwise it's
  the first day the scraper saw it. So release dates build up from your first
  scrape onwards. Products that are dropped stay in the data as "No longer
  listed", so older releases remain visible.
- Price changes are logged per product and shown in its detail view.

Product data comes from the schema.org JSON-LD retailers publish for Google
Shopping, with Open Graph price tags and the visible size/colour pickers as
fallbacks. See `scraper/extract.js`.

## Keeping it up to date automatically

`.github/workflows/scrape-prices.yml` runs the scraper every day on GitHub
Actions and commits the new `data/*.json`, which builds up the price history.
You can also start it by hand from the repo's **Actions** tab. To publish the
dashboard, turn on GitHub Pages for the repo; it will be at
`/price-tracker/`.

## When a retailer stops working

Retailers redesign their sites and use bot protection, so expect to adjust
things now and then:

1. Run `npm run scrape -- --retailer <id> --max 3 --headful --debug`.
2. If it finds **0 product links**, the search URL or product link pattern in
   `lib/retailers.js` needs updating — look at the saved page in `data/debug/`.
3. If it finds links but **0 products with a price**, the product page layout
   changed; check the saved product page and adjust `scraper/extract.js` or
   the selectors in `readDom()` in `scraper/scrape.js`.
4. If pages are blocked (captcha / "access denied"), run from your own machine
   with `--headful`, lower `--concurrency`, or scrape less often. GitHub's
   data-centre IPs are more likely to be blocked than a home connection.

A failed run never wipes existing data: categories that return nothing keep
their previous products.

Add retailers in `lib/retailers.js`, categories and colour names in
`lib/catalog.js`.

## Files

| Path | What it is |
|---|---|
| `index.html`, `site/` | The dashboard (plain HTML/CSS/JS, no build step) |
| `lib/` | Categories, colours, retailers and statistics shared by scraper and dashboard |
| `scraper/scrape.js` | Playwright scraper |
| `scraper/extract.js` | Turns a product page into a price/colour/size record |
| `scraper/make-sample.js` | Generates fake data for trying the layout (not committed) |
| `scraper/merge.js` | Tracks release dates, dropped products and price changes between runs |
| `data/products.json` | Every product ever seen, with its latest details |
| `data/images/` | Product screenshots (WebP) |
| `data/history.json` | Daily average per retailer and category |
| `test/` | `npm test` |

Please scrape politely: the defaults visit a few pages at a time, once a day.
Check each retailer's terms before using the data commercially.
