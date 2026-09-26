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
 * Build a scoped cheerio context using sectionSelector
 *
 * IMPORTANT: We do NOT rebuild the cheerio root here. Rebuilding
 * it loses DOM context (DataTables wrappers, sibling relationships,
 * etc.) which breaks detection on real-world sites.
 *
 * Returns:
 *   $scope                    — always the full cheerio root
 *   matched                   — the matched section nodes (or null)
 *   effectiveSectionSelector  — the selector that actually matched
 * ============================================================ */
function buildScope($full, sectionSelector) {
  const trimmed = (sectionSelector || "").trim();
  if (!trimmed) {
    return { $scope: $full, matched: null, effectiveSectionSelector: null };
  }

  const matched = $full(trimmed);
  if (matched.length === 0) {
    // Selector didn't match — fall back to the full page
    return { $scope: $full, matched: null, effectiveSectionSelector: null };
  }

  return { $scope: $full, matched, effectiveSectionSelector: trimmed };
}

/* ============================================================
 * AUTO-DETECT SELECTORS
 *
 * Strategy (first match wins):
 *   1. Common table-row patterns (BPDB, LGED, NESCO, gov sites)
 *   2. Common card/list-item patterns
 *   3. Fallback: every <a> whose text/href looks like a tender
 *
 * When `matched` (a section) is passed, candidate lookups prefer
 * nodes INSIDE that section first.
 * ============================================================ */
