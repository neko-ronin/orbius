# BOAST — test plan

What to check. Every workspace, flow, control, and state the application can be in,
written so that someone who has never opened it — a person or an agent — can work
through it top to bottom and know when they are done.

This document says **what must be true**. `docs/VALIDATION.md` records **what was
actually checked, when, and what happened**. Neither is useful alone: a log without
a suite cannot tell you what was skipped, and a suite without a log cannot tell you
whether anything was ever run.

## How to use it

1. Run the setup below.
2. Work through each case. A case is one row: do the steps, compare with the
   expectation.
3. Record the outcome in `docs/VALIDATION.md` **by case ID**, with the date and the
   build. Cases not run are recorded as not run — silence is not a pass.
4. A failure gets an entry in the bug wiki (`~/Repos/vibes/bugs/`) once diagnosed.

**Case IDs are permanent.** Renumbering breaks every historical log entry. Retired
cases are marked retired, not deleted.

Severity, where a case names one:

- **Blocker** — data loss, a workspace that will not render, a save that will not
  reopen.
- **Major** — a feature does not work, or works wrongly.
- **Minor** — cosmetic, or a state that is ugly but recoverable.

## Setup

```bash
npm install
npm test
npm run build
npm run dev
```

Browser: a WebGL2 context is required. Verify `WEBGL 2` appears in the stage corner
before starting — if it does not, nothing below is valid.

Two fixtures are assumed, and the first case builds them if absent:

- **A saved particle project** — any particle scene, saved.
- **A saved orb project with a non-default palette and emission** — used to prove
  an imported shader keeps its own look.

Some cases touch `saves/`. That folder is the user's real work. Record what is in it
before destructive cases, and put it back.

---

## 1. Shell, navigation and global state

| ID | Check | Expect |
|---|---|---|
| NAV-01 | Load the app cold (no autosave) | Particle playground, a rendered scene, `LIVE RENDER`, `WEBGL 2` |
| NAV-02 | Click each of the four workspace tabs | Each renders; the tab shows as pressed; no console error |
| NAV-03 | Switch workspace and return | The first workspace's settings are as they were left |
| NAV-04 | Edit anything | The title badge changes to `EDITED` |
| NAV-05 | Save | The badge returns to its saved state |
| NAV-06 | Rename the project | Name persists across a workspace switch and into a save |
| NAV-07 | Statusbar | Shows the three status strings and the shortcuts button |
| NAV-08 | Stage overlays | Corner label, renderer type, axis mark, perspective number, FPS, resolution all present |
| NAV-09 | Window resize | Canvas follows; no horizontal page scroll; no stretched aspect |

### Keyboard

| ID | Key | Expect |
|---|---|---|
| KEY-01 | `Space` | Pause toggles; corner reads `PAUSED`; the image stops changing |
| KEY-02 | `S` | Show mode on; `S` or `Esc` returns |
| KEY-03 | `Esc` | Closes show mode, field guide and any open tooltip |
| KEY-04 | `P` | High-resolution PNG downloads |
| KEY-05 | `C` | Recording starts, then stops on a second press |
| KEY-06 | `X` | Placed fields cleared, with a toast |
| KEY-07 | `?` | Field guide opens |
| KEY-08 | `1 G R V L B F` | Each selects its tool, with a toast |
| KEY-09 | `⌘/Ctrl+S` | Saves; the browser's own save dialog does not appear |
| KEY-10 | Any of the above **while typing in a field** | Types the character; does not trigger the shortcut |

### Show mode

| ID | Check | Expect |
|---|---|---|
| SHOW-01 | Enter show mode | Navigation, panels and overlays hidden; canvas fills the window |
| SHOW-02 | Resolution | Canvas renders at the show-quality scale, higher than development |
| SHOW-03 | Record and capture in show mode | Both work |
| SHOW-04 | Recovery banner while in show mode | Suppressed, not drawn over the presentation |
| SHOW-05 | Exit | Editor returns with the scene unchanged |

---

## 2. Library and collection

| ID | Check | Expect |
|---|---|---|
| LIB-01 | Open each workspace | The left panel lists that workspace's recipes with rendered previews |
| LIB-02 | Previews | Each specimen renders its own thumbnail; failure shows `Preview unavailable`, never a broken image |
| LIB-03 | Choose a recipe | Applies it, renames the project, clears placed fields, re-renders |
| LIB-04 | `+ Collect` | The current scene is added with a portrait thumbnail and a toast |
| LIB-05 | Collect at the 16-item limit | Refused with a clear message; nothing is lost |
| LIB-06 | Load a collected specimen | Restores its workspace, settings and name |
| LIB-07 | Delete a specimen | Confirmation first; then it is gone and stays gone after reload |
| LIB-08 | Empty collection | Shows the empty-state copy, not a blank area |
| LIB-09 | Collect failure (e.g. storage refused) | Message names the actual cause, never a generic "storage is full" |

