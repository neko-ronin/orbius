# ORBIUS — deployability audit plan (Cloudflare static)

How a localhost-only Vite app becomes a deployable web app. Written to be reusable:
the same process applies to any local-first static SPA.

## 0. Mental model (what "deployable" means here)

A localhost app can assume:

- the dev server is always running (Vite `apply: "serve"` plugins, file writes),
- loopback networking (`127.0.0.1`, `localhost`, custom CORS origins),
- a single machine, single browser, huge local disk (`saves/` in repo),
- a high-end GPU in front of you.

A deployed static app can assume none of that. Definition used in this plan:

> `npm ci && npm run build` produces a self-contained `dist/` that any static
> file server can host with zero env vars, zero backend, no console errors,
> and first-frame render on a stranger's GPU.

For orbius + Cloudflare this means: **Workers + Workers Static Assets**
(Cloudflare's recommended path for new static sites/SPAs; Pages is for
existing Pages projects). No server code, no bindings, no secrets — just
`dist/` + a `wrangler.jsonc` with an `assets` directory. Login (`wrangler login`
/ `wrangler whoami`) is deferred; everything below works logged-out.

## 1. Recon (what to read first, and why)

1. `package.json` — scripts, deps. Look for `--host 127.0.0.1`, backend frameworks, env usage.
2. `vite.config.js` — plugins with `apply: "serve"` are dev-only by design; anything else that touches `fs`/`path` is a deployability smell.
3. `src/studio/storage.js` (or equivalent persistence layer) — does prod have a fallback when the dev endpoint is gone? Ours does: `onDisk()` ping → IndexedDB → localStorage → download.
4. `index.html` + built `dist/index.html` — absolute paths (`/assets/...`, `/favicon.svg`) break on subpath hosts; relative base fixes it.
5. `.gitignore` — `saves/`, `dist/`, `node_modules/` ignored? Large local-only folders must never be bundled.
6. `src/` for `localhost`, `127.0.0.1`, `process.env`, `import.meta.env`, `fetch(`, `MediaRecorder`, `captureStream`, WebGL extensions — each is a runtime capability to verify in prod.

Commands:

```sh
npm run build
# localhost/loopback strings must be absent from dist/. A single `/__orbius`
# API-path reference from src/studio/storage.js is EXPECTED (the client probe
# that 404s in prod and falls back to IndexedDB) — it is not a leak.
rg -l "127\.0\.0\.1|localhost" dist/ || echo "clean: no loopback refs"
rg -c "__orbius" dist/assets/*.js  # expect 1 hit: the API path constant
ls -la dist/ && du -sh dist/
```

## 2. Phase 0 — baseline reproducibility

Goal: prove the build is hermetic.

- [x] `npm ci && npm run build` passes on a clean checkout (Node 22.12+ for Vite 8). Verified 2026-09-28: 19 packages, 43 modules, ~200ms.
- [x] `npm test` passes (50/50: project validation, graph eval, shader tests).
- [x] `rg "127.0.0.1|localhost" dist/` is clean. One `/__orbius` string remains — the expected client probe path, not a leak.
- [x] Serve `dist/` WITHOUT vite (`python3 -m http.server -d dist`): root 200, asset 200 (376KB JS), `/__orbius/ping` 404 as designed. This is the closest logged-out simulation of Cloudflare.

Why this matters: if it doesn't work under a dumb file server, it won't work on the edge either.

## 3. Phase 1 — build artifact audit

- [x] Base path (audited, not yet fixed): `dist/index.html` emits absolute `/assets/index-*.js` and `/favicon.svg` (verified 2026-09-28; `src/main.jsx:1054` also uses `/favicon.svg`). Fine for a root custom domain on Workers Static Assets; 404s on any subpath. Fix when Cloudflare hostname is known: `base: "./"` (or parameterized base) in `vite.config.js`, then rebuild and re-verify.
- [ ] Dev-plugin absence: assert `orbiusSaves()` never runs in `build` (`apply: "serve"`). Request `/__orbius/ping` against the static preview → must 404 AND the UI must stay usable (library pickers show download fallback, no unhandled rejection).
- [ ] Bundle budget: baseline is ~376KB JS (126KB gzip) + 37KB CSS, 43 modules, ~200ms build. Record it; fail CI if it doubles without intent.
- [ ] Worker asset: `import.worker-*.js` must load from the same base as the main chunk.

## 4. Phase 2 — runtime decoupling (localhost removal)

