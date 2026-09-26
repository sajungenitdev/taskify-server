// src/services/tenderCrawler.service.js
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const SiteSource = require("../models/SiteSource.model");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function toAbsolute(href, baseUrl) {
  if (!href) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/* ============================================================
 * AUTO-DETECT SELECTORS
 *
 * Strategy (first match wins):
 *   1. Common table-row patterns (BPDB, LGED, gov sites)
 *   2. Common card/list-item patterns
 *   3. Fallback: every <a> whose text/href looks like a tender
 * ============================================================ */
function autoDetectSelectors($) {
  /* ---------- 1. Table-based portals ---------- */
  const TABLE_ROW_CANDIDATES = [
    "table#dataTable tbody tr",
    "table#tblList tbody tr",
    "table#GridView1 tbody tr",
    "table.table tbody tr",
    "table.table-bordered tbody tr",
    "table.tableView tbody tr",
    "table#tenderTable tbody tr",
    "table tbody tr",
  ];

  for (const rowSel of TABLE_ROW_CANDIDATES) {
    const rows = $(rowSel);
    if (rows.length < 3) continue;

    const firstRow = rows.first();
    const cells = firstRow.find("td");
    if (cells.length === 0) continue;

    /* Find the cell with the highest "tender-likeness" score */
    let bestCellIdx = -1;
    let bestScore = 0;

    cells.each((i, cell) => {
      const $cell = $(cell);
      const links = $cell.find("a");
      let score = 0;

      links.each((_, a) => {
        const txt = $(a).text().trim();
        const href = $(a).attr("href") || "";

        if (txt.length > 20) score += 2;
        if (/tender|supply|procurement|repair|purchase|work|consultancy/i.test(txt))
          score += 3;
        if (/\/\d{4}\//.test(href)) score += 1;
        if (/\.pdf$/i.test(href)) score += 1;
      });

      if (score > bestScore) {
        bestScore = score;
        bestCellIdx = i;
      }
    });

    if (bestCellIdx === -1) continue;

    return {
      listSelector: rowSel,
      titleSelector: `td:nth-child(${bestCellIdx + 1}) a`,
      linkSelector: `td:nth-child(${bestCellIdx + 1}) a`,
      dateSelector: "td:last-child",
      linkAttr: "href",
    };
  }

  /* ---------- 2. Card / list-based portals ---------- */
  const LIST_CANDIDATES = [
    ".tender-list .tender-item",
    ".tender-list > li",
    ".tender-card",
    "ul.tender-list > li",
    "ul.notice-list > li",
    ".notice-item",
    ".list-item",
    "article.tender",
    "li.tender",
  ];

  for (const itemSel of LIST_CANDIDATES) {
    const items = $(itemSel);
    if (items.length < 3) continue;

    const firstItem = items.first();
    const link = firstItem.find("a").first();
    if (link.length === 0) continue;

    return {
      listSelector: itemSel,
      titleSelector: "a",
      linkSelector: "a",
      dateSelector: ".date, .published, time, .post-date",
      linkAttr: "href",
    };
  }

  /* ---------- 3. Fallback: raw link scan ---------- */
  const TENDER_HREF_RE = /\/(tender|tenders|notice|notices|procurement|egp)\//i;
  const TENDER_TEXT_RE =
    /tender|supply|procurement|purchase|repair|work|consultancy|re-?tender/i;

  const links = [];
  $("a").each((_, a) => {
    const href = $(a).attr("href") || "";
    const text = $(a).text().trim();

    if (
      text.length >= 15 &&
      (TENDER_HREF_RE.test(href) || TENDER_TEXT_RE.test(text))
    ) {
      links.push({ text, href });
    }
  });

  if (links.length >= 3) {
    return {
      listSelector: "__fallback_links__",
      titleSelector: "",
      linkSelector: "",
      dateSelector: "",
      linkAttr: "href",
      _fallbackLinks: links.slice(0, 100),
    };
  }

  return null;
}

/* ---------- Cheerio parser (static HTML) ---------- */
function parseWithCheerio(html, source) {
  const $ = cheerio.load(html);

  /* Build effective config — auto-detect if listSelector empty */
  let effective = {
    listSelector: source.listSelector,
    titleSelector: source.titleSelector,
    linkSelector: source.linkSelector,
    dateSelector: source.dateSelector,
    linkAttr: source.linkAttr || "href",
  };

  let detected = null;
  if (!effective.listSelector) {
    const auto = autoDetectSelectors($);
    if (!auto) return [];
    detected = auto;
    effective = { ...effective, ...auto };
  }

  /* --- Fallback sentinel: raw link list, no row wrapping --- */
  if (effective.listSelector === "__fallback_links__") {
    return (effective._fallbackLinks || []).map((c) => ({
      title: c.text,
      tenderLink: source.absoluteLinks
        ? toAbsolute(c.href, source.url)
        : c.href,
      publishedAtText: "",
      sourceSite: source.name,
      sourceDomain: source.domain || domainOf(source.url),
    }));
  }

  /* --- Normal path --- */
  const rows = $(effective.listSelector);
  const tenders = [];

  rows.each((_, el) => {
    const $el = $(el);
    const title = $el.find(effective.titleSelector).text().trim();
    const rawLink =
      $el.find(effective.linkSelector).attr(effective.linkAttr) || "";
    const dateText = $el.find(effective.dateSelector).text().trim();

    if (!title) return;

    tenders.push({
      title,
      tenderLink: source.absoluteLinks
        ? toAbsolute(rawLink, source.url)
        : rawLink,
      publishedAtText: dateText,
      sourceSite: source.name,
      sourceDomain: source.domain || domainOf(source.url),
    });
  });

  return tenders;
}

/* ---------- Puppeteer parser (JS-rendered pages) ---------- */
async function parseWithPuppeteer(source) {
  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 1366, height: 900 });
    await page.setBypassCSP(true);

    await page.goto(source.url, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });

    /* Wait for a row selector if one was given */
    if (source.listSelector) {
      try {
        await page.waitForSelector(source.listSelector, { timeout: 20000 });
      } catch {
        console.warn(
          `[puppeteer] selector "${source.listSelector}" not found within 20s on ${source.url}`,
        );
      }
    }

    /* Give JS a moment to inject rows */
    await new Promise((r) => setTimeout(r, 1500));

    /* If no selectors provided, detect from the rendered DOM via Cheerio */
    let effective = source;
    if (!source.listSelector) {
      const renderedHtml = await page.content();
      const $ = cheerio.load(renderedHtml);
      const auto = autoDetectSelectors($);
      if (!auto) return [];
      effective = { ...source, ...auto };

      /* Sentinel — extract from Cheerio directly */
      if (effective.listSelector === "__fallback_links__") {
        return (effective._fallbackLinks || []).map((c) => ({
          title: c.text,
          tenderLink: source.absoluteLinks
            ? toAbsolute(c.href, source.url)
            : c.href,
          publishedAtText: "",
          sourceSite: source.name,
          sourceDomain: source.domain || domainOf(source.url),
        }));
      }
    }

    const tenders = await page.evaluate(
      (cfg) => {
        const rows = document.querySelectorAll(cfg.row);
        const out = [];

        rows.forEach((row) => {
          const titleEl = row.querySelector(cfg.title);
          const linkEl = row.querySelector(cfg.link);
          const dateEl = cfg.date ? row.querySelector(cfg.date) : null;

          const title = titleEl ? titleEl.innerText.trim() : "";
          if (!title) return;

          let rawLink = "";
          if (linkEl) {
            rawLink = linkEl.getAttribute(cfg.linkAttr || "href") || "";
          }

          let absLink = rawLink;
          try {
            absLink = new URL(rawLink, window.location.href).toString();
          } catch {
            absLink = rawLink;
          }

          out.push({
            title,
            tenderLink: absLink,
            publishedAtText: dateEl ? dateEl.innerText.trim() : "",
          });
        });

        return out;
      },
      {
        row: effective.listSelector,
        title: effective.titleSelector,
        link: effective.linkSelector,
        date: effective.dateSelector,
        linkAttr: effective.linkAttr || "href",
      },
    );

    return tenders.map((t) => ({
      ...t,
      sourceSite: source.name,
      sourceDomain: source.domain || domainOf(source.url),
    }));
  } finally {
    await browser.close();
  }
}

