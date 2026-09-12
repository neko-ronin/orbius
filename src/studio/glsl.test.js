import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, isDeclaration } from "./glsl.js";

test("the tokenizer covers its input exactly", () => {
  // The overlay sits behind a textarea and must be the same text, character for
  // character. A dropped or duplicated token shifts every glyph after it away from
  // the caret, so this is the property that matters most.
  for (const source of [
    "",
    "\n\n",
    "vec3 p = vec3(1.0, .5, 2e-3);",
    "// note\n/* block\nspans lines */\n#version 300 es\n",
    "float f(vec3 q){return q.x*-1.;} // tail",
    "€ unicode ✳ and\ttabs",
  ]) {
    const tokens = tokenize(source);
    assert.equal(
      tokens.map((t) => t[1]).join(""),
      source,
      `lost text: ${source}`,
    );
    // Offsets must address the original string, since a scrub splices by them.
    for (const [, text, at] of tokens)
      assert.equal(source.slice(at, at + text.length), text);
  }
});

test("tokens are classified the way the colours claim", () => {
  const kinds = (src) =>
    Object.fromEntries(
      tokenize(src)
        .filter((t) => t[0] !== "ws")
        .map(([kind, text]) => [text, kind]),
    );
  const k = kinds("uniform float uGlow; vec3 n = normalize(p) * 2.5e-3; // hi");
  assert.equal(k.uniform, "key");
  assert.equal(k.vec3, "type");
  assert.equal(k.normalize, "fn");
  assert.equal(k.uGlow, "uni"); // scaffold-provided names read differently
  assert.equal(k["2.5e-3"], "num");
  assert.equal(k["// hi"], "comment");
  assert.equal(kinds("#version 300 es")["#version"], "pre");
  // A declaration is not a note to yourself, and reads as the thing it is.
  assert.ok(isDeclaration('// @control veins 1 14 0.1 "x"'));
  assert.ok(isDeclaration("// @default veins 6"));
  assert.ok(!isDeclaration("// an ordinary comment"));
});

test("pathological input cannot hang the highlighter", () => {
  // This runs on every keystroke against text the user controls, so every pattern
  // has to be linear. These are the shapes that make a backtracking scanner hang.
  for (const evil of [
    "/*".repeat(20000),
    "a".repeat(100000),
    "1.".repeat(20000),
    "((((((((((".repeat(5000),
    "0.0e".repeat(20000),
  ]) {
    const started = Date.now();
    const tokens = tokenize(evil);
    assert.equal(tokens.map((t) => t[1]).join(""), evil);
    assert.ok(
      Date.now() - started < 1000,
      `took ${Date.now() - started}ms on ${evil.slice(0, 12)}…`,
    );
  }
});
