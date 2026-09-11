import { meshColumns } from "./geometry.js";
export const layerDefaults = {
  layers: 8,
  resolution: 80,
  relief: 0.18,
  frequency: 2.4,
  detail: 0.38,
  twist: 0.6,
  spacing: 0.21,
  seed: 7,
};
export const layerControls = {
  layers: [
    "Sheets",
    2,
    24,
    1,
    "Separate terrain sheets. More sheets add depth; leave enough spacing to read each one.",
    "procedural terrain layers stratigraphy",
  ],
  resolution: [
    "Dots per axis",
    24,
    96,
    4,
    "Sampling detail across each sheet. Higher values resolve fine ripples and cost more memory.",
    "heightfield sampling resolution",
  ],
  relief: [
    "Relief",
    0,
    0.6,
    0.01,
    "Height of peaks and valleys. Try 0.2 for rolling terrain, 0.5 for dramatic folds.",
    "terrain relief amplitude heightmap",
  ],
  frequency: [
    "Terrain frequency",
    0.5,
    6,
    0.1,
    "How many hills cross the object. Lower values make broad landscapes.",
    "noise frequency procedural terrain",
  ],
  detail: [
    "Fine ridges",
    0,
    1,
    0.01,
    "Adds smaller ripples to the main terrain. Keep this below 0.5 for clean contours.",
    "fractal brownian motion octaves",
  ],
  twist: [
    "Domain twist",
    0,
    2,
    0.05,
    "Bends the hills into winding currents. Zero gives orderly waves.",
    "domain warping procedural noise",
  ],
  spacing: [
    "Sheet spacing",
    0.025,
    0.25,
    0.005,
    "Vertical separation between sheets. Outer sheets are clipped by your mesh.",
    "stratigraphy layer spacing geology",
  ],
  seed: [
    "Terrain seed",
    0,
    100,
    1,
    "Changes the landscape without changing its character. The same seed always reproduces it.",
    "random seed reproducible procedural generation",
  ],
};
export function validateLayers(value) {
  if (
    value !== undefined &&
    (!value || typeof value !== "object" || Array.isArray(value))
  )
    throw Error("Invalid layer recipe.");
  const result = Object.fromEntries(
    Object.keys(layerDefaults).map((key) => [
      key,
      value?.[key] === undefined ? layerDefaults[key] : value[key],
    ]),
  );
  for (const [key, [, min, max, step]] of Object.entries(layerControls)) {
    const n = result[key];
    if (
      !Number.isFinite(n) ||
      n < min ||
      n > max ||
      (["layers", "resolution", "seed"].includes(key) && !Number.isInteger(n))
    )
      throw Error(`Invalid layer ${key}.`);
  }
  if (result.layers * result.resolution ** 2 > 120000)
    throw Error(
      "Layer budget is 120,000 dots. Reduce sheets or dots per axis.",
    );
  return result;
}
export function layerGeometry(triangles, options) {
  const s = validateLayers(options),
    n = s.resolution,
    step = 2 / n;
  // Reorient the mesh so the existing column rasterizer yields vertical intervals.
  const swapped = Float32Array.from(triangles);
  for (let i = 0; i < swapped.length; i += 3)
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
  const jitter = (a, b) => {
    const v = Math.sin(a * 127.1 + b * 311.7 + s.seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  // Jitter inside each cell so sheets read as fine grains, not a wireframe grid.
  // The rasterizer samples the same offsets, so every point keeps its own interval.
  const offsets = new Float32Array(n * n * 2);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      offsets[(i * n + j) * 2] = 0.16 + jitter(i, j) * 0.68;
      offsets[(i * n + j) * 2 + 1] = 0.16 + jitter(j + 131, i) * 0.68;
    }
  const columns = meshColumns(swapped, n, offsets),
    result = [],
    limits = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -1 + (i + offsets[(i * n + j) * 2]) * step,
        z = -1 + (j + offsets[(i * n + j) * 2 + 1]) * step;
      const a = x * s.frequency * 3 + s.seed * 0.73,
        b = z * s.frequency * 3;
      const w = a + s.twist * Math.sin(b * 0.7);
      const height =
        s.relief *
        (Math.sin(w) * Math.cos(b * 0.8) * 0.65 +
          Math.sin(w * 2.7 + b * 1.3) * s.detail * 0.25 +
          Math.cos(w * 0.4 - b * 1.7) * 0.35);
      const intervals = columns[i * n + j];
      for (let layer = 0; layer < s.layers; layer++) {
        const y = (layer - (s.layers - 1) / 2) * s.spacing + height;
        for (let k = 0; k + 1 < intervals.length; k += 2)
          if (y > intervals[k] + 0.025 && y < intervals[k + 1] - 0.025) {
            result.push(x, y, z);
            limits.push(intervals[k] + 0.015, intervals[k + 1] - 0.015);
            break;
          }
      }
    }
  if (!result.length)
    throw Error("No sheets intersect the mesh. Reduce spacing or relief.");
  return {
    points: Float32Array.from(result),
    limits: Float32Array.from(limits),
  };
}

export function layerPoints(triangles, options) {
  return layerGeometry(triangles, options).points;
}
