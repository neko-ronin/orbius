# BOAST: reference gaps, directions, and interview

8 September 2026. Reviewed against local baseline commit `da509c8`. This is source inspection and reference analysis, not a new live-browser performance benchmark. No application code was changed during this review.

## Finding

The orb quality problem is structural. BOAST has useful controls and a working rendering foundation, but its built-in orb looks largely vary one surface model. The references separate shell, interior, fine structure, and staging; their variety survives removing color. Adding more preset names or increasing the ray count would leave the main gap unresolved.

The particle playground is worth retaining. Its next substantial advance would be stable material identities and visible relationships between populations, rather than simply a larger population or more global noise.

The gallery also needs to become part of the artwork. Its current decorative thumbnails do not show the scene that will load. A rendered collection of authored specimens is a product feature, not cosmetic polish.

## Verified current implementation versus desired behavior

| Area | Evidence in current source | Gap and consequence |
|---|---|---|
| Frontend | React UI in `src/main.jsx`, Vite project tooling, authored CSS in `src/style.css`; custom WebGL2/GLSL engine | The framework need not change to achieve the reference's polish. The work is hierarchy, interaction, presentation, and rendering. |
| Orb structure | `src/project.js:453` defines one default distance field: a sphere with trigonometric displacement; pigment is a two-color animated band | Built-in variety shares one structural vocabulary. Need separate material families and independent shell/interior behavior. |
| Preset switching | `src/main.jsx:263` loads default configuration plus a preset's values, resets fields, and reseeds | A preset selection is not a new shader family. It does not install a distinct material program. |
| Optical depth | Orb shader in `src/shaders.js` includes approximate environment lighting, occlusion/shadow work, and a reflected hit; its refraction path samples pigment at a constructed interior position | There is useful shading scaffolding, but no modeled transmissive shell containing a separately composed dendritic or volumetric scene. A refraction slider alone cannot produce R09. |
| Persistent surface state | Default shader uses position and time, with no chemical feedback state | No local perturbation can propagate through a persistent spherical chemical field as proposed for R04/R05. Reflection/self-shadow and surface chemistry are separate capabilities. |
| Particle relationships | `src/engine.js` initializes position/age/velocity/seed per particle; simulation in `src/shaders.js` applies flow and external forces independently | There is no species ID, neighbor interaction, density solve, or shared fluid field. Cosmetic color variation cannot establish separate materials. |
| Spatial tools | Interactive fields are evaluated through the camera-plane coordinate scheme | Useful screen interaction is not yet a persistent three-dimensional container or material boundary. R03 needs a deliberate spatial model. |
| Gallery | `src/main.jsx:584–603` renders preset cards using `.preset-art` / `.mini-orbit`; `src/style.css` supplies gradient artwork | Cards are illustrations, not scene renders. They cannot represent custom saved shaders faithfully. |
| Persistence | `src/main.jsx` exports/imports project data and maintains a local autosave | This is a foundation for disk projects, not yet a browsable collection of named saved specimens with generated thumbnails. |
| Nodes | `src/project.js:496–522` resolves a single incoming chain; nodes assign global parameter values | No multi-source composition, material layering, inter-species coupling, or explicit feedback. Repeated parameter nodes can replace earlier values rather than compose effects. |
| Show quality | `src/engine.js` selects larger ray budgets for show mode; postprocessing resides in `src/shaders.js` | More samples improve precision but do not add material structure. Pixel-based bloom footprints also deserve resolution-consistency review before claiming matched preview/show aesthetics. |

Source paths above are relative to the repository root. Line numbers refer to the recorded baseline, not a promise that later edits preserve them.

## Recommended scope, awaiting the interview

### First: a material studio with three outstanding specimens

Build glass/dendrites, surface chemistry, and an internally folded pearlescent or filamentary material. Each must be clearly different in grayscale, at thumbnail size, and in motion. Pair them with real rendered gallery previews and a focused inspector. This directly addresses the client's strongest criticism and supplies a quality bar for later work.

