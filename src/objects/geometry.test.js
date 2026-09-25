import {
  layerGeometry,
  layerPoints,
  layerDefaults,
  validateLayers,
} from "./layers.js";
import { primitiveMesh, isFaceted, orbForms, WALL } from "./primitives.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMesh,
  meshInfo,
  surfacePoints,
  volumePoints,
  smoothNormals,
} from "./geometry.js";
import { newObject, validateObjects, objectOptics } from "./model.js";
import {
  validateProject,
  defaults,
  defaultShader,
  initialGraph,
} from "../project.js";
const cube = `v -1 -1 -1
v 1 -1 -1
v 1 1 -1
v -1 1 -1
v -1 -1 1
v 1 -1 1
v 1 1 1
v -1 1 1
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 4 8 7 3
f 1 5 8 4
f 2 3 7 6`;
const obj = (text) =>
  parseMesh(new TextEncoder().encode(text).buffer, "mesh.obj");
test("OBJ quad mesh triangulates, normalizes, and remains closed", () => {
  const mesh = obj(cube);
  assert.equal(mesh.length / 9, 12);
  assert.equal(meshInfo(mesh).closed, true);
  assert.ok([...mesh].every((n) => Math.abs(n) <= 1));
});
test("negative OBJ references and concave polygons preserve area", () => {
  const mesh = obj(
    "v 0 0 0\nv 2 0 0\nv 2 2 0\nv 1 1 0\nv 0 2 0\nf -5 -4 -3 -2 -1",
  );
  assert.equal(mesh.length / 9, 3);
  assert.equal(meshInfo(mesh).area, 3);
  assert.equal(meshInfo(mesh).closed, false);
});
test("OBJ rejects malformed and invalid faces without following external material paths", () => {
  assert.throws(() => obj("v 0 0 0\nf 1 2 3"));
  assert.throws(() => obj("v NaN 0 0\nf 1 1 1"));
  assert.equal(
    obj(`mtllib https://example.invalid/material\n${cube}`).length,
    108,
  );
});
test("binary STL parses even when header begins with solid", () => {
  const b = new ArrayBuffer(134),
    v = new DataView(b);
  new Uint8Array(b).set(new TextEncoder().encode("solid binary mesh"));
  v.setUint32(80, 1, true);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((x, i) =>
    v.setFloat32(96 + i * 4, x, true),
  );
  assert.equal(parseMesh(b, "test.stl").length, 9);
});
test("area-weighted surface dots lie on cube boundary and are repeatable", () => {
  const mesh = obj(cube),
    a = surfacePoints(mesh, 2000),
    b = surfacePoints(mesh, 2000);
  assert.deepEqual(a, b);
  for (let i = 0; i < a.length; i += 3)
    assert.ok(
      Math.abs(Math.max(...a.slice(i, i + 3).map(Math.abs)) - 1) < 1e-6,
    );
});
test("filled volume dots occupy the whole closed cube and reject open meshes", () => {
  const mesh = obj(cube),
    points = volumePoints(mesh, 12);
  assert.equal(points.length / 3, 12 ** 3);
  assert.ok([...points].every((n) => Math.abs(n) < 1));
  assert.ok(points.some((n) => Math.abs(n) < 0.1));
  assert.throws(() => volumePoints(mesh.slice(9)), /closed/);
});
test("embedded geometry and independent object treatments survive portable project round trip", () => {
  const mesh = obj(cube),
    points = surfacePoints(mesh, 50),
    a = newObject("shell.obj", mesh, points, meshInfo(mesh)),
    b = {
      ...newObject("inner.obj", mesh, points, meshInfo(mesh), "surface"),
      scale: [0.6, 0.7, 0.8],
      position: [0, 0.1, 0],
    };
  const project = {
    format: "orbius-project",
    version: 1,
    name: "Imported composition",
    mode: "glass",
    config: { ...defaults },
    shader: defaultShader,
    graph: structuredClone(initialGraph),
    fields: [],
    objects: [a, b],
  };
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(restored.objects[0].triangles, a.triangles);
  assert.equal(restored.objects[0].role, "glass");
  assert.equal(restored.objects[1].role, "surface");
  assert.deepEqual(restored.objects[1].scale, [0.6, 0.7, 0.8]);
});
test("imported project rejects oversized, nonfinite or malformed object state", () => {
  const mesh = obj(cube),
    make = () =>
      newObject("mesh", mesh, surfacePoints(mesh, 5), meshInfo(mesh));
  for (const mutate of [
    (o) => (o.scale[0] = 0),
    (o) => (o.position[1] = Infinity),
    (o) => (o.role = "script"),
    (o) => (o.triangles[0] = NaN),
    (o) => (o.points = []),
    (o) => (o.color = "url(x)"),
    (o) => (o.opacity = 2),
  ]) {
    const o = make();
    mutate(o);
    assert.throws(() => validateObjects([o]));
  }
  const o = make();
  assert.throws(() => validateObjects([o, o]));
});

