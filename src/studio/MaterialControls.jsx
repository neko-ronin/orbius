import React from "react";
import Control from "./Control.jsx";
import {
  composerControls,
  fieldNames,
  operationNames,
} from "../materials/composer.js";
import { exportFamily as createBundle } from "../materials/export.js";
import { palettes } from "../project.js";
export default function MaterialControls({
  config,
  update,
  onStart,
  onCollect,
  tip,
}) {
  const select = (key, label, names) => (
    <label className="material-select" key={key}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={config[key]}
        onChange={(e) => update(key, +e.target.value)}
      >
        {names.map((name, i) => (
          <option value={i} key={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  function exportFamily() {
    const colors = palettes[config.palette].colors.map((hex) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
    );
    const bundle = createBundle(config, colors);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "boast-shader-family.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="material-identity">
      <span className="eyebrow">MATERIAL FAMILY</span>
      {select("family", "Shader family", [
        "Custom GLSL surface",
        "Prismatic silk",
        "Solar cartography · under review",
        "Liquid mercury · under review",
        "Family designer",
      ])}
      {[2, 3].includes(config.family) && (
        <p className="material-review">
          Very unimpressive · on the chopping block. Retained for improvement
          and comparison.
        </p>
      )}
      {config.family !== 4 ? (
        <button className="primary-button" onClick={onStart}>
          Create a shader family
        </button>
      ) : (
        <section className="family-designer">
          <span className="eyebrow">01 / DEFINE THE MATERIAL</span>
          <p>
            Compose two spatial fields into a luminous volume. The live orb is
            your preview.
          </p>
          {select("fieldA", "Primary field", fieldNames)}
          {select("fieldB", "Secondary field", fieldNames)}
          <span className="eyebrow">02 / MAKE THEM INTERACT</span>
          {select("fieldOperation", "Composition", operationNames)}
          {Object.entries(composerControls)
            .filter(
              ([key]) => !["fieldA", "fieldB", "fieldOperation"].includes(key),
            )
            .map(([key, entry]) => (
              <Control
                key={key}
                id={key}
                entry={entry}
                value={config[key]}
                onChange={(next) => update(key, next)}
                tip={tip}
              />
            ))}
          <span className="eyebrow">03 / KEEP YOUR FAMILY</span>
          <p>
            Name the family above the canvas. Tune palette, folds, motion, and
            light below. Collect saves an editable family with its rendered
            portrait; Save writes a portable project.
          </p>
          <div className="object-actions">
            <button onClick={onCollect}>Collect family</button>
            <button onClick={exportFamily}>Export GLSL bundle</button>
          </div>
        </section>
      )}
    </div>
  );
}
