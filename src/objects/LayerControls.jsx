import React, { useState, useEffect } from "react";
import { layerDefaults, layerControls } from "./layers.js";
export default function LayerControls({ object, busy, onBuild }) {
  const [draft, setDraft] = useState(object.layerSettings ?? layerDefaults);
  useEffect(
    () => setDraft(object.layerSettings ?? layerDefaults),
    [object.id, object.layerSettings],
  );
  const budget = draft.layers * draft.resolution ** 2;
  return (
    <section className="layer-designer">
      <span className="eyebrow">STRATA / PROCEDURAL SHEETS</span>
      <p className="mesh-formats">
        Build terrain inside this mesh. Each sheet is a field of dots; the shell
        clips its edges.
      </p>
      {Object.entries(layerControls).map(
        ([key, [label, min, max, step, hint]]) => (
          <label className="object-slider" key={key} title={hint}>
            <span>
              {label}
              <output>{draft[key]}</output>
            </span>
            <input
              aria-label={label}
              type="range"
              min={min}
              max={max}
              step={step}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: +e.target.value })}
            />
          </label>
        ),
      )}
      <p className="mesh-formats">
        Up to {budget.toLocaleString()} dots before clipping · 120,000 maximum
      </p>
      <button
        className="primary-button"
        disabled={busy || budget > 120000}
        onClick={() => onBuild(draft)}
      >
        Build layers
      </button>
      <p className="mesh-formats">
        Geometry changes apply on Build. Color, light flow, and transforms
        update live below.
      </p>
    </section>
  );
}
