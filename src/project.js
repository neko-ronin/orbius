export const palettes = [
  { name: "Ion violet", colors: ["#7050ff", "#bd8aff", "#f5d7ff"] },
  { name: "Solar flare", colors: ["#ff381a", "#ff982e", "#fff1ae"] },
  { name: "Glacial", colors: ["#146dff", "#41dcf4", "#d9fff4"] },
  { name: "Acid dream", colors: ["#4861ff", "#bcff65", "#f1ffc7"] },
  { name: "Rose gold", colors: ["#b51b7c", "#f590ac", "#ffead0"] },
];
export const defaults = {
  count: 80000,
  size: 1.7,
  spread: 1.7,
  speed: 0.65,
  life: 12,
  spin: 0.8,
  turbulence: 0.45,
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
};
export const controls = {
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
    "Self reflection",
    0,
    1,
    0.05,
    "Strength of a second ray cast toward the same surface, with an environment fallback. Deep cavities reflect their neighbors.",
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
export const presets = [
  {
    name: "Event horizon",
    tag: "ORBITAL / 01",
    description: "A slow dance at the edge of infinity.",
    values: {},
  },
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
      spin: 1.4,
      turbulence: 1.1,
      spread: 1.4,
      tilt: 0.9,
      trail: 0.9,
      twist: 2.7,
      depth: 0.35,
    },
  },
  {
    name: "Tidal memory",
    tag: "FLUID / 03",
    description: "Electric currents, suspended in time.",
    values: {
      detail: 3.5,
      displacement: 0.13,
      roughness: 0.09,
      metallic: 0.35,
      ior: 1.7,
      reflection: 0.9,
      palette: 2,
      spin: 0.3,
      turbulence: 0.85,
      frequency: 0.65,
      spread: 2,
      tilt: 0.3,
      trail: 0.93,
      depth: 0.7,
      arms: 2,
    },
  },
  {
    name: "Botanical signal",
    tag: "ORGANIC / 04",
    description: "Something alive in the interference.",
    values: {
      detail: 9,
      displacement: 0.3,
      roughness: 0.5,
      metallic: 0.3,
      orbMorph: 0.2,
      palette: 3,
      spin: -0.45,
      turbulence: 0.3,
      frequency: 2.8,
      twist: -2,
      arms: 5,
      trail: 0.7,
    },
  },
  {
    name: "Velvet supernova",
    tag: "CELESTIAL / 05",
    description: "A thousand soft explosions.",
    values: {
      detail: 4.2,
      displacement: 0.22,
      roughness: 0.35,
      reflection: 0.4,
      orbMorph: 0.3,
      palette: 4,
      spread: 1.2,
      depth: 1.1,
      spin: 0.55,
      turbulence: 0.75,
      arms: 4,
      trail: 0.88,
    },
  },
];
export const defaultShader = `// Coordinates are in object space; uTime is seconds.\n// Return a signed distance: negative inside, positive outside.\nfloat shape(vec3 p) {\n  float t = uTime * uMorph;\n  vec3 q = p;\n  q.x += 0.13 * sin(p.y * 3.0 + t);\n  float ridges = sin(q.x * uDetail + t)\n    * sin(q.y * uDetail - t * 0.6)\n    * sin(q.z * uDetail + t * 0.3);\n  return length(p) - uRadius + ridges * uDisplace;\n}\n\n// Define surface color; n is the surface normal.\nvec3 pigment(vec3 p, vec3 n) {\n  float band = sin(p.y * 3.5 + p.x * 2.0 + uTime * 0.15 + uHue * 6.283);\n  return mix(uColorA, uColorB, band * 0.5 + 0.5);\n}`;
export const nodeKinds = {
  particles: { label: "Particle source", category: "SOURCE", color: "#b099ff" },
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
  if (!["particles", "orb"].includes(chain[0]?.type))
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
export function validateProject(data) {
  if (!data || data.format !== "boast-project" || data.version !== 1)
    throw Error("This is not a supported BOAST project (version 1).");
  if (!["particles", "orb", "nodes"].includes(data.mode))
    throw Error("Unknown workspace.");
  const config = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = data.config?.[key];
    if (value === undefined) continue;
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
    config[key] = value;
  }
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
      ["particles", "orb"].includes(n.type) &&
      graph.edges.some((e) => e[1] === n.id)
    )
      throw Error("Source cannot have input.");
    if (n.type === "output" && graph.edges.some((e) => e[0] === n.id))
      throw Error("Output cannot have outgoing connections.");
  }
  const fields = Array.isArray(data.fields) ? data.fields : [];
  if (fields.length > 12) throw Error("Maximum 12 fields.");
  const fieldIds = new Set();
  for (const f of fields)
    if (
      typeof f.id !== "string" ||
      f.id.length > 80 ||
      fieldIds.has(f.id) ||
      !["attract", "repel", "vortex", "light", "burst", "freeze"].includes(
        f.type,
      ) ||
      ![f.x, f.y, f.strength, f.radius].every(Number.isFinite) ||
      Math.abs(f.x) > 20 ||
      Math.abs(f.y) > 20 ||
      f.strength < 0 ||
      f.strength > 12 ||
      f.radius < 0.1 ||
      f.radius > 6 ||
      !/^#[0-9a-f]{6}$/i.test(f.color)
    )
      throw Error("Invalid field.");
    else fieldIds.add(f.id);
  return {
    format: "boast-project",
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
