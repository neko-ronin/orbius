// A tokenizer for the GLSL an author actually writes here. Small language, small
// scanner: every alternative below is linear — no nested quantifiers, no alternation
// inside a repeat — because a highlighter runs on every keystroke against text the
// user controls, and a catastrophically backtracking pattern is a hang.
const KEYWORDS = new Set(
  "if else for while do break continue return discard const in out inout uniform varying attribute struct precision highp mediump lowp layout flat smooth centroid invariant true false void".split(
    " ",
  ),
);
const TYPES = new Set(
  "float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 uvec2 uvec3 uvec4 bvec2 bvec3 bvec4 mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 sampler2D sampler3D samplerCube".split(
    " ",
  ),
);
const BUILTINS = new Set(
  "abs acos all any asin atan ceil clamp cos cross degrees distance dot exp exp2 faceforward floor fract fwidth inversesqrt length log log2 max min mix mod modf normalize pow radians reflect refract round sign sin smoothstep sqrt step tan texture textureSize transpose inverse determinant dFdx dFdy gl_FragCoord gl_Position gl_VertexID gl_PointCoord gl_PointSize".split(
    " ",
  ),
);
const TOKEN =
  /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(#[A-Za-z_]\w*)|(\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|(\s+)|(.)/g;

// Returns [kind, text, offset] triples covering the whole source with no gaps, so
// the overlay is always the same length as the textarea it sits behind.
export function tokenize(source) {
  const out = [];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(source))) {
    const [text] = m;
    const kind =
      m[1] || m[2]
        ? "comment"
        : m[3]
          ? "pre"
          : m[4]
            ? "num"
            : m[5]
              ? KEYWORDS.has(text)
                ? "key"
                : TYPES.has(text)
                  ? "type"
                  : BUILTINS.has(text)
                    ? "fn"
                    : text.startsWith("u") && /^u[A-Z]/.test(text)
                      ? "uni"
                      : "id"
              : m[6]
                ? "ws"
                : "punc";
    out.push([kind, text, m.index]);
    if (m.index === TOKEN.lastIndex) TOKEN.lastIndex++;
  }
  return out;
}
// An @control line is a declaration, not a comment, so it reads as one.
export const isDeclaration = (text) =>
  /^\/\/\s*@(control|default)\b/.test(text);
