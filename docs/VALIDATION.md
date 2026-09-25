# Validation record

What was actually checked, when, and what happened. The cases themselves live in
`docs/TEST_PLAN.md`; this file only records runs against them. A case that is not
named below was not checked.

---

## Run 2 — 2026-09-12

Commit under test: `00c04b7` plus the two fixes this run produced.
Host: macOS 25.6, Chromium in the desktop app's browser pane, development server.
Stage viewport 305 × 307 at development quality; show mode 662 × 1049.
Method: unit tests, direct HTTP against the save endpoint, and the running
application driven through the DOM with pixel readback from the live WebGL2 context
rather than screenshots alone.

### Failed

| Case | What happened |
|---|---|
| **ORB-01, PRF-01, PRF-02** | **Blocker, fixed in this run.** Switching to the orb workspace threw `look is not defined` on the first frame. The renderer stopped, the error card appeared, and every workspace stayed frozen afterwards while the stage still read `LIVE RENDER` and the stats line held its last value. Cause: a Python `str.replace` in commit `72b484f` replaces every occurrence, and the intended edit to the glass workspace's contained-family path also landed on the orb workspace's material path, where `look` does not exist. Fixed by restoring `c.params?.[family.id]` there. The orb workspace had been broken since that commit. |
| **KEY-10 (hardening)** | **Minor, fixed in this run.** The global key handler called `e.target.closest(...)` unconditionally; a keydown whose target is not an element threw and took the handler down. Now optional-chained. Found by the harness, not by a user path. |
| **UXS-12** | Not a failure but not a pass: the automated heuristic flagged the workspace tabs and the field-note buttons, which are deliberately bare. The known unstyled secondary buttons in the object panel were not separately confirmed. Needs a human eye. |

### Passed

**Automated** — `npm test`: 45 tests, 0 failures. `npm run build`: clean, 363 KB raw
/ 122 KB gzip for the application bundle. `npx prettier --check src`: clean.

Covering, among others: project round trips and version rejection; invalid numbers,
palettes, nodes and fields; cycles and active-chain evaluation; family validation,
legacy integer migration, declared controls and source offsets; shell contents
including the carried look and its rejection cases; every orb form closed,
outward-facing and on the unit sphere; the dodecahedron's face count and the
geodesic's square law; hollow shells, reversed inner winding and both interior fill
modes; faceted versus averaged normals; the GLSL tokenizer including pathological
input; the GPU timer.

**Shell and navigation** — NAV-01, NAV-02 (all four workspaces render, correct
eyebrow and pressed state, no console error), NAV-04, NAV-05, NAV-07, NAV-08.

**Keyboard** — KEY-01 (pause freezes the image and the corner says so; resume
restores it), KEY-02, KEY-03, KEY-06, KEY-07, KEY-08.

**Show mode** — SHOW-01 (chrome hidden, exit affordance present), SHOW-02 (305 × 307
→ 662 × 1049), SHOW-04 (recovery banner suppressed), SHOW-05.

**Orb** — ORB-01 for all four built-ins plus the custom GLSL surface: each renders,
animates, and reports its own GPU passes. ORB-02 (dropdown lists every registered
family plus the custom surface). ORB-03 (declared controls swap with the family —
`Corona` for solar, `Filament`/`Weave` for silk, the composer set for composer).

**Family authoring** — FAM-01 (a `+ Volume` family renders immediately), FAM-03 (a
syntax error reports `Line 8 · 'BROKEN' : syntax error` **and the previous program
keeps rendering**), FAM-04, FAM-05 (the line number is the author's), FAM-06 (a
declared `@control` produced a `Wobble` slider), FAM-07 (`@default` 2.5 honoured).

**Code editor** — EDT-10 by implication of FAM-05. The rest of section 6 was not
run; scrubbing and undo need a real pointer and real key events.

**Glass** — GLS-25 (the picker lists collected specimens and saved project files in
one deduplicated list — seven distinct pieces from two stores), GLS-28 (an orb
shader becomes the shell's inner shader and renders live). GLS-01 through GLS-07 and
GLS-26/27 were verified earlier the same day while the forms were built: all six orb
forms render as closed glass, a five-sided cylinder is a pentagonal prism, a hollow
orb reads as a wall, and a particle piece poured into a hollow orb fills the cavity
rather than the wall.

**Persistence** — SAV-01 (`Saved to saves/projects/qa-probe-01.json`), SAV-02
(the dialog lists projects by name, with the elsewhere fallback), SAV-03 (reopened
with its name, its authored family and its declared parameter value intact), SAV-05,
SAV-08 (the recovery banner named the autosaved piece). RTR-05 by the same route.

**Performance** — PRF-01 and PRF-02 after the fix: the breakdown reports this
workspace's passes and nothing else (`material`/`composite` in orb,
`footprint`/`stage`/`reflection`/`dots`/`shells`/`composite` in glass,
`simulate`/`composite` in particles). PRF-06 was exercised earlier the same day by
forcing `WEBGL_lose_context`: the application survived, the message was accurate,
and the flushed autosave matched what was on screen.

