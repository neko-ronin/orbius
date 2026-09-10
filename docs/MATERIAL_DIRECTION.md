# Material direction — 2026-09-09

## User verdict: preserve the signal

- Particle playground: fantastic; good MVP state. This iteration does not alter its simulation.
- Prismatic silk: enjoyed. Preserve its existing rendering path.
- Liquid mercury and Solar cartography: **very unimpressive; on the chopping block unless substantially improved**. Retain both. Flag their gallery cards and inspector; do not present them as successful reference materials.
- Glass Objects: previously highly underdeveloped. The target is a composed interior and credible optics, not merely a mesh importer with a transparent material.

## Topography reference

Source: `inspirations/topography.mov`, 45.29 seconds. Inspected a nine-frame contact sheet at approximately 0, 4, 8, 12, 16, 20, 24, 28, and 32 seconds. The clip presents a tall clear cylinder containing horizontal, irregular terrain-like particle sheets. Warm orange/red peaks sit above cool cyan strata; sparse white sparks punctuate the volume. The perspective and close framing expose fine sampling, separated layers, and a bright glass base/rim against black.

Implementation brief for an independent agent:

> Build a material-object studio in which an enclosure and its contents are separate editable objects. Inside a user-selected closed mesh, generate multiple finely sampled terrain sheets. Expose sheet count, sampling resolution, spacing, broad relief, fine ridges, frequency, domain warp, and reproducible seed. Allow independently colored sets of sheets, flowing accents, restrained sparks, and bounded motion. Clip points and their animation to the actual source mesh, including concave imported shapes. Keep build-time geometry operations off the UI thread; material, motion and transform changes should remain immediate. Present the glass through its reflections and transmission: readable studio strips, narrow rim highlights, thickness-dependent bending and absorption, modest chromatic separation and adjustable rough transmission. Judge the composition in motion, in close view, and at presentation resolution. Do not substitute a dense uniform volume or a broad glow for readable sheets. Save editable construction settings and geometry together.

## Rendering research

The relevant techniques are 3D dielectric rendering; CSS frosted-panel glassmorphism alone cannot make the object convincing.

