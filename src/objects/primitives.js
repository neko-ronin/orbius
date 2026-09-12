// Closed meshes use the same materials, sampling, and persistence as imports.
//
// Two generators live here. A lathe spins a 2D profile around Y, which is where the
// smooth orb and every cylinder come from; a polyhedron table is triangulated
// directly, which is the only way to get a shape whose faces are not all the same
// kind — a dodecahedron is twelve pentagons and no lathe will ever produce one.
export const primitiveDefaults = {
  form: "smooth",
  sides: 64,
  detail: 2,
  hollow: false,
  wall: 0.12,
};
// Tasteful ranges, not the full domain. Under five sides a cylinder is a wedge
// rather than a vessel; over 64 nothing is visible but more triangles. A wall under
// 2% z-fights against itself and over 30% is a solid ball wearing a seam.
export const SIDES = [5, 64];
export const DETAIL = [1, 4];
export const WALL = [0.02, 0.3];
export const orbForms = [
  ["smooth", "Smooth"],
  ["geodesic", "Geodesic"],
  ["icosahedron", "Icosahedron"],
  ["dodecahedron", "Dodecahedron"],
  ["octahedron", "Octahedron"],
  ["cube", "Cube"],
];

const sub = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, n) => a.map((x) => x * n);
// Every solid here is normalised to a circumradius of one, so switching form
// changes the shape and nothing else: a cube is the cube inscribed in that orb.
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));

const PHI = (1 + Math.sqrt(5)) / 2;
// (0, ±1, ±φ) and its cyclic rotations.
const ICOSAHEDRON = {
  vertices: [
    [0, 1, PHI],
    [0, -1, PHI],
    [0, 1, -PHI],
    [0, -1, -PHI],
    [1, PHI, 0],
    [-1, PHI, 0],
    [1, -PHI, 0],
    [-1, -PHI, 0],
    [PHI, 0, 1],
    [-PHI, 0, 1],
    [PHI, 0, -1],
    [-PHI, 0, -1],
  ].map(unit),
  faces: [
    [0, 1, 8],
    [0, 8, 4],
    [0, 4, 5],
    [0, 5, 9],
    [0, 9, 1],
    [3, 2, 11],
    [3, 11, 7],
    [3, 7, 6],
    [3, 6, 10],
    [3, 10, 2],
    [1, 9, 7],
    [1, 7, 6],
    [1, 6, 8],
    [8, 6, 10],
    [8, 10, 4],
    [4, 10, 2],
    [4, 2, 5],
    [5, 2, 11],
    [5, 11, 9],
    [9, 11, 7],
  ],
};
const CUBE = {
  vertices: [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ].map(unit),
  faces: [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [1, 2, 6, 5],
    [0, 4, 7, 3],
  ],
};
const OCTAHEDRON = {
  vertices: [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ],
  faces: [
    [0, 2, 4],
    [2, 1, 4],
    [1, 3, 4],
    [3, 0, 4],
    [2, 0, 5],
    [1, 2, 5],
    [3, 1, 5],
    [0, 3, 5],
  ],
};

// The dodecahedron is the icosahedron's dual: one pentagon per icosahedral vertex,
// its corners the centres of the faces meeting there. Building it this way rather
// than typing twenty golden-ratio vertices and twelve hand-ordered faces means the
// winding and the face order cannot be quietly wrong.
function dual({ vertices, faces }) {
  const centres = faces.map((f) =>
    unit(
      f.reduce(
        (a, i) => a.map((n, k) => n + vertices[i][k] / f.length),
        [0, 0, 0],
      ),
    ),
  );
  const out = [];
  vertices.forEach((v, i) => {
    const around = faces
      .map((f, k) => (f.includes(i) ? k : -1))
      .filter((k) => k >= 0);
    if (around.length < 3) return;
    // Order them around the vertex: a basis in the plane it faces, then by angle.
    const first = sub(centres[around[0]], scale(v, dot(centres[around[0]], v)));
    const x = unit(first),
      y = cross(v, x);
    const ordered = around
      .map((k) => {
        const d = sub(centres[k], scale(v, dot(centres[k], v)));
        return [k, Math.atan2(dot(d, y), dot(d, x))];
      })
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    out.push({ centre: v, corners: ordered.map((k) => centres[k]) });
  });
  return out;
}

// A face is triangulated as a fan from its own centre rather than from one corner,
// so every triangle of a pentagon is the same size and the flat normal is exact.
function fan(corners, outward, triangles) {
  const centre = corners.reduce(
    (a, c) => a.map((n, k) => n + c[k] / corners.length),
    [0, 0, 0],
  );
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    // Wind so the triangle faces away from the middle of the solid.
    if (dot(cross(sub(a, centre), sub(b, centre)), outward) >= 0)
      triangles.push(...centre, ...a, ...b);
    else triangles.push(...centre, ...b, ...a);
  }
}

function polyhedron(kind) {
  const triangles = [];
  if (kind === "dodecahedron") {
    for (const { centre, corners } of dual(ICOSAHEDRON))
      fan(corners, centre, triangles);
    return triangles;
  }
  const solid =
    kind === "cube" ? CUBE : kind === "octahedron" ? OCTAHEDRON : ICOSAHEDRON;
  for (const face of solid.faces) {
    const corners = face.map((i) => solid.vertices[i]);
    fan(
      corners,
      corners.reduce((a, c) => a.map((n, k) => n + c[k]), [0, 0, 0]),
      triangles,
    );
  }
  return triangles;
}

