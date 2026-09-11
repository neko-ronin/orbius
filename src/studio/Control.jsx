import React from "react";
// One slider, everywhere. Every panel in the studio describes its parameters the
// same way — [label, min, max, step, field note, search terms] — so every slider
// can carry the same numeric entry and the same field note, rather than each panel
// inventing its own and the glass wizard ending up with browser tooltips.
export default function Control({ id, entry, value, onChange, tip }) {
  const [label, min, max, step] = entry;
  return (
    <div className="control">
      <div className="control-label">
        <button
          onMouseEnter={() => tip.show(id, entry)}
          onMouseLeave={tip.hide}
          onFocus={() => tip.show(id, entry)}
          onBlur={tip.hide}
          onClick={() => tip.toggle(id, entry)}
          aria-label={`Learn about ${label}`}
        >
          {label}
          <span>?</span>
        </button>
        <input
          aria-label={`${label} value`}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            if (e.target.value !== "")
              onChange(Math.max(min, Math.min(max, +e.target.value)));
          }}
        />
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` }}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}
