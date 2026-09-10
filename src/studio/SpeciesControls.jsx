import React from "react";
export default function SpeciesControls({ config, update, control }) {
  return (
    <details open className="species-panel">
      <summary>Material populations</summary>
      <div className="section-controls">
        <label className="species-toggle">
          <input
            type="checkbox"
            checked={!!config.speciesEnabled}
            onChange={(e) => update("speciesEnabled", e.target.checked ? 1 : 0)}
          />{" "}
          Couple three populations
        </label>
        {!!config.speciesEnabled && (
          <>
            <p className="species-note">
              A · Amber / B · Cyan / C · Rose
              <br />
              Rows feel columns. Positive attracts; negative separates. Coupling
              uses a projected density field.
            </p>
            <div className="pair-matrix">
              <span>↓ feels →</span>
              {["A", "B", "C"].map((x) => (
                <b key={x}>{x}</b>
              ))}
              {["A", "B", "C"].map((a) => (
                <React.Fragment key={a}>
                  <b>{a}</b>
                  {["A", "B", "C"].map((b) => (
                    <input
                      key={b}
                      type="number"
                      aria-label={`${a} feels ${b}`}
                      title={`${a} feels ${b}: positive attracts, negative repels`}
                      min={-2}
                      max={2}
                      step={0.05}
                      value={config[`pair${a}${b}`]}
                      onChange={(e) => {
                        if (e.target.value !== "")
                          update(
                            `pair${a}${b}`,
                            Math.max(-2, Math.min(2, +e.target.value)),
                          );
                      }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
            {["A", "B", "C"].map((a) => (
              <React.Fragment key={a}>
                {control(`speciesDrag${a}`)}
                {control(`speciesLift${a}`)}
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </details>
  );
}