// Each icosahedral face split into detail^2 triangles, pushed out to the sphere.
// Every vertex lands on the unit sphere, so the result is a ball of near-equal
// facets with no poles — which is the thing a lathe cannot give you.
function geodesic(detail) {
  const triangles = [];
  for (const face of ICOSAHEDRON.faces) {
    const [a, b, c] = face.map((i) => ICOSAHEDRON.vertices[i]);
    const at = (i, j) =>
      unit(
        a.map(
          (n, k) => n + ((b[k] - n) * i) / detail + ((c[k] - n) * j) / detail,
        ),
      );
    // The two triangles of a subdivided cell wind opposite ways, and the parent
    // face's own orientation flips them again, so each is turned outward on its own
    // rather than reasoned about: every vertex is on the sphere, so "outward" is
    // just the direction the triangle already sits in.
    const push = (p, q, r) => {
      const n = cross(sub(q, p), sub(r, p));
      if (dot(n, p) >= 0) triangles.push(...p, ...q, ...r);
      else triangles.push(...p, ...r, ...q);
    };
    for (let i = 0; i < detail; i++)
      for (let j = 0; j < detail - i; j++) {
        push(at(i, j), at(i + 1, j), at(i, j + 1));
        if (j < detail - i - 1)
          push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
      }
  }
  return triangles;
}

function latheProfile(kind) {
  if (kind === "orb")
    return Array.from({ length: 33 }, (_, i) => {
      const angle = (i / 32) * Math.PI;
      return [i === 0 || i === 32 ? 0 : Math.sin(angle), Math.cos(angle)];
    });
  // Small rounded rims catch the studio lights without a razor-sharp edge.
  const profile = [
    [0, 1],
    [0.74, 1],
  ];
  for (let i = 1; i <= 6; i++) {
    const angle = ((i / 6) * Math.PI) / 2;
    profile.push([
      0.74 + 0.06 * Math.sin(angle),
      0.94 + 0.06 * Math.cos(angle),
    ]);
  }
  profile.push([0.8, -0.94]);
  for (let i = 1; i <= 6; i++) {
    const angle = ((i / 6) * Math.PI) / 2;
    profile.push([
      0.74 + 0.06 * Math.cos(angle),
      -0.94 - 0.06 * Math.sin(angle),
    ]);
  }
  profile.push([0, -1]);
  return profile;
}

function lathe(profile, segments) {
  const rings = profile.map(([radius, y]) =>
    Array.from({ length: segments }, (_, i) => {
      const angle = (i / segments) * Math.PI * 2;
      return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
    }),
  );
  const triangles = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = rings[j][i],
        b = rings[j][next];
      const c = rings[j + 1][i],
        d = rings[j + 1][next];
      if (profile[j][0] > 0) triangles.push(...a, ...b, ...c);
      if (profile[j + 1][0] > 0) triangles.push(...b, ...d, ...c);
    }
  }
  return triangles;
}

// A hollow solid is the same surface twice: the outer one, and a shrunken copy
// wound the other way so its normals point into the cavity. The glass shader
// measures optical thickness to the nearest back-facing surface, which for a ray
// entering a vessel like this is the far side of the wall — so a hollow shell reads
// as a wall rather than as a solid ball, with nothing in the shader to change.
function shell(triangles, wall) {
  const factor = 1 - wall;
  const out = new Float32Array(triangles.length * 2);
  out.set(triangles);
  for (let i = 0; i < triangles.length; i += 9)
    for (let k = 0; k < 3; k++) {
      out[triangles.length + i + k] = triangles[i + k] * factor;
      out[triangles.length + i + 3 + k] = triangles[i + 6 + k] * factor;
      out[triangles.length + i + 6 + k] = triangles[i + 3 + k] * factor;
    }
  return out;
}

const clamp = (n, [low, high], fallback) =>
  Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;

export function primitiveMesh(kind, options = {}) {
  const { form = "smooth" } = options;
  const sides = Math.round(
    clamp(options.sides, SIDES, primitiveDefaults.sides),
  );
  const detail = Math.round(
    clamp(options.detail, DETAIL, primitiveDefaults.detail),
  );
  let triangles;
  if (kind === "cylinder") triangles = lathe(latheProfile(kind), sides);
  else if (kind !== "orb") throw new Error("Unknown basic form.");
  else if (form === "smooth") triangles = lathe(latheProfile(kind), 64);
  else if (form === "geodesic") triangles = geodesic(detail);
  else if (orbForms.some(([id]) => id === form)) triangles = polyhedron(form);
  else throw new Error("Unknown basic form.");
  return options.hollow
    ? shell(triangles, clamp(options.wall, WALL, primitiveDefaults.wall))
    : new Float32Array(triangles);
}

// Whether this form wants its facets shaded as facets. Averaging normals across a
// 72-degree corner is what turns a pentagon into a soft blob, and it is the same
// averaging that makes 64 sides look round — so the generator decides, once, and
// the answer is stored with the object.
export function isFaceted(kind, options = {}) {
  if (kind === "cylinder")
    return (
      Math.round(clamp(options.sides, SIDES, primitiveDefaults.sides)) < 24
    );
  return (options.form ?? "smooth") !== "smooth";
}
