import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  defaultShader,
  initialGraph,
  validateProject,
  resolveGraph,
} from "./project.js";
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
 const p = fixture(); p.shaderDraft = "unfinished shader edit";
 const loaded = validateProject(JSON.parse(JSON.stringify(p)));
 assert.equal(loaded.shader, defaultShader);
 assert.equal(loaded.shaderDraft, "unfinished shader edit");
});
test("prototype names and duplicate field identifiers are rejected", () => {
 const p = fixture(); p.graph.nodes[0].type = "__proto__";
 assert.throws(() => validateProject(p));
 const q = fixture(); const f = {id:"duplicate", type:"attract",x:0,y:0,strength:1,radius:1,color:"#ffffff"};
 q.fields = [f, {...f}]; assert.throws(() => validateProject(q));
});