**UI states** — UXS-09 (the field note opens on hover and on focus, carries the
authored control's own note and its search link, closes on leave and on `Esc`),
UXS-10 (backdrop click and `Esc` both close a modal), UXS-05.

**Boundaries** — SEC-01 (a request without `x-orbius` falls through to the
application, never to data), SEC-02 (`{"error":"origin"}` for a foreign origin),
SEC-04 (`..%2F..%2Fpwned` landed at `saves/state/pwned.json` — confined, then
removed), SEC-05, SEC-06 (a non-JSON body is refused and nothing is written),
SEC-09 (no new runtime dependency; two remain).

### Not run

- **EDT-01 to EDT-09, EDT-11, EDT-12** — the editor's pointer and keyboard
  behaviour: caret alignment, `Tab`, undo, alt-scrubbing. These need real input
  events and a human looking at the caret.
- **EXP-01 to EXP-06** — capture, recording and the export bundles. Downloads were
  not triggered from this harness.
- **PRT-02 to PRT-15** — the particle workspace's controls, tools, placed fields and
  populations, beyond the workspace rendering at all.
- **NOD-01 to NOD-10** — the node composer, beyond the workspace rendering.
- **GLS-10 to GLS-24, GLS-29 to GLS-38** — mesh import, per-object materials,
  layers, transforms and most of the contents flows. GLS-29 (an imported orb keeps
  its look) was demonstrated visually earlier the same day, before the orb bug above
  was found, and should be re-run.
- **LIB-02, LIB-04 to LIB-09** — collection previews, collect, limits and deletion.
- **SAV-04, SAV-06, SAV-07, SAV-09 to SAV-16** — including the IndexedDB fallback in
  a built copy, which nothing has ever exercised.
- **ERR-01 to ERR-05**, **UXS-01 to UXS-08, UXS-11 to UXS-15**, **RTR-01 to RTR-04,
  RTR-06 to RTR-08**, **LAY-01 to LAY-05**, **PRF-03, PRF-04, PRF-05, PRF-07**,
  **FAM-08 to FAM-16**, **ORB-04 to ORB-12**, **SEC-03, SEC-07, SEC-08**.
- No Safari, no Firefox, no discrete GPU, no touch device, no soak test.

### Notes

Driving the application for these checks wrote over the local autosave and created
`saves/projects/qa-probe-01.json`. The autosave was captured before the run and
restored after it; the probe file was deleted. Saved projects were not modified.

An earlier attempt at the keyboard cases dispatched events at `window`, whose target
has no `closest`, and reported failures that were the harness's fault rather than the
application's. They were re-run against `document.body`. Worth remembering: a probe
that fails is a claim about the probe until proven otherwise.

---

## Run 1 — 2026-09-08

Recorded before `docs/TEST_PLAN.md` existed, so it has no case IDs and cannot be
compared to a run that does. Kept as history.

It describes an application with four workspaces, a node composer, PNG and video
export, and eight unit tests. Everything built since — the studio rig, glass defects,
the stage and its floor, families as values, declared parameters, compile-as-you-type,
the code editor, saves in the repository, families inside shells, the shape options
— postdates it and appears nowhere below.

### Automated checks

`npm test`: eight passing tests covering valid disk round trips; unsupported
format/version, invalid numbers and palette values; malformed nodes/fields; multiple
inputs and cycles; active-chain-only evaluation; orb source routing; independent
preservation of compiled shader and unfinished draft; prototype-name and
duplicate-field rejection.

`npm run build`: successful Vite production build. Application JavaScript
approximately 252 KB before gzip (82 KB gzip); CSS approximately 25 KB (7 KB gzip).

### Browser checks

Playwright CLI against locally installed Chromium for Testing. Desktop 1440 × 960;
mobile 390 × 844. Tests exercised the rendered application, not mocked WebGL.

Passed: parameter field note on hover; placing a gravity field, `L` for coloured
light, `X` to clear; pause preserving an identical canvas across frames; show mode
hiding navigation and raising the canvas to 2160 × 1440, with Escape restoring the
editor; invalid GLSL showing diagnostics while the renderer kept working; valid GLSL
recompiling and clearing them; a downloaded project reopening from disk with its
modified shader; a four-node composition evaluating and reducing to two when
rewired; a cycle rejected with feedback; mobile layout not overflowing horizontally;
real PNG and video downloads; `getError()` returning 0 after export and workspace
transitions.

The async file-loading test initially checked the screen before `File.text()`
resolved and was corrected to wait for the restored workspace. A missing favicon in
the first development load was fixed with a local SVG. Deliberately invalid GLSL is
an expected compile failure, not an uncaught error.

### Media evidence

Under `output/playwright/`, excluded from git: particle authoring and show views;
orb show and studio views; node composer; mobile; a 4K export verified at
**3840 × 2560**; a recording verified by ffprobe as **VP9, 2160 × 1440, 30 fps**,
about 1.53 MB. MediaRecorder WebM may omit duration metadata. The round-trip project
fixture is `roundtrip.orbius.json`.

The default 80,000-particle development scene showed about 60 FPS on that host — an
observation, not a benchmark or a show-mode guarantee.

During visual review, floating-point feedback targets replaced the clipping-prone
default where supported, pause rendering was fixed, ray-march convergence improved,
and framebuffer resampling added so quality changes preserve accumulated trails.

### Coverage limits recorded at the time

No Safari, Firefox, discrete-GPU, context-loss, maximum-complexity shader, or
30-second soak test. Export encoding and performance remain browser and GPU
dependent. Touch layout was checked through a narrow viewport, not a device.

### Post-reset smoke check

A fresh session also passed keyboard focus trapping and Escape in the guide, pointer
exit from show mode, save/load of an unfinished GLSL draft while retaining the
compiled renderer, missing-source diagnostics, a dark pixel readback for a
disconnected output, and a final WebGL error check of 0. The replayable check was
`output/playwright/final-smoke.js`.
