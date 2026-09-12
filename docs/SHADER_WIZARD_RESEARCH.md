# Authoring shader families in-app — research

The goal: stop hand-coding families into the renderer. A family should be something
a user builds, saves, and shares from inside BOAST, with dragging and composing for
the parts that suit it and raw GLSL for the parts that do not.

## 1. What actually blocks it today

Not the UI. The data model.

`src/materials/fragment.js` is one fragment shader with families selected by
`if(uFamily==1)`, `==2`, `==4`. A family is a **branch in a source file**, so adding
one means editing that file, adding an integer to a list, and adding its parameters
by hand to `materialDefaults`, `materialControls`, and a section array in
`main.jsx`. Four files, none of them reachable from the running app. That is the
whole reason a person cannot add one.

Family 4 — the one the "family designer" exposes — is not authoring either. It is
`field(p, kindA)` combined with `field(p, kindB)` through one of four operations,
where `field` is a switch over four hardcoded functions. Sixteen combinations and
some continuous parameters. That is a **preset space**, and a preset space is
exactly the thing that runs out.

## 2. What BOAST already has

More than it looks like. An honest inventory, because the cheapest wizard is the
one that mostly already exists.

**A working code contract.** The Orb workspace already accepts raw GLSL. The user
writes exactly two functions:

```glsl
float shape(vec3 p);           // signed distance
vec3  pigment(vec3 p, vec3 n); // surface colour
```

and `orbFragment(source)` wraps them in a scaffold that supplies the uniforms, the
raymarcher, normals, soft shadows, ambient occlusion, an environment, and tone
mapping. This is the single most valuable asset in the repo for this problem. It is
already the hand-holding-plus-code leg: a tiny surface to write against, with
everything hard provided. It compiles live and shows compiler diagnostics while the
previous working shader keeps rendering.

**A live compile path** — `engine.compile(source)` swaps the program and keeps the
old one on failure. `COMPILED` / `MODIFIED` state is already in the UI.

**A parameter description format.** `[label, min, max, step, field note, search
terms]`, now shared by every panel through `Control.jsx`. A family that could
*declare its own* entries in this shape would get sliders, numeric entry, clamping,
persistence, and field notes with no code changes anywhere.

**An export contract.** `exportFamily()` already emits a self-contained
`boast-shader-family` bundle: vertex, fragment, uniforms, and a written integration
contract. Authoring is the missing inverse of an export that already works.

**A validation and persistence spine.** `validateProject` already refuses malformed
input at the boundary and clamps every number to its control's range.

What is missing is not a renderer feature. It is that **a family is not a value**.

## 3. How the field solves it

### Node graphs that compile, not graphs that render

The important distinction, and the one most casual descriptions get wrong.

