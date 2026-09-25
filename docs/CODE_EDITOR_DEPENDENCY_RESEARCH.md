# Code editor dependencies — evaluation

The shader-wizard research named a constraint without testing it: "no CodeMirror, no
Monaco." This is the test. Measured September 2026 against the registry, not recalled.

## 1. What we actually need

From the authoring work, in order of how much it hurts to go without:

1. **Errors marked at their line.** The compiler already returns a line number; the
   editor cannot show it.
2. **GLSL syntax highlighting.** Keywords, types, builtins, numbers, comments.
3. **Scrubbable numeric literals** — alt-drag a constant to change it live.
4. **Decent editing** — Tab inserts, auto-indent, undo that survives a re-render.

What we do **not** need, and which is most of what these libraries are:
autocomplete, a language server, multi-cursor, folding, minimap, find-and-replace,
bracket matching across 100k lines, collaborative editing, or 200 language grammars.
The document is capped at 20,000 characters and defines two functions.

## 2. The baseline being defended

| | |
|---|---|
| Runtime dependencies | 2 (react, react-dom) |
| Packages in the tree | 43 |
| Packages with install scripts | 0 |
| App bundle | 338.6 KB raw / **112.5 KB gzip** |
| Pinning | `save-exact=true` |
| Install scripts | disabled globally (`ignore-scripts=true`) |

Any candidate is measured against these numbers, not against "is it a good library."
They are all good libraries.

## 3. Measured comparison

Transitive package counts come from resolving a lockfile without installing
(`npm install --package-lock-only`). Sizes are the actual files from the CDN,
gzip -9.

| Option | Packages | Adds to tree | Gzip added | App gzip after | Open advisories |
|---|---|---|---|---|---|
| **Nothing** (textarea, today) | 0 | — | 0 | 112.5 KB | — |
| Own GLSL highlighter | 0 | — | ~1 KB | ~113 KB | — |
| Prism + react-simple-code-editor | 5 | +12% | ~24 KB | ~136 KB (+21%) | none |
| CodeJar + Prism | 6 | +14% | ~23 KB | ~135 KB (+21%) | none |
| CodeMirror 6 + legacy-modes | 18 | **+42%** | ~126 KB | ~238 KB (**+112%**) | none |
| Shiki (highlight only) | **45** | **+105%** | ~90 KB+ | — | none |
| Monaco + @monaco-editor/react | 10 | +23% | **megabytes** | — | **2** |

Two rows settle themselves. **Shiki** adds more packages than ORBIUS's entire current
tree to do highlighting alone. **Monaco** unpacks to 95.6 MB and is the only
candidate shipping known vulnerabilities today.

## 4. Security findings

### Install scripts: clean across the board

No candidate, at any depth, declares `preinstall`, `install` or `postinstall`. The
`prepare` scripts on the CodeMirror packages only run for git installs, not registry
tarballs, and `ignore-scripts=true` neutralises the class regardless. This is the
one threat we are already hardened against, and it is the one nobody is exploiting
here.

### Monaco ships a vulnerable dompurify

`monaco-editor@0.56.0` depends on `dompurify` in a range covered by four open
advisories — [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4),
[GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882),
[GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9),
[GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) — all
sanitizer-bypass leading to XSS. npm's suggested remediation is to **downgrade to
0.53.0**, a semver-major move backwards. There is no forward fix.

Monaco uses dompurify to render markdown in hovers and suggestions. In ORBIUS the
plausible path is an imported family whose doc comments reach a hover. That is
indirect and speculative — but it is a live XSS primitive sitting inside an editor
whose entire job here is to display untrusted-ish text, and the fix direction is
backwards.

### Nobody publishes with provenance

**Not one candidate publishes npm attestations** — not CodeMirror, not Prism, not
Monaco, not Microsoft's own packages. So for every option on this list, the question
"is this tarball built from the source in that repo" has no cryptographic answer.
You are trusting a publishing account, full stop.

That reframes the bus-factor numbers below from a continuity concern into a
supply-chain one.

### Publishing accounts and staleness

| Package | Maintainers | Last publish |
|---|---|---|
| `@codemirror/view` | **1** (marijn) | 2026-09-03 |
| `@codemirror/state` | **1** (marijn) | 2026-09-04 |
| `codejar` | **1** (medv) | 2025-10-14 |
| `prismjs` | 8 | 2025-03-10 (18 months) |
| `react-simple-code-editor` | 2 | 2024-07-04 (**26 months**) |
| `monaco-editor` | 7 (Microsoft org accounts) | 2026-07-20 |

Two opposite risks:

- **CodeMirror is one person across every package.** Actively, almost daily,
  maintained — and a single npm account compromise reaches `@codemirror/view`, which
  is loaded into the editing surface of a great many applications. This is precisely
  the `nx` / Shai-Hulud shape: a high-reach package behind one credential and no
  provenance.
- **Prism and react-simple-code-editor are stale.** Prism has an unfinished v2 and a
  long history of ReDoS findings in its regex grammars (1.30.0 is clean today);
  react-simple-code-editor has not shipped in over two years. Stale is not
  vulnerable, but it means nobody is watching.

### The vulnerability class matters here

