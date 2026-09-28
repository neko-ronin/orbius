# ORBIUS material and object studio

## User-directed object composition

Glass Objects now starts with an empty composition. The procedural human bust, skeletal scaffold, and Phosphor anatomy preset have been removed. Object geometry comes from basic forms or local mesh files; materials are independent treatments of that geometry. See [the current direction and reference analysis](MATERIAL_DIRECTION.md) for procedural strata, optics, and shader-family authoring.

Add a built-in **Glass orb** or **Glass cylinder** — in one of six forms, with any number of sides from five, optionally hollow with a wall thickness — or a **Glass cup**, one of ten drinking glasses, with four cuts for the Old Fashioned — or import an OBJ or STL mesh, then choose **Glass container**, **Surface dots**, or **Filled volume dots**. Import another mesh or duplicate an existing object. Each object has independent position, rotation, scale, visibility, color, and material controls. Removal can be undone. The scene supports eight objects.

Surface dots use deterministic area-weighted sampling over triangles. Filled-volume dots use odd/even triangle intersections to fill a grid inside the mesh; this requires a closed manifold surface. Open meshes can use glass or surface dots. Intersecting or degenerate shells may need repair in a modeler. Files are centered and uniformly fitted independently on import; use the object transforms to align separately exported parts.

Supported inputs: OBJ positions/faces, including negative indices and triangulation of simple concave polygons; ASCII and binary STL. Input materials, textures, external material references, rigs, animations, and GLB/FBX are not imported. All processing is local. Limits: 20 MB input, 50,000 triangles per mesh, 120,000 sampled points per object, and a scene-wide geometry budget. Files outside the limits receive a message rather than being silently truncated.

## Ownership and extension boundaries

- `src/objects/geometry.js`: pure parsing, topology checks, normals, surface sampling, and volume sampling. Covered by Node tests.
- `src/objects/layers.js`: clipped terrain generation, motion limits, and recipe validation.
- `src/materials/composer.js` and `export.js`: family construction parameters and standalone GLSL bundle export.
- `src/objects/import.worker.js`: off-main-thread mesh preparation and material conversion.
- `src/objects/model.js`: scene-object contract and import validation.
- `src/objects/Renderer.js`: imported mesh buffers, dot pass, and glass pass. Transforms/material edits reuse existing geometry buffers. Removed geometry releases GPU resources.
- `src/objects/Editor.jsx`: object selection, import, conversion, transforms, and material controls.
- `src/materials/`: the separate orb shader catalog, material renderer, and persistent surface-chemistry feedback.
- `src/particles/`: the separate population coupling field and its parameter definitions.
- `src/studio/storage.js`: IndexedDB autosave and collection storage, with legacy localStorage reads.
- `src/project.js`: portable project validation, including embedded object geometry.

## What a shell can hold

Select a glass shell and choose **Load a saved creation**. It lists what is in
`saves/projects` by name, and what the thing becomes depends on what it was.

A **particle** piece is poured in: its solver parameters come across and the
particles run live inside that shell, fitted to it, as contents the glass refracts
alongside any dots or strata. One enclosure holds a simulation at a time; **Empty
this enclosure** releases it.

An **orb shader** is placed inside the shell as its **inner shader** when you
import the saved piece — the only way one gets in, since there is deliberately no
picker for it. It renders through the enclosure's camera rather than its own, so it
is refracted and absorbed like anything else in there. An authored family travels
with the piece and is added to this project, and so does the look it was saved
with — palette, hue, emission, scale and every declared parameter — or the shell
would render the same shader against this workspace's own defaults and the import
would arrive unfinished. Once placed, the shell's stack row names it and its
section offers size, offset and removal; placing and every change after it are
undoable like any other object change. There is still no picker — a new inner
sun means importing another piece.

Another **glass** composition adds its objects to the scene.

The picker lists both places a piece can live: everything in your collection, and
every project file in `saves/projects`. Collecting something never writes a project
file, so listing only the folder hid every collected specimen.

The shell is voxelized into an occupancy grid (64³, one box-blur pass) in the
import worker. The solver samples that grid in local space each step and pushes
escaping particles back across it: the wall is a surface they rebound from, not a
spring they pile against, so concave and imported meshes confine
correctly, not just a fitted sphere. **Containment force** under Contained
simulation sets how hard. Particles seed inside the volume by rejection sampling,
both on the CPU at reset and on the GPU when one ages out.

A project is not loaded into an enclosure so much as interpreted into one. Its
structure comes from an emitter throwing material into open space, and walling
that in unchanged destroys it, so `conformSimulation` re-authors the project
against the enclosure's *measured* interior — centre, per-axis half-extent, and
fill fraction, taken from the occupancy grid rather than from a bounding box.

- A cloud settles where turbulence balances its pull toward the middle, so the
  turbulence is scaled by the ratio of vessel size to authored emitter radius.
  That puts the equilibrium at the vessel's scale, which is what makes the
  authored shape survive at a new size.
- The emitter spans the vessel across and keeps the flatness it was given, so a
  disc stays a disc instead of swelling into a filled block.
- Flow frequency rises as the cloud shrinks, with a floor of about two turns
  across the vessel, so there is structure to see at close framing.
- Damping and trail length are capped. Held material re-crosses its own path
  constantly, and stage values for either settle it into a dead uniform fog.

The pull toward the middle is kept, re-centred on the vessel. Removing it and
letting the walls do all the work looks principled and is wrong: the material
random-walks into featureless haze and the vessel just contains a mist. The walls
clip what reaches them, and gaps survive above and below the body.

