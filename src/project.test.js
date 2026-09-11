import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  defaultShader,
  initialGraph,
  validateProject,
  resolveGraph,
  conformSimulation,
  controls,
  lightRig,
  lightRoles,
} from "./project.js";
import { newObject } from "./objects/model.js";
const fixture = () => ({
  format: "boast-project",
  version: 1,
  name: "Round trip",
  mode: "particles",
  config: { ...defaults },
  shader: defaultShader,
  graph: structuredClone(initialGraph),
  fields: [],
});
test("a saved project round trips every parameter and connected graph", () => {
  const p = fixture();
  p.config.spin = -1.2;
  p.mode = "nodes";
  p.fields = [
    {
      id: "field-1",
      type: "light",
      x: 0.2,
      y: -0.5,
      strength: 3,
      radius: 1,
      color: "#ffccee",
    },
  ];
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
});
test("untrusted project rejects missing format, versions, NaN, infinite values and out-of-range data", () => {
  for (const change of [
    (p) => (p.version = 2),
    (p) => (p.format = "wrong"),
    (p) => (p.config.zoom = NaN),
    (p) => (p.config.count = 1e10),
    (p) => (p.config.palette = 8),
    (p) => (p.config.lightColor = "javascript:alert(1)"),
    (p) => (p.shader = "x".repeat(20001)),
  ]) {
    const p = fixture();
    change(p);
    assert.throws(() => validateProject(p));
  }
});
test("rejects unknown node types, multiple inputs, cycles and invalid fields", () => {
  for (const change of [
    (p) => (p.graph.nodes[0].type = "script"),
    (p) => p.graph.edges.push(["source", "glow"]),
    (p) => p.graph.edges.push(["glow", "flow"]),
    (p) =>
      (p.fields = [
        {
          type: "attract",
          x: Infinity,
          y: 0,
          strength: 1,
          radius: 1,
          color: "#ffffff",
        },
      ]),
  ]) {
    const p = fixture();
    change(p);
    assert.throws(() => validateProject(p));
  }
});
test("only nodes connected to the output modify the render", () => {
  const graph = structuredClone(initialGraph);
  graph.nodes.push({ id: "unused", type: "twist", x: 0, y: 0, value: 3 });
  const r = resolveGraph(graph, defaults);
  assert.equal(r.mode, "particles");
  assert.equal(r.config.turbulence, 0.7);
  assert.equal(r.config.bloom, 0.9);
  assert.equal(r.config.twist, defaults.twist);
  assert.deepEqual(r.active, ["source", "flow", "glow", "out"]);
  assert.equal(defaults.turbulence, 0.45);
});
test("disconnected output and cyclic graphs cannot evaluate", () => {
  assert.throws(() => resolveGraph({ ...initialGraph, edges: [] }, defaults));
  assert.throws(() =>
    resolveGraph(
      {
        ...initialGraph,
        edges: [
          ["flow", "glow"],
          ["glow", "flow"],
          ["glow", "out"],
        ],
      },
      defaults,
    ),
  );
});
test("orb source selects orb renderer through the same composition chain", () => {
  const g = structuredClone(initialGraph);
  g.nodes[0].type = "orb";
  assert.equal(resolveGraph(g, defaults).mode, "orb");
});

test("project keeps the working shader and an unfinished draft independently", () => {
  const p = fixture();
  p.shaderDraft = "unfinished shader edit";
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.shader, defaultShader);
  assert.equal(loaded.shaderDraft, "unfinished shader edit");
});
test("prototype names and duplicate field identifiers are rejected", () => {
  const p = fixture();
  p.graph.nodes[0].type = "__proto__";
  assert.throws(() => validateProject(p));
  const q = fixture();
  const f = {
    id: "duplicate",
    type: "attract",
    x: 0,
    y: 0,
    strength: 1,
    radius: 1,
    color: "#ffffff",
  };
  q.fields = [f, { ...f }];
  assert.throws(() => validateProject(q));
});

test("legacy projects acquire new system defaults without changing their custom surface", () => {
  const p = fixture();
  p.config = { count: 40000, spin: 0.7 };
  const restored = validateProject(p);
  assert.equal(restored.config.family, 0);
  assert.equal(restored.config.speciesEnabled, 0);
  assert.equal(restored.config.glassClarity, 0.92);
  assert.equal(restored.shader, p.shader);
});
test("glass containers and interior recipes round trip independently", () => {
  for (let container = 0; container < 3; container++)
    for (let interior = 0; interior < 3; interior++) {
      const p = fixture();
      p.mode = "glass";
      Object.assign(p.config, {
        container,
        interior,
        glassThickness: 0.3,
        interiorScale: 0.7,
      });
      assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
    }
});
test("material families, chemical parameters and directional species couplings are validated", () => {
  for (const [key, value] of [
    ["family", 5],
    ["container", 0.5],
    ["interior", -1],
    ["reactionFeed", 0.2],
    ["pairAB", 3],
    ["speciesDragB", NaN],
  ]) {
    const p = fixture();
    p.config[key] = value;
    assert.throws(() => validateProject(p));
  }
  const p = fixture();
  p.config.pairAB = -1;
  p.config.pairBA = 0.5;
  const loaded = validateProject(p);
  assert.equal(loaded.config.pairAB, -1);
  assert.equal(loaded.config.pairBA, 0.5);
});
test("glass is a peer source in the node composer", () => {
  const p = fixture();
  p.graph.nodes[0].type = "glass";
  p.mode = "nodes";
  assert.equal(resolveGraph(validateProject(p).graph, p.config).mode, "glass");
});

test("composed shader families round trip and reject invalid operators", () => {
  const p = fixture();
  p.config.family = 4;
  p.config.fieldA = 3;
  p.config.fieldB = 2;
  p.config.fieldOperation = 3;
  p.config.fieldWidth = 0.04;
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(restored.config.family, 4);
  assert.equal(restored.config.fieldOperation, 3);
  assert.equal(restored.config.fieldWidth, 0.04);
  for (const [key, value] of [
    ["fieldA", 4],
    ["fieldB", 0.5],
    ["fieldOperation", -1],
    ["fieldWidth", 0],
    ["fieldMix", NaN],
  ]) {
    const invalid = fixture();
    invalid.config[key] = value;
    assert.throws(() => validateProject(invalid));
  }
});

test("a contained particle simulation names a glass shell and survives a round trip", () => {
  const shell = newObject(
    "Vessel",
    [0, 0, 0, 1, 0, 0, 0, 1, 0],
    [0.2, 0.2, 0.2],
    {},
  );
  const p = { ...fixture(), mode: "glass", objects: [shell] };
  p.particleContainer = shell.id;
  assert.equal(
    validateProject(JSON.parse(JSON.stringify(p))).particleContainer,
    shell.id,
  );
  // A container that is not a glass shell in the scene is dropped, not trusted.
  assert.equal(
    validateProject({ ...p, particleContainer: "no-such-object" })
      .particleContainer,
    undefined,
  );
  assert.equal(
    validateProject({
      ...p,
      objects: [{ ...shell, role: "surface" }],
    }).particleContainer,
    undefined,
  );
  assert.throws(() => validateProject({ ...p, particleContainer: 7 }));
  assert.equal(validateProject(fixture()).particleContainer, undefined);
});

