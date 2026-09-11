import test from "node:test";
import assert from "node:assert/strict";
import { GpuTimer } from "./gpuTimer.js";

// A stand-in for the driver: queries resolve when told to, and a disjoint can be
// raised the way a real GPU raises one after being interrupted.
function fakeGl({ supported = true } = {}) {
  const state = new Map();
  let next = 0;
  const gl = {
    QUERY_RESULT_AVAILABLE: "available",
    QUERY_RESULT: "result",
    disjoint: 0,
    createQuery: () => ({ id: next++ }),
    deleteQuery: (q) => state.delete(q),
    beginQuery: (_target, q) => state.set(q, { ready: false, ns: 0 }),
    endQuery: () => {},
    getQueryParameter: (q, p) =>
      p === "available" ? state.get(q).ready : state.get(q).ns,
    getParameter: () => gl.disjoint,
    getExtension: (name) =>
      supported && name === "EXT_disjoint_timer_query_webgl2"
        ? { TIME_ELAPSED_EXT: "elapsed", GPU_DISJOINT_EXT: "disjoint" }
        : null,
    resolve: (ms) => {
      for (const v of state.values()) {
        v.ready = true;
        v.ns = ms * 1e6;
      }
    },
    live: () => state.size,
  };
  return gl;
}

test("a timer without the extension still runs every pass", () => {
  const timer = new GpuTimer(fakeGl({ supported: false }));
  assert.equal(timer.available, false);
  let ran = 0;
  assert.equal(
    timer.span("stage", () => {
      ran++;
      return "value";
    }),
    "value",
  );
  assert.equal(ran, 1);
  assert.equal(timer.poll(), null);
});

test("passes report in render order and survive a throwing pass", () => {
  const gl = fakeGl();
  const timer = new GpuTimer(gl);
  timer.span("footprint", () => {});
  timer.span("stage", () => {});
  // A pass that throws must still close its query, or every later query in the
  // frame is measured inside it and the numbers are silently wrong.
  assert.throws(() =>
    timer.span("shells", () => {
      throw Error("shader blew up");
    }),
  );
  timer.span("composite", () => {});
  gl.resolve(2);
  const { passes, total } = timer.poll();
  assert.deepEqual(
    passes.map((p) => p.label),
    ["footprint", "stage", "shells", "composite"],
  );
  assert.equal(total, 8);
});

test("a disjoint discards its results rather than reporting a phantom spike", () => {
  const gl = fakeGl();
  const timer = new GpuTimer(gl);
  for (let i = 0; i < 40; i++) {
    timer.span("shells", () => {});
    gl.resolve(4);
    timer.poll();
  }
  const settled = timer.poll() ?? { passes: [{ ms: 0 }] };
  assert.ok(Math.abs(settled.passes[0].ms - 4) < 0.01);
  gl.disjoint = 1;
  timer.span("shells", () => {});
  gl.resolve(900);
  const after = timer.poll();
  assert.ok(
    Math.abs(after.passes[0].ms - 4) < 0.01,
    "an interrupted frame must not move the reading",
  );
});

test("queries are recycled rather than allocated every frame", () => {
  const gl = fakeGl();
  const timer = new GpuTimer(gl);
  for (let i = 0; i < 50; i++) {
    timer.span("stage", () => {});
    gl.resolve(1);
    timer.poll();
  }
  assert.equal(gl.live(), 1);
});