for (const kind of ["orb", "cylinder"]) {
  test(`${kind} primitive is closed, outward-facing, and supports filled dots`, () => {
    const mesh = primitiveMesh(kind);
    assert.equal(meshInfo(mesh).closed, true);
    assert.ok([...mesh].every((v) => Number.isFinite(v) && Math.abs(v) <= 1));
    for (let i = 0; i < mesh.length; i += 9) {
      const a = mesh.slice(i, i + 3),
        b = mesh.slice(i + 3, i + 6),
        c = mesh.slice(i + 6, i + 9);
      const u = b.map((v, k) => v - a[k]),
        v = c.map((n, k) => n - a[k]);
      const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      assert.ok(normal.reduce((sum, n, k) => sum + n * a[k], 0) > 0);
    }
    const points = volumePoints(mesh, 16);
    assert.ok(points.length > 1000);
    for (let i = 0; i < points.length; i += 3) {
      const [x, y, z] = points.slice(i, i + 3);
      assert.ok(
        kind === "orb"
          ? x * x + y * y + z * z <= 1.001
          : x * x + z * z <= 0.641 && Math.abs(y) <= 1,
      );
    }
    const object = newObject(kind, mesh, points, meshInfo(mesh), "volume");
    assert.equal(
      validateObjects(JSON.parse(JSON.stringify([object])))[0].name,
      kind,
    );
  });
}

test("terrain sheets stay inside a closed shell, reproduce seeds, and retain editable recipes", () => {
  const mesh = primitiveMesh("orb"),
    settings = { ...layerDefaults, resolution: 32 };
  const points = layerPoints(mesh, settings);
  assert.deepEqual(points, layerPoints(mesh, settings));
  assert.notDeepEqual(points, layerPoints(mesh, { ...settings, seed: 8 }));
  assert.ok(points.length > 1000);
  for (let i = 0; i < points.length; i += 3)
    assert.ok(
      points[i] ** 2 + points[i + 1] ** 2 + points[i + 2] ** 2 <= 1.001,
    );
  const object = {
    ...newObject("Terrain", mesh, points, {}, "layers"),
    layerSettings: settings,
  };
  assert.deepEqual(
    validateObjects(JSON.parse(JSON.stringify([object])))[0].layerSettings,
    settings,
  );
  assert.throws(() => layerPoints(mesh.slice(9), settings));
  for (const value of [
    { layers: 24, resolution: 96 },
    { resolution: 30.5 },
    { relief: NaN },
    { spacing: 0 },
  ])
    assert.throws(() => validateLayers(value));
});
test("legacy objects acquire optics defaults and reject malformed new material parameters", () => {
  const object = newObject(
    "Shell",
    obj(cube),
    surfacePoints(obj(cube), 10),
    {},
  );
  delete object.thickness;
  delete object.defects;
  assert.equal(validateObjects([object])[0].thickness, objectOptics.thickness);
  assert.equal(validateObjects([object])[0].defects, objectOptics.defects);
  for (const value of [
    { dispersion: 5 },
    { colorTop: "bad" },
    { studioLight: NaN },
    { thickness: -1 },
    { defects: 2 },
    { inclusions: -0.1 },
  ])
    assert.throws(() => validateObjects([{ ...object, ...value }]));
});

test("terrain motion intervals retain both endpoints inside the mesh and persist", () => {
  const mesh = primitiveMesh("orb");
  const { points, limits } = layerGeometry(mesh, {
    ...layerDefaults,
    resolution: 32,
  });
  assert.equal(limits.length, (points.length / 3) * 2);
  for (let i = 0; i < points.length / 3; i++)
    for (const y of [limits[i * 2], limits[i * 2 + 1]])
      assert.ok(points[i * 3] ** 2 + y * y + points[i * 3 + 2] ** 2 <= 1.001);
  const object = {
    ...newObject("Moving strata", mesh, points, {}, "layers"),
    pointLimits: Array.from(limits),
    billow: 0.1,
    layerSettings: layerDefaults,
  };
  assert.equal(
    validateObjects(JSON.parse(JSON.stringify([object])))[0].billow,
    0.1,
  );
  assert.throws(() => validateObjects([{ ...object, pointLimits: [1, 0] }]));
});

