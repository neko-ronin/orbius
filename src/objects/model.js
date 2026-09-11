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
