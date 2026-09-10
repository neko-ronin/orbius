import { materialFragment } from "./fragment.js";
import { quadVertex } from "../shaders.js";
// Export only the authored volume path; no chemistry sampler or built-in families.
export function exportFamily(config, colors) {
  let fragment = materialFragment;
  const begin = fragment.indexOf(" else if(uFamily==1)");
  const end = fragment.indexOf(" float hueAngle=", begin);
  fragment = fragment.slice(0, begin) + fragment.slice(end);
  fragment = fragment
    .replace("uniform sampler2D uChemistry;", "")
    .replace("uniform int uFamily,uSteps;", "uniform int uSteps;")
    .replace(" if(uFamily==4){", " {");
  const uniforms = {
    uResolution: [1280, 720],
    uTime: 0,
    uSteps: 160,
    uColorA: colors[0],
    uColorB: colors[1],
    uColorC: colors[2],
  };
  for (const key of [
    "rotation",
    "tilt",
    "zoom",
    "hue",
    "ior",
    "reflection",
    "roughness",
    "interiorMotion",
    "emission",
    "materialScale",
    "materialFold",
    "surfaceActivity",
    "fieldA",
    "fieldB",
    "fieldOperation",
    "fieldMix",
    "fieldOffset",
    "fieldRatio",
    "fieldWidth",
    "fieldColor",
  ])
    uniforms["u" + key[0].toUpperCase() + key.slice(1)] = config[key];
  return {
    format: "boast-shader-family",
    version: 1,
    vertex: quadVertex,
    fragment,
    uniforms,
    config,
    contract:
      "WebGL2 fullscreen triangle (drawArrays TRIANGLES, 0, 3), no vertex attributes or textures. uSteps is int; other scalar uniforms are float. uTime is seconds; uResolution is framebuffer pixels. Colors are normalized RGB. Output is linear HDR before exposure, bloom and tone mapping. This integration bundle is not a BOAST project: use Save in BOAST for a project that can be reopened.",
  };
}