- [Three.js MeshPhysicalMaterial](https://threejs.org/docs/pages/MeshPhysicalMaterial.html): transmission is separate from opacity; thickness and attenuation control light through the volume; IOR and dispersion govern refraction; environment lighting is important to the material's appearance.
- [Drei MeshTransmissionMaterial](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material): rough transmission, chromatic aberration, and scene capture improve real-time glass; quality and resolution have performance costs.

These are references, not added dependencies. No package, remote model, environment image, or code from the video was downloaded or installed. Rendering changes were authored against the existing WebGL2 engine.

## Implemented systems

### Procedural strata

Select a glass object and choose **Design inner layers**. This creates a separate strata object using that mesh and its initial transform. All closed imported meshes use the same path as the orb and cylinder.

Eight terrain controls define a reproducible geometry recipe. **Build layers** applies geometry changes in a worker, while colors, height gradient, brightness, point size, sparkle accents, flow speed, billow amplitude, and transforms update live. Duplicate a strata object to create separately tuned groups with different colors and fields.

The mesh is rasterized into vertical inside/outside intervals. Sheet samples and per-point animation limits are generated from those intervals. Sample positions are jittered inside each grid cell from the recipe seed so sheets read as grains rather than a wireframe; the rasterizer casts its ray at the same jittered position, which is what keeps every point and its motion range inside the shell. Billow animation changes height only, clamped within each interval. Groups inherit the enclosure's transform at creation; later transforms are independent. They are not a parent-child scene graph. Open/non-manifold meshes cannot define a filled interior. Limits are 120,000 points per object and a checked scene-wide geometry budget.

### Glass

The renderer measures back-face depth into a separate color/depth target. Front-face shading uses that depth for optical thickness, Snell-direction screen-space offsets, tint absorption, and RGB dispersion. Transmission blur uses four samples in development and twelve in show mode. IOR, thickness, absorption, roughness, dispersion, and studio brightness are independent controls.

Lighting is one camera-locked studio rig (`envLight`): a graded sky, a large soft key box, a wide cool strip and a narrow warm strip that read as vertical highlights on a curved shell, and a floor bounce. Roughness widens every one of them. A grazing sheen term adds the thin bright edge a shell shows against a dark studio. **Studio backdrop** (scene finish) draws a dark sweep behind the objects so refraction and reflection have a world to show; set it to zero for black-space, dendrite-style compositions. Four **optical finish** presets — Clear, Frosted, Prism, Smoked — set the seven optical controls together, since no single slider produces a finish on its own.

Objects draw into a multisampled accumulator (4x, dropping to 2x above two megapixels, and to none if the GPU refuses the allocation), which is what gives the shell silhouettes clean edges; the fragment shader still runs once per pixel, so only the resolve is added cost.

Multiple shells composite back to front by camera-space origin depth over one shared depth buffer, so ordering follows the camera rather than an object-space axis, nearer shells occlude farther ones per pixel, and each shell refracts the layers already behind it — including other shells. Each shell is drawn against a copy of the scene so far, which is what makes that possible.

Transmission smears the spectrum across the blur samples rather than taking three fixed RGB taps, so strong dispersion reads as a spectral edge instead of colour noise. A refracted lookup that leaves the screen has nothing to read and would repeat the border pixel into a streak; those fade back to looking straight through the shell.

This remains an artistic screen-space approximation. A shell bends what is behind it with a single screen-space offset, not a ray traced through successive dielectric boundaries, so nested glass does not accumulate correct transitions; the object-origin sort key can still mis-order deeply interpenetrating shells. There are no physically traced caustics, multiple internal bounces, or HDR environment-map lighting. Open meshes fall back to a thin optical depth. Concave multiple intervals in the optical pass are approximate. These limitations matter before claiming reference-level glass.

### Shader-family designer

In Orb shaders, **Create a shader family** opens a bounded volume-field composer. The author selects two fields (interwoven sheets, concentric ripples, noise contours, crossing waves), then morphs, layers, intersects, or carves their densities. Independent frequency, offset, influence, ribbon width, color travel, domain folding, motion, scale and radiance make it a parameterized construction system rather than just a list of presets.

The stage previews edits immediately. **Collect family** stores the construction and an actual rendered portrait. **Save** writes the ordinary portable BOAST project. **Export GLSL bundle** exports a texture-free WebGL2 fullscreen vertex/fragment pair, explicit uniform values, configuration and integration contract. The export specializes the family path and excludes the built-in chemistry/silk/mercury branches. It is an integration artifact; use the normal project format to reopen in BOAST.

Scope: volumetric orb materials. It is not an arbitrary shader graph, AI shader generation system, surface BRDF editor, or geometry editor. Noise-heavy combinations can be dense and expensive; the author should preserve negative space. Technical checks are not a substitute for the user's aesthetic acceptance.

## Verification and remaining quality work

- 26 Node tests and production build pass. Tests cover legacy/new project contracts, primitive topology, clipped sheets, reproducibility, motion bounds, rejected geometry budgets, independent object optics, and family/operator validation.
- Browser exercised primitive creation, worker generation, keyboard adjustment of sheet count, rebuilding, collection save/reload (seven sheets and billow retained), and shader family composition/collection reload.
- Browser rendering matrix: four field compositions; exported GLSL compile/render; cylinder and sphere strata; frosted/dispersion variant; RGBA8 optical-target fallback. All produced lit output with zero WebGL errors.
- Visual checks included development view and show view. The new result has legible particle strata and a much stronger glass outline. It is not asserted to match the reference's cinematic optics, internal depth richness, or fine fluid motion.
- Local reproducible render matrix: `output/studio-qa/index.html` (ignored development artifact). Research contact sheet: `/tmp/boast-topography.jpg` (temporary).

Next quality gates: compare glass and interior at matching camera/scale to the clip; test high-concavity imported shells; improve multi-object transmission ordering; offer art-directed lighting environments; expand procedural layer fields only after the current ones prove useful in the user's hands. Keep mercury/cartography flagged until their output earns a different verdict.
