import test from "node:test";
import assert from "node:assert/strict";
import { authorMessage, orbFragment, ORB_OFFSET } from "./shaders.js";

test("compiler messages are translated to the line the author wrote", () => {
  // The offset is a property of the scaffold, so derive the expectation from the
  // scaffold rather than restating the number — this fails if orbFragment's
  // preamble ever grows a line.
  const assembled = orbFragment("float shape(vec3 p){return 0.;}");
  const firstUserLine =
    assembled.split("\n").findIndex((l) => l.includes("float shape")) + 1;
  assert.equal(firstUserLine - ORB_OFFSET, 1);

  assert.equal(
    authorMessage("ERROR: 0:9: 'NOPE' : undeclared identifier"),
    "Line 3 · 'NOPE' : undeclared identifier",
  );
  assert.equal(
    authorMessage("WARNING: 0:8: something minor"),
    "Line 2 (warning) · something minor",
  );

  // Driver logs are null-terminated and the terminator arrives as its own line.
  assert.equal(
    authorMessage("ERROR: 0:7: bad\n" + String.fromCharCode(0)),
    "Line 1 · bad",
  );

  // An error inside the scaffold itself cannot report as line zero or a negative.
  assert.equal(authorMessage("ERROR: 0:2: internal"), "Line 1 · internal");

  // Anything that is not a positioned diagnostic passes through intact, because a
  // linker error with no line is still worth reading.
  assert.equal(
    authorMessage("Link failed: too many uniforms"),
    "Link failed: too many uniforms",
  );
});
