// Closed meshes use the same materials, sampling, and persistence as imports.
export function primitiveMesh(kind) {
  const segments = 64;
  let profile;
  if (kind === "orb") {
    profile = Array.from({ length: 33 }, (_, i) => {
      const angle = (i / 32) * Math.PI;
      return [i === 0 || i === 32 ? 0 : Math.sin(angle), Math.cos(angle)];
    });
  } else if (kind === "cylinder") {
    // Small rounded rims catch the studio lights without a razor-sharp edge.
    profile = [
      [0, 1],
      [0.74, 1],
    ];
    for (let i = 1; i <= 6; i++) {
      const angle = ((i / 6) * Math.PI) / 2;
      profile.push([
        0.74 + 0.06 * Math.sin(angle),
        0.94 + 0.06 * Math.cos(angle),
      ]);
    }
    profile.push([0.8, -0.94]);
    for (let i = 1; i <= 6; i++) {
      const angle = ((i / 6) * Math.PI) / 2;
      profile.push([
        0.74 + 0.06 * Math.cos(angle),
        -0.94 - 0.06 * Math.sin(angle),
      ]);
    }
    profile.push([0, -1]);
  } else {
    throw new Error("Unknown basic form.");
  }
  const rings = profile.map(([radius, y]) =>
    Array.from({ length: segments }, (_, i) => {
      const angle = (i / segments) * Math.PI * 2;
      return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
    }),
  );
  const triangles = [];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = rings[j][i],
        b = rings[j][next];
      const c = rings[j + 1][i],
        d = rings[j + 1][next];
      if (profile[j][0] > 0) triangles.push(...a, ...b, ...c);
      if (profile[j + 1][0] > 0) triangles.push(...b, ...d, ...c);
    }
  }
  return new Float32Array(triangles);
}
