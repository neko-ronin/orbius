# ORBIUS — Light laboratory

A local-first visual instrument built with React and WebGL 2. No account, backend, API keys, or external assets are required.

## Run

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The dependency lockfile is included in the project files; `.npmrc` disables package lifecycle scripts. Use a modern Node version compatible with Vite 8 (Node 22.12+ recommended). The development server binds to loopback only.

```sh
npm test       # project validation and graph evaluation
npm run build # static production output in dist/
npm run preview
```

## Make something

- **Particle playground** opens first. Five presets, five palettes, 80,000 default particles (up to 160,000), GPU simulation, 3D orbital motion, procedural flow, trails, bloom, exposure, and camera controls.
- **Orb studio** ray-marches an editable closed surface. Geometry, normal calculation, ambient occlusion, self-shadowing, and secondary reflection rays use the same distance field. Open **GLSL editor** to edit `shape(vec3 p)` and `pigment(vec3 p, vec3 n)`. A failed compilation leaves the last working program on screen. The surface file can be exported as GLSL.
- **Orb shaders** carries the material families. A family is a value, not a branch in the renderer: pick one, **Duplicate to edit** it, or start a new **Volume** or **Surface** from a working template. The editor compiles as you type and keeps the last working version on screen while you break the next one, so a half-typed shader shows you an error rather than an empty canvas. It highlights GLSL, numbers the lines, marks the line an error is on, and **alt-drag any number to scrub it** — the shader recompiles under your hand. A family declares its own sliders in its own source — `// @control veins 1 14 0.1 "How many filaments cross the body."` — and the panel builds them, with the ranges, field notes and persistence every other control has. Authored families travel with the project, and **Save to library** puts one in `saves/families/` so another composition can pick it up.

A glass shell can hold one. **Inner shader** on a glass object renders a family inside it, at a size and offset you choose, through the enclosure's own camera — so it is refracted, absorbed and occluded like anything else in there. Solar cartography at 0.4 inside a clear orb is a sun under glass. **Enclosure** in the orb workspace turns off a volume family's own bounding sphere, which is what makes it a body of light rather than an object in a second ball.
- **Glass objects** composes enclosures and their contents as separate objects. Add a glass orb, cylinder or cup, or import an OBJ/STL mesh, then give it a **Glass container**, **Surface dots**, **Filled volume dots**, or **Procedural strata** material. An orb can be **smooth, geodesic, icosahedral, dodecahedral, octahedral or cubic**, a cylinder can have anywhere from five to sixty-four sides, and either can be **hollow** with a wall thickness. A cup is a drinking glass turned from a closed outline — **Old Fashioned, wine, cocktail, martini, cognac, champagne, shot, margarita, Poco Grande scotch or nosing scotch** — already a wall around a cavity, and the Old Fashioned can also be cut: **square with dimpled sides, ornate crystal facets, or round with many sides** — all chosen before you add it, since the mesh is baked at that moment. Four optical finishes (Clear, Frosted, Prism, Smoked) set IOR, roughness, thickness, dispersion, absorption, density, studio brightness, and the two defect controls together; the individual controls stay available. **Surface defects** adds forming waviness, orange peel, a scratch field, and uneven wall thickness; **Bubbles & seeds** suspends inclusions in the body at depth. Both are seeded from the object, so a vessel keeps its own flaws and a duplicate gets its own. **Studio backdrop** under Studio & finish draws the sweep the glass refracts and reflects — set it to zero for black-space compositions.
- **Contained simulations** run a saved particle project inside a glass shell. Select a shell, choose **Load a saved creation**, and pick a `.orbius.json` particle project: its solver parameters transfer, its particles are confined to the mesh interior by a voxel occupancy field, and the glass refracts them. The project is re-authored against the enclosure's measured interior rather than loaded verbatim — a simulation built for an open stage becomes uniform fog once walled in — and its particles accumulate into their own trail buffer, where a saved project's filaments and most of its brightness live. Its placed fields come too, fitted to the vessel the same way and held in the shell's own frame, so moving or turning the shell carries them; **Contained fields** under Contained simulation scales how hard they pull.
- **Node composer** is hidden from navigation until it is mature enough to feature. Its code stays in `src/NodeEditor.jsx`, and a project saved in that workspace still opens into it. It connects a particle or orb source through curl, spiral warp, color grade, and bloom to one stage output. Drag cards to arrange them. Click an output port and then an input port to wire them. Click a wire to disconnect. Only the chain reaching the output affects rendering; disconnected output renders an empty stage. Cycles and multiple input connections are rejected. Up to 24 nodes.
- **Show mode** hides the studio UI and increases resolution from 70% to 150% by default. Both scales are adjustable. Orb primary rays use 80 steps in development and 192 in show mode; secondary rays and shadow samples also increase. Rendering is capped at 3840 px on the longer edge and at the GPU texture limit. Exit with `S`, `Escape`, or the top-right control (revealed on hover/focus; faintly visible on touch devices).

