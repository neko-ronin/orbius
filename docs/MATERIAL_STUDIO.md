# BOAST material and object studio

## User-directed object composition

Glass Objects now starts with an empty composition. The procedural human bust, skeletal scaffold, and Phosphor anatomy preset have been removed. Object geometry comes from basic forms or local mesh files; materials are independent treatments of that geometry. See [the current direction and reference analysis](MATERIAL_DIRECTION.md) for procedural strata, optics, and shader-family authoring.

Add a built-in **Glass orb** or **Glass cylinder**, or import an OBJ or STL mesh, then choose **Glass container**, **Surface dots**, or **Filled volume dots**. Import another mesh or duplicate an existing object. Each object has independent position, rotation, scale, visibility, color, and material controls. Removal can be undone. The scene supports eight objects.

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

## Rendering and persistence

Glass uses smooth geometry normals, a measured back-face depth pass, a camera-locked analytic studio rig (key box, two strips, floor bounce, grazing sheen), tint absorption, spectral separation, and rough screen-space transmission of the dot layer. A **Studio backdrop** scene control draws the sweep those optics refract; zero returns the stage to black space. Four **optical finish** presets set the seven glass controls as a group. Objects draw into a multisampled accumulator, so shell silhouettes are antialiased; the sample count steps down on large targets and falls back to none where the GPU will not allocate it. Shells composite back to front by camera-space origin depth and share one depth buffer, so a nearer shell occludes a farther one per pixel and refracts everything already behind it — the dot layer, the backdrop, and other shells. Dispersion is smeared across the transmission blur samples rather than taken as three fixed RGB taps, and refracted lookups that leave the screen fade back to looking straight through instead of streaking the border pixel. It is an artistic real-time approximation, not a spectral path tracer: each shell still bends what is behind it with a single screen-space offset rather than tracing a ray through successive dielectric boundaries, and the sort key is the object origin, so deeply interpenetrating shells can still order wrongly as objects even where the depth buffer resolves the pixels. Dot objects are luminous point clouds, with surface, filled-volume, and procedural-strata modes. Strata have reproducible terrain recipes and per-point motion intervals clipped to the original mesh.

Projects embed triangles, sampled points, optional procedural recipes and motion bounds, transforms, and material properties. Disk files therefore remain portable without the source OBJ/STL files; import accepts projects up to 96 MB. Autosave and the sixteen-entry collection use IndexedDB to avoid localStorage's small string quota. Existing local saves remain readable. Collection thumbnails show actual rendered work. Saved particle/chemical scenes are recipes, not exact resumable GPU snapshots.

Glass Objects remains available as a node source. The node composer retains its existing single-chain evaluator; a general multi-input geometry graph is separate future work. The GLSL editor still edits the custom orb-surface contract.

## Verification

The production build and twenty-six tests pass. Coverage includes OBJ triangulation, negative references, malformed inputs, binary STL, deterministic surface sampling, closed-volume filling, open-mesh rejection, embedded-geometry round trips, invalid object transforms, legacy project compatibility, and node-source selection.

Browser checks imported two separate OBJ fixtures, retained the first as glass, converted the second into a filled dot volume, and independently scaled it inside the enclosure. A collected scene reloaded with both meshes and their separate roles. No GPU warnings/errors were reported during these checks. Fixtures are development artifacts under ignored `output/mesh-qa/`, not hard-coded application families. OBJ file-picker automation was slow; that is separate from the import worker's mesh processing.

No runtime dependency was added. The importer does not fetch external OBJ material references or execute file content.

Basic forms are closed triangle meshes generated in `src/objects/primitives.js`. They share the imported-object material, transform, dot sampling, duplication, and save/load paths. The cylinder has softly rounded rims.