- [ ] `onDisk()` probe cost: today every prod load fires `fetch("/__orbius/ping")` before falling back. Harmless but noisy (failed fetch in console, latency). Future work (explicitly deferred): build-time deployed flag vs runtime probe, then hide save/load UI in deployed mode.
- [x] Mapped every `onDisk() === false` branch (2026-09-28):
  - `main.jsx:1084` Open → `listProjects()` null → file picker. Graceful.
  - `main.jsx:646` Save → `writeProject()` null → Blob download. Graceful.
  - `readStored`/`writeStored` → IndexedDB `boast-studio` + legacy localStorage. Graceful.
  - `Editor.jsx:702` contained simulation → `[]` + collection items → file picker when both empty. Graceful.
  - [ ] **Known dead button:** `MaterialControls.jsx:121` Save to library → `writeFamily()` returns null in prod → `setNote("")`, silent no-op. Must be hidden in deployed mode (deferred spec).
- [x] Capability guards: WebGL2 throw caught in `main.jsx:427-429` → `setError`; context-lost handled in `engine.js:62-68`; `MediaRecorder`/`captureStream` guarded in `main.jsx:710-724`; `EXT_color_buffer_float` falls back via `hdr` flag.
- [ ] Capability guards: WebGL2 missing, `EXT_color_buffer_float` missing, `MediaRecorder.isTypeSupported === false`, `canvas.captureStream` missing. These are the top prod crash risks on Safari/mobile.
- [ ] No `Origin`/`CORS` assumptions: dev allowlist (`127.0.0.1:5173,4173`) must not be referenced by prod code paths.

## 5. Phase 3 — Cloudflare Static Assets fit

- [x] No adapter needed: plain Vite output → `assets.directory = "./dist"`. No SSR, no functions, no bindings. Deployed 2026-09-28 to `https://orbius.nekoronin.workers.dev` (account `5b3bf0…`, `wrangler.jsonc` committed).
- [x] Custom domain `orbius.catronin.com` attached via `routes` + `custom_domain: true` (2026-09-28, verified 200). Side effect: `workers.dev` serving disabled (404) — re-enable with `workers_dev = true` if ever wanted.
- [x] **Lesson — do NOT use `not_found_handling: single-page-application` here.** First deploy had it; the SPA fallback returned `index.html` (200) for `/__orbius/ping`, so the client's `onDisk()` probe wrongly returned true and `writeStored` threw on HTML-instead-of-JSON — silently breaking autosave and visibly breaking collection saves. This SPA has no client-side routes, so default 404s are correct: `/__orbius/*` 404s, `onDisk()` is false, and every branch falls back to IndexedDB/download exactly as the dumb-server test validated. Rule of thumb: SPA fallback is only safe when no client probe depends on a 404.
- [ ] Headers/caching (in `wrangler.jsonc` or `_headers` equivalent): `Cache-Control: immutable` for `/assets/*` (hashed filenames), `no-cache` for `index.html`. Security: `X-Content-Type-Options: nosniff`, restrictive `frame-ancestors`. Avoid COOP/COEP (only needed for `SharedArrayBuffer`; plain worker doesn't need it).
- [ ] Custom domain vs `*.workers.dev`: root domain → absolute `/` paths tolerable; subpath → relative base required. Decide before writing config.
- [ ] Previews: Workers Previews give per-branch URLs under the same Worker — use for deploy smoke tests once logged in.

Deferred, needs `wrangler login`:

```sh
wrangler whoami
wrangler deploy --dry-run
wrangler deploy
```

## 6. Phase 4 — perf / device audit (stranger's GPU, not yours)

- [ ] Cold load on throttled 4G + integrated GPU: time-to-first-frame, shader compile jank (350ms debounce in `main.jsx` assumes desktop typing).
- [ ] Particle default (80k, up to 160k) on mobile: measure, consider adaptive default or auto-degrade.
- [ ] 3840px PNG export + 30s/12Mbps MediaRecorder paths on mobile Safari: must fail with a message, never a hang.

## 7. Phase 5 — ops (so this stays deployable)

- [ ] CI (no `.github/workflows/` exists yet): `npm ci && npm test && npm run build` + serve-`dist/` smoke (console-error check via Playwright).
- [ ] Guard: CI fails if `src/` imports from `saves/` or if `dist/` contains loopback refs. (Note: `__orbius` API-path string is expected — guard on `127.0.0.1|localhost`, not on `__orbius`.)
- [ ] Version stamp: `package.json` is `1.1.0` but nothing stamps it into the UI/build. Inject at build so bug reports identify the deploy.
- [ ] Keep `docs/VALIDATION.md` convention: log what was actually checked, by date + build, not just what should be true.

## Appendix: reusable checklist (copy to next project)

1. Read scripts + vite config + storage layer + built index.html.
2. `build` → `grep dist` → serve with a dumb server.
3. Fix base path; prove dev-only plugins are absent in prod.
4. Map every degraded-vs-hidden UI branch.
5. Guard every browser capability (WebGL, codecs, streams).
6. Set cache/security headers; choose root vs subpath.
7. CI the whole chain so it stays deployable.