Each numeric control has an explanation on hover or focus, an example, and a learning-search link. Expand the inspector sections to reach all parameters. Light color affects newly placed lights. The interaction strength and radius affect newly placed fields; an existing field's strength and its X/Y/Z position can be changed under **Placed fields**.

| Key | Action |
| --- | --- |
| `1` | Orbit camera tool; drag the stage |
| `G` | Place an attractive gravity well |
| `R` | Place a repulsive field |
| `V` | Place a vortex |
| `L` | Place a colored light |
| `B` | Create a short outward shockwave |
| `F` | Place a field that damps nearby motion |
| `Shift` + click | Double the new field's strength |
| `X` | Clear fields |
| Scroll | Zoom |
| `Space` | Pause / play |
| `S` / `Escape` | Enter / leave show mode |
| `P` | Download a high-resolution PNG |
| `C` | Start / stop a recording, up to 30 seconds |
| `Cmd/Ctrl S` | Save the project |
| `?` | Field guide |

Keyboard shortcuts are suspended while typing. Fields sit in the scene: a click places one on the plane through the centre facing the camera, and it stays put as you orbit; nearer markers draw larger. Projects saved before fields had depth open with each field as a **column** along the line of sight it was placed from, so it sits where it was drawn. Click a field marker to delete that field. There are at most 12 simultaneous fields. Orb interaction uses camera dragging; particle field markers are hidden there.

## Save, recover, export

**Save** downloads a portable `.orbius.json` project. **Open** loads one from disk. Files contain parameters, the workspace, node positions and connections, fields, the working shader, and an unfinished shader draft. Loading validates the format, sizes, ranges, identifiers, and graph structure before applying the scene. Compilation failure aborts loading and retains the previous scene.

The browser keeps a debounced local autosave and offers to restore it on the next visit. Use explicit disk saves for durable copies. There is no server storage or cloud sync. Saved projects recreate settings and field placement, not a bit-exact checkpoint of all GPU particle positions or wall-clock time. Transient shockwaves are omitted.

PNG export captures the canvas at 3840 px wide, limited by GPU capabilities, preserving the current aspect ratio and accumulated trails. UI is never part of canvas exports. Pre-existing trail history is resampled at the new resolution; newly rendered points use the target resolution. For the sharpest fresh trails, let show mode run briefly before capturing.

Video uses the browser's MediaRecorder with a 30 FPS capture stream and a 12 Mbps requested bitrate, preferring VP9 WebM, then VP8 WebM, then MP4 where supported. It records the current canvas resolution. Enter show mode before starting a recording and keep its dimensions stable. The 30-second limit bounds memory use; playback metadata and codec availability vary by browser. Audio is not recorded.

## Rendering boundaries

This is a real-time artistic renderer, not a physically based path tracer. Orb reflection rays can hit neighboring folds; otherwise they sample an analytic environment. Refraction uses the refraction index to bend an interior color sample, not a full volumetric transmission model. Very aggressive or non-distance GLSL can introduce ray-marching artifacts or exhaust GPU time. The inspector's supplied geometry range also allows disconnected lobes at high displacement.

Everything the app saves — the autosave, your collection, and projects — is written
to `saves/` inside the repository, through a dev-server endpoint that exists only
while `npm run dev` is running. The folder is gitignored. **Open** lists what is in
`saves/projects/` and still offers a file picker for anything from elsewhere. A built
copy has no dev server to write through and falls back to IndexedDB and browser
downloads.