---

## 3. Particle playground

| ID | Check | Expect |
|---|---|---|
| PRT-01 | Default scene | Particles render and move |
| PRT-02 | Every control in Emission, Motion & forces, Interaction, Light & atmosphere, Camera | Each changes the image; none throws; extremes stay stable |
| PRT-03 | Drag on the stage with the cursor tool | Orbits the camera |
| PRT-04 | Scroll wheel | Zooms within its limits |
| PRT-05 | Click with a force tool | Places a field marker at the click point |
| PRT-06 | Shift-click | Places at twice the strength |
| PRT-07 | Field strength box | Accepts 0.1–12; refuses to leave the range |
| PRT-08 | Delete a field from the list or the marker | Both remove it |
| PRT-09 | Twelve fields placed | The counter shows `12/12`; a thirteenth is refused |
| PRT-10 | `Clear fields` / `X` | All removed |
| PRT-11 | `Reseed` | Simulation restarts, fields cleared, toast shown |
| PRT-12 | `Pause` then `Reseed` | Behaves sanely; no frozen or blank canvas |
| PRT-13 | Material populations on | Three populations appear; per-species controls become available |
| PRT-14 | Light colour picker | Placed lights take the chosen colour |
| PRT-15 | Empty stage hint | Shown only when no fields exist, and names the selected tool |

---

## 4. Orb shaders

| ID | Check | Expect |
|---|---|---|
| ORB-01 | Each built-in family (Prismatic silk, Solar cartography, Liquid mercury, Composed fields) | Renders; no console error; GPU time reported |
| ORB-02 | Family dropdown | Lists every registered family plus `Custom GLSL surface` |
| ORB-03 | Switch family | Its declared controls replace the previous family's; values persist per family |
| ORB-04 | Material structure, Light & finish, Camera controls | Each changes the image |
| ORB-05 | Key / Fill / Back light sections | Moving a light sweeps its highlight; colour is Kelvin-like; intensity and drift behave |
| ORB-06 | Solar cartography, rotated a full turn | No seam; no pole artefact; cells are granular, not a dozen boulders |
| ORB-07 | Solar `Corona` | 0 is off; low values a thin rim; high values streamers standing over active regions |
| ORB-08 | Liquid mercury | The silhouette deforms as it turns — not a painted ball |
| ORB-09 | Composed fields designer | Field A/B, composition, and each composer control change the result |
| ORB-10 | `Enclosure` at 0 on a volume family | The bounding sphere stops reflecting; only the volume remains |
| ORB-11 | Palette buttons | All five change the colours |
| ORB-12 | Export GLSL bundle | Downloads valid JSON containing the source |

---

## 5. Family authoring

| ID | Check | Expect |
|---|---|---|
| FAM-01 | `+ Volume` and `+ Surface` | Create a family, select it, and render something immediately |
| FAM-02 | Edit its GLSL | Recompiles about a third of a second after typing stops |
| FAM-03 | Introduce a syntax error | Error panel appears with a line number; **the previous program keeps rendering** |
| FAM-04 | Fix the error | Message clears and the new program takes over |
| FAM-05 | Error line number | Points at the line the author wrote, not the assembled shader's |
| FAM-06 | Add `// @control name min max step "note"` | A slider appears with that label, range and field note |
| FAM-07 | `// @default name value` | The control starts there rather than at the midpoint |
| FAM-08 | Rename a family | The name updates in the dropdown and in saves |
| FAM-09 | Delete a family | Confirmation; the selection falls back cleanly |
| FAM-10 | `Duplicate to edit` on a built-in | Makes an editable copy with the same source |
| FAM-11 | `Save to library` | Writes to `saves/families`; the note names the path |
| FAM-12 | `+ <name>` from the library | Adds it to the project with a fresh id; does not collide with an existing one |
| FAM-13 | A family over the GLSL size cap | Refused with a clear message |
| FAM-14 | A pathological family (many loops, very many calls, deep nesting) | Refused by the complexity check before it reaches the driver |
| FAM-15 | 24 families in a project | The limit is enforced |
| FAM-16 | Save and reopen a project with an authored family | Source, name, controls and values all survive |

---

## 6. Code editor

