# CLAUDE.md — geo-hanoi

Read `STATUS.md` then `docs/STATUS.md` before answering; update `docs/STATUS.md` (keep < 100 lines) at the end of each session.

- Static site, no build. Serve from repo root (`python -m http.server 8080`); data is fetched relatively.
- Map page: `index.html` + `css/map.css` + `js/app.js`. Detail page: `to.html` + `css/to.css` + `js/to-detail.js`.
- UI copy is Vietnamese; code, comments and commits stay English. Font Roboto (Vietnamese diacritics).
- Design reference: Google Maps patterns (panel, chips, bottom sheet), flat surfaces with hairline borders, no shadows at rest.
- Pushing to `main` deploys GitHub Pages — commit freely, push only when asked.
- Run `npx playwright test` after UI changes; tests depend on `window.__GEO_TEST__` and a few stable IDs (see STATUS.md). **Hand off only after a fresh green run in the same session** — do not leave verification to the user.