// Every form has to be a closed, outward-facing solid or the glass has nothing to
// measure its own thickness against, and filled dots refuse the mesh outright.
test("every orb form is a closed outward-facing solid on the unit sphere", () => {
  for (const [form] of orbForms) {
    const mesh = primitiveMesh("orb", { form, detail: 2 });
    const info = meshInfo(mesh);
    assert.equal(info.closed, true, `${form} is not closed`);
    assert.equal(info.boundaryEdges, 0, `${form} has open edges`);
    for (let i = 0; i < mesh.length; i += 9) {
      const a = [...mesh.slice(i, i + 3)];
      const u = [...mesh.slice(i + 3, i + 6)].map((v, k) => v - a[k]),
        v = [...mesh.slice(i + 6, i + 9)].map((n, k) => n - a[k]);
      const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      assert.ok(
        normal.reduce((sum, n, k) => sum + n * a[k], 0) > 0,
        `${form} has an inward-facing triangle`,
      );
    }
    // Circumradius one: switching form changes the shape and not the size.
    let far = 0;
    for (let i = 0; i < mesh.length; i += 3)
      far = Math.max(far, Math.hypot(mesh[i], mesh[i + 1], mesh[i + 2]));
    assert.ok(Math.abs(far - 1) < 1e-6, `${form} is not on the unit sphere`);
  }
  // A dodecahedron is twelve pentagons: sixty triangles fanned from twelve centres.
  assert.equal(primitiveMesh("orb", { form: "dodecahedron" }).length / 9, 60);
  // Geodesic detail is a square law, on twenty faces.
  for (const detail of [1, 2, 3, 4])
    assert.equal(
      primitiveMesh("orb", { form: "geodesic", detail }).length / 9,
      20 * detail * detail,
    );
});

test("a hollow form encloses a cavity that still fills with dots", () => {
  const wall = 0.2;
  const solid = primitiveMesh("orb", { form: "smooth" });
  const mesh = primitiveMesh("orb", { form: "smooth", hollow: true, wall });
  assert.equal(mesh.length, solid.length * 2, "the wall is the surface twice");
  assert.equal(meshInfo(mesh).closed, true);
  // The inner surface faces into the cavity, which is what lets the glass shader
  // measure the wall rather than the whole ball.
  let inward = 0;
  for (let i = solid.length; i < mesh.length; i += 9) {
    const a = [...mesh.slice(i, i + 3)];
    const u = [...mesh.slice(i + 3, i + 6)].map((v, k) => v - a[k]),
      v = [...mesh.slice(i + 6, i + 9)].map((n, k) => n - a[k]);
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    if (normal.reduce((sum, n, k) => sum + n * a[k], 0) < 0) inward++;
  }
  assert.equal(inward, solid.length / 9, "the inner surface is not reversed");

  // Alternate crossings fill the wall and leave the cavity empty; asking for the
  // space the vessel encloses fills the whole interior, which is what pouring a
  // simulation into a shell has always meant.
  const middle = (points) => {
    let count = 0;
    for (let i = 0; i < points.length; i += 3)
      if (Math.hypot(points[i], points[i + 1], points[i + 2]) < 0.6) count++;
    return count;
  };
  assert.equal(middle(volumePoints(mesh, 24)), 0);
  assert.ok(middle(volumePoints(mesh, 24, true)) > 100);
  assert.ok(WALL[0] <= wall && wall <= WALL[1]);
});

test("faceted shading gives every triangle its own normal", () => {
  assert.equal(isFaceted("orb", { form: "dodecahedron" }), true);
  assert.equal(isFaceted("orb", { form: "smooth" }), false);
  assert.equal(isFaceted("cylinder", { sides: 5 }), true);
  assert.equal(isFaceted("cylinder", { sides: 64 }), false);
  const mesh = primitiveMesh("orb", { form: "cube" });
  const flat = smoothNormals(mesh, true),
    smooth = smoothNormals(mesh);
  for (let i = 0; i < mesh.length; i += 9) {
    const n = [...flat.slice(i, i + 3)];
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-6);
    // All three corners of a face share it, which is what makes the face flat.
    for (const k of [3, 6])
      n.forEach((v, axis) =>
        assert.ok(Math.abs(v - flat[i + k + axis]) < 1e-6),
      );
  }
  // Averaged across a ninety-degree corner, a cube's normals point at its corners
  // instead of its faces — which is the blob the flag exists to avoid. The first
  // vertex of each triangle is the face centre, shared with nothing; the second is
  // a real corner of the cube, shared with two other faces.
  assert.ok(
    [...smooth.slice(3, 6)].some((v, k) => Math.abs(v - flat[3 + k]) > 0.3),
  );
});
