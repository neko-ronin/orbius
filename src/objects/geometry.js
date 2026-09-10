// Pure geometry operations shared by the import worker and contract tests.
export const MAX_TRIANGLES = 50000;
export const MAX_POINTS = 120000;
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function triangulate(face, vertices) {
  if (face.length === 3) return [face];
  if (face.length > 256)
    throw Error(
      "OBJ polygons may contain at most 256 corners. Triangulate larger faces before exporting.",
    );
  let normal = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = vertices[face[i]],
      b = vertices[face[(i + 1) % face.length]];
    normal = normal.map(
      (v, j) =>
        v +
        (a[(j + 1) % 3] - b[(j + 1) % 3]) * (a[(j + 2) % 3] + b[(j + 2) % 3]),
    );
  }
  const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const p = face.map((i) => vertices[i].filter((_, j) => j !== axis));
  const orient = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const sign = Math.sign(
    p.reduce(
      (s, a, i) =>
        s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ),
  );
  const remaining = face.map((_, i) => i),
    result = [];
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i + remaining.length - 1) % remaining.length],
        b = remaining[i],
        c = remaining[(i + 1) % remaining.length];
      if (orient(p[a], p[b], p[c]) * sign <= 1e-12) continue;
      if (
        remaining.some(
          (j) =>
            j !== a &&
            j !== b &&
            j !== c &&
            orient(p[a], p[b], p[j]) * sign >= -1e-12 &&
            orient(p[b], p[c], p[j]) * sign >= -1e-12 &&
            orient(p[c], p[a], p[j]) * sign >= -1e-12,
        )
      )
        continue;
      result.push([face[a], face[b], face[c]]);
      remaining.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped)
      throw Error(
        "A polygon cannot be triangulated. Export a triangulated OBJ mesh.",
      );
  }
  result.push(remaining.map((i) => face[i]));
  return result;
}
export function parseMesh(buffer, name) {
  const triangles = [];
  if (name.toLowerCase().endsWith(".obj")) {
    const vertices = [];
    for (const raw of new TextDecoder().decode(buffer).split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      if (!line) continue;
      const [type, ...parts] = line.split(/\s+/);
      if (type === "v") {
        if (parts.length < 3) throw Error("OBJ vertex is incomplete.");
        const v = parts.slice(0, 3).map(Number);
        if (!v.every(Number.isFinite))
          throw Error("OBJ contains invalid coordinates.");
        vertices.push(v);
        if (vertices.length > 300000)
          throw Error("Mesh has too many vertices.");
      } else if (type === "f") {
        if (parts.length < 3)
          throw Error("OBJ face has fewer than three vertices.");
        const face = parts.map((p) => {
          const n = Number(p.split("/")[0]);
          const i = n < 0 ? vertices.length + n : n - 1;
          if (!Number.isInteger(n) || n === 0 || !vertices[i])
            throw Error("OBJ face references an invalid vertex.");
          return i;
        });
        for (const triangle of triangulate(face, vertices))
          for (const i of triangle) triangles.push(...vertices[i]);
        if (triangles.length / 9 > MAX_TRIANGLES)
          throw Error(
            `Limit: ${MAX_TRIANGLES.toLocaleString()} triangles per mesh. Simplify the mesh before importing.`,
          );
      }
    }
  } else if (name.toLowerCase().endsWith(".stl")) {
    const view = new DataView(buffer);
    const count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (buffer.byteLength === 84 + count * 50) {
      if (count > MAX_TRIANGLES)
        throw Error("STL exceeds the 50,000 triangle limit.");
      for (let i = 0; i < count; i++)
        for (let j = 0; j < 9; j++)
          triangles.push(view.getFloat32(84 + i * 50 + 12 + j * 4, true));
    } else {
      const text = new TextDecoder().decode(buffer);
      for (const match of text.matchAll(
        /\bvertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g,
      )) {
        triangles.push(...match.slice(1).map(Number));
        if (triangles.length / 9 > MAX_TRIANGLES)
          throw Error("STL exceeds the 50,000 triangle limit.");
      }
    }
  } else throw Error("Choose an OBJ or STL mesh.");
  if (
    !triangles.length ||
    triangles.length % 9 ||
    !triangles.every(Number.isFinite)
  )
    throw Error("The file contains no valid triangle mesh.");
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  triangles.forEach((v, i) => {
    const a = i % 3;
    min[a] = Math.min(min[a], v);
    max[a] = Math.max(max[a], v);
  });
  const extent = Math.max(...max.map((v, i) => v - min[i]));
  if (extent < 1e-10) throw Error("Mesh has zero size.");
  return Float32Array.from(
    triangles,
    (v, i) => ((v - (min[i % 3] + max[i % 3]) * 0.5) * 2) / extent,
  );
}
export function meshInfo(triangles) {
  const edges = new Map();
  let area = 0;
  for (let i = 0; i < triangles.length; i += 9) {
    const v = [0, 3, 6].map((k) =>
      Array.from(triangles.slice(i + k, i + k + 3)),
    );
    area += Math.hypot(...cross(sub(v[1], v[0]), sub(v[2], v[0]))) * 0.5;
    const keys = v.map((p) => p.map((x) => Math.round(x * 1e5)).join(","));
    for (let j = 0; j < 3; j++) {
      const a = keys[j],
        b = keys[(j + 1) % 3];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundaryEdges = [...edges.values()].filter((n) => n !== 2).length;
  return {
    triangles: triangles.length / 9,
    closed: boundaryEdges === 0,
    boundaryEdges,
    area,
  };
}
export function surfacePoints(triangles, count = 30000) {
  const cdf = [];
  let total = 0;
  for (let i = 0; i < triangles.length; i += 9) {
    const a = Array.from(triangles.slice(i, i + 3)),
      b = Array.from(triangles.slice(i + 3, i + 6)),
      c = Array.from(triangles.slice(i + 6, i + 9));
    total += Math.hypot(...cross(sub(b, a), sub(c, a))) * 0.5;
    cdf.push(total);
  }
  if (total < 1e-10) throw Error("Mesh has no usable surface area.");
  let seed = 12871;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const points = new Float32Array(Math.min(count, MAX_POINTS) * 3);
  for (let i = 0; i < points.length; i += 3) {
    const target = random() * total;
    let lo = 0,
      hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const t = lo * 9,
      r = Math.sqrt(random()),
      s = random();
    for (let a = 0; a < 3; a++)
      points[i + a] =
        triangles[t + a] * (1 - r) +
        triangles[t + 3 + a] * r * (1 - s) +
        triangles[t + 6 + a] * r * s;
  }
  return points;
}
export function meshColumns(triangles, resolution = 48) {
  if (!meshInfo(triangles).closed)
    throw Error(
      "Filled volume needs a closed, manifold mesh. Use Surface dots for this object, or close the mesh in your modeler.",
    );
  // Rasterize triangle crossings into YZ columns, then fill odd/even intervals along X.
  const columns = Array.from({ length: resolution * resolution }, () => []),
    step = 2 / resolution;
  for (let i = 0; i < triangles.length; i += 9) {
    const a = triangles.slice(i, i + 3),
      b = triangles.slice(i + 3, i + 6),
      c = triangles.slice(i + 6, i + 9);
    const denominator =
      (b[2] - c[2]) * (a[1] - c[1]) + (c[1] - b[1]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-10) continue;
    const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) + 1) / step)),
      y1 = Math.min(
        resolution - 1,
        Math.floor((Math.max(a[1], b[1], c[1]) + 1) / step),
      );
    const z0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) + 1) / step)),
      z1 = Math.min(
        resolution - 1,
        Math.floor((Math.max(a[2], b[2], c[2]) + 1) / step),
      );
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        const py = -1 + (y + 0.5031) * step,
          pz = -1 + (z + 0.5073) * step;
        const u =
          ((b[2] - c[2]) * (py - c[1]) + (c[1] - b[1]) * (pz - c[2])) /
          denominator;
        const v =
          ((c[2] - a[2]) * (py - c[1]) + (a[1] - c[1]) * (pz - c[2])) /
          denominator;
        const w = 1 - u - v;
        if (Math.min(u, v, w) >= -1e-7)
          columns[y * resolution + z].push(u * a[0] + v * b[0] + w * c[0]);
      }
  }
  return columns.map((values) =>
    values
      .sort((a, b) => a - b)
      .filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-5),
  );
}
export function volumePoints(triangles, resolution = 48) {
  const columns = meshColumns(triangles, resolution),
    step = 2 / resolution;
  const points = [];
  for (let y = 0; y < resolution; y++)
    for (let z = 0; z < resolution; z++) {
      const xs = columns[y * resolution + z]
        .sort((a, b) => a - b)
        .filter((x, i, arr) => i === 0 || x - arr[i - 1] > 1e-5);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (
          let x = Math.max(0, Math.ceil((xs[i] + 1) / step - 0.5));
          x < resolution && -1 + (x + 0.5) * step < xs[i + 1];
          x++
        ) {
          points.push(
            -1 + (x + 0.5) * step,
            -1 + (y + 0.5031) * step,
            -1 + (z + 0.5073) * step,
          );
          if (points.length / 3 >= MAX_POINTS) return Float32Array.from(points);
        }
    }
  if (!points.length)
    throw Error(
      "No interior volume could be sampled. Check the mesh for intersecting or reversed shells.",
    );
  return Float32Array.from(points);
}
export function smoothNormals(triangles) {
  const sums = new Map(),
    keys = [];
  for (let i = 0; i < triangles.length; i += 9) {
    const v = [0, 3, 6].map((k) =>
      Array.from(triangles.slice(i + k, i + k + 3)),
    );
    const n = cross(sub(v[1], v[0]), sub(v[2], v[0]));
    for (const p of v) {
      const key = p.map((x) => Math.round(x * 1e5)).join(",");
      keys.push(key);
      const old = sums.get(key) || [0, 0, 0];
      sums.set(
        key,
        old.map((x, j) => x + n[j]),
      );
    }
  }
  const out = new Float32Array(triangles.length);
  keys.forEach((key, i) => {
    const n = sums.get(key),
      length = Math.hypot(...n) || 1;
    out.set(
      n.map((x) => x / length),
      i * 3,
    );
  });
  return out;
}
