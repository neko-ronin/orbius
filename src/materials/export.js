import { quadVertex } from "../shaders.js";
import { lightRig } from "../project.js";
import { familyById, familySource } from "./families.js";
// A family's own source is the bundle. This used to slice the built-in families out
// of one enormous shader by searching for branch text, which only worked as long as
// nobody edited the branch it searched for.
export function exportFamily(config, colors) {
  const family = familyById[config.family] ?? familyById.composer;
  const fragment = familySource(family);
  const usesChemistry = fragment.includes("texture(uChemistry");
  // The rig travels with the bundle, resolved at t=0: the shader reads these arrays,
  // so an export without them would compile and render black.
  const rig = lightRig(config, 0);
  const uniforms = {
    "uLightDir[0]": Array.from(rig.direction),
    "uLightColor[0]": Array.from(rig.color),
    uResolution: [1280, 720],
    uTime: 0,
    uSteps: 160,
    uColorA: colors[0],
    uColorB: colors[1],
    uColorC: colors[2],
  };
  // Only what this family actually reads. The hardcoded list used to be written for
  // the composer and travelled with every bundle, so a surface family shipped field
  // parameters it has no uniform for.
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
  ]) {
    const name = "u" + key[0].toUpperCase() + key.slice(1);
    if (fragment.includes(name)) uniforms[name] = config[key];
  }
  return {
    format: "orbius-shader-family",
    version: 1,
    vertex: quadVertex,
    fragment,
    uniforms,
    family: { id: family.id, name: family.name, kind: family.kind },
    config,
    contract:
      "WebGL2 fullscreen triangle (drawArrays TRIANGLES, 0, 3), no vertex attributes. uLightDir and uLightColor are vec4[3] studio lights: xyz is a world direction and w the softbox width; rgb is premultiplied colour and a the softbox height. uSteps is int; other scalar uniforms are float. uTime is seconds; uResolution is framebuffer pixels. Colors are normalized RGB. Output is linear HDR before exposure, bloom and tone mapping. " +
      (usesChemistry
        ? "This family samples uChemistry, a Gray-Scott reaction-diffusion field in an equirectangular map (R feed, G reagent), which you must supply and step yourself; without it the surface renders as bare crust. "
        : "No textures are read. ") +
      "This integration bundle is not a ORBIUS project: use Save in ORBIUS for a project that can be reopened.",
  };
}
