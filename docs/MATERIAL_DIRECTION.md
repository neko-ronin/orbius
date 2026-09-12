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

### Stage

The glass sat in a void, and that is most of why it read as unreal: refraction can
only announce itself by deforming recognisable structure, and a smooth screen-space
gradient stays a smooth gradient however hard you bend it. The backdrop is now a
world-space stage — an analytic floor plane with a horizon, evaluated per pixel from
a reconstructed world ray rather than drawn as geometry, so it is infinite, needs no
depth, and costs one fullscreen pass. **Floor height** and **Floor finish** place and
polish it. Shells reflect and refract the room, not just the rig; the floor wrapping
into the underside of a shell is most of what puts an object on a surface.

The rig is world-locked now rather than camera-locked, so highlights sweep across a
shell as the camera orbits instead of riding along with it. **Studio backdrop** dims
only what the camera sees directly — reflections always see the full room, so a
black-space composition still has lit glass.

A contact shadow comes from a 256² coverage mask rendered straight down over the
stage, sampled with a widening disc so the edge is a penumbra rather than a cutout.
It works for any mesh, including imports, because it is just coverage. Its offset is
currently a constant matched to the key light's azimuth; when the rig becomes
data-driven that constant should derive from the key light instead.

### Defects

Being flawless is the loudest tell that a render is a render. **Surface defects**
tilts the shading normal by the slope of three noise octaves at once — the lens-like
waviness of forming, orange peel, and a scratch field — and modulates optical
thickness with a fourth, so a vessel magnifies unevenly as it turns. One octave alone
reads as a pattern rather than as wear.

**Bubbles & seeds** walks the body along the refracted ray and samples a cell field,
one seed per cell, jittered. Because a bubble never spans a cell, the neighbouring
cells never have to be checked — four taps total. The radius draw is cubed, since a
real melt leaves a few big seeds and a great many specks; a flat distribution reads as
evenly sprinkled dots. Marching along the ray rather than the surface is what makes
the seeds sit at depth and slide against the silhouette as the camera moves.

Both fields are keyed to a hash of the object's id, so a given vessel keeps its own
bubbles and scratches across sessions without storing a field of them, and duplicating
an object gives the copy its own flaws.

### The rig

Lighting was three hardcoded lobes, which meant the only honest answer to "move the
key" was to edit a shader. It is data now: three softboxes — key, fill, back — each
with azimuth and elevation on a sphere around the object, a width and a height, a
colour temperature in kelvin, an intensity, and how much it drifts and flickers.

A softbox is a rectangle, not a point, so `envLight` builds a basis on each light's
axis and measures the two tangential offsets separately. One expression then gives a
round octa, a tall strip box, and everything between, with no azimuth to wrap and no
trouble at the poles. Roughness widens the lobe and the energy is given partly back,
because a blurred reflection of a light is wider and dimmer, never wider and
brighter. It is the square root of the ratio rather than the ratio itself: the broad
lookups double as the ambient term, and conserving exactly leaves the room with no
fill at all.

`stage()`'s roughness argument now means *how sharply the caller sees the room*, not
the floor's own finish, which it reads from its own uniform. A polished shell sees
crisp softboxes where a frosted one sees a glow — previously everything saw the room
through the same fixed blur, which is most of why the rig read as painted on. The
contact shadow's offset derives from the key light, so moving the key moves its
shadow. Below about 15° of elevation the offset is clamped rather than swinging to
infinity, so a very low or underslung key leaves its shadow where it is.

Kelvin, drift and flicker resolve on the CPU once per frame — per light, never per
pixel — and the shader receives only a direction, a softbox size and a premultiplied
colour. Drift and flicker are built from three periods with no common multiple, so
the rig wanders without ever settling into a visible loop; zero on both pins a light
exactly, since a still composition has to be able to hold still.

The parameters are flat keys (`keyAzimuth`, `fillKelvin`, …) rather than a nested
array, so persistence, validation, range clamping, and the slider UI all come free
from machinery that already existed.

### The floor reflection

A shell now leaves an image of itself in the floor. The mesh is drawn a second time
with the model mirrored through the floor plane — one extra geometry pass with no
render target, no mirrored camera, and no reflection texture to size. The mirror
reverses the winding, so the pass culls front faces to keep the ones now facing the
camera, and it draws after the floor but before anything standing on it, so the real
object covers its own reflection where they meet.

Only the bright half of a shell survives a reflection — the rig in its surface and
its lit rim — so the pass shades with the light rig and Fresnel alone and traces no
refraction. That is both far cheaper and closer to what a real sweep shows. It fades
exponentially with distance below the floor, the way a reflection loses itself in the
surface, and **Floor finish** scales it, because the polish of the floor is one
physical quantity and does not deserve two sliders. Above 0.85 the pass is skipped
entirely rather than drawn at a strength nobody can see.

A mirrored mesh would paint itself across the sky wherever the floor is not visible,
so a pixel whose world ray does not point downward is discarded. That is the exact
test, not an approximation of one.

Not reflected: the contents of a shell, and dot objects outside one. The shell is
what reads as an object standing on a surface; reflecting a luminous point cloud
would need the trail buffer mirrored too, which is a target's worth of memory for
something the floor mostly swallows.

The environment is procedural by necessity — the project ships no external assets —
so a convincing studio is reachable and a photographic one is not.

Lighting is one studio rig (`envLight`): a graded sky and a floor bounce under three data-driven softboxes, each placed on a sphere with its own size, kelvin, intensity and drift (see **The rig** above). Roughness widens every one of them. A grazing sheen term adds the thin bright edge a shell shows against a dark studio. **Studio backdrop** (scene finish) draws a dark sweep behind the objects so refraction and reflection have a world to show; set it to zero for black-space, dendrite-style compositions. Four **optical finish** presets — Clear, Frosted, Prism, Smoked — set the nine optical controls together, defects and seeds included, since no single slider produces a finish on its own.

Objects draw into a multisampled accumulator (4x, dropping to 2x above two megapixels, and to none if the GPU refuses the allocation), which is what gives the shell silhouettes clean edges; the fragment shader still runs once per pixel, so only the resolve is added cost.

Multiple shells composite back to front by camera-space origin depth over one shared depth buffer, so ordering follows the camera rather than an object-space axis, nearer shells occlude farther ones per pixel, and each shell refracts the layers already behind it — including other shells. Each shell is drawn against a copy of the scene so far, which is what makes that possible.

Transmission smears the spectrum across the blur samples rather than taking three fixed RGB taps, so strong dispersion reads as a spectral edge instead of colour noise. A refracted lookup that leaves the screen has nothing to read and would repeat the border pixel into a streak; those fade back to looking straight through the shell.

This remains an artistic screen-space approximation. A shell bends what is behind it with a single screen-space offset, not a ray traced through successive dielectric boundaries, so nested glass does not accumulate correct transitions; the object-origin sort key can still mis-order deeply interpenetrating shells. There are no physically traced caustics, multiple internal bounces, or HDR environment-map lighting. Open meshes fall back to a thin optical depth. Concave multiple intervals in the optical pass are approximate. These limitations matter before claiming reference-level glass.

### Shader-family designer

In Orb shaders, **Create a shader family** opens a bounded volume-field composer. The author selects two fields (interwoven sheets, concentric ripples, noise contours, crossing waves), then morphs, layers, intersects, or carves their densities. Independent frequency, offset, influence, ribbon width, color travel, domain folding, motion, scale and radiance make it a parameterized construction system rather than just a list of presets.

The stage previews edits immediately. **Collect family** stores the construction and an actual rendered portrait. **Save** writes the ordinary portable BOAST project. **Export GLSL bundle** exports a texture-free WebGL2 fullscreen vertex/fragment pair, explicit uniform values, configuration and integration contract. The export specializes the family path and excludes the built-in chemistry/silk/mercury branches. It is an integration artifact; use the normal project format to reopen in BOAST.

Scope: volumetric orb materials. It is not an arbitrary shader graph, AI shader generation system, surface BRDF editor, or geometry editor. Noise-heavy combinations can be dense and expensive; the author should preserve negative space. Technical checks are not a substitute for the user's aesthetic acceptance.

### Floor texture

A mirror-flat floor reflects a mirror-clean rig, and the analytic stage was exactly
flat. **Floor texture** gives it three things a real sweep has: two scales of slow
undulation, which is what actually breaks a reflection up; drag marks where things
have been moved, which raise local roughness rather than painting a dark smear,
because a scuff is a patch that stopped being polished; and the tooth of the surface
itself. The scuff threshold is deliberately high — wear that covers everything is
not wear, it is a different floor, and the first tuning of this flattened the light
pools instead of interrupting them.

All of it fades out with distance. One cell of a noise field covers many pixels near
the camera and many cells cover one pixel far away, and only the near half of that
is texture rather than aliasing.

Measured rather than assumed: the stage pass goes from 0.59ms to 0.67ms with texture
at full, about 1.7% of the frame.

Known limit: the floor's analytic sheen ripples with the undulation, but the
mirrored mesh of the floor reflection does not — it is geometry, and it reflects
through a flat plane. A shell's reflection stays crisp on a floor whose highlights
have gone soft. Distorting it would mean displacing the mirrored vertices by the
same field, which is a vertex-shader lookup of a fragment-shader function.

### The two families under review

`materialPresets` carried its own verdict on Solar cartography and Liquid mercury:
*very unimpressive, on the chopping block*. Rebuilding them before the authoring
work, rather than after, keeps two disappointing shapes from defining the contract
authored families would have to fit.

**One rig, everywhere.** Three environment functions existed — the real one written
for the glass stage, a hardcoded strip and blob in the material shader, a sine band
in the orb scaffold. The two workspaces that most depend on what they reflect had the
worst of them. `envLight` now lives in `src/lighting.js` and all three share it;
`stage()` stays with glass because it needs the footprint texture. The orb takes its
key light direction from `uLightDir[0]`, so moving a light moves that orb's shading
and its shadow, and the orb workspace gets the Key/Fill/Back sections for free.

`envRoom()` adds the one thing a rig alone cannot: a horizon. A mirror reflecting
only lights and a smooth sky reads as a blob — the horizon is the line the eye needs
to believe a reflection is a reflection.

**Liquid mercury.** The silhouette never moved. `shell()` was `length(p)-1.` for
every family and family 3 only perturbed the normal, which is a painted ball. The
field now carries the displacement for family 3, so the outline deforms and the
normal follows for free; the march steps shorter in proportion, since a displaced SDF
overestimates distance. Shaded as a metal against the rig: no diffuse term, tint in
F0 rather than a wash laid over the reflection.

**Solar cartography.** Three defects, two of them bug classes already hit elsewhere in
this project. The chemistry texture clamped both axes, so the shader's own lookup
stretched the border column into a seam down the sphere — longitude is periodic and
is `REPEAT` now. `atan(p.z, p.x)` is undefined at exactly the poles, guarded the way
`envLight` guards its azimuth. And the Gray–Scott laplacian stepped a uniform texel
distance in both axes, while a texel of longitude covers a shrinking angle toward the
poles — diffusion was anisotropic and dragged cells into streaks, so the longitude
step is stretched by `1/sin(colatitude)`.

Then shaded as a luminous body: limb *darkening* where it used to brighten at the
rim, granulation, and relief taken from the gradient of the chemical map. The first
attempt took that gradient with `dFdx`, which jumps at every silhouette and step
boundary on a raymarched surface and printed blocks of noise across the disc;
sampling the map directly is stable and costs four fetches.

The two things left over from that pass are now done. **Cell size** is not a shader
constant at all: Gray-Scott's structure size is fixed in texels by its rates, so the
map's resolution is what decides how large a cell looks on the sphere. 256x128 drew
a dozen boulders; 1024x512 draws granulation, for a simulation that still costs
under a millisecond. The seed was coarsened to match and the map is walked further
before it is first shown, or the first second is a grid of blocks.

**The corona** could not be written inside `surface()` at all — it lives where the
ray misses the star, and the scaffold returned background there for every family.
So the scaffold grew one optional hook: a family writes `#define HAS_HALO` and its
own `vec3 halo(vec3 ro, vec3 rd)`, and without one the miss path costs a return.
Cartography's halo takes the ray's closest approach to the star, samples the
chemistry along that direction, and grows its reach from the activity it finds —
so a streamer stands over an active region instead of the whole thing being an even
shell of fog. Contained inside a glass shell the same hook draws the corona through
the enclosure's camera, and its exponential falloff is what keeps it from washing
over the rest of the frame.

Both families are out of review.

### Measuring it

Frame rate is a fact about the tab, not about the renderer: a throttled or
backgrounded tab reports single digits for a scene the GPU finishes in two
milliseconds, and every timing taken while building the stage, the defects, the rig
and the floor reflection was worthless for exactly that reason.
`EXT_disjoint_timer_query_webgl2` measures the work instead of the schedule, so a
number read from a throttled tab is still the truth. Each render pass gets its own
query — they are already sequential, so nothing has to nest — and the per-pass
breakdown sits under the frame counter it exists to correct. A disjoint discards
every result in flight rather than reporting a spike that never happened.

First readings, 414x321, one glass orb on the stage: footprint 0.06, stage 0.16,
reflection 0.12, shells 0.75, composite 0.83 — 1.9ms total. Defects and inclusions
at full strength move the shell pass by about 0.03ms, which is inside the noise, so
the flaws are effectively free. The most expensive pass in the frame is the bloom
composite, not any of the glass work.

## Verification and remaining quality work

- 26 Node tests and production build pass. Tests cover legacy/new project contracts, primitive topology, clipped sheets, reproducibility, motion bounds, rejected geometry budgets, independent object optics, and family/operator validation.
- Browser exercised primitive creation, worker generation, keyboard adjustment of sheet count, rebuilding, collection save/reload (seven sheets and billow retained), and shader family composition/collection reload.
- Browser rendering matrix: four field compositions; exported GLSL compile/render; cylinder and sphere strata; frosted/dispersion variant; RGBA8 optical-target fallback. All produced lit output with zero WebGL errors.
- Visual checks included development view and show view. The new result has legible particle strata and a much stronger glass outline. It is not asserted to match the reference's cinematic optics, internal depth richness, or fine fluid motion.
- Local reproducible render matrix: `output/studio-qa/index.html` (ignored development artifact). Research contact sheet: `/tmp/boast-topography.jpg` (temporary).

Next quality gates: compare glass and interior at matching camera/scale to the clip; test high-concavity imported shells; improve multi-object transmission ordering; offer art-directed lighting environments; expand procedural layer fields only after the current ones prove useful in the user's hands.
