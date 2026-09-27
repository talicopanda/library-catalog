/**
 * app.js — Library Catalog static site
 *
 * Loads books.json from the site root when deployed, or the parent directory
 * when previewing the source files under /web/.
 */

let allBooks = [];
let searchIndex = null;
let currentLanguage = localStorage.getItem("catalog-language") === "pt-BR" ? "pt-BR" : "en";

const translations = {
  en: {
    pageTitle: "Library Catalog",
    siteTitle: "Library catalog",
    copies: "copies",
    shelves: "shelf locations",
    reviewCount: "need identification or review",
    searchTab: "Search",
    browseTab: "Browse by shelf",
    searchPlaceholder: "Search by title, author, publisher, ISBN, or shelf…",
    shelfLabel: "Shelf:",
    result: "result(s)",
    noResults: (query) => `No books found for “${query}”`,
    book: "book(s)",
    unknownTitle: "Title not identified",
    unknownAuthor: "Author unknown",
    needsReview: "Needs review",
    isbn: "ISBN",
    empty: "No books found.",
  },
  "pt-BR": {
    pageTitle: "Catálogo da biblioteca",
    siteTitle: "Catálogo",
    copies: "exemplares",
    shelves: "estantes",
    reviewCount: "precisam de identificação ou revisão",
    searchTab: "Buscar",
    browseTab: "Ver por estante",
    searchPlaceholder: "Busque por título, autor, editora, ISBN ou estante…",
    shelfLabel: "Estante:",
    result: "resultado(s)",
    noResults: (query) => `Nenhum livro encontrado para “${query}”`,
    book: "livro(s)",
    unknownTitle: "Título não identificado",
    unknownAuthor: "Autor desconhecido",
    needsReview: "Precisa de revisão",
    isbn: "ISBN",
    empty: "Nenhum livro encontrado.",
  },
};

function t(key) {
  return translations[currentLanguage][key];
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const catalogUrl = window.location.pathname.replace(/\/+$/, "").endsWith("/web")
  ? "../books.json"
  : "./books.json";

fetch(catalogUrl, { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error("books.json could not be loaded");
    return r.json();
  })
  .then((data) => {
    if (!Array.isArray(data.batches)) {
      throw new Error("books.json must contain a batches array");
    }
    allBooks = data.batches.flatMap((batch) =>
      (Array.isArray(batch.books) ? batch.books : []).map((book) => ({
        ...book,
        location: batch.location || "Unknown",
      }))
    );
    if (window.Fuse) {
      searchIndex = new window.Fuse(allBooks, {
        keys: [
          { name: "title", weight: 0.75 },
          { name: "author", weight: 0.12 },
          { name: "publisher", weight: 0.06 },
          { name: "isbn", weight: 0.05 },
          { name: "location", weight: 0.02 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.25,
        minMatchCharLength: 3,
      });
    }
    init();
  })
  .catch((err) => {
    document.querySelector("main").innerHTML =
      `<div class="empty" style="padding:60px">⚠️ ${esc(err.message)}. Check that books.json is available from the site root.</div>`;
  });

function init() {
  setupLanguageSwitch();
  renderStats();
  setupTabs();
  setupSearch();
  setupBrowse();
  applyLanguage();
}

function setupLanguageSwitch() {
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      currentLanguage = button.dataset.language;
      localStorage.setItem("catalog-language", currentLanguage);
      applyLanguage();
    });
  });
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage === "pt-BR" ? "pt-BR" : "en";
  document.title = t("pageTitle");
  document.getElementById("site-title").textContent = t("siteTitle");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
  });

  renderStats();
  document.getElementById("search-input").dispatchEvent(new Event("input"));
  document.getElementById("location-select").dispatchEvent(new Event("change"));
}

// ── Stats header ───────────────────────────────────────────────────────────────

function renderStats() {
  const locations = new Set(allBooks.map((b) => b.location)).size;
  const needsReview = allBooks.filter(isNeedsReview).length;
  document.getElementById("stats").textContent =
    `${allBooks.length.toLocaleString(currentLanguage)} ${t("copies")} · ` +
    `${locations.toLocaleString(currentLanguage)} ${t("shelves")} · ` +
    `${needsReview.toLocaleString(currentLanguage)} ${t("reviewCount")}`;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

// ── Search ─────────────────────────────────────────────────────────────────────

function setupSearch() {
  const input  = document.getElementById("search-input");
  const status = document.getElementById("search-status");
  const grid   = document.getElementById("search-results");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      status.textContent = "";
      grid.innerHTML = "";
      return;
    }
    const exactResults = allBooks.filter((book) =>
      searchableFields(book).some((value) => value.toLowerCase().includes(q))
    );
    const results = exactResults.length || !searchIndex || q.length < 4
      ? exactResults
      : findFuzzyMatches(input.value.trim());
    status.textContent = results.length
      ? `${results.length.toLocaleString(currentLanguage)} ${t("result")}`
      : t("noResults")(input.value.trim());
    renderBooks(grid, results);
  });
}