Retain React, Vite, the existing particle playground, disk project concepts, keyboard tools, and the GLSL editor. Do not adopt a UI framework or graphics engine solely because a reference uses it. Evaluate renderer changes only against a concrete missing effect and a small prototype.

A family should have a few effective artistic controls—such as branch occupancy, glass clarity, surface activity coverage, or internal folding—followed by deeper technical controls. The existing exhaustive help approach can survive in the advanced view. A single inspector containing every possible parameter for every family would undermine the reference's clarity.

### Next: material relationships in the particle playground

Add a small number of explicitly named species, with colors as reinforcement rather than the sole identifier. Start with a single compelling demonstration and a small directed interaction matrix. Distinguish within-species cohesion from cross-species attraction/repulsion. Make it possible to isolate a species and disable a relationship to understand what it contributes.

A practical prototype can use art-directed coupling or a spatial field. A true incompressible-fluid promise would require a different acceptance bar and solver work. Avoid prematurely implementing density, temperature, phase change, chemical reaction, and collision systems simultaneously.

Use stable steps and bounded forces. Probe energy growth and behavior under low frame rates. Preview/show switching should adjust visual quality, not quietly change the simulated material properties.

### Then: meaningful composition nodes

Extend nodes after the material and interaction concepts are proven. Useful initial operations would combine a shell and contents, attach a field to a selected species, and mix two sources with an explicit rule. A small graph that actually composes is more valuable than a large menu wired to scalar assignments.

## Expansive directions

### Storm in glass — the best bridge between the requests

A clear shell contains three media: a slow cohesive amber body, fast cyan wisps, and sparse white or magenta sparks. An applied pulse travels through them differently. At a boundary, an optional artistic reaction creates short-lived luminous dendrites. The gallery shows the specimen in its quiet state; show mode can perform a controlled escalation.

Why it is promising: silhouette, optics, particle identity, interaction, and cinematic motion all become visible in one scene. Risk: attempting every subsystem at once. First prove the shell plus one interior, then introduce one relationship at a time.

### Living mineral cabinet — the library as exhibition

Saved works occupy a calm gallery of carefully staged specimens. Each has a deliberate camera, representative moment, and optional short hover animation. A black-space glass orb and a warm-studio organic sculpture may have different environments while sharing typography and spacing. Opening a specimen feels like approaching the same object, not navigating to an unrelated settings screen.

Why it is promising: the application becomes impressive before the user edits anything, and their saved collection becomes worth showing. Risk: uncontrolled live preview cost and stale thumbnails. Use cached real renders and a bounded preview renderer.

### Contact chemistry — relationships create the visual signature

Two materials keep their own colors and motion. Only their contact region emits, branches, or converts a small amount into a third material. The important event is the interface, not total screen brightness. Let users change which relationship produces the reaction and see the consequence immediately.

Why it is promising: this makes multi-batch particles fundamentally different from a rainbow swarm. Risk: “contact” needs a defined distance/field test; physical chemistry should not be implied for an artistic rule.

### Coral instrument — an alternate visual world

An asymmetric, fuzzy branching sculpture floats above a warm studio ground. Slow growth, fine fibers, and thin translucent ribbons replace constant bloom. Preset variations alter branching logic and material distribution rather than only hue.

Why it is promising: it broadens the application's identity beyond neon objects on black. Risk: procedural geometry and fiber antialiasing deserve a dedicated slice; avoid committing to full organism modeling.

### A short cinematic score

Let a work move through authored phases: calm, gather, ignite, and settle. A few smoothly blended parameters create a repeatable 10–20 second performance. These visual states could later map to avatar behavior, but they also serve social clips without requiring AI or audio integration.

Why it is promising: a good performance can make a small catalog feel richer. Risk: timeline and video export can become their own product. Begin with state interpolation and a recorded proof before designing a full editor.

## Interview: three questions already presented