/* ---------- Fetch raw HTML ---------- */
async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    headers: {
      "User-Agent": randomUA(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
    httpsAgent,
  });
  return data;
}

/* ---------- Crawl one site (auto mode with fallback) ---------- */
async function crawlOne(source) {
  const started = new Date();
  const isPersisted = !!source._id;
  const renderMode = source.renderMode || "auto";   // default → auto

  try {
    let tenders = [];
    let effectiveMode = "cheerio";
    let fellBack = false;
    let detectedSelectors = null;

    if (renderMode === "puppeteer") {
      tenders = await parseWithPuppeteer(source);
      effectiveMode = "puppeteer";
    } else if (renderMode === "cheerio") {
      const html = await fetchHtml(source.url);
      tenders = parseWithCheerio(html, source);
      effectiveMode = "cheerio";
    } else {
      /* ---------- AUTO: cheerio first, puppeteer if 0 ---------- */
      try {
        const html = await fetchHtml(source.url);
        tenders = parseWithCheerio(html, source);
      } catch (err) {
        console.warn(
          `[crawl] cheerio fetch failed for ${source.name}: ${err.message}`,
        );
        tenders = [];
      }

      if (tenders.length === 0) {
        console.log(
          `[crawl] cheerio found 0 on ${source.name} — trying puppeteer…`,
        );
        tenders = await parseWithPuppeteer(source);
        effectiveMode = "puppeteer";
        fellBack = true;
      }
    }

    if (isPersisted) {
      await SiteSource.findByIdAndUpdate(source._id, {
        lastCrawledAt: started,
        lastCrawlStatus: "success",
        lastCrawlError: "",
        lastItemCount: tenders.length,
      });
    }

    return {
      ok: true,
      source: source.name,
      count: tenders.length,
      tenders,
      effectiveMode,
      fellBack,
      detectedSelectors,
    };
  } catch (err) {
    if (isPersisted) {
      await SiteSource.findByIdAndUpdate(source._id, {
        lastCrawledAt: started,
        lastCrawlStatus: "error",
        lastCrawlError: String(err.message).slice(0, 500),
        lastItemCount: 0,
      });
    }

    return {
      ok: false,
      source: source.name,
      count: 0,
      tenders: [],
      error: err.message,
    };
  }
}

async function crawlAllSources({ delayMs = 1500 } = {}) {
  const sources = await SiteSource.find({ active: true }).lean();
  const results = [];

  for (const source of sources) {
    const r = await crawlOne(source);
    results.push(r);
    if (delayMs) await new Promise((res) => setTimeout(res, delayMs));
  }

  return results;
}

module.exports = {
  crawlOne,
  crawlAllSources,
  autoDetectSelectors,
  fetchHtml,
  parseWithCheerio,
};