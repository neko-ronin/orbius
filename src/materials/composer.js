export const composerDefaults = {
  fieldA: 0,
  fieldB: 1,
  fieldOperation: 3,
  fieldMix: 0.35,
  fieldOffset: 0.6,
  fieldRatio: 1.7,
  fieldWidth: 0.065,
  fieldColor: 0.65,
};
export const composerControls = {
  fieldA: ["Primary field", 0, 3, 1],
  fieldB: ["Secondary field", 0, 3, 1],
  fieldOperation: ["Composition", 0, 3, 1],
  fieldMix: [
    "Secondary influence",
    0,
    1,
    0.01,
    "Blends in the second field or controls how deeply it masks or carves the first.",
    "signed distance field blending operations",
  ],
  fieldOffset: [
    "Field offset",
    0,
    3,
    0.01,
    "Moves the second field through the first. Watch crossings appear and disappear.",
    "domain offset signed distance field",
  ],
  fieldRatio: [
    "Relative frequency",
    0.3,
    3,
    0.01,
    "Changes the second field scale independently. Try 1.7 for a finer structure around broad folds.",
    "frequency ratio procedural noise",
  ],
  fieldWidth: [
    "Ribbon width",
    0.025,
    0.2,
    0.005,
    "Thickness of the luminous material. Fine ribbons reveal negative space; thicker ribbons feel cloudlike.",
    "isosurface thickness volumetric raymarching",
  ],
  fieldColor: [
    "Color travel",
    0,
    2,
    0.01,
    "How quickly colors change through the volume. Zero gives a restrained gradient.",
    "colour ramp volumetric rendering",
  ],
};
export const fieldNames = [
  "Interwoven sheets",
  "Concentric ripples",
  "Noise contours",
  "Crossing waves",
];
export const operationNames = [
  "Morph fields",
  "Layer together",
  "Intersect",
  "Carve away",
];
