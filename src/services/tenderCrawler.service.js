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

/* ---------- Cheerio parser (static HTML) ---------- */
function parseWithCheerio(html, source) {
  const $ = cheerio.load(html);
  const rows = $(source.listSelector);

  const tenders = [];
  rows.each((_, el) => {
    const $el = $(el);
    const title = $el.find(source.titleSelector).text().trim();
    const rawLink =
      $el.find(source.linkSelector).attr(source.linkAttr || "href") || "";
    const dateText = $el.find(source.dateSelector).text().trim();

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

    /* Ignore TLS errors */
    await page.setBypassCSP(true);

    await page.goto(source.url, {
      waitUntil: "networkidle2",
      timeout: 45000,
    });

    /* Wait for the table rows to appear */
    try {
      await page.waitForSelector(source.listSelector, { timeout: 20000 });
    } catch {
      console.warn(
        `[puppeteer] selector "${source.listSelector}" not found within 20s on ${source.url}`,
      );
    }

    /* Give JS a moment to inject rows */
    await new Promise((r) => setTimeout(r, 1500));

    const tenders = await page.evaluate(
      (cfg) => {
        const rows = document.querySelectorAll(cfg.row);
        const out = [];

        rows.forEach((row) => {
          const titleEl = row.querySelector(cfg.title);
          const linkEl = row.querySelector(cfg.link);
          const dateEl = row.querySelector(cfg.date);

          const title = titleEl ? titleEl.innerText.trim() : "";
          if (!title) return;

          let rawLink = "";
          if (linkEl) {
            rawLink = linkEl.getAttribute(cfg.linkAttr || "href") || "";
          }

          /* Make absolute if relative */
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
        row: source.listSelector,
        title: source.titleSelector,
        link: source.linkSelector,
        date: source.dateSelector,
        linkAttr: source.linkAttr || "href",
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

/* ---------- Crawl one site (routes to cheerio or puppeteer) ---------- */
async function crawlOne(source) {
  const started = new Date();
  const isPersisted = !!source._id;
  const renderMode = source.renderMode || "cheerio";

  try {
    let tenders = [];

    if (renderMode === "puppeteer") {
      tenders = await parseWithPuppeteer(source);
    } else {
      const { data: html } = await axios.get(source.url, {
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
      tenders = parseWithCheerio(html, source);
    }

    if (isPersisted) {
      await SiteSource.findByIdAndUpdate(source._id, {
        lastCrawledAt: started,
        lastCrawlStatus: "success",
        lastCrawlError: "",
        lastItemCount: tenders.length,
      });
    }

    return { ok: true, source: source.name, count: tenders.length, tenders };
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

module.exports = { crawlOne, crawlAllSources };