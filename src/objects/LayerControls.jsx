import React, { useState, useEffect } from "react";
import { layerDefaults, layerControls } from "./layers.js";
import Control from "../studio/Control.jsx";
export default function LayerControls({ object, busy, onBuild, tip }) {
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
      {Object.entries(layerControls).map(([key, entry]) => (
        <Control
          key={key}
          id={`layer-${key}`}
          entry={entry}
          value={draft[key]}
          onChange={(next) => setDraft({ ...draft, [key]: next })}
          tip={tip}
        />
      ))}
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