| ID | Check | Expect |
|---|---|---|
| EDT-01 | Type | The highlighted layer stays exactly under the caret at every scroll position |
| EDT-02 | Syntax colour | Keywords, types, builtins, numbers and comments are distinguished |
| EDT-03 | `Tab` | Inserts two spaces; does not move focus |
| EDT-04 | `⌘/Ctrl+Z` after typing and after `Tab` | Undoes one step, not the whole session |
| EDT-05 | Hold `Alt` | The editor signals that numbers are scrubbable |
| EDT-06 | `Alt`-drag a number | It changes live, with a range suited to its magnitude |
| EDT-07 | `Alt`-drag `5.` | Stays a float; does not become `5` |
| EDT-08 | Scrub a number that changes width (e.g. 9.5 → 10.5) | Keeps scrubbing correctly |
| EDT-09 | Release outside the window | The drag ends; nothing is stuck |
| EDT-10 | Error line | Highlighted in the gutter and in the text |
| EDT-11 | Very long / pathological source | The highlighter does not hang the tab |
| EDT-12 | `maxLength` | Cannot type past the cap |

---

## 7. Glass objects

### Creating forms

| ID | Check | Expect |
|---|---|---|
| GLS-01 | `+ Glass orb` with each of the six forms | Smooth, Geodesic, Icosahedron, Dodecahedron, Octahedron, Cube each render as closed glass |
| GLS-02 | Geodesic detail 1–4 | Visibly finer facets; 1 is the icosahedron |
| GLS-03 | Faceted forms | Facets read as facets, not smoothed into a blob |
| GLS-04 | Smooth orb | Still reads as round — unchanged from before the forms existed |
| GLS-05 | Cylinder sides 5, 8, 24, 64 | 5 is a pentagonal prism; 64 reads as round |
| GLS-06 | Size across forms | Changing form changes the shape, not the size |
| GLS-07 | `Hollow` on, wall 0.02 / 0.12 / 0.3 | Reads as a wall rather than a solid; thickness visibly varies |
| GLS-08 | Add an object, then change the shape options | The existing object is unchanged; the options describe the next one |
| GLS-09 | Eight objects | A ninth is refused |

### Import

| ID | Check | Expect |
|---|---|---|
| GLS-10 | Import a valid OBJ and a valid STL | Both load with triangle counts shown |
| GLS-11 | Import a malformed file | A message, not a crash; the scene survives |
| GLS-12 | Import over 20 MB or over 50k triangles | Refused with the limit named |
| GLS-13 | Import with a polygon over 256 corners | Refused with the reason |

### Materials and per-object controls

| ID | Check | Expect |
|---|---|---|
| GLS-14 | Each material: Glass container, Surface dots, Filled volume dots, Procedural strata | Each renders |
| GLS-15 | Filled volume dots on an open mesh | Refused with the reason, and the object survives |
| GLS-16 | Four optical finishes | Each sets a coherent set of values |
| GLS-17 | Surface defects, Bubbles & seeds | Visible; seeded per object, so a duplicate differs |
| GLS-18 | Position, rotation, scale per axis | Each clamps to its range and moves the object |
| GLS-19 | Object colour, upper colour, gradient, flow, sparkles | Each visible on a dots object |
| GLS-20 | Visibility toggle | Hides and shows without deleting |
| GLS-21 | Rename an object | Persists through save and reload |
| GLS-22 | Duplicate | A copy with its own flaws, named `copy` |
| GLS-23 | Remove, then `Undo object change` | The object returns |
| GLS-24 | `+ Design inner layers` | Creates a strata object inside the shell, with its own recipe controls |

### Contents

| ID | Check | Expect |
|---|---|---|
| GLS-25 | `+ Load a saved creation` | Lists **both** collected specimens and saved project files, by name, deduplicated |
| GLS-26 | Load a particle piece | Runs inside the shell, fitted to it; the panel says so |
| GLS-27 | Load a particle piece into a **hollow** shell | Fills the cavity, not the wall |
| GLS-28 | Load an orb shader | Becomes the shell's inner shader |
| GLS-29 | An imported orb shader's appearance | Matches how it looked in the orb workspace — palette, emission, scale, declared parameters — allowing for the shell's own optics and stage |
| GLS-30 | Load an orb piece with an authored family | The family comes with it, with a fresh id |
| GLS-31 | Load a glass composition | Its objects are added to the scene |
| GLS-32 | Load a piece whose mode has nowhere to go | A clear message, no change |
| GLS-33 | `Inner shader` dropdown | Selects any registered family; inherits this workspace's settings |
| GLS-34 | Switch inner shader after importing one | Does not dress the new family in the old one's settings |
| GLS-35 | Inner size and inner offset | Both move and scale the contained family |
| GLS-36 | `Empty this enclosure` | Releases a contained simulation |
| GLS-37 | Solar cartography inside a shell | Its corona stays local to the object, not washed across the frame |
| GLS-38 | `From a file elsewhere…` | Opens the native picker as a fallback |