Because that endpoint can write files, it is confined deliberately: names are rebuilt
from `[a-z0-9-]` rather than escaped, the target directory comes from a fixed map, the
extension is fixed, every request must carry an `x-orbius` header (which forces a CORS
preflight that only this dev server's own origins pass), and the `Origin` header is
checked independently.

A contained simulation is confined by a 64³ occupancy grid sampled in the solver, which is an art-directed boundary force, not rigid-body collision: particles are pushed back along the field gradient and can dip into a thin wall under a low containment force. Thin features narrower than a voxel do not confine reliably. Glass objects sit on a world-space stage: an analytic floor with a horizon, a contact shadow from a top-down coverage mask, and a world-locked studio rig whose highlights sweep as the camera orbits. The rig is three data-driven softboxes — key, fill, back — each with spherical placement, width and height, a kelvin colour temperature, intensity, and arrhythmic drift and flicker; the contact shadow follows the key light. Kelvin and the temporal motion resolve on the CPU once per frame, so the cost is per light rather than per pixel. Shells also leave a reflection in the floor, drawn by mirroring the mesh through the floor plane and shading it with the rig alone; **Floor finish** scales it, and a matte sweep skips the pass. A shell's contents and dot objects outside one are not reflected. **Studio backdrop** dims only the directly visible background — glass always reflects the full room. **Floor texture** gives the sweep undulation, drag marks, and tooth so reflections have something to break up on, fading out with distance so fine detail never becomes aliasing. Glass objects render into a multisampled buffer, so shell silhouettes are antialiased; the sample count steps down at high output resolutions. Shells composite back to front by camera depth over a shared depth buffer, so each shell refracts and occludes the shells behind it. Refraction is still a single screen-space offset per shell, not a ray traced through successive dielectric boundaries, and it can only bend light from what is on screen — lookups that would leave the frame fall back to looking straight through the shell.

Node graphs are a single-input composition chain with reusable branches, not a general-purpose image mixer or arbitrary GLSL node compiler. Repeated nodes of the same parameter type use the last connected value. Particle motion nodes affect the particle simulation; on orbs they change the surface domain warp.

WebGL 2 is required. Float color targets are used when `EXT_color_buffer_float` is available, with an RGBA8 fallback. Performance depends on GPU, output size, particle count, and shader complexity. Context loss displays a recovery message instead of silently continuing with a broken image. Touch layout is supported; desktop is the primary authoring experience. Browser chrome remains browser-controlled in show mode.

## Sources of truth

Start here before changing anything or testing anything. These four are authoritative for this repository; where they and a stray comment disagree, they win.

- **`docs/MATERIAL_DIRECTION.md`** — why the work is the way it is. Every material decision, what was tried, what failed, and what the failure taught. The reference for intent.
- **`docs/TEST_PLAN.md`** — what must be true. Every workspace, flow, control, limit and UI state as numbered cases, and therefore the closest thing to a feature inventory. Test against this, and add a case when you add behaviour. Its numbers are a snapshot of the code, not the other way round.
- **`docs/SHADER_WIZARD_RESEARCH.md`** — how in-app authoring was arrived at: the survey of shader tools and live-coding environments behind families-as-values, `@control` annotations, and compile-as-you-type.
- **`docs/CODE_EDITOR_DEPENDENCY_RESEARCH.md`** — the measured case for building the editor rather than taking CodeMirror or Monaco, including the reversal triggers. Read it before proposing a dependency.

`docs/MATERIAL_STUDIO.md` documents the glass and material workspaces as built. `docs/VALIDATION.md` is the record of what was actually checked and when, by case ID from the test plan; it is a log, never a specification. The bug wiki at `~/Repos/vibes/bugs/` holds the diagnoses — consult it before debugging anything non-trivial, and write an entry after solving one.

## Source map

- `src/main.jsx`: studio state, inspector, controls, persistence, capture, and keyboard interaction.
- `src/engine.js`: WebGL resource ownership, transform feedback, render targets, simulation, capture, and cleanup.
- `src/shaders.js`: simulation, point sprites, feedback, compositing, and orb shader assembly.
- `src/project.js`: parameter metadata, presets, palettes, file validation, and graph evaluation.
- `src/NodeEditor.jsx`: node manipulation and connections.
- `src/style.css`: studio design language, responsive layout, and interaction states.

Dependency review, provenance, limitations, and advisory sources are in `docs/VET_REPORT.txt`. No commit or push was made during creation.