function searchableFields(book) {
  return [book.title, book.author, book.publisher, book.isbn, book.location]
    .map(cleanField)
    .filter(Boolean);
}

function findFuzzyMatches(query) {
  const normalizedQuery = normalizeSearchText(query);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const fuzzyResults = searchIndex.search(query).map(({ item }) => item);
  const candidates = [...new Set([...fuzzyResults, ...allBooks])];

  // For a single misspelled word, use a small edit-distance budget to keep
  // fuzzy matching precise instead of returning vaguely similar titles.
  if (queryWords.length === 1) {
    const maxDistance = normalizedQuery.length >= 4 ? 1 : 0;
    return candidates
      .map((book) => ({ book, rank: singleWordMatchRank(book, normalizedQuery) }))
      .filter(({ rank }) => rank.distance <= maxDistance)
      .sort((a, b) => a.rank.distance - b.rank.distance || a.rank.field - b.rank.field)
      .map(({ book }) => book);
  }

  return fuzzyResults;
}

function singleWordMatchRank(book, query) {
  const fields = [book.title, book.author, book.publisher, book.isbn, book.location];
  let best = { distance: Infinity, field: fields.length };

  fields.forEach((value, fieldIndex) => {
    const words = normalizeSearchText(cleanField(value)).split(" ").filter(Boolean);
    words.forEach((word) => {
      if (Math.abs(word.length - query.length) > 1) return;
      const distance = editDistanceAtMostOne(query, word);
      if (distance < best.distance || (distance === best.distance && fieldIndex < best.field)) {
        best = { distance, field: fieldIndex };
      }
    });
  });

  return best;
}

function normalizeSearchText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistanceAtMostOne(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;

  let left = 0;
  let right = 0;
  let edits = 0;
  while (left < a.length && right < b.length) {
    if (a[left] === b[right]) {
      left += 1;
      right += 1;
    } else {
      edits += 1;
      if (edits > 1) return 2;
      if (a.length > b.length) left += 1;
      else if (b.length > a.length) right += 1;
      else {
        left += 1;
        right += 1;
      }
    }
  }

  if (left < a.length || right < b.length) edits += 1;
  return edits;
}

// ── Browse by shelf ────────────────────────────────────────────────────────────

function setupBrowse() {
  const select = document.getElementById("location-select");
  const count  = document.getElementById("browse-count");
  const grid   = document.getElementById("browse-results");

  // Build sorted list of unique locations
  const locations = [...new Set(allBooks.map((book) => book.location))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  locations.forEach((loc) => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    select.appendChild(opt);
  });

  function show() {
    const loc = select.value;
    const books = allBooks.filter((book) => book.location === loc);
    count.textContent = `${books.length.toLocaleString(currentLanguage)} ${t("book")}`;
    renderBooks(grid, books);
  }

  select.addEventListener("change", show);
  if (locations.length) show();
}

// ── Book Card ──────────────────────────────────────────────────────────────────

function renderBooks(container, books) {
  if (!books.length) {
    container.innerHTML = `<p class="empty">${esc(t("empty"))}</p>`;
    return;
  }
  container.innerHTML = books.map(bookCard).join("");
}

function bookCard(b) {
  const title = cleanField(b.title) || t("unknownTitle");
  const author = cleanField(b.author) || t("unknownAuthor");
  const publisher = cleanField(b.publisher);
  const year = cleanField(b.year);
  const language = cleanField(b.language);
  const tags = [
    year ? `<span class="tag tag-year">${esc(year)}</span>` : "",
    language ? `<span class="tag tag-lang">${esc(language.toUpperCase())}</span>` : "",
    `<span class="tag tag-location">${esc(b.location)}</span>`,
    isNeedsReview(b) ? `<span class="tag tag-review">${esc(t("needsReview"))}</span>` : "",
  ].join("");

  return `
    <article class="book-card">
      <p class="book-title">${esc(title)}</p>
      <p class="book-author">${esc(author)}</p>
      ${publisher ? `<p class="book-publisher">${esc(publisher)}</p>` : ""}
      <div class="book-meta">${tags}</div>
      ${cleanField(b.isbn) ? `<p class="book-isbn">${esc(t("isbn"))} ${esc(cleanField(b.isbn))}</p>` : ""}
    </article>`;
}

function cleanField(value) {
  return value == null ? "" : String(value).trim().replace(/^\*/, "");
}

function isNeedsReview(book) {
  return !cleanField(book.title) || Object.values(book).some(
    (value) => typeof value === "string" && value.trim().startsWith("*")
  );
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
