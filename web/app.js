/**
 * app.js — Library Catalog static site
 *
 * Loads books.json from the site root when deployed, or the parent directory
 * when previewing the source files under /web/.
 */

let allBooks = [];

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
    init();
  })
  .catch((err) => {
    document.querySelector("main").innerHTML =
      `<div class="empty" style="padding:60px">⚠️ ${esc(err.message)}. Check that books.json is available from the site root.</div>`;
  });

function init() {
  renderStats();
  setupTabs();
  setupSearch();
  setupBrowse();
}

// ── Stats header ───────────────────────────────────────────────────────────────

function renderStats() {
  const locations = new Set(allBooks.map((b) => b.location)).size;
  const needsReview = allBooks.filter(isNeedsReview).length;
  document.getElementById("stats").textContent =
    `${allBooks.length} copies across ${locations} shelf locations · ${needsReview} need identification or review`;
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
    const results = allBooks.filter((book) =>
      [book.title, book.author, book.publisher, book.isbn, book.location]
        .some((value) => cleanField(value).toLowerCase().includes(q))
    );
    status.textContent = results.length
      ? `${results.length} result(s)`
      : `No books found for "${input.value.trim()}"`;
    renderBooks(grid, results);
  });
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
    count.textContent = `${books.length} book(s)`;
    renderBooks(grid, books);
  }

  select.addEventListener("change", show);
  if (locations.length) show();
}

// ── Book Card ──────────────────────────────────────────────────────────────────

function renderBooks(container, books) {
  if (!books.length) {
    container.innerHTML = '<p class="empty">No books found.</p>';
    return;
  }
  container.innerHTML = books.map(bookCard).join("");
}

function bookCard(b) {
  const title = cleanField(b.title) || "Title not identified";
  const author = cleanField(b.author) || "Author unknown";
  const publisher = cleanField(b.publisher);
  const year = cleanField(b.year);
  const language = cleanField(b.language);
  const tags = [
    year ? `<span class="tag tag-year">${esc(year)}</span>` : "",
    language ? `<span class="tag tag-lang">${esc(language.toUpperCase())}</span>` : "",
    `<span class="tag tag-location">${esc(b.location)}</span>`,
    isNeedsReview(b) ? '<span class="tag tag-review">Needs review</span>' : "",
  ].join("");

  return `
    <article class="book-card">
      <p class="book-title">${esc(title)}</p>
      <p class="book-author">${esc(author)}</p>
      ${publisher ? `<p class="book-publisher">${esc(publisher)}</p>` : ""}
      <div class="book-meta">${tags}</div>
      ${cleanField(b.isbn) ? `<p class="book-isbn">ISBN ${esc(cleanField(b.isbn))}</p>` : ""}
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
