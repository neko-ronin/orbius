import { layerGeometry } from "./layers.js";
import { primitiveMesh } from "./primitives.js";
import {
  parseMesh,
  meshInfo,
  surfacePoints,
  volumePoints,
  volumeField,
} from "./geometry.js";
self.onmessage = ({ data }) => {
  try {
    const triangles = data.primitive
      ? primitiveMesh(data.primitive)
      : data.triangles
        ? Float32Array.from(data.triangles)
        : parseMesh(data.buffer, data.name);
    if (data.role === "field") {
      const { field, resolution, interior } = volumeField(triangles);
      self.postMessage({ field, resolution, interior }, [field.buffer]);
      return;
    }
    const info = meshInfo(triangles);
    const layer =
      data.role === "layers"
        ? layerGeometry(triangles, data.layerSettings)
        : null;
    const points = layer
      ? layer.points
      : data.role === "volume"
        ? volumePoints(triangles)
        : surfacePoints(triangles);
    self.postMessage({ triangles, points, info, limits: layer?.limits }, [
      triangles.buffer,
      points.buffer,
      ...(layer ? [layer.limits.buffer] : []),
    ]);
  } catch (e) {
    self.postMessage({ error: e.message });
  }
};
