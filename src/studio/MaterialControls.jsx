import Control from "./Control.jsx";
import {
  composerControls,
  fieldNames,
  operationNames,
} from "../materials/composer.js";
import { exportFamily as createBundle } from "../materials/export.js";
import { palettes } from "../project.js";
import {
  contracts,
  newFamily,
  validateFamilies,
} from "../materials/families.js";
import { listFamilies, readFamily, writeFamily } from "./storage.js";
import React, { useEffect, useState } from "react";
export default function MaterialControls({
  config,
  update,
  onStart,
  onCollect,
  tip,
  families,
  registry,
  onFamilies,
}) {
  const mine = families.find((f) => f.id === config.family);
  // The library is the folder in the repo, read once when this panel appears and
  // after anything writes to it, so a family authored here can be used elsewhere.
  const [library, setLibrary] = useState([]);
  const [note, setNote] = useState("");
  const refresh = () =>
    listFamilies()
      .then((items) => setLibrary(items ?? []))
      .catch(() => setLibrary([]));
  useEffect(() => {
    refresh();
  }, []);
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
          choose — and one this project authored sits beside the shipped ones. */}
      {select("family", "Shader family", null, [
        ["", "Custom GLSL surface"],
        ...Object.values(registry).map((f) => [f.id, f.name]),
      ])}
      <div className="family-actions">
        {Object.entries(contracts).map(([kind, contract]) => (
          <button
            key={kind}
            title={contract.note}
            onClick={() => {
              const family = newFamily(
                kind,
                `New ${contract.label.toLowerCase()}`,
              );
              onFamilies([...families, family]);
              update("family", family.id);
            }}
          >
            + {contract.label}
          </button>
        ))}
        {config.family && !mine && (
          <button
            title="Copy this family into the project so you can edit it"
            onClick={() => {
              const source = registry[config.family];
              const copy = {
                ...newFamily(source.kind, `${source.name} copy`),
                glsl: source.glsl,
              };
              onFamilies([...families, copy]);
              update("family", copy.id);
            }}
          >
            Duplicate to edit
          </button>
        )}
      </div>
      {(library.length > 0 || mine) && (
        <div className="family-library">
          {mine && (
            <button
              onClick={async () => {
                try {
                  const at = await writeFamily(mine.name, mine);
                  setNote(at ? `Saved to ${at}` : "");
                  refresh();
                } catch (e) {
                  setNote(e.message);
                }
              }}
            >
              Save to library
            </button>
          )}
          {library.map(({ file, label }) => (
            <button
              key={file}
              className="from-library"
              title={`Add ${label} to this project`}
              onClick={async () => {
                try {
                  const stored = await readFamily(file);
                  // Same check as a project's own families: a file on disk is input.
                  const [family] = validateFamilies([
                    { ...stored, id: newFamily(stored.kind).id },
                  ]);
                  onFamilies([...families, family]);
                  update("family", family.id);
                  setNote("");
                } catch (e) {
                  setNote(`Could not add ${label}: ${e.message}`);
                }
              }}
            >
              + {label}
            </button>
          ))}
        </div>
      )}
      {note && <p className="material-review">{note}</p>}
      {mine && (
        <div className="family-identity">
          <input
            aria-label="Family name"
            value={mine.name}
            maxLength={80}
            onChange={(e) =>
              onFamilies(
                families.map((f) =>
                  f.id === mine.id ? { ...f, name: e.target.value } : f,
                ),
              )
            }
          />
          <button
            aria-label={`Delete ${mine.name}`}
            onClick={() => {
              if (!window.confirm(`Delete ${mine.name}?`)) return;
              onFamilies(families.filter((f) => f.id !== mine.id));
              update("family", "");
            }}
          >
            ×
          </button>
        </div>
      )}
      {config.family === "solar" && (
        <p className="material-review">
          Under review · improving. Reads as a luminous body now, but the cells
          are large and nothing rises above the limb.
        </p>
      )}
      {config.family !== "composer" ? (
        // This selects a built-in and applies its tuned settings; it does not create
        // anything. It used to say "Create a shader family", which is what the two
        // buttons above it actually do.
        <button className="primary-button" onClick={onStart}>
          Start from Composed fields
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