Contained particles accumulate into their own faded pair of buffers before being
added to the scene, as the particle workspace does. Most of a saved project's
brightness and all of its filaments live in that history, not in one frame of
points.

The conformed values are ordinary controls afterwards, under **Contained
simulation**. Reopening a project does not re-conform: what was saved is already
authored for its vessel. Placed fields travel with a simulation: positions, reach
and pull scale by the same ratio as the emitter, so a well holds the same part of
the cloud it held on the open stage. They are stored in the shell's own frame and
placed in the scene every frame, so they follow the shell rigidly while the cloud
follows it by force. **Contained fields** scales their pull. The enclosure's
transform drives the confinement live, so moving the vessel carries the contents,
but as a force rather than a rigid attachment: fast moves leave the cloud
sloshing.

Projects store the enclosure's id, not the voxel grid, and rebuild the field from
the mesh on open. Particle counts, positions, and elapsed time are a recipe, not a
resumable GPU snapshot, as everywhere else in ORBIUS.

## Rendering and persistence

Glass uses smooth geometry normals, a measured back-face depth pass, a world-locked analytic studio rig of three data-driven softboxes (key, fill, back — placement, size, kelvin, intensity, drift, flicker) over a floor bounce and grazing sheen, tint absorption, spectral separation, and rough screen-space transmission of the dot layer. A **Studio backdrop** scene control draws the sweep those optics refract; zero returns the stage to black space. Four **optical finish** presets set the nine glass controls as a group. **Surface defects** perturbs the normal by the slope of three noise octaves and modulates optical thickness; **Bubbles & seeds** marches the refracted ray through a jittered cell field so inclusions sit at depth. Both are keyed to a hash of the object id rather than stored. Objects draw into a multisampled accumulator, so shell silhouettes are antialiased; the sample count steps down on large targets and falls back to none where the GPU will not allocate it. Shells composite back to front by camera-space origin depth and share one depth buffer, so a nearer shell occludes a farther one per pixel and refracts everything already behind it — the dot layer, the backdrop, and other shells. Dispersion is smeared across the transmission blur samples rather than taken as three fixed RGB taps, and refracted lookups that leave the screen fade back to looking straight through instead of streaking the border pixel. It is an artistic real-time approximation, not a spectral path tracer: each shell still bends what is behind it with a single screen-space offset rather than tracing a ray through successive dielectric boundaries, and the sort key is the object origin, so deeply interpenetrating shells can still order wrongly as objects even where the depth buffer resolves the pixels. Dot objects are luminous point clouds, with surface, filled-volume, and procedural-strata modes. Strata have reproducible terrain recipes and per-point motion intervals clipped to the original mesh.

Projects embed triangles, sampled points, optional procedural recipes and motion bounds, transforms, and material properties. Disk files therefore remain portable without the source OBJ/STL files; import accepts projects up to 96 MB. Autosave and the sixteen-entry collection use IndexedDB to avoid localStorage's small string quota. Existing local saves remain readable. Collection thumbnails show actual rendered work. Saved particle/chemical scenes are recipes, not exact resumable GPU snapshots.

Glass Objects remains available as a node source. The node composer retains its existing single-chain evaluator; a general multi-input geometry graph is separate future work. The GLSL editor still edits the custom orb-surface contract.

## Verification

The production build and twenty-six tests pass. Coverage includes OBJ triangulation, negative references, malformed inputs, binary STL, deterministic surface sampling, closed-volume filling, open-mesh rejection, embedded-geometry round trips, invalid object transforms, legacy project compatibility, and node-source selection.

Browser checks imported two separate OBJ fixtures, retained the first as glass, converted the second into a filled dot volume, and independently scaled it inside the enclosure. A collected scene reloaded with both meshes and their separate roles. No GPU warnings/errors were reported during these checks. Fixtures are development artifacts under ignored `output/mesh-qa/`, not hard-coded application families. OBJ file-picker automation was slow; that is separate from the import worker's mesh processing.

No runtime dependency was added. The importer does not fetch external OBJ material references or execute file content.

Basic forms are closed triangle meshes generated in `src/objects/primitives.js`. They share the imported-object material, transform, dot sampling, duplication, and save/load paths. The cylinder has softly rounded rims.

Two generators live there. A **lathe** spins a 2D profile around Y — the smooth orb and every cylinder — and a **polyhedron** table is triangulated directly, which is the only way to get a solid whose faces are not all the same kind: a dodecahedron is twelve pentagons and no lathe will produce one. It is built as the dual of the icosahedron rather than from a typed table of golden-ratio vertices, so its winding and face order cannot be quietly wrong. **Geodesic** subdivides each icosahedral face and pushes the result out to the sphere, giving near-equal facets and no poles. Every form is normalised to a circumradius of one, so changing form changes the shape and not the size.

**Cylinder sides** runs 5–64. Below 24 the faces are shaded as faces rather than averaged into each other; averaging is what makes 64 segments read as round, and the same averaging turns a pentagon into a soft blob. The generator decides which it wants and stores the answer on the object as `faceted`.

**Hollow** builds the same surface twice: the outer one, and a shrunken copy wound the other way so its normals point into the cavity. Nothing in the glass shader changes — it already measures optical thickness to the nearest back-facing surface, which for a ray entering a vessel is the far side of the wall, so a hollow form reads as a wall rather than as a solid. What did have to change is every question about the *interior*: filled dots, poured particles and strata fill between alternate surface crossings, which on a hollow form fills the wall and leaves the cavity empty. Those paths ask for the space the vessel encloses instead — first crossing to last — which is what pouring something into a shell has always meant.

These are creation-time settings. The mesh is baked when the object is added, so the panel describes the next form you add, not one already in the scene.
