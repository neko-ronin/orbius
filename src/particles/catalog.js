export const speciesDefaults = {
  speciesEnabled: 0,
  speciesDragA: 0.8,
  speciesDragB: 0.2,
  speciesDragC: 0.45,
  speciesLiftA: -0.12,
  speciesLiftB: 0.3,
  speciesLiftC: 0.05,
  pairAA: 0.3,
  pairAB: -0.8,
  pairAC: 0.4,
  pairBA: 0.6,
  pairBB: 0.1,
  pairBC: -0.5,
  pairCA: -0.4,
  pairCB: 0.9,
  pairCC: -0.2,
};
export const speciesControls = Object.fromEntries(
  Object.keys(speciesDefaults).map((key) => [
    key,
    key === "speciesEnabled"
      ? [
          "Species coupling",
          0,
          1,
          1,
          "Enable three distinct populations coupled through a shared density field. Zero restores the original independent-particle flow.",
          "GPU particle density field",
        ]
      : key.startsWith("pair")
        ? [
            `${key.slice(4, 5)} feels ${key.slice(5)}`,
            -2,
            2,
            0.05,
            "Positive follows the other population’s density gradient; negative pushes away. This direction is independent of the reverse relationship. Try opposite signs for pursuit.",
            "particle life asymmetric interaction matrix",
          ]
        : key.startsWith("speciesDrag")
          ? [
              `${key.at(-1)} damping`,
              0,
              2,
              0.05,
              "How quickly this population loses velocity. High damping feels heavy and cohesive; low damping leaves long sweeping motion.",
              "particle velocity damping",
            ]
          : [
              `${key.at(-1)} vertical drift`,
              -1,
              1,
              0.05,
              "An artistic upward or downward force unique to this population. It does not represent physical fluid buoyancy.",
              "particle external acceleration",
            ],
  ]),
);