---

## 8. Node composer

| ID | Check | Expect |
|---|---|---|
| NOD-01 | Open the workspace | The graph renders with its nodes |
| NOD-02 | Add each node type | Appears and can be wired |
| NOD-03 | Drag a node | Moves; the wires follow |
| NOD-04 | Connect output to input | Wire drawn; the downstream result changes |
| NOD-05 | Click a wire | Disconnects |
| NOD-06 | Create a cycle | Refused with feedback; the graph is unchanged |
| NOD-07 | Disconnect the output | Renders black rather than failing |
| NOD-08 | Reduce the chain | Only the active chain evaluates |
| NOD-09 | Node parameter inputs | Each changes the result |
| NOD-10 | Save and reopen | The graph, positions and connections survive |

---

## 9. Persistence

| ID | Check | Expect |
|---|---|---|
| SAV-01 | `Save` with the dev server running | Writes into `saves/projects`; a toast names the path |
| SAV-02 | `Open` | Lists the folder's projects **by name**, not by filename slug |
| SAV-03 | Open one | Restores workspace, settings, objects, families and name exactly |
| SAV-04 | `Open a file from elsewhere…` | Native picker loads a `.json` project |
| SAV-05 | Save a name with spaces and punctuation | Round-trips; the file is a sane slug; `New surface` does not become `new-20surface` |
| SAV-06 | Save the same name twice | Overwrites its own file rather than multiplying |
| SAV-07 | Autosave | Written while editing; survives reload |
| SAV-08 | Reload with an autosave present | Recovery banner names the piece; `Restore` reinstates it |
| SAV-09 | Dismiss the banner | It stays dismissed for that session |
| SAV-10 | Recovery banner accuracy | It never offers work older than what was on screen |
| SAV-11 | Open a project file that is not a BOAST project | Refused with a reason; the current scene survives |
| SAV-12 | Open a project from an older version (integer family id) | Migrates and renders |
| SAV-13 | Open a project naming a family it does not carry | Refused, or the reference is dropped — never a broken render |
| SAV-14 | A file over the 96 MB limit | Refused with the size named, not a network error |
| SAV-15 | Build without a dev server (`npm run build` and serve `dist`) | Saves fall back to IndexedDB; nothing reports a false failure |
| SAV-16 | `saves/` is git-ignored | `git status` stays clean after saving |

---

## 10. Export and capture

| ID | Check | Expect |
|---|---|---|
| EXP-01 | PNG capture | Downloads at the show resolution; correct dimensions in the file header |
| EXP-02 | Recording | Produces a playable video; stops on a second press and at the 30-second cap |
| EXP-03 | Export `.glsl` | Downloads the current surface source |
| EXP-04 | Export GLSL bundle | Valid JSON, with the palette resolved to numbers |
| EXP-05 | `Export project` from the scene panel | Same as Save |
| EXP-06 | WebGL error state after every export | `getError()` is 0 |

---

## 11. Rendering and performance

| ID | Check | Expect |
|---|---|---|
| PRF-01 | GPU breakdown | Per-pass milliseconds shown; labels match the active workspace |
| PRF-02 | Switching workspace | Stale passes from the previous workspace do not linger in the breakdown |
| PRF-03 | Development and show quality sliders | Resolution changes; trails survive a quality change |
| PRF-04 | Several shells each holding a different family | No frame stalls while they compile; families appear within a frame or two |
| PRF-05 | FPS versus GPU time | Understood as different facts — a throttled tab reports low FPS with low GPU time |
| PRF-06 | Force context loss (`WEBGL_lose_context`) | The app survives, the message is accurate, and the autosave on disk matches what was on screen |
| PRF-07 | Sustained run (several minutes) | No unbounded memory growth, no progressive slowdown |

---

## 12. Errors, limits and inputs

| ID | Check | Expect |
|---|---|---|
| ERR-01 | Every numeric input given a value out of range | Clamped, not accepted |
| ERR-02 | Every numeric input given empty or non-numeric text | Ignored; no `NaN` reaches the renderer |
| ERR-03 | A project file with an invalid palette, malformed nodes, duplicate object ids, or a prototype-polluting key | Refused with a reason |
| ERR-04 | Renderer failure | The error card appears and offers to save before reloading |
| ERR-05 | Every error message in the app | Names the actual cause; no blanket message blaming the wrong subsystem |

