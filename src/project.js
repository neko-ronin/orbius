import { validateObjects } from "./objects/model.js";
import {
  LEGACY,
  parseControls,
  resolveFamilies,
  validateFamilies,
} from "./materials/families.js";
import { speciesDefaults, speciesControls } from "./particles/catalog.js";
import { materialDefaults, materialControls } from "./materials/catalog.js";
export const palettes = [
  { name: "Ion violet", colors: ["#7050ff", "#bd8aff", "#f5d7ff"] },
  { name: "Solar flare", colors: ["#ff381a", "#ff982e", "#fff1ae"] },
  { name: "Glacial", colors: ["#146dff", "#41dcf4", "#d9fff4"] },
  { name: "Acid dream", colors: ["#4861ff", "#bcff65", "#f1ffc7"] },
  { name: "Rose gold", colors: ["#b51b7c", "#f590ac", "#ffead0"] },
];
// A studio rig as data rather than three hardcoded lobes. Each light is a softbox
// on a sphere around the object: where it stands, how big the box is, what colour
// it burns at, and how much it wanders and breathes. Flat keys (keyAzimuth, ...)
// rather than a nested array, so persistence, validation, range clamping, and the
// slider UI all come for free from the machinery that already exists.
export const lightRoles = [
  [
    "key",
    "Key",
    {
      azimuth: -31,
      elevation: 30,
      width: 0.45,
      height: 0.45,
      kelvin: 5400,
      intensity: 1.9,
      drift: 0.12,
      flicker: 0.06,
    },
  ],
  [
    "fill",
    "Fill",
    {
      azimuth: 66,
      elevation: 2,
      width: 0.13,
      height: 0.75,
      kelvin: 9000,
      intensity: 2.6,
      drift: 0.08,
      flicker: 0.04,
    },
  ],
  [
    "back",
    "Back",
    {
      azimuth: -117,
      elevation: 4,
      width: 0.09,
      height: 0.7,
      kelvin: 3000,
      intensity: 2.1,
      drift: 0.18,
      flicker: 0.22,
    },
  ],
];
const lightProperties = [
  [
    "azimuth",
    "azimuth",
    -180,
    180,
    1,
    "Where the light stands around the object, in degrees. Zero is behind the camera; 180 is directly behind the subject.",
    "studio light placement photography",
  ],
  [
    "elevation",
    "elevation",
    -30,
    85,
    1,
    "How high the light is hung, in degrees. Around 30 is a portrait key; negative puts it below the subject for an uplight.",
    "studio light height photography",
  ],
  [
    "width",
    "width",
    0.04,
    1,
    0.01,
    "Horizontal size of the softbox. Narrow gives the vertical bar highlight a strip box leaves on a curved shell; wide gives a broad soft wrap.",
    "softbox strip box size",
  ],
  [
    "height",
    "height",
    0.04,
    1,
    0.01,
    "Vertical size of the softbox. Width and height together are the difference between an octa, a strip, and a bare bulb.",
    "softbox size aspect",
  ],
  [
    "kelvin",
    "colour",
    1800,
    12000,
    50,
    "Colour temperature in kelvin. 2700 is a warm domestic bulb, 5600 is daylight, 9000 is open shade. Mixing temperatures across the rig is most of what makes studio light read as real.",
    "kelvin colour temperature white balance",
  ],
  [
    "intensity",
    "intensity",
    0,
    6,
    0.05,
    "Brightness of this light. Zero turns it off without losing its placement.",
    "studio light intensity",
  ],
  [
    "drift",
    "drift",
    0,
    1,
    0.01,
    "How far the light wanders from where it was hung. The motion is built from periods that share no common multiple, so it never settles into a visible loop.",
    "light animation drift motion",
  ],
  [
    "flicker",
    "flicker",
    0,
    1,
    0.01,
    "How much the light breathes in brightness. Arrhythmic, like a practical lamp on a soft dimmer rather than a pulse.",
    "light animation flicker pulse",
  ],
];
const capitalise = (s) => s[0].toUpperCase() + s.slice(1);
export const lightKeys = Object.fromEntries(
  lightRoles.map(([id]) => [
    id,
    lightProperties.map(([p]) => id + capitalise(p)),
  ]),
);
const lightDefaults = Object.fromEntries(
  lightRoles.flatMap(([id, , values]) =>
    lightProperties.map(([p]) => [id + capitalise(p), values[p]]),
  ),
);
const lightControls = Object.fromEntries(
  lightRoles.flatMap(([id, label]) =>
    lightProperties.map(([p, name, min, max, step, help, terms]) => [
      id + capitalise(p),
      [`${label} ${name}`, min, max, step, help, terms],
    ]),
  ),
);
// The Planckian locus, as the cheap piecewise fit. Good between 1800K and 12000K,
// which is the whole range a rig is ever hung at.
function kelvinColor(k) {
  const t = k / 100;
  const channels = [
    t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332),
    t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755),
    t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305,
  ];
  return channels.map((c) => Math.min(1, Math.max(0, c / 255)));
}
// Three periods with no common multiple. A single sine reads as a machine; this
// wanders, which is what a room full of practicals and a draught actually does.
const wander = (seed, t) =>
  Math.sin(t * 0.31 + seed) * 0.6 +
  Math.sin(t * 0.73 + seed * 2.1) * 0.3 +
  Math.sin(t * 1.37 + seed * 3.7) * 0.1;
// Resolve the rig to what the shader needs: a world direction and softbox width per
// light, and a premultiplied colour with the height packed alongside it.
export function lightRig(config, time) {
  const direction = new Float32Array(12),
    color = new Float32Array(12);
  lightRoles.forEach(([id], i) => {
    const at = (p) => config[id + capitalise(p)] ?? 0;
    const drift = at("drift");
    const azimuth =
      ((at("azimuth") + drift * 16 * wander(i * 1.7, time)) * Math.PI) / 180;
    const elevation =
      ((at("elevation") + drift * 9 * wander(i * 1.7 + 5, time)) * Math.PI) /
      180;
    const flat = Math.cos(elevation);
    direction.set(
      [
        Math.sin(azimuth) * flat,
        Math.sin(elevation),
        Math.cos(azimuth) * flat,
        Math.max(0.04, at("width")),
      ],
      i * 4,
    );
    const level =
      at("intensity") *
      Math.max(0, 1 + at("flicker") * 0.4 * wander(i * 1.7 + 11, time * 1.9));
    color.set(
      [...kelvinColor(at("kelvin")).map((c) => c * level), at("height")],
      i * 4,
    );
  });
  return { direction, color };
}
export const defaults = {
  ...materialDefaults,
  ...speciesDefaults,
  count: 80000,
  size: 1.7,
  spread: 1.7,
  speed: 0.65,
  life: 12,
  spin: -2,
  turbulence: 0,
  frequency: 1.4,
  drag: 0.35,
  gravity: 0,
  depth: 0.55,
  arms: 3,
  twist: 1.5,
  trail: 0.82,
  bloom: 0.75,
  exposure: 1.1,
  palette: 0,
  hue: 0,
  zoom: 1,
  tilt: 0.65,
  rotation: 0,
  autoRotate: 0.06,
  grain: 0.035,
  vignette: 0.4,
  fieldStrength: 1.5,
  fieldRadius: 1.2,
  lightColor: "#c9a3ff",
  lightIntensity: 1.5,
  orbScale: 1,
  displacement: 0.19,
  detail: 5,
  roughness: 0.18,
  metallic: 0.85,
  ior: 1.35,
  reflection: 0.6,
  shadow: 0.85,
  ambient: 0.13,
  keyLight: 2.5,
  orbMorph: 0.4,
  devScale: 0.7,
  showScale: 1.5,
  backdrop: 0.55,
  containment: 1.2,
  fieldGain: 1,
  stageFloor: -1.15,
  stageRoughness: 0.42,
  stageTexture: 0.55,
  reflections: 1,
  bounce: 0.6,
  // Values for the controls a family declares in its own source, nested by family
  // id so two families may both call something "scale" without colliding.
  params: {},
  ...lightDefaults,
};
// The parameters a saved particle project carries into a glass enclosure. Trail,
// camera, and scene finish stay with the enclosure's own composition.
export const simulationKeys = [
  "count",
  "size",
  "speed",
  "life",
  "spread",
  "spin",
  "turbulence",
  "frequency",
  "drag",
  "gravity",
  "depth",
  "arms",
  "twist",
  "palette",
  "hue",
  "trail",
  ...Object.keys(speciesDefaults),
];
export const controls = {
  ...materialControls,
  ...speciesControls,
  ...lightControls,
  containment: [
    "Containment force",
    0.2,
    4,
    0.05,
    "How hard the enclosure holds the loaded particle simulation inside its walls. Low values let energetic material bulge through thin sections; high values pin it to the surface.",
    "particle boundary collision response",
  ],
  fieldGain: [
    "Contained fields",
    0,
    3,
    0.05,
    "Scales the placed fields a poured simulation brought with it. They are fitted to the vessel on the way in; this is for the rest. Zero turns them off.",
    "particle force field strength",
  ],
  stageFloor: [
    "Floor height",
    -3,
    0,
    0.01,
    "Where the studio floor sits relative to the objects. Just below an object grounds it; drop it away for a floating presentation. The glass reflects and refracts the floor either way.",
    "studio cyclorama floor photography",
  ],
  stageRoughness: [
    "Floor finish",
    0,
    1,
    0.01,
    "Polish of the floor. Low values give a wet, mirror-like sweep that throws the lights back up into the glass; high values give matte seamless paper.",
    "glossy studio floor reflection roughness",
  ],
  stageTexture: [
    "Floor texture",
    0,
    1,
    0.01,
    "How worn the floor is: slow undulation, drag marks where things have been moved, and the tooth of the surface itself. A mirror-flat floor reflects a mirror-clean rig, which is most of what makes a studio render read as a render. Fades out with distance, since fine detail far away is aliasing rather than texture.",
    "seamless paper cyclorama floor texture scuffs",
  ],
  backdrop: [
    "Studio backdrop",
    0,
    1,
    0.01,
    "Brightness of the studio sweep behind the objects. Glass needs something to refract; zero returns to black space for dark, dendrite-style compositions.",
    "studio sweep lighting photography glass",
  ],
  reflections: [
    "Inner reflections",
    0,
    1,
    1,
    "Draws the emissive contents — dot clouds, inner shaders, contained simulations — mirrored in the floor alongside the glass shells. Costs a second, half-step march per inner shader.",
    "planar reflection floor ray marching",
  ],
  bounce: [
    "Colour bounce",
    0,
    2,
    0.05,
    "How much light the emissive contents throw onto the floor and into neighbouring glass. Zero keeps the studio rig as the only light source.",
    "global illumination colour bleed bounce light",
  ],
  count: [
    "Particle count",
    5000,
    160000,
    1000,
    "Living points of light. Try 80,000 for a rich cloud, or 20,000 for airy detail. More points cost GPU time.",
    "GPU transform feedback particles",
  ],
  size: [
    "Point size",
    0.4,
    5,
    0.1,
    "How large each particle appears. Small points feel like dust; larger points create a soft, luminous cloud. Pair small points with higher exposure.",
    "WebGL point sprites",
  ],
  spread: [
    "Emitter radius",
    0.3,
    3,
    0.05,
    "The width of the spiral birthplace. A small radius concentrates energy; a wide radius fills the stage.",
    "particle emitter distributions",
  ],
  speed: [
    "Time scale",
    0,
    2,
    0.05,
    "How fast the world moves. Try 0.3 for floating dust or 1.5 for a storm. Zero holds simulation time.",
    "animation delta time",
  ],
  life: [
    "Lifetime",
    2,
    30,
    0.5,
    "Seconds before a particle returns to its birthplace. Short lives preserve the spiral; long lives let fields pull it apart.",
    "particle lifetime respawn",
  ],
  spin: [
    "Orbit force",
    -2,
    2,
    0.05,
    "Pushes particles around the center. Negative values reverse direction. Combine with a gravity well for an accretion disk.",
    "tangential force orbital particles",
  ],
  turbulence: [
    "Curl strength",
    0,
    2,
    0.01,
    "Stirs smooth eddies into the cloud. Try 0.3 for delicate wisps or 1.2 for tangled ribbons.",
    "curl noise flow fields",
  ],
  frequency: [
    "Flow frequency",
    0.2,
    5,
    0.05,
    "The size of those eddies. Low values make broad rivers; high values make fine, restless ripples.",
    "procedural vector fields frequency",
  ],
  drag: [
    "Velocity damping",
    0,
    2,
    0.05,
    "How quickly movement loses energy. High values tame wild forces; low values leave long sweeping paths.",
    "exponential velocity damping",
  ],
  gravity: [
    "Vertical gravity",
    -2,
    2,
    0.05,
    "Pulls the whole cloud down. Negative gravity lifts it. A little gravity makes the spiral melt into falling light.",
    "particle acceleration gravity",
  ],
  depth: [
    "Cloud depth",
    0.05,
    1.5,
    0.05,
    "Thickness of the particle disk in 3D. Thin disks feel like Saturn rings; thick disks become nebulae.",
    "3D particle distribution",
  ],
  arms: [
    "Spiral arms",
    1,
    8,
    1,
    "Number of ribbons in the initial spiral. Two makes a galaxy; five creates a pinwheel. Reseed to see the change immediately.",
    "logarithmic spiral galaxy",
  ],
  twist: [
    "Spiral winding",
    -4,
    4,
    0.1,
    "How tightly the birth ribbons wrap around the center. Reverse it to change the spiral handedness. Reseed after large changes.",
    "Archimedean spiral polar coordinates",
  ],
  trail: [
    "Afterimage",
    0,
    0.96,
    0.01,
    "How long previous frames linger. Try 0.85 for silk trails or zero for crisp particles. Long trails bloom into smooth light.",
    "framebuffer feedback trails",
  ],
  bloom: [
    "Bloom intensity",
    0,
    2,
    0.05,
    "Light spilling beyond bright edges. Use a little for realism or more for a dreamy glow.",
    "real time bloom post processing",
  ],
  exposure: [
    "Exposure",
    0.2,
    3,
    0.05,
    "Overall brightness before tone mapping. Lower it to reveal layers in a dense cloud.",
    "exposure tone mapping",
  ],
  hue: [
    "Palette shift",
    0,
    1,
    0.01,
    "Moves each particle through the selected color gradient. Animate or adjust for a new color balance.",
    "GLSL color palette interpolation",
  ],
  zoom: [
    "Camera zoom",
    0.5,
    2,
    0.05,
    "Moves the composition closer. Scroll over the stage for the same control. Zoom out before adding far-reaching fields.",
    "perspective camera focal length",
  ],
  tilt: [
    "Camera tilt",
    0,
    1.5,
    0.05,
    "Views the disk from overhead or near its edge. A low angle makes the depth of the trails visible.",
    "3D camera rotation matrix",
  ],
  rotation: [
    "Camera azimuth",
    -3.14,
    3.14,
    0.05,
    "Rotates the composition around the vertical axis. Drag the stage with the Orbit tool to change it.",
    "camera azimuth spherical coordinates",
  ],
  autoRotate: [
    "Auto rotation",
    0,
    0.3,
    0.01,
    "Slow camera movement for a cinematic reveal. Set zero for a fixed composition or seamless still capture.",
    "orbit camera animation",
  ],
  grain: [
    "Film grain",
    0,
    0.15,
    0.005,
    "Adds fine texture to the final image. Keep it subtle for social compression; zero gives a clean digital finish.",
    "shader film grain dithering",
  ],
  vignette: [
    "Vignette",
    0,
    1,
    0.05,
    "Darkens the frame edges to keep attention on the subject. A gentle value works well on a dark stage.",
    "radial vignette shader",
  ],
  fieldStrength: [
    "Field strength",
    0.1,
    6,
    0.1,
    "Power of newly placed forces. Hold Shift while placing for double strength. Strong wells bend whole ribbons.",
    "inverse square force softening",
  ],
  fieldRadius: [
    "Field radius",
    0.2,
    3,
    0.05,
    "Reach of new forces and light sources. Small fields sculpt details; wide fields reshape the entire cloud.",
    "radial force falloff",
  ],
  lightIntensity: [
    "Light intensity",
    0.1,
    5,
    0.1,
    "Brightness of newly placed colored lights. Light colors mix with the particle palette.",
    "point light attenuation",
  ],
  orbScale: [
    "Orb radius",
    0.5,
    1.4,
    0.05,
    "Size of the ray-marched surface. Larger orbs reveal the fine structure; leave room for displacement.",
    "signed distance field sphere",
  ],
  displacement: [
    "Surface displacement",
    0,
    0.45,
    0.01,
    "Depth of ridges and cavities in the closed surface. Deep ridges cast shadows onto neighboring ridges.",
    "SDF displacement sphere tracing",
  ],
  detail: [
    "Surface frequency",
    1,
    12,
    0.1,
    "How many ridges cover the orb. Low values make soft folds; high values produce intricate mineral detail.",
    "domain warping signed distance fields",
  ],
  roughness: [
    "Roughness",
    0.02,
    1,
    0.02,
    "Width of specular highlights. Low values look polished; high values create soft ceramic light.",
    "Blinn Phong specular roughness",
  ],
  metallic: [
    "Metallic",
    0,
    1,
    0.05,
    "Tints highlights with the material color. Low values feel ceramic; high values make colored metal.",
    "metalness material shading",
  ],
  ior: [
    "Refraction index",
    1,
    2.4,
    0.05,
    "Bends the internal ray used to sample the far side of the surface. Higher values distort the internal color more.",
    "GLSL refract index of refraction",
  ],
  reflection: [
    "Reflections",
    0,
    1,
    0.05,
    "Strength of reflected light. Built-in materials reflect the studio environment; the custom surface also traces a secondary ray toward neighboring geometry.",
    "ray marching secondary reflection rays",
  ],
  shadow: [
    "Self shadow",
    0,
    1,
    0.05,
    "Darkness of shadows cast by folds onto the orb itself. More displacement makes these easier to see.",
    "ray marching soft shadows",
  ],
  ambient: [
    "Ambient light",
    0,
    0.5,
    0.01,
    "Soft fill light in the cavities. Lower values make dramatic contrast; higher values reveal dark detail.",
    "ambient occlusion SDF",
  ],
  keyLight: [
    "Key light",
    0.2,
    5,
    0.1,
    "Intensity of the main studio light above the orb. Balance this with exposure and metallic.",
    "three point lighting key light",
  ],
  orbMorph: [
    "Morph speed",
    0,
    1.5,
    0.05,
    "How quickly surface folds evolve. Zero freezes the material shape while the camera can keep rotating.",
    "procedural shader animation",
  ],
  devScale: [
    "Development resolution",
    0.35,
    1,
    0.05,
    "Render pixels relative to the stage size while editing. Lower values make complex ray marching more responsive.",
    "render resolution supersampling",
  ],
  showScale: [
    "Show resolution",
    1,
    2,
    0.25,
    "Render pixels relative to stage size in Show mode, capped at 3840 on the long edge. Higher values sharpen the result and cost frame rate.",
    "supersampling anti aliasing",
  ],
};
// The gallery keeps one particle preset plus the species study in main.jsx.
// Removed presets (Event horizon, Tidal memory, Botanical signal, Velvet
// supernova) were values-only shortcuts over the same sliders — Event horizon
// was literally the defaults — so anything they showed can be dialled back.
export const presets = [
  {
    name: "Solar turbulence",
    tag: "ENERGETIC / 02",
    description: "Molten filaments. Uncontained energy.",
    values: {
      detail: 7.2,
      displacement: 0.25,
      roughness: 0.12,
      reflection: 0.85,
      orbMorph: 0.7,
      palette: 1,
      spin: -2,
      turbulence: 0,
      spread: 1.4,
      tilt: 0.9,
      trail: 0.9,
      twist: 2.7,
      depth: 0.35,
    },
  },
];
export const defaultShader = `// Coordinates are in object space; uTime is seconds.\n// Return a signed distance: negative inside, positive outside.\nfloat shape(vec3 p) {\n  float t = uTime * uMorph;\n  vec3 q = p;\n  q.x += 0.13 * sin(p.y * 3.0 + t);\n  float ridges = sin(q.x * uDetail + t)\n    * sin(q.y * uDetail - t * 0.6)\n    * sin(q.z * uDetail + t * 0.3);\n  return length(p) - uRadius + ridges * uDisplace;\n}\n\n// Define surface color; n is the surface normal.\nvec3 pigment(vec3 p, vec3 n) {\n  float band = sin(p.y * 3.5 + p.x * 2.0 + uTime * 0.15 + uHue * 6.283);\n  return mix(uColorA, uColorB, band * 0.5 + 0.5);\n}`;
export const nodeKinds = {
  particles: { label: "Particle source", category: "SOURCE", color: "#b099ff" },
  glass: { label: "Glass object", category: "SOURCE", color: "#68cfb8" },
  orb: { label: "Orb source", category: "SOURCE", color: "#b099ff" },
  curl: {
    label: "Curl field",
    category: "MOTION",
    color: "#68cfb8",
    param: "turbulence",
  },
  twist: {
    label: "Spiral warp",
    category: "MOTION",
    color: "#68cfb8",
    param: "twist",
  },
  palette: {
    label: "Color grade",
    category: "COLOR",
    color: "#e7b56d",
    param: "hue",
  },
  bloom: {
    label: "Bloom",
    category: "FINISH",
    color: "#e7b56d",
    param: "bloom",
  },
  output: { label: "Stage output", category: "OUTPUT", color: "#e4e6ef" },
};
export const initialGraph = {
  nodes: [
    { id: "source", type: "particles", x: 32, y: 45, value: 1 },
    { id: "flow", type: "curl", x: 260, y: 65, value: 0.7 },
    { id: "glow", type: "bloom", x: 488, y: 45, value: 0.9 },
    { id: "out", type: "output", x: 716, y: 65, value: 1 },
  ],
  edges: [
    ["source", "flow"],
    ["flow", "glow"],
    ["glow", "out"],
  ],
};
export function resolveGraph(graph, config) {
  const result = { ...config };
  const output = graph.nodes.find((n) => n.type === "output");
  if (!output) throw Error("Add a Stage output node.");
  const chain = [];
  const seen = new Set();
  let node = output;
  while (node) {
    if (seen.has(node.id))
      throw Error("Feedback loop detected. Use a forward chain.");
    seen.add(node.id);
    chain.unshift(node);
    const incoming = graph.edges.filter((e) => e[1] === node.id);
    if (incoming.length > 1) throw Error("Each input accepts one connection.");
    node = graph.nodes.find((n) => n.id === incoming[0]?.[0]);
  }
  if (!["particles", "orb", "glass"].includes(chain[0]?.type))
    throw Error("Connect a source to the Stage output.");
  for (const n of chain) {
    const param = nodeKinds[n.type]?.param;
    if (param) result[param] = n.value;
  }
  return {
    config: result,
    mode: chain[0].type,
    active: chain.map((n) => n.id),
  };
}
// A saved project's structure comes from its emitter and its free expansion into
// open space. Walling that in destroys it, so a simulation is not loaded into an
// enclosure — it is interpreted into one. The enclosure supplies the domain: the
// flow is re-sized so eddies fit the vessel, damping is capped so the material
// cannot settle into a dead packed block, and the emitter figures are replaced by
// the measured interior. Character — spin, lifetime, palette, point size,
// population, species coupling — carries over untouched.
export function conformSimulation(config, interior, scale) {
  if (!interior?.extent || interior.extent.length !== 3)
    throw Error("The enclosure was not measured; rebuild it and try again.");
  const clamp = (key, value) =>
    Math.min(controls[key][2], Math.max(controls[key][1], value));
  // World half-extents of the interior, and the length that stands for the vessel.
  const extent = interior.extent.map((e, axis) =>
    Math.max(0.05, e * Math.abs(scale[axis])),
  );
  const size = (extent[0] + extent[1] + extent[2]) / 3;
  const authored = Math.max(0.3, config.spread);
  // The stage length the project was authored at, mapped to the vessel's.
  const k = size / authored;
  const spread = clamp("spread", Math.max(extent[0], extent[2]));
  return {
    ...config,
    // The cloud settles where turbulence balances the pull to the middle, so
    // scaling it by k puts that equilibrium at the vessel's size rather than the
    // stage's — the authored shape, at the vessel's scale.
    turbulence: clamp("turbulence", Math.max(0.15, config.turbulence * k)),
    gravity: clamp("gravity", config.gravity * k),
    // Finer flow as the cloud shrinks, and never so coarse that the vessel holds
    // less than about two turns of it.
    frequency: clamp("frequency", Math.max(config.frequency / k, 1.8 / size)),
    drag: clamp("drag", Math.min(config.drag, 0.45)),
    // Held material re-crosses its own path constantly, so a stage-length trail
    // smears into fog; keep enough history to draw the filaments and no more.
    trail: clamp("trail", Math.min(config.trail, 0.7)),
    // The emitter spans the vessel across and keeps the flatness it was given,
    // so a disc stays a disc instead of swelling to fill the shell.
    spread,
    depth: clamp("depth", (config.depth / authored) * spread),
  };
}
// A poured simulation's fields keep their place in its figure. The emitter was
// re-sized to the vessel, so positions, reach and pull scale with it, and a well
// holds the same part of the cloud it held on the open stage. They are kept in
// the shell's own frame, which is what lets them follow it when it moves.
export function conformFields(fields, config, conformed) {
  const ratio = conformed.spread / Math.max(0.3, config.spread);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  return fields.map((f) => ({
    ...f,
    position: f.position.map((v) => fieldCoordinate(v * ratio)),
    radius: clamp(f.radius * ratio, 0.1, 6),
    strength: clamp(f.strength * ratio, 0, 12),
  }));
}
export const fieldTypes = [
  "attract",
  "repel",
  "vortex",
  "light",
  "burst",
  "freeze",
];
// A particle that strays this far from home is reborn, so a field placed further
// out would act on nothing.
export const FIELD_EXTENT = 7;
// Where a field may stand along one axis, kept to hundredths: finer than a
// particle, and it reads cleanly in the list.
export const fieldCoordinate = (v) =>
  Math.round(Math.max(-FIELD_EXTENT, Math.min(FIELD_EXTENT, v)) * 100) / 100;
// The particle workspace's camera, which the shaders take as uEye and uProjScale.
export const particleView = { eye: 4.5, projScale: 2 };
// The camera the shaders build: yaw about Y, then tilt about X, the eye on +z
// looking back at the origin. Rows of that matrix, world to camera.
function cameraRows({ rotation, tilt }) {
  const c = Math.cos(rotation),
    s = Math.sin(rotation),
    ct = Math.cos(tilt),
    st = Math.sin(tilt);
  return [
    [c, 0, s],
    [st * s, ct, -st * c],
    [-ct * s, st, ct * c],
  ];
}
// Where a world point lands on screen, in -1..1, and its distance from the eye —
// the projection the particle vertex shader makes.
export function viewProject(p, view) {
  const [x, y, z] = cameraRows(view).map(
    (r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2],
  );
  const depth = view.eye - z;
  const k = (view.projScale * view.zoom) / Math.max(1, depth);
  return [(x * k) / view.aspect, y * k, depth];
}
// Camera space back to the scene: a rotation's transpose is its inverse.
function toWorld(view, v) {
  const rows = cameraRows(view);
  return [0, 1, 2].map(
    (i) => rows[0][i] * v[0] + rows[1][i] * v[1] + rows[2][i] * v[2],
  );
}
const unit = (v) => v.map((n) => n / Math.hypot(...v));
// A screen point put into the scene, on the plane facing the camera at camera
// depth z (through the origin unless told otherwise), with an axis running from it
// back to the eye.
export function viewUnproject(sx, sy, view, z = 0) {
  const k = (view.eye - z) / (view.zoom * view.projScale);
  const [x, y] = [sx * view.aspect * k, sy * k];
  return {
    position: toWorld(view, [x, y, z]).map(fieldCoordinate),
    axis: toWorld(view, unit([-x, -y, view.eye - z])),
  };
}
// From a point in the scene towards the eye: the axis of a field that faces the
// camera from where it stands.
export function viewAxis(p, view) {
  const eye = toWorld(view, [0, 0, view.eye]);
  return unit(eye.map((e, i) => e - p[i]));
}
// Fields were screen points before they had depth. The solver pulled toward the ray
// through that point at every depth, which is a column along the line of sight, so
// that is what an old one becomes: anchored where its saved camera looked, and
// fixed in the scene from then on.
// ponytail: an old field moved with the window's shape; LEGACY_ASPECT is one
// stage's, so a field far off centre lands a little aside of where it was drawn.
const LEGACY_ASPECT = 1.6;
function legacyField(f, config) {
  if (f?.position !== undefined || ![f?.x, f?.y].every(Number.isFinite))
    return f;
  const { x, y, ...rest } = f;
  return {
    ...rest,
    ...viewUnproject(x, y, {
      ...particleView,
      rotation: config.rotation,
      tilt: config.tilt,
      zoom: config.zoom,
      aspect: LEGACY_ASPECT,
    }),
    reach: "column",
  };
}
const isVector = (v) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export function validateProject(data) {
  // Families the project carries, resolved alongside the built-ins before anything
  // that names a family is checked against them.
  const families = validateFamilies(data?.families);
  const registry = resolveFamilies(families);
  // "boast-project" is what files saved before the rename to Orbius carry.
  if (
    !["orbius-project", "boast-project"].includes(data?.format) ||
    data.version !== 1
  )
    throw Error("This is not a supported ORBIUS project (version 1).");
  if (!["particles", "orb", "glass", "nodes"].includes(data.mode))
    throw Error("Unknown workspace.");
  const config = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = data.config?.[key];
    if (value === undefined) continue;
    if (key === "params") {
      if (value === null || typeof value !== "object" || Array.isArray(value))
        throw Error("Invalid family parameters.");
      const params = {};
      for (const [id, values] of Object.entries(value)) {
        const family = registry[id];
        // A file may name a family this build does not have. Dropping its values is
        // right: they describe controls nothing can read.
        if (!family || !values || typeof values !== "object") continue;
        const { controls: declared } = parseControls(family.glsl);
        const kept = {};
        for (const [name, v] of Object.entries(values)) {
          const control = declared[name];
          if (!control) continue;
          if (typeof v !== "number" || !Number.isFinite(v))
            throw Error(`Invalid ${id} parameter ${name}.`);
          if (v < control[1] || v > control[2])
            throw Error(`${id} parameter ${name} is outside its range.`);
          kept[name] = v;
        }
        if (Object.keys(kept).length) params[id] = kept;
      }
      config.params = params;
      continue;
    }
    if (key === "family") {
      // Families were integers before they were values. A file written then must
      // still open now, so the old number maps to the id it became.
      // 0 meant the custom GLSL surface; 1-4 were the built-ins. Anything else was
      // never valid and must not quietly become the custom surface.
      const id =
        typeof value === "number" ? (value === 0 ? "" : LEGACY[value]) : value;
      if (id === undefined || (id !== "" && !registry[id]))
        throw Error("Unknown material family.");
      config.family = id;
      continue;
    }
    if (key === "lightColor") {
      if (!/^#[0-9a-f]{6}$/i.test(value)) throw Error("Invalid light color.");
    } else if (typeof value !== "number" || !Number.isFinite(value))
      throw Error(`Invalid ${key}.`);
    if (controls[key] && (value < controls[key][1] || value > controls[key][2]))
      throw Error(`${key} is outside its supported range.`);
    if (
      key === "palette" &&
      (!Number.isInteger(value) || value < 0 || value >= palettes.length)
    )
      throw Error("Unknown palette.");
    if (
      ["container", "interior"].includes(key) &&
      (!Number.isInteger(value) || value < 0 || value > 2)
    )
      throw Error(`Unknown ${key}.`);
    if (
      ["fieldA", "fieldB", "fieldOperation"].includes(key) &&
      !Number.isInteger(value)
    )
      throw Error(`Invalid ${key}.`);
    config[key] = value;
  }
  const particleContainer = data.particleContainer;
  if (
    particleContainer !== undefined &&
    particleContainer !== null &&
    (typeof particleContainer !== "string" || particleContainer.length > 80)
  )
    throw Error("Invalid particle container.");
  if (typeof data.shader !== "string" || data.shader.length > 20000)
    throw Error("Shader must be text under 20,000 characters.");
  if (
    data.shaderDraft !== undefined &&
    (typeof data.shaderDraft !== "string" || data.shaderDraft.length > 20000)
  )
    throw Error("Invalid shader draft.");
  const graph = data.graph;
  if (
    !graph ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    graph.nodes.length > 24 ||
    graph.edges.length > 24
  )
    throw Error("Invalid node graph (maximum 24 nodes).");
  const ids = new Set();
  for (const n of graph.nodes) {
    if (
      typeof n.id !== "string" ||
      n.id.length > 80 ||
      ids.has(n.id) ||
      !Object.hasOwn(nodeKinds, n.type) ||
      ![n.x, n.y, n.value].every(Number.isFinite) ||
      Math.abs(n.x) > 5000 ||
      Math.abs(n.y) > 5000
    )
      throw Error("Invalid node.");
    ids.add(n.id);
    const p = nodeKinds[n.type].param;
    if (p && (n.value < controls[p][1] || n.value > controls[p][2]))
      throw Error("Node value out of range.");
  }
  for (const e of graph.edges)
    if (
      !Array.isArray(e) ||
      e.length !== 2 ||
      !ids.has(e[0]) ||
      !ids.has(e[1]) ||
      e[0] === e[1]
    )
      throw Error("Invalid connection.");
  if (graph.nodes.filter((n) => n.type === "output").length !== 1)
    throw Error("Project needs exactly one output.");
  const visiting = new Set(),
    done = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw Error("Graph contains a cycle.");
    if (done.has(id)) return;
    visiting.add(id);
    for (const e of graph.edges.filter((e) => e[0] === id)) visit(e[1]);
    visiting.delete(id);
    done.add(id);
  };
  for (const n of graph.nodes) visit(n.id);
  for (const n of graph.nodes) {
    if (graph.edges.filter((e) => e[1] === n.id).length > 1)
      throw Error("Multiple input connections.");
    if (
      ["particles", "orb", "glass"].includes(n.type) &&
      graph.edges.some((e) => e[1] === n.id)
    )
      throw Error("Source cannot have input.");
    if (n.type === "output" && graph.edges.some((e) => e[0] === n.id))
      throw Error("Output cannot have outgoing connections.");
  }
  const fields = (Array.isArray(data.fields) ? data.fields : []).map((f) =>
    legacyField(f, config),
  );
  if (fields.length > 12) throw Error("Maximum 12 fields.");
  const fieldIds = new Set();
  for (const f of fields)
    if (
      typeof f.id !== "string" ||
      f.id.length > 80 ||
      fieldIds.has(f.id) ||
      !fieldTypes.includes(f.type) ||
      !isVector(f.position) ||
      f.position.some((v) => Math.abs(v) > FIELD_EXTENT) ||
      !isVector(f.axis) ||
      Math.abs(Math.hypot(...f.axis) - 1) > 1e-3 ||
      !["point", "column"].includes(f.reach) ||
      ![f.strength, f.radius].every(Number.isFinite) ||
      f.strength < 0 ||
      f.strength > 12 ||
      f.radius < 0.1 ||
      f.radius > 6 ||
      !/^#[0-9a-f]{6}$/i.test(f.color)
    )
      throw Error("Invalid field.");
    else fieldIds.add(f.id);
  const objects = (
    data.objects !== undefined ? validateObjects(data.objects) : []
  ).map((o) =>
    // A shell may name a family that this document no longer carries — deleted, or
    // authored somewhere else. Dropping the reference keeps the object; rejecting
    // the file would lose a whole composition over one stale id.
    o.contents && !registry[o.contents.family]
      ? { ...o, contents: undefined }
      : o,
  );
  return {
    format: "orbius-project",
    version: 1,
    name:
      typeof data.name === "string"
        ? data.name.slice(0, 80)
        : "Untitled experiment",
    mode: data.mode,
    config,
    shader: data.shader,
    ...(data.shaderDraft !== undefined
      ? { shaderDraft: data.shaderDraft }
      : {}),
    graph: structuredClone(graph),
    fields: structuredClone(fields),
    // Omitted when empty, so a project that never authored one is unchanged on disk.
    ...(families.length ? { families } : {}),
    ...(data.objects !== undefined ? { objects } : {}),
    // Only kept when it names a glass shell that is actually in the scene.
    ...(objects.some((o) => o.id === particleContainer && o.role === "glass")
      ? { particleContainer }
      : {}),
  };
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
