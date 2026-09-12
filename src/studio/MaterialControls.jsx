import React from "react";
import Control from "./Control.jsx";
import {
  composerControls,
  fieldNames,
  operationNames,
} from "../materials/composer.js";
import { exportFamily as createBundle } from "../materials/export.js";
import { palettes } from "../project.js";
import { builtins } from "../materials/families.js";
export default function MaterialControls({
  config,
  update,
  onStart,
  onCollect,
  tip,
}) {
  // `names` indexes options by position; `options` gives them explicit values, which
  // is what a family needs now that it is identified by name rather than by number.
  const select = (key, label, names, options) => (
    <label className="material-select" key={key}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={config[key]}
        onChange={(e) =>
          update(key, options ? e.target.value : +e.target.value)
        }
      >
        {(options ?? names.map((name, i) => [i, name])).map(([value, name]) => (
          <option value={value} key={String(value)}>
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
      {/* Generated from the registry, so a family that exists is a family you can
          choose — which is the point of families being values at all. */}
      {select("family", "Shader family", null, [
        ["", "Custom GLSL surface"],
        ...builtins.map((f) => [f.id, f.name]),
      ])}
      {config.family === "solar" && (
        <p className="material-review">
          Under review · improving. Reads as a luminous body now, but the cells
          are large and nothing rises above the limb.
        </p>
      )}
      {config.family !== "composer" ? (
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