---

## 13. UI and UX states

Every panel has more states than "populated". Check each one that applies.

| ID | State | Expect |
|---|---|---|
| UXS-01 | Empty | Glass with no objects, collection with no specimens, particle stage with no fields, family library with no families — each has purposeful empty copy |
| UXS-02 | Busy | Mesh processing disables the controls that would conflict and says what is happening |
| UXS-03 | Disabled | Every disabled control is disabled for a visible reason (limit reached, nothing selected) |
| UXS-04 | Selected | The selected object's row is distinguishable |
| UXS-05 | Dirty | Unsaved work is indicated, and the indicator clears on save |
| UXS-06 | Paused | Indicated in the stage corner |
| UXS-07 | Error | Messages appear near what caused them, not only as a toast |
| UXS-08 | Toast | Appears, is readable, and clears itself |
| UXS-09 | Tooltip | Hover and focus both open a field note; it closes on leave and on `Esc`; the "explore further" link works |
| UXS-10 | Modal | Opens, traps focus, closes on backdrop click, on its close button and on `Esc` |
| UXS-11 | Section headers | Collapse and expand; the first two start open |
| UXS-12 | Secondary buttons | Every button has a visible border or background — none render as bare text |
| UXS-13 | Focus visible | Every interactive element shows a focus ring when tabbed to |
| UXS-14 | Labels | Every control has an accessible name |
| UXS-15 | Live regions | Status messages are announced, not only drawn |

### Round trips

The transitions where state gets lost. Each is a full circuit, not one action.

| ID | Circuit | Expect |
|---|---|---|
| RTR-01 | Edit → switch workspace → return | Nothing lost |
| RTR-02 | Edit → save → reload → open | Identical |
| RTR-03 | Edit → reload without saving → Restore | The autosave, and it says so |
| RTR-04 | Restore while holding unsaved work | The user is not silently overwritten |
| RTR-05 | Author a family → save → reopen → edit it again | Still editable, still compiles |
| RTR-06 | Orb piece → import into glass → save → reopen | Still looks like the orb piece |
| RTR-07 | Collect → delete the original → load the specimen | Works from the collection alone |
| RTR-08 | Show mode → edit → show mode | Consistent |

---

## 14. Layout

| ID | Check | Expect |
|---|---|---|
| LAY-01 | 1440 × 960 | The intended three-column layout |
| LAY-02 | 390 × 844 | No horizontal overflow; every control reachable |
| LAY-03 | Between the two | Nothing overlaps or clips at any intermediate width |
| LAY-04 | Long project and object names | Truncate rather than break the layout |
| LAY-05 | Dark surroundings | The application is dark-native; nothing renders as white-on-white |

---

## 15. Boundaries

The dev-server save endpoint writes files. These are the checks that keep it from
being a local file-write primitive for any page in the browser.

| ID | Check | Expect |
|---|---|---|
| SEC-01 | Request without the `x-boast` header | Not served |
| SEC-02 | Request with a foreign `Origin` | Refused |
| SEC-03 | Cross-origin request from another page | Blocked at the preflight |
| SEC-04 | A name containing `../`, a separator or an absolute path | Confined; the file lands inside `saves/<area>` or is refused |
| SEC-05 | An unknown area | Refused |
| SEC-06 | A body that is not JSON | Refused; nothing is written |
| SEC-07 | The plugin in a production build | Absent |
| SEC-08 | Imported GLSL from a file | Runs only after passing validation and the complexity check |
| SEC-09 | `npm ls` / lockfile | No new runtime dependency; no install scripts |

---

## 16. What the automated tests already cover

Cases marked here do not need a manual pass unless the code beneath them changed.
`npm test` covers, at time of writing: project round trips and version rejection;
invalid numbers, palettes, nodes and fields; cycles and active-chain evaluation;
family validation, legacy family migration, declared controls and source offsets;
shell contents including the carried look; primitive forms, closure and winding;
hollow shells and both interior fill modes; faceted versus averaged normals; the
GLSL tokenizer including pathological input; and the GPU timer.

Everything else in this document is a human or agent check. Rendering correctness —
whether a thing *looks* like what it claims to be — is not unit-testable here and
never appears in that list.

---

## Recording a run

In `docs/VALIDATION.md`, per run: the date, the commit, the browser and machine,
then the case IDs that passed, the case IDs that failed with what happened, and the
case IDs not run with why. A run that checked forty cases and says so is worth more
than one that claims everything passed.
