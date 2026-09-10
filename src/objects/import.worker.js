import { layerGeometry } from "./layers.js";
import { primitiveMesh } from "./primitives.js";
import {
  parseMesh,
  meshInfo,
  surfacePoints,
  volumePoints,
} from "./geometry.js";
self.onmessage = ({ data }) => {
  try {
    const triangles = data.primitive
      ? primitiveMesh(data.primitive)
      : data.triangles
        ? Float32Array.from(data.triangles)
        : parseMesh(data.buffer, data.name);
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