Prism and any hand-rolled highlighter are **regex tokenizers**, so the failure mode
is ReDoS — a catastrophically backtracking pattern hanging the tab on a crafted
file. This is worth naming because it applies to the build-it-yourself option too,
and it is the one thing to get right there: **no nested quantifiers, no
alternation inside a repeat.** GLSL's grammar is simple enough that every pattern
can be linear.

## 5. Reliability findings

**Monaco does not support mobile.** ORBIUS's validation record includes "mobile
layout does not overflow the viewport horizontally," and `style.css` carries mobile
breakpoints. Adopting Monaco means dropping a supported target, or shipping two
editors. That alone disqualifies it independently of the security finding.

**Monaco needs build configuration.** Web workers, and in practice a Vite plugin —
a build-tool dependency on top of the runtime one, and a standing source of
breakage on every Vite major. ORBIUS currently has exactly one devDependency.

**CodeJar is `contenteditable`.** That buys 4 KB and costs the well-known
contenteditable problems: IME composition, and native undo fighting a controlled
React value. For a two-function shader file it would probably be fine; "probably
fine on input handling" is not a property worth buying.

**react-simple-code-editor is a textarea with a highlighted `<pre>` behind it** —
the same architecture you would build yourself, as a dependency, unmaintained for
two years. It is 21 KB of scroll-sync and tab handling.

**CodeMirror 6 is the only genuinely excellent option here.** Proper editing model,
real accessibility, real IME, real mobile, and a `shader` mode for GLSL already
present in `@codemirror/legacy-modes/mode/clike` (verified: it exports `shader` and
carries GLSL builtins). It would do everything on the needs list well. It also more
than doubles the application's gzipped payload to get there.

## 6. The build-it-yourself option, costed honestly

A `<textarea>` with a highlighted `<pre>` behind it — the react-simple-code-editor
architecture, ~120 lines:

- **GLSL tokenizer** — a language with ~40 keywords, ~20 types, ~80 builtins, one
  comment form, no string literals and no preprocessor we care about. One linear
  regex, ~25 lines including the token table.
- **Overlay** — `<pre>` under a transparent-text textarea, identical font metrics,
  scroll position synced on `onScroll`. ~30 lines.
- **Error line** — the compiler already gives the line number; highlight that row in
  the overlay. ~10 lines.
- **Tab handling** — insert two spaces, keep undo working via
  `document.execCommand("insertText")`. ~10 lines.
- **Scrubbable literals** — find the number under the pointer with a regex, alt-drag
  to modify, splice the string. ~40 lines. *No dependency offers this at all* —
  CodeMirror and Monaco would both need it written by hand anyway.

What we would genuinely give up versus CodeMirror: bracket matching, autocomplete,
multi-cursor, code folding, and a properly engineered undo stack. Against a
20,000-character file with two functions in it, that is a list of things nobody will
miss.

## 7. Recommendation

**Build it. Take no dependency.**

The decisive argument is not size or even the Monaco advisories — it is that the
feature which most defines the wizard, **scrubbable literals, is not offered by any
of these libraries**. We would be writing custom editor code regardless. The
question is only whether we also inherit 18 packages behind a single unattested
npm account to get bracket matching we do not need.

Ranked, if that call is ever reversed:

1. **CodeMirror 6** — the only one worth 18 packages. Take it when the editor
   becomes a primary surface (multi-file families, real autocomplete against a
   snippet library), not before. Pin exact, vendor the lockfile, review diffs on
   every bump.
2. **Prism alone**, for highlighting only, keeping our own textarea. 5 packages,
   ~24 KB, replaces perhaps 25 lines of tokenizer. A poor trade but a defensible
   one.
3. **Nothing else.** Monaco is disqualified twice over — open advisories with a
   backwards-only fix, and no mobile support. Shiki costs more packages than the
   whole application. CodeJar and react-simple-code-editor are our own architecture
   with someone else's maintenance risk attached.

### Reversal triggers

Revisit if any of these become true, rather than on taste:

- The editor grows past one file, or needs completion against a snippet library.
- Our tokenizer accumulates more than ~200 lines — at that point we are maintaining
  a highlighter badly instead of using one.
- A GLSL grammar we would have to write starts needing real parsing (scope-aware
  highlighting, go-to-definition).

## 8. If a dependency is ever taken

Non-negotiables, given the findings above:

- `save-exact=true` and `ignore-scripts=true` stay. Both already set.
- Pin transitively; commit the lockfile; **read the diff** on every bump, because
  no attestation makes that diff the only verification available.
- `npm audit` in CI, treating a new advisory on a rendering-path package as a
  release blocker rather than a ticket.
- Never load an editor from a CDN at runtime — the `@monaco-editor/loader` default
  fetches from jsDelivr, which converts a pinned dependency into a live remote
  execution surface.
- Keep the tokenizer ReDoS-safe whichever way this goes: linear patterns only.

## Method

- Package metadata, maintainers, publish dates, attestations: `npm view`.
- Transitive counts and install-script detection: `npm install --package-lock-only`
  into a throwaway directory with `ignore-scripts=true` — resolution only, no
  execution, nothing installed into this project.
- Advisories: `npm audit` against those resolved trees, September 2026.
- Sizes: files fetched from jsDelivr and gzipped locally; CodeMirror's bundled
  figure from Bundlephobia (364.4 KB min / 116.0 KB gzip).
- GLSL support confirmed by reading the shipped files, not the documentation.