test("a loaded simulation is authored for the enclosure it is poured into", () => {
  const saved = {
    ...defaults,
    spread: 2.4,
    depth: 1.2,
    turbulence: 1.2,
    frequency: 1.4,
    drag: 1.6,
    spin: 0.9,
    life: 11,
    count: 44000,
  };
  const tall = { center: [0, 0, 0], extent: [0.8, 0.98, 0.8], fill: 0.5 };
  const vessel = conformSimulation(saved, tall, [1, 1, 1]);
  // The emitter spans the vessel and keeps the flatness it was authored with.
  assert.ok(vessel.spread <= 0.81);
  assert.ok(
    Math.abs(vessel.depth / vessel.spread - saved.depth / saved.spread) < 0.01,
    "emitter aspect ratio survives the rescale",
  );
  // Damping is capped: a small vessel with heavy drag settles into a dead block.
  assert.ok(vessel.drag < saved.drag);
  // Character carries over untouched.
  for (const key of ["spin", "life", "count", "palette", "hue", "size"])
    assert.equal(vessel[key], saved[key]);
  for (const [key, value] of Object.entries(vessel))
    if (controls[key])
      assert.ok(
        value >= controls[key][1] && value <= controls[key][2],
        `${key} stays inside its control range`,
      );
  // Eddies are sized to the vessel, so a larger one carries a coarser flow and
  // needs more energy to cross.
  const big = conformSimulation(saved, tall, [3, 3, 3]);
  assert.ok(big.frequency < vessel.frequency);
  assert.ok(big.turbulence > vessel.turbulence);
  assert.ok(big.spread > vessel.spread);
});

test("conforming without a measured interior fails at the boundary", () => {
  // The worker has to forward the measurement; losing it silently left the
  // enclosure running whatever config happened to be loaded already.
  for (const interior of [undefined, null, {}, { extent: [1, 1] }])
    assert.throws(
      () => conformSimulation(defaults, interior, [1, 1, 1]),
      /not measured/,
    );
});

test("the studio rig resolves placement, colour temperature and drift", () => {
  const rig = (over, time = 0) => lightRig({ ...defaults, ...over }, time);
  const dir = (r, i) => [...r.direction.slice(i * 4, i * 4 + 3)];
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} vs ${b}`);

  // Spherical placement: zero azimuth faces away from the camera down +Z, and
  // elevation lifts toward +Y.
  const facing = rig({ keyAzimuth: 0, keyElevation: 0, keyDrift: 0 });
  dir(facing, 0).forEach((v, axis) => near(v, [0, 0, 1][axis]));
  const side = rig({ keyAzimuth: 90, keyElevation: 0, keyDrift: 0 });
  dir(side, 0).forEach((v, axis) => near(v, [1, 0, 0][axis]));
  const overhead = rig({ keyAzimuth: 40, keyElevation: 90, keyDrift: 0 });
  dir(overhead, 0).forEach((v, axis) => near(v, [0, 1, 0][axis]));
  for (let i = 0; i < lightRoles.length; i++)
    near(Math.hypot(...dir(facing, i)), 1);

  // Warm light is redder than cool light, and the softbox height travels in the
  // colour's fourth channel.
  const warm = rig({ keyKelvin: 2200, keyIntensity: 1, keyFlicker: 0 });
  const cool = rig({ keyKelvin: 11000, keyIntensity: 1, keyFlicker: 0 });
  assert.ok(warm.color[0] / warm.color[2] > cool.color[0] / cool.color[2]);
  near(warm.color[3], defaults.keyHeight);
  assert.deepEqual([...rig({ keyIntensity: 0 }).color.slice(0, 3)], [0, 0, 0]);

  // A light with no drift or flicker must be pinned, or a still composition would
  // never hold still; with them, it has to actually move.
  const still = Object.fromEntries(
    lightRoles.flatMap(([id]) => [
      [`${id}Drift`, 0],
      [`${id}Flicker`, 0],
    ]),
  );
  assert.deepEqual([...rig(still, 0).direction], [...rig(still, 37).direction]);
  assert.deepEqual([...rig(still, 0).color], [...rig(still, 37).color]);
  const moving = { keyDrift: 1, keyFlicker: 1 };
  assert.notDeepEqual(
    [...rig(moving, 0).direction],
    [...rig(moving, 37).direction],
  );
  assert.notDeepEqual([...rig(moving, 0).color], [...rig(moving, 37).color]);
  // Flicker must not drive a light negative, however deep the trough.
  for (let t = 0; t < 60; t += 0.37)
    assert.ok(rig({ keyFlicker: 1, keyIntensity: 1 }, t).color[0] >= 0);
});
