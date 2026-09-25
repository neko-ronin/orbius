// Closed meshes use the same materials, sampling, and persistence as imports.
//
// Three generators live here. A lathe spins a 2D profile around Y, which is where
// the smooth orb, every cylinder and every drinking glass come from; a polyhedron
// table is triangulated directly, which is the only way to get a shape whose faces
// are not all the same kind — a dodecahedron is twelve pentagons and no lathe will
// ever produce one; and a geodesic subdivides one.
export const primitiveDefaults = {
  form: "smooth",
  cup: "oldFashioned",
  cut: "plain",
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
// A drinking glass is a lathe job too, but of a closed outline rather than a half
// silhouette: down the outside, across the base, and back up the inside of the
// cavity to the rim. Turned in that order the lathe winds every triangle away from
// the glass — outward outside, into the cavity inside — which is what the shader
// needs to read a wall instead of a solid lump, with nothing in the shader to
// change and no second shrunken copy of the surface.
export const cups = [
  ["oldFashioned", "Old Fashioned"],
  ["wine", "Wine"],
  ["cocktail", "Cocktail"],
  ["martini", "Martini"],
  ["cognac", "Cognac"],
  ["champagne", "Champagne"],
  ["shot", "Shot"],
  ["margarita", "Margarita"],
  ["pocoGrande", "Poco Grande scotch"],
  ["nosing", "Nosing scotch"],
];
// Cuts for the Old Fashioned. A rocks glass is the one shape on the list that is
// pressed or cut rather than blown round, so it is the one that gets a second menu.
export const oldFashionedCuts = [
  ["plain", "Plain"],
  ["dimpled", "Square, dimpled sides"],
  ["crystal", "Ornate crystal facets"],
  ["paneled", "Round, many sides"],
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

function lathe(profile, segments, scale = null) {
  const rings = profile.map(([radius, y]) =>
    Array.from({ length: segments }, (_, i) => {
      const angle = (i / segments) * Math.PI * 2;
      const r = scale ? radius * scale(angle, y) : radius;
      return [r * Math.cos(angle), y, r * Math.sin(angle)];
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

// Forty-eight is a multiple of the twenty-four panels and the twelve and
// twenty-four flutes below, so a panel corner and a groove floor land exactly on a
// ring vertex instead of somewhere between two of them.
const CUP_SEGMENTS = 48;
// How finely the outline is resampled. Fine enough for a dimple to have a shape,
// coarse enough that a glass is about twice an orb rather than ten times it.
const CUP_STEP = 0.07;

// Bowls are arcs of circles, so authoring them as arcs is both shorter and smoother
// than listing the points a lathe needs. Angles in degrees from the radius axis.
const arc = (cx, cy, radius, from, to, steps) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  });
// The stem flaring out into a foot the glass can stand on, the same curve at
// whatever size each glass wants. Ends on the axis, which is where every outline
// below has to finish.
const foot = (radius, stem, top) => [
  [stem, top],
  [stem + radius * 0.1, top * 0.6],
  [radius * 0.38, top * 0.38],
  [radius * 0.68, top * 0.2],
  [radius * 0.92, top * 0.1],
  [radius, top * 0.07],
  [radius, 0],
  [0, 0],
];
// The outside of each glass, rim first and finishing on the axis under the base, in
// millimetres-over-ten so the numbers read as a real glass; `fit` scales them. The
// cavity is not drawn: it is this wall moved in by `wall` and floored at `floor`, so
// each shape is authored once and cannot disagree with itself.
const cupOutlines = {
  // A heavy rocks tumbler: a straight taper, a rounded bottom edge, and a base thick
  // enough to be the reason you hold it.
  oldFashioned: {
    outer: [
      [4.25, 9],
      [3.74, 0.62],
      ...arc(3.14, 0.62, 0.6, 0, -90, 6),
      [0, 0],
    ],
    wall: 0.5,
    floor: 2.3,
  },
  // A burgundy bowl: a sphere cut off above its widest point and drawn in at the rim.
  wine: {
    outer: [
      [3.35, 20.2],
      ...arc(0, 15.4, 4.6, 41, -80, 22),
      [0.46, 9.3],
      ...foot(4.05, 0.46, 2.3),
    ],
    wall: 0.34,
    floor: 11.5,
  },
  // A coupe: a shallow saucer, wider than it is deep.
  cocktail: {
    outer: [
      ...arc(0, 12.6, 5.4, -3, -68, 18),
      [0.45, 6.3],
      ...foot(4.2, 0.45, 1.9),
    ],
    wall: 0.3,
    floor: 8.6,
  },
  // A cone and nothing else, which is the whole point of it.
  martini: {
    outer: [[5.45, 12.7], [0.42, 6.55], ...foot(4.25, 0.42, 1.9)],
    wall: 0.28,
    floor: 7.3,
  },
  // A snifter: a wide belly closing back in at the rim, on a stem short enough that
  // the bowl sits in your palm.
  cognac: {
    outer: [
      ...arc(0, 8.2, 4.7, 50, -78, 22),
      [1.05, 2.9],
      ...foot(4.2, 1.05, 1.5),
    ],
    wall: 0.3,
    floor: 4.6,
  },
  // A flute: tall, narrow, and barely curved, so the bubbles have a long way to go.
  champagne: {
    outer: [
      [2.92, 23.3],
      [3.06, 21.6],
      [3.05, 19.3],
      [2.9, 16.8],
      [2.6, 14.4],
      [2.15, 12.4],
      [1.55, 10.9],
      [0.95, 9.9],
      [0.5, 9.2],
      [0.44, 8.7],
      ...foot(3.9, 0.44, 2.1),
    ],
    wall: 0.26,
    floor: 10.8,
  },
  // The tumbler again, small, and almost all base.
  shot: {
    outer: [[2.32, 6], [1.86, 0.5], ...arc(1.36, 0.5, 0.5, 0, -90, 6), [0, 0]],
    wall: 0.38,
    floor: 1.7,
  },
  // A coupette: a wide flared brim stepping out over a round bulb, which is the
  // ledge that makes a margarita glass a margarita glass.
  margarita: {
    outer: [
      [5.95, 14.6],
      [3.15, 12.1],
      ...arc(0, 10.6, 3.75, 22, -62, 14),
      [0.46, 6.4],
      ...foot(4.45, 0.46, 2),
    ],
    wall: 0.3,
    floor: 8.3,
  },
  // Pinched under the flared rim, bulging again below it. Hand-drawn because it is
  // not made of arcs.
  pocoGrande: {
    outer: [
      [4.95, 17.5],
      [4.35, 16.3],
      [3.78, 15],
      [3.46, 13.6],
      [3.62, 12.2],
      [3.96, 10.8],
      [3.9, 9.4],
      [3.35, 8.2],
      [2.4, 7.2],
      [1.35, 6.4],
      [0.72, 5.9],
      [0.5, 5.4],
      ...foot(4.25, 0.5, 1.5),
    ],
    wall: 0.3,
    floor: 7.7,
  },
  // A nosing copita: a tulip bowl gathering the spirit into a straight neck, on a
  // squat solid base instead of a stem.
  nosing: {
    outer: [
      [1.72, 11.3],
      [1.6, 9.9],
      ...arc(0, 6.4, 3.3, 45, -62, 18),
      [1.5, 2.95],
      [1.55, 2.3],
      [2.05, 1.45],
      [2.45, 0.75],
      [2.62, 0.28],
      [2.6, 0.07],
      [2.42, 0],
      [0, 0],
    ],
    wall: 0.27,
    floor: 4.4,
  },
};

const TAU = Math.PI * 2;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
// A rounded square, scaled so its corners sit on the radius the round glass had
// rather than outside it.
const square = (theta) =>
  (2 * (Math.abs(Math.cos(theta)) ** 4 + Math.abs(Math.sin(theta)) ** 4)) **
  -0.25;
// One narrow lobe of a cosine. A grid of these in angle and height reads as pressed
// dimples; a plain cosine would read as a wave.
const dent = (v) => Math.max(0, Math.cos(v)) ** 4;
// The radius of a regular polygon, one at its corners.
const panel = (theta, n) => {
  const step = TAU / n;
  return Math.cos(Math.PI / n) / Math.cos((theta % step) - step / 2);
};
// A V-groove: nothing at the flute's shoulders, deepest along its centre line.
const flute = (theta, n) => 1 - 2 * Math.abs((((theta * n) / TAU) % 1) - 0.5);
// How much of its radius the glass keeps at this angle and height. Each cut is
// applied to the inside of the wall as well as the outside, so the wall keeps its
// thickness and a deep groove cannot fold the outline through itself. Heights are
// the fitted ones, so the base is at -1 and the rim at 1.
const cutScale = {
  plain: () => 1,
  dimpled: (theta, y) =>
    square(theta) * (1 - 0.11 * dent(4 * theta) * dent(7.85 * (y + 0.32))),
  crystal: (theta, y) =>
    1 -
    0.13 *
      flute(theta, 12) *
      clamp01(Math.min(3.6 * (0.66 - y), 4 * (y + 0.86))) -
    0.05 * flute(theta, 24) * clamp01(Math.min(6 * (0.9 - y), 6 * (y - 0.6))),
  paneled: (theta) => panel(theta, 24),
};

function cupProfile({ outer, wall, floor }) {
  const below = outer.findIndex(([, y]) => y <= floor);
  const [r1, y1] = outer[below - 1],
    [r0, y0] = outer[below];
  const across = r0 + ((r1 - r0) * (floor - y0)) / (y1 - y0);
  const inner = [[across, floor], ...outer.slice(0, below).reverse()].map(
    ([r, y]) => [Math.max(r - wall, 0), y],
  );
  return [...outer, [0, floor], ...inner, outer[0]];
}
// Into the same [-1, 1] box an imported mesh is normalised into, by the longer of
// height and width, so a flute stays narrow and a coupe stays wide.
function fit(profile) {
  const low = Math.min(...profile.map(([, y]) => y)),
    high = Math.max(...profile.map(([, y]) => y));
  const factor =
    2 / Math.max(high - low, 2 * Math.max(...profile.map(([r]) => r)));
  return profile.map(([r, y]) => [r * factor, (y - (low + high) / 2) * factor]);
}
// A lathe only knows the rings it is handed, and both a cut that varies with height
// and a smooth silhouette need more of them than the shape needs corners. Points are
// inserted along the straight line between two of them, so this changes the sampling
// and never the shape, and a zero-length step — where an arc starts on the point
// before it — collapses instead of becoming a ring of degenerate triangles.
function densify(profile, step) {
  const out = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1],
      [r1, y1] = profile[i];
    const count = Math.ceil(Math.hypot(r1 - r0, y1 - y0) / step);
    for (let k = 1; k < count; k++)
      out.push([r0 + ((r1 - r0) * k) / count, y0 + ((y1 - y0) * k) / count]);
    if (count) out.push(profile[i]);
  }
  return out;
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

// Which glass and which cut, with anything the menus never offered replaced by the
// default rather than thrown at the caller: these arrive from a saved file too.
const cupChoice = (options) => {
  const cup = cupOutlines[options.cup] ? options.cup : primitiveDefaults.cup;
  return [
    cup,
    cup === "oldFashioned" && cutScale[options.cut]
      ? options.cut
      : primitiveDefaults.cut,
  ];
};
export function primitiveMesh(kind, options = {}) {
  const { form = "smooth" } = options;
  // A cup is already a wall around a cavity, so `hollow` and `wall` have nothing
  // left to do here — the outline carries both.
  if (kind === "cup") {
    const [cup, cut] = cupChoice(options);
    return new Float32Array(
      lathe(
        densify(fit(cupProfile(cupOutlines[cup])), CUP_STEP),
        CUP_SEGMENTS,
        cutScale[cut],
      ),
    );
  }
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
  // A cut or panelled glass wants its facets read as facets; a dimple wants the
  // averaging that makes it a dent rather than a ring of flats.
  if (kind === "cup")
    return ["crystal", "paneled"].includes(cupChoice(options)[1]);
  if (kind === "cylinder")
    return (
      Math.round(clamp(options.sides, SIDES, primitiveDefaults.sides)) < 24
    );
  return (options.form ?? "smooth") !== "smooth";
}
