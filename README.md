# Library Catalog

A manually curated catalog of physical books. The public site is deployed to <https://biblioteca.scopinho.com> from this repository using GitHub Pages. The only published data is `books.json` and the static viewer in `web/`.

## Local preview

From the repository root, run `python3 -m http.server 8000` and open <http://localhost:8000/web/>.

## Update the catalog

`books.json` is the source of truth. Each batch represents a shelf location, and each record represents one physical copy. Preserve duplicate and unidentified copies, use `null` for unreadable metadata, and prefix inferred values with `*` for review. The website reads this JSON directly.

When cataloging shelf photos, process files by numeric filename order rather than attachment order. A filename containing `---` marks the start of a section and is not itself cataloged. Record books in physical left-to-right order, deduplicate books repeated where consecutive photos overlap, and retain genuinely separate duplicate copies.

## GitHub Pages and DNS

Pushing to `main` builds the site artifact from `web/`, adds `books.json` and the custom-domain marker, then deploys with GitHub Pages. The workflow and Git ignore allowlist keep the repository limited to the viewer, catalog, and deployment documentation; shelf photos, local databases/state, examples, and editor files stay out of the public repository.

GitHub Pages is configured to deploy with **GitHub Actions** and use `biblioteca.scopinho.com`. At the DNS provider, create a CNAME record with host `biblioteca` pointing to `talicopanda.github.io`. Once DNS resolves, GitHub provisions the TLS certificate; HTTPS enforcement can be enabled after the certificate is issued.