**Substance Designer** evaluates each node to a texture. Every node has a real
thumbnail, which is its great teaching affordance — you see where your idea went
wrong at the node it went wrong at. It also means each node costs a render target,
which is why most Designer operations are too expensive to do in real time
([polycount discussion](https://polycount.com/discussion/214583/substance-designer-vs-unity-shader-graph)).

**Material Maker** took the other road: most nodes are GLSL snippets, and
connecting them **generates one combined shader** rather than rendering an image per
node ([Material Maker](https://rodzilla.itch.io/material-maker)). New nodes can be
made by grouping existing ones *or by writing GLSL directly*.

For BOAST the second model is the only viable one — one program, one pass, real
time — and it has a pleasant consequence: **the graph is a code generator, so the
graph and the code are the same artifact seen two ways.**

### The code-defines-the-interface pattern

The detail worth stealing outright. In SHADERed's SpearNode, you type GLSL into a
node and **the editor creates the pins automatically** from what you wrote
([SHADERed](https://shadered.org/blog?id=10)). NodeToy exposes the same idea as a
Custom Expression node ([NodeToy](https://nodetoy.co/)); three.js and Babylon have
"hybrid graph" previews built on it
([three.js forum](https://discourse.threejs.org/t/hybrid-graph-glsl-shader-editor-tech-preview-for-three-js/48725)).

This dissolves the usual "visual *or* code" split. A node is a function; its
signature is its interface. `float ridges(vec3 p, float scale)` has two inputs and
one output because it says so. No separate node definition to maintain, no registry
to edit, and a user who writes a function has authored a node whether they meant to
or not.

### Annotation-driven controls

`live-glsl` generates its GUI from annotations in the shader; ShaderBox detects
uniforms and shows contextual widgets for them
([ShaderBox](https://where-is-your-keyboard.itch.io/shaderbox/devlog/987247/shaderbox-interactive-glsl-shaders-editor)).
The shader is the single source of truth for its own parameters.

BOAST is unusually ready for this because the control tuple already exists. A header
comment is enough:

```glsl
// @control scale 0.5 8 0.1 "How many times the pattern repeats across the volume."
```

### The feedback loop is the feature

The live-coding literature is consistent on one point: when the loop is
instantaneous the cost of a mistake drops to zero, and that is what makes
exploration possible — trying an idea in 100ms rather than 30s
([Frontend Masters](https://frontendmasters.com/courses/canvas-webgl/hot-reloading-future-features/),
[shader-reload](https://github.com/mattdesl/shader-reload)). This is the true
content of the music-REPL comparison, and it transfers cleanly. It is not about
having a text pane; it is about never pressing Compile.

### Breeding instead of building

A genuinely different strategy, and the one most likely to be dismissed too early.
Interactive evolutionary shader tools encode a shader's graph as a chromosome, show
a population of variants rendered on a standard scene, and let the user score or
pick parents to recombine
([arXiv 2312.17587](https://arxiv.org/abs/2312.17587)), following Picbreeder. Newer
work puts an LLM in the mutation operator ([arXiv 2512.08951](https://arxiv.org/html/2512.08951v1)).

Worth taking seriously here for a specific reason: **BOAST already has a
collection**. "Collect family" saves an editable family with a rendered portrait. A
grid of nine mutations with a Keep button is a small step from a gallery that
exists, and it answers the question a parameter space is actually bad at — *what is
in here that I would never have typed?*

## 4. Strategies

Ordered by how much they change, not by preference. Each notes what it costs here.

### A. Family as a value (prerequisite for everything else)

Replace the `uFamily` integer branch with a registry: a family is a record with a
name, a GLSL body, its control declarations, defaults, and a portrait. Built-ins
become seed records rather than special cases.

*Cost:* a real refactor of `fragment.js` and the material catalog. *Buys:* families
become savable, importable, shareable, and diffable — and every later idea becomes
possible. Nothing else on this list works without it.

### B. Self-describing parameters

`@control` annotations parsed in JS into the existing six-tuple. A new family brings
its own sliders, ranges, and field notes.

*Cost:* small — a regex parser and a merge into the controls table. *Buys:* removes
the author from the loop for parameters entirely. Highest value per line on the
list.

### C. Always-live compile

Debounced recompile on edit, keeping the last good program on failure — which
`compile()` already does — plus errors marked at their line.

*Cost:* small, and one real hazard: a pathological shader can hang the GPU. The
scaffold's fixed loop bounds already contain this, and **user code must never be
allowed to set a loop bound.** *Buys:* the feedback loop the whole literature says
is the thing.

### D. Hybrid graph over the same source

Nodes are GLSL functions; pins come from signatures; the graph emits one shader.
Switching between graph and code is a view change, not an export.

*Cost:* the largest item here — a parser, a layout, a topological emitter, and a
policy for code that the graph cannot round-trip. *Buys:* exactly what was asked
for. Best attempted after A–C exist, since it is a *view* over them.

### E. A snippet shelf

A drawer of composable fragments — noise kinds, domain warps, ramps, easings, SDF
primitives and combinators — each with a live thumbnail, dragged to insert at the
cursor.

*Cost:* small, mostly content. *Buys:* most of the hand-holding of a graph at a
fraction of the price, and it works for a programmer who would rather type. A
plausible substitute for D rather than a step toward it.

### F. Scrubbable literals

Alt-drag any number in the source to change it live, Bret Victor style. No uniform
declaration, no slider, no ceremony.

*Cost:* small, and larger without a real code editor. *Buys:* the tightest possible
loop for the thing people actually do most — adjusting a constant.

### G. Breeding

Mutate the current family's parameters — later its graph — into a grid of variants
on a fixed scene. Keep, breed, or discard into the collection.

*Cost:* moderate, and much cheaper at the parameter level than the graph level.
*Buys:* discovery rather than construction. Complements every other item; competes
with none.

### H. Per-stage previews

Substance's thumbnail-per-node, which is *the* comprehension aid in that tool. In a
single-program design it means re-rendering the chain truncated at each stage.

*Cost:* real GPU cost, now measurable — `EXT_disjoint_timer_query_webgl2` is wired
up and a full frame is presently under 5ms, so there is headroom to spend here
deliberately rather than hopefully.

## 4b. What has been built

**A. Family as a value** — done (`3401712`). `src/materials/families.js` holds the
registry and the scaffold; `fragment.js` is gone. A family is `{id, name, kind,
glsl}`, compiled per family and cached on identity and source. Two kinds so far,
`volume` and `surface`, which is what rebuilding Solar cartography and Liquid mercury
proved was actually needed. Loop bounds live in the scaffold and only there.

**B. Self-describing parameters** — done. A family declares controls in its own
source:

```glsl
// @control filament 4 60 0.5 "How tightly the sheets pinch into threads." "isosurface"
// @default filament 24
```

The parser builds the same six-tuple every panel already consumes, the scaffold
declares `uniform float uFilament`, the engine binds it, and the panel grows a
section named after the family. Values live in `config.params[familyId]`, nested so
two families may both call something `scale`; a file naming a family or a control
this build does not have has those values dropped rather than rejected, so older and
newer files still open. Prismatic silk uses it for two of its own.

**C. Compile as you type** — done. The GLSL editor has no Compile button: edits
land 350ms after you stop typing. Measured before designing it, because the answer
decided the design — compiling and linking that shader is about a millisecond
steady-state, with 55-90ms on the first two compiles while the driver's cache is
cold. At a millisecond there is nothing to ration and no in-progress state worth
drawing, so the debounce exists to avoid sending half-typed identifiers to the
driver rather than to throttle a cost.

Errors report the author's line, not the assembled shader's. The offset is measured
against a real driver message rather than counted by eye, and the test derives it
from the scaffold so it fails if the preamble grows. A failed compile keeps the last
working program running, which is the property that makes typing into a live shader
bearable at all: the editor shows a soft red edge and the line, and the render
carries on.

**A family you can add in the app** — done. A project carries its own families
alongside the built-ins, and the merged registry is what every consumer reads, so an
authored family is indistinguishable from a shipped one: it appears in the dropdown,
its declared controls build a panel section, and it is what the editor edits.

Built-ins are duplicated rather than edited in place, because editing a shipped
family would leave a project that renders differently from an identical one
elsewhere. Families are identified, never named, so renaming one cannot orphan the
parameters saved against it.

The load-bearing detail is that compilation fails softly. `frame()` treats a render
error as fatal and disposes the engine, so a half-typed family would take the whole
application down; `familyProgram` keeps the last good program on screen instead, and
a family that has never compiled draws nothing. The failed source is remembered so
the driver is not asked the same broken question sixty times a second.

## 5. Recommended path

**A + B + C first**, as one piece of work. A family becomes a record, declares its
own controls, and recompiles as you type. That alone ends the dependency on me for
new families, because a new family stops requiring an edit to the renderer.

**Then E and F.** Cheap, and together they cover most of what "hand-holding" means
for a programmer: things to reach for, and direct manipulation of what is already
written.

**Then D or G, as a choice, not a sequence.** D is the literal request. G is the one
more likely to produce something neither of us would have written. Building both is
possible; building both *first* is how neither gets finished.

## 6. What I would not build

**A general-purpose node graph with a fixed node library.** It is the expensive half
of Substance Designer without the thumbnails that make it worth it, and it puts the
author back in the loop — every new capability becomes a new node type someone has
to add. The signature-derived node is the version that does not have this problem.

**A visual editor that cannot round-trip.** If the graph cannot read back code the
user hand-edited, the code becomes a dead end and the graph becomes the only real
interface. Either the graph owns a region and says so, or it round-trips.

**A dependency.** Line-marked errors, scrubbable literals, and syntax highlighting
have to be built on a `textarea` and an overlay. This was an assumption when first
written and is now a measured finding — see
[CODE_EDITOR_DEPENDENCY_RESEARCH.md](CODE_EDITOR_DEPENDENCY_RESEARCH.md). The short
version: CodeMirror 6 would more than double the application's gzipped payload,
Monaco ships open sanitizer advisories with a downgrade-only fix and does not
support mobile, and **no library on the list offers scrubbable literals at all**, so
custom editor code gets written either way.

## 7. Security note

Authored GLSL is compiled locally and runs on the user's own GPU; there is no `eval`
and no server. The real exposure is an **imported** family from elsewhere: GLSL
cannot read the filesystem or the network, but it can hang the GPU and take the tab
with it. The existing scaffold contains this by owning every loop bound as a
constant. Any authoring path must keep that property — **user code contributes
function bodies, never loop bounds** — and imported families should be validated on
the same principle as imported projects, at the boundary, before they reach a
compiler.

## Sources

- [Substance Designer vs. Unity Shader Graph — polycount](https://polycount.com/discussion/214583/substance-designer-vs-unity-shader-graph)
- [Material Maker](https://rodzilla.itch.io/material-maker)
- [SpearNode: a node based shader editor — SHADERed](https://shadered.org/blog?id=10)
- [NodeToy](https://nodetoy.co/)
- ["Hybrid Graph" GLSL shader editor tech preview — three.js forum](https://discourse.threejs.org/t/hybrid-graph-glsl-shader-editor-tech-preview-for-three-js/48725)
- [ShaderBox — interactive GLSL editor](https://where-is-your-keyboard.itch.io/shaderbox/devlog/987247/shaderbox-interactive-glsl-shaders-editor)
- [shader-reload](https://github.com/mattdesl/shader-reload)
- [Hot reloading — Frontend Masters, Creative Coding with Canvas & WebGL](https://frontendmasters.com/courses/canvas-webgl/hot-reloading-future-features/)
- [A Tool for the Procedural Generation of Shaders using Interactive Evolutionary Algorithms — arXiv 2312.17587](https://arxiv.org/abs/2312.17587)
- [AI Co-Artist: LLM-Powered Interactive GLSL Shader Animation Evolution — arXiv 2512.08951](https://arxiv.org/html/2512.08951v1)
- [GLSL MAT — TouchDesigner documentation](https://docs.derivative.ca/GLSL_MAT)