function autoDetectSelectors($, matched) {
  /* Helper: search inside the section first, then the whole page */
  const findRows = (selector) => {
    if (matched && matched.length > 0) {
      try {
        const within = matched.find(selector);
        if (within.length > 0) return within;
      } catch {
        /* invalid selector — fall through */
      }
    }
    return $(selector);
  };

  /* ---------- 1. Table-based portals ---------- */
  const TABLE_ROW_CANDIDATES = [
    "table tbody tr",
    "table.dataTable tbody tr",
    "table.notice-table tbody tr",
    "table#noticeTable tbody tr",
    "table tbody tr[role='row']",
    ".dataTables_wrapper tbody tr",
    "table#dataTable tbody tr",
    "table#tblList tbody tr",
    "table#GridView1 tbody tr",
    "table.table tbody tr",
    "table.table-bordered tbody tr",
    "table.tableView tbody tr",
    "table#tenderTable tbody tr",
    "tbody tr",
  ];

  for (const rowSel of TABLE_ROW_CANDIDATES) {
    const rows = findRows(rowSel);
    if (rows.length < 3) continue;

    const firstRow = rows.first();
    // ✅ Support both <td> AND <th> cells (NESCO uses <th> inside <tbody>)
    const cells = firstRow.find("td, th");
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
        if (/tender|supply|procurement|repair|purchase|work|consultancy|bid/i.test(txt))
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

    const idx = bestCellIdx + 1;
    return {
      listSelector: rowSel,
      titleSelector: `td:nth-child(${idx}) a, th:nth-child(${idx}) a, td:nth-child(${idx}), th:nth-child(${idx})`,
      linkSelector: `td:nth-child(${idx}) a, th:nth-child(${idx}) a`,
      dateSelector: "td:last-child, th:last-child",
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
    const items = findRows(itemSel);
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

  /* ---------- 3. Fallback: raw link scan inside the scope ---------- */
  const TENDER_HREF_RE = /\/(tender|tenders|notice|notices|procurement|egp)\//i;
  const TENDER_TEXT_RE =
    /tender|supply|procurement|purchase|repair|work|consultancy|re-?tender|bid/i;

  const links = [];
  const linkPool = matched && matched.length > 0 ? matched.find("a") : $("a");

  linkPool.each((_, a) => {
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

/* ============================================================
 * Cheerio parser (static HTML) — scoped by sectionSelector
 * ============================================================ */
function parseWithCheerio(html, source) {
  const $full = cheerio.load(html);

  const { $scope, matched, effectiveSectionSelector } = buildScope(
    $full,
    source.sectionSelector,
  );

  /* Build effective config — auto-detect if listSelector empty */
  let effective = {
    listSelector: source.listSelector || "",
    titleSelector: source.titleSelector || "",
    linkSelector: source.linkSelector || "",
    dateSelector: source.dateSelector || "",
    linkAttr: source.linkAttr || "href",
  };

  let detected = null;
  if (!effective.listSelector) {
    const auto = autoDetectSelectors($scope, matched);
    if (!auto) {
      return { tenders: [], effectiveSectionSelector, detected: null };
    }
    detected = auto;
    effective = { ...effective, ...auto };
  }

  /* --- Fallback sentinel: raw link list, no row wrapping --- */
  if (effective.listSelector === "__fallback_links__") {
    const list = (effective._fallbackLinks || []).map((c) => ({
      title: c.text,
      tenderLink: source.absoluteLinks
        ? toAbsolute(c.href, source.url)
        : c.href,
      publishedAtText: "",
      sourceSite: source.name,
      sourceDomain: source.domain || domainOf(source.url),
    }));
    return { tenders: list, effectiveSectionSelector, detected };
  }

  /* --- Normal path: prefer rows scoped inside the section --- */
  let rows;
  if (matched && matched.length > 0) {
    try {
      const scoped = matched.find(effective.listSelector);
      rows = scoped.length > 0 ? scoped : $scope(effective.listSelector);
    } catch {
      rows = $scope(effective.listSelector);
    }
  } else {
    rows = $scope(effective.listSelector);
  }

  const tenders = [];

  rows.each((_, el) => {
    const $el = $scope(el);

    /* Title — selector first, then first <a>, then first td/th */
    let title = $el.find(effective.titleSelector).text().trim();
    if (!title) {
      title =
        $el.find("a").first().text().trim() ||
        $el.find("td, th").eq(1).text().trim() ||
        "";
    }
    if (!title) return;

    /* Link — selector first, then first <a> */
    let rawLink =
      $el.find(effective.linkSelector).attr(effective.linkAttr) || "";
    if (!rawLink) {
      rawLink = $el.find("a[href]").first().attr("href") || "";
    }

    /* Date */
    const dateText = $el.find(effective.dateSelector).text().trim();

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

  return { tenders, effectiveSectionSelector, detected };
}

/* ============================================================
 * Puppeteer parser (JS-rendered pages) — honours sectionSelector
 * ============================================================ */
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

    /* ✅ Wait for the section selector first (if provided) */
    const sectionSel = (source.sectionSelector || "").trim();
    let effectiveSectionSelector = null;

    if (sectionSel) {
      try {
        await page.waitForSelector(sectionSel, { timeout: 15000 });
        effectiveSectionSelector = sectionSel;
      } catch {
        console.warn(
          `[puppeteer] sectionSelector "${sectionSel}" not found on ${source.url} — using full page`,
        );
      }
    }

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

    /* If no listSelector provided, detect from the rendered DOM */
    let effective = { ...source };
    let detected = null;

    if (!source.listSelector) {
      const renderedHtml = await page.content();
      const $full = cheerio.load(renderedHtml);
      const { matched, effectiveSectionSelector: detectedSection } =
        buildScope($full, sectionSel);

      if (detectedSection) effectiveSectionSelector = detectedSection;

      const auto = autoDetectSelectors($full, matched);
      if (!auto) {
        return { tenders: [], effectiveSectionSelector, detected: null };
      }
      detected = auto;
      effective = { ...source, ...auto };

      /* If the fallback link scan matched, use cheerio directly */
      if (effective.listSelector === "__fallback_links__") {
        const list = (effective._fallbackLinks || []).map((c) => ({
          title: c.text,
          tenderLink: source.absoluteLinks
            ? toAbsolute(c.href, source.url)
            : c.href,
          publishedAtText: "",
          sourceSite: source.name,
          sourceDomain: source.domain || domainOf(source.url),
        }));
        return { tenders: list, effectiveSectionSelector, detected };
      }
    }

    /* ✅ Evaluate in the live browser, scoped to the section */
    const tenders = await page.evaluate(
      (cfg) => {
        const sectionEl = cfg.section
          ? document.querySelector(cfg.section)
          : null;
        const root = sectionEl || document;

        /* Try the detected row selector; fall back to common variants */
        const rowCandidates = [
          cfg.row,
          "table tbody tr",
          "tbody tr",
          "tr[role='row']",
        ];

        let rows = [];
        for (const sel of rowCandidates) {
          if (!sel) continue;
          try {
            const found = root.querySelectorAll(sel);
            if (found && found.length > 0) {
              rows = Array.from(found);
              break;
            }
          } catch {
            /* invalid selector — skip */
          }
        }

        const out = [];

        rows.forEach((row) => {
          /* Title */
          let title = "";
          if (cfg.title) {
            try {
              const t = row.querySelector(cfg.title);
              if (t) title = t.innerText.trim();
            } catch {
              /* invalid */
            }
          }
          if (!title) {
            title = (row.innerText || "").trim().split("\n")[0];
          }
          if (!title) return;

          /* Link */
          let rawLink = "";
          if (cfg.link) {
            try {
              const l = row.querySelector(cfg.link);
              if (l) rawLink = l.getAttribute(cfg.linkAttr || "href") || "";
            } catch {
              /* invalid */
            }
          }
          if (!rawLink) {
            const l = row.querySelector("a[href]");
            if (l) rawLink = l.getAttribute("href") || "";
          }

          let absLink = rawLink;
          try {
            absLink = new URL(rawLink, window.location.href).toString();
          } catch {
            absLink = rawLink;
          }

          /* Date */
          let dateText = "";
          if (cfg.date) {
            try {
              const d = row.querySelector(cfg.date);
              if (d) dateText = d.innerText.trim();
            } catch {
              /* invalid */
            }
          }

          out.push({
            title,
            tenderLink: absLink,
            publishedAtText: dateText,
          });
        });

        return out;
      },
      {
        section: effectiveSectionSelector || "",
        row: effective.listSelector,
        title: effective.titleSelector,
        link: effective.linkSelector,
        date: effective.dateSelector,
        linkAttr: effective.linkAttr || "href",
      },
    );

    return {
      tenders: tenders.map((t) => ({
        ...t,
        sourceSite: source.name,
        sourceDomain: source.domain || domainOf(source.url),
      })),
      effectiveSectionSelector,
      detected,
    };
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
  const renderMode = source.renderMode || "auto";

  try {
    let tenders = [];
    let effectiveMode = "cheerio";
    let fellBack = false;
    let detectedSelectors = null;
    let effectiveSectionSelector = null;

    if (renderMode === "puppeteer") {
      const r = await parseWithPuppeteer(source);
      tenders = r.tenders;
      detectedSelectors = r.detected;
      effectiveSectionSelector = r.effectiveSectionSelector;
      effectiveMode = "puppeteer";
    } else if (renderMode === "cheerio") {
      const html = await fetchHtml(source.url);
      const r = parseWithCheerio(html, source);
      tenders = r.tenders;
      detectedSelectors = r.detected;
      effectiveSectionSelector = r.effectiveSectionSelector;
      effectiveMode = "cheerio";
    } else {
      /* ---------- AUTO: cheerio first, puppeteer if 0 ---------- */
      try {
        const html = await fetchHtml(source.url);
        const r = parseWithCheerio(html, source);
        tenders = r.tenders;
        detectedSelectors = r.detected;
        effectiveSectionSelector = r.effectiveSectionSelector;
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
        const r = await parseWithPuppeteer(source);
        tenders = r.tenders;
        detectedSelectors = r.detected;
        effectiveSectionSelector = r.effectiveSectionSelector;
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
      effectiveSectionSelector,
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