import { validateLayers, layerDefaults } from "./layers.js";
import { MAX_TRIANGLES, MAX_POINTS } from "./geometry.js";
export const objectOptics = {
  billow: 0,
  thickness: 0.3,
  dispersion: 0.03,
  studioLight: 2.2,
  absorption: 0.25,
  defects: 0.4,
  inclusions: 0.2,
  gradient: 0,
  flow: 0.25,
  sparkles: 0.08,
  colorTop: "#ff6028",
};
// Field notes for the per-object parameters, in the same shape the scene controls
// use: [label, min, max, step, note, search terms]. Object optics live here rather
// than in project.js because several names — roughness, ior, emission — mean one
// thing for a shell and another for the orb workspace's material.
export const objectControls = {
  opacity: [
    "Glass density",
    0,
    1,
    0.01,
    "How much of the tint the body holds. Low values give thin, barely-there glass; high values give a dense, bottled colour that swallows what is behind it.",
    "glass transmission density optics",
  ],
  ior: [
    "Refraction",
    1,
    2.5,
    0.01,
    "Index of refraction — how hard the shell bends what is behind it. Water is 1.33, window glass 1.5, lead crystal around 1.7, diamond 2.4.",
    "index of refraction snell law glass",
  ],
  roughness: [
    "Roughness",
    0,
    1,
    0.01,
    "Softens studio reflections and blurs the transmitted interior. Keep it low for crisp dots and sharp softboxes; raise it for sandblasted, frosted glass.",
    "surface roughness microfacet frosted glass",
  ],
  thickness: [
    "Optical thickness",
    0.01,
    1,
    0.01,
    "Scales the measured front-to-back depth used for refraction and absorption. Try 0.1 for thin blown glass; 0.5 for a heavy optical form.",
    "optical path length beer lambert glass",
  ],
  dispersion: [
    "Spectral dispersion",
    0,
    0.2,
    0.005,
    "Separates red and blue refraction, the way a prism does. Small values give spectral edges where the shell curves; large values exaggerate them deliberately.",
    "chromatic dispersion prism abbe number",
  ],
  absorption: [
    "Tint absorption",
    0,
    3,
    0.05,
    "How strongly the tint filters light passing through. Thick regions absorb more, so a shell darkens toward its silhouette exactly as real coloured glass does.",
    "beer lambert absorption coloured glass",
  ],
  studioLight: [
    "Studio light",
    0,
    5,
    0.05,
    "How brightly this shell takes the rig. Clear glass is nearly invisible without something bright to reflect, so this is usually what rescues a lifeless object.",
    "studio lighting reflection glass photography",
  ],
  defects: [
    "Surface defects",
    0,
    1,
    0.01,
    "Forming waviness, orange peel, a scratch field, and uneven wall thickness. Seeded from the object, so a vessel keeps its own flaws and a duplicate gets its own. Flawlessness is the loudest tell of a render.",
    "glass surface imperfection orange peel scratches",
  ],
  inclusions: [
    "Bubbles & seeds",
    0,
    1,
    0.01,
    "Seeds and bubbles suspended in the body. They sit at depth and slide against the silhouette as the camera moves, the way inclusions in real art glass do.",
    "glass bubbles seeds inclusions annealing",
  ],
  emission: [
    "Dot brightness",
    0,
    5,
    0.05,
    "How much light each dot gives off. These are luminous points, not lit surfaces, so this is the whole of their brightness.",
    "additive emissive point cloud rendering",
  ],
  pointSize: [
    "Dot size",
    0.5,
    6,
    0.1,
    "Radius of each dot in pixels, before distance falloff. Small and many reads as mist; large and few reads as beads.",
    "point sprite size gl_PointSize",
  ],
  dotOpacity: [
    "Dot opacity",
    0,
    1,
    0.01,
    "How strongly the dot cloud accumulates. Because the dots add rather than cover, low values let deep structure show through instead of a solid front face.",
    "additive blending opacity point cloud",
  ],
  gradient: [
    "Height color blend",
    0,
    1,
    0.01,
    "Blends the lower and upper dot colours by height inside the original mesh. Zero keeps one flat colour throughout.",
    "vertical colour gradient volume rendering",
  ],
  flow: [
    "Flow speed",
    0,
    2,
    0.01,
    "Speed of terrain motion, travelling light, and sparkle animation. Zero pauses the flow and gives you a still specimen.",
    "animation flow speed procedural motion",
  ],
  billow: [
    "Terrain billow",
    0,
    0.2,
    0.005,
    "Vertical motion amplitude for strata. Each dot is clamped to its own interior interval, including inside imported closed meshes, so terrain never escapes the shell. Rebuild older layers to enable motion.",
    "vertex displacement animation terrain",
  ],
  sparkles: [
    "Sparkle accents",
    0,
    1,
    0.01,
    "Adds rare bright accents without raising the brightness of every dot. A few points flaring is far more legible than all of them getting brighter.",
    "specular sparkle accent rendering",
  ],
};
export const MAX_OBJECTS = 8;
export function newObject(name, triangles, points, info, role = "glass") {
  return {
    ...objectOptics,
    id: crypto.randomUUID(),
    name: name.replace(/\.[^.]+$/, "").slice(0, 80),
    role,
    visible: true,
    triangles: Array.from(triangles),
    points: Array.from(points),
    info,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: role === "glass" ? "#bce8de" : "#69ffc1",
    opacity: 0.16,
    ior: 1.45,
    roughness: 0.06,
    emission: 1.7,
    pointSize: 2,
  };
}
export function validateObjects(objects) {
  if (objects === undefined) return [];
  if (!Array.isArray(objects) || objects.length > MAX_OBJECTS)
    throw Error("A scene supports up to eight objects.");
  const ids = new Set();
  let total = 0;
  return objects.map((o) => {
    o = { ...objectOptics, ...o };
    if (
      !o ||
      typeof o.id !== "string" ||
      !o.id ||
      o.id.length > 80 ||
      ids.has(o.id) ||
      typeof o.name !== "string" ||
      o.name.length > 80 ||
      !["glass", "surface", "volume", "layers"].includes(o.role) ||
      typeof o.visible !== "boolean"
    )
      throw Error("Invalid scene object.");
    ids.add(o.id);
    for (const [key, max, stride] of [
      ["triangles", MAX_TRIANGLES * 9, 9],
      ["points", MAX_POINTS * 3, 3],
    ]) {
      const a = o[key];
      if (
        !Array.isArray(a) ||
        !a.length ||
        a.length > max ||
        a.length % stride ||
        !a.every((n) => Number.isFinite(n) && Math.abs(n) <= 1.001)
      )
        throw Error(`Invalid object ${key}.`);
      total += a.length;
    }
    if (o.pointLimits !== undefined) {
      if (
        !Array.isArray(o.pointLimits) ||
        o.pointLimits.length !== (o.points.length / 3) * 2 ||
        !o.pointLimits.every((n) => Number.isFinite(n) && Math.abs(n) <= 1.001)
      )
        throw Error("Invalid terrain motion bounds.");
      for (let i = 0; i < o.pointLimits.length; i += 2)
        if (o.pointLimits[i] > o.pointLimits[i + 1])
          throw Error("Invalid terrain interval.");
      total += o.pointLimits.length;
    }
    if (total > 4000000)
      throw Error("Scene geometry exceeds the supported size.");
    for (const key of ["position", "rotation", "scale"])
      if (
        !Array.isArray(o[key]) ||
        o[key].length !== 3 ||
        !o[key].every(
          (n) =>
            Number.isFinite(n) &&
            (key === "scale"
              ? n >= 0.05 && n <= 4
              : Math.abs(n) <= (key === "rotation" ? 360 : 4)),
        )
      )
        throw Error(`Invalid object ${key}.`);
    for (const [key, min, max] of [
      ["billow", 0, 0.2],
      ["thickness", 0.01, 1],
      ["dispersion", 0, 0.2],
      ["studioLight", 0, 5],
      ["absorption", 0, 3],
      ["defects", 0, 1],
      ["inclusions", 0, 1],
      ["gradient", 0, 1],
      ["flow", 0, 2],
      ["sparkles", 0, 1],
      ["opacity", 0, 1],
      ["ior", 1, 2.5],
      ["roughness", 0, 1],
      ["emission", 0, 5],
      ["pointSize", 0.5, 6],
    ])
      if (!Number.isFinite(o[key]) || o[key] < min || o[key] > max)
        throw Error(`Invalid object ${key}.`);
    if (!/^#[0-9a-f]{6}$/i.test(o.color)) throw Error("Invalid object color.");
    if (!/^#[0-9a-f]{6}$/i.test(o.colorTop))
      throw Error("Invalid upper dot color.");
    return {
      ...o,
      ...(o.role === "layers"
        ? { layerSettings: validateLayers(o.layerSettings ?? layerDefaults) }
        : {}),
      info: undefined,
    };
  });
}