No answers were available when this document was written. Recommendations are proposals, not accepted decisions.

1. **What should lead the next milestone?** A polished orb studio and rendered gallery; interacting particle species; or one exceptional orb plus one exceptional interaction scene? Recommendation: orb studio first, or the paired slice if demonstrating the shared material direction matters more than finishing the gallery quickly.
2. **How far should the avatar reference carry?** Visual quality/UI only; previewable idle/thinking/speaking states; or live microphone/AI behavior? Recommendation: visual/UI quality first; state previews are a natural bounded extension.
3. **How physical should the particles be?** Art-directed convincing media; physically plausible fluids; or clearly separate physical and artistic modes? Recommendation: art-directed interactions first, with honest naming and a path to a proper fluid prototype.

## Follow-up interview bank

Ask these in small groups after the first choices. They are design prompts, not a checklist the client must complete before any progress.

### Taste and identity

- Which two recordings would you show someone to communicate BOAST's identity, and which should remain occasional experiments?
- For orbs, do you prefer a stable sphere containing wild activity, a living surface that changes shape, or both as distinct families?
- Should the default emotional register be elegant and mysterious, energetic and spectacular, or intimate and biological?
- Would you accept fewer templates if every one looked like a different material and had a beautifully staged preview?

### Material behavior

- Should batches preserve identity while interacting, or be able to transform one another? For example, could cyan fluid touching amber material generate white branches?
- Is “fluid” primarily about convincing motion, or do you expect pouring, stacking by density, incompressibility, and vessel collisions?
- Should interaction be in a freely navigable 3D space, on the orb's surface, or in a framed 2D/2.5D composition first?
- Is the desired interaction a continuous instrument under the mouse, or a scene seeded once and allowed to evolve?

### Authoring and collection

- Are saved works recipes that replay from a seed, exact frozen moments, or resumable simulations? Which must survive sharing a project file?
- Should templates open as editable copies, and should the personal gallery be the default home or a drawer beside the playground? The original request makes the particle playground the initial mode; changing that default needs an explicit choice.
- In GLSL work, is the priority writing code from scratch, editing a template's material functions, or generating/exporting code from nodes?
- Do you want to design one orb at a time, or compose several objects/materials into a scene? That changes the editor's scope substantially.

### Delivery and constraints

- What machine/browser should establish the performance target, and what is your preferred final format: live demo, still image, or short video?
- Are portrait 9:16 and square output essential? Are seamless loops, transparent backgrounds, or high-resolution offline renders important?
- Is commercial reuse of exported work a requirement? That affects which third-party reference shaders could ever be considered.
- Should saved work stay entirely local, or is sharing a portable file enough for now? There is no need to introduce accounts/cloud storage without a concrete reason.

## Suggested acceptance session

Choose the three target references before coding. Compare each result against its contact sheet and original clip at equal framing. Review stills, at least a short continuous motion segment, a deliberate user intervention, and a save/load replay. Include thumbnail and full-stage views. Record actual hardware and output settings; do not equate successful compilation with visual success.

For the first material milestone, the critical question is whether the three examples look like different things made of different substances. For the particle milestone, it is whether removing one relationship visibly changes how the materials behave. For the gallery, it is whether the preview is both beautiful and truthful.

## Scope and reuse notes

The standalone [agent brief](AGENT_IMPLEMENTATION_BRIEF.md) contains all nine visual descriptions without BOAST implementation assumptions. The [evidence index](README.md) links the timestamped assets and explains review limitations.

The identified avatar reference is [Orbkit](https://github.com/zzzzshawn/orbkit). Its [shader license](https://github.com/zzzzshawn/orbkit/blob/main/LICENSE-SHADERS.md) includes noncommercial restrictions for derived shader content alongside MIT portions. This is a reason to implement the desired material vocabulary independently or review individual permissions, not a reason to discard the UI inspiration. No dependency was installed, downloaded for execution, or newly vetted as safe in this review.
