import LayerControls from "./LayerControls.jsx";
import { layerDefaults } from "./layers.js";
import React, { useEffect, useRef, useState } from "react";
import {
  newObject,
  MAX_OBJECTS,
  validateObjects,
  objectOptics,
} from "./model.js";
import {
  validateProject,
  simulationKeys,
  conformSimulation,
} from "../project.js";
// Coordinated optical settings; each is a whole finish, not one slider.
const glassFinishes = [
  [
    "Clear",
    {
      ior: 1.45,
      roughness: 0.04,
      thickness: 0.28,
      dispersion: 0.02,
      absorption: 0.18,
      opacity: 0.12,
      studioLight: 2.3,
      defects: 0.3,
      inclusions: 0.12,
    },
  ],
  [
    "Frosted",
    {
      ior: 1.4,
      roughness: 0.6,
      thickness: 0.34,
      dispersion: 0.01,
      absorption: 0.5,
      opacity: 0.3,
      studioLight: 2,
      defects: 0.55,
      inclusions: 0.28,
    },
  ],
  [
    "Prism",
    {
      ior: 1.8,
      roughness: 0.05,
      thickness: 0.45,
      dispersion: 0.05,
      absorption: 0.25,
      opacity: 0.14,
      studioLight: 2.7,
      defects: 0.22,
      inclusions: 0.35,
    },
  ],
  [
    "Smoked",
    {
      ior: 1.5,
      roughness: 0.16,
      thickness: 0.65,
      dispersion: 0.03,
      absorption: 1.6,
      opacity: 0.55,
      studioLight: 1.7,
      defects: 0.65,
      inclusions: 0.45,
    },
  ],
];
export default function ObjectEditor({
  objects,
  onChange,
  selected,
  onSelect,
  notify,
  particleContainer,
  onSimulation,
}) {
  const input = useRef(),
    simulationInput = useRef(),
    worker = useRef();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (worker.current) {
      worker.current.terminate();
      worker.current = null;
      setBusy(false);
      setMessage("Processing cancelled because the scene changed.");
    }
  }, [objects]);
  const selectedItem = objects.find((o) => o.id === selected);
  const current = selectedItem ? { ...objectOptics, ...selectedItem } : null;
  const update = (key, value) =>
    onChange(
      objects.map((o) => (o.id === selected ? { ...o, [key]: value } : o)),
    );
  function process(data, done) {
    worker.current?.terminate();
    setBusy(true);
    setMessage("Preparing geometry…");
    const w = new Worker(new URL("./import.worker.js", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = ({ data: result }) => {
      w.terminate();
      worker.current = null;
      setBusy(false);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage("");
      try {
        done(result);
      } catch (e) {
        setMessage(e.message);
      }
    };
    w.onerror = () => {
      w.terminate();
      worker.current = null;
      setBusy(false);
      setMessage("Could not process this mesh. Check the file and try again.");
    };
    w.postMessage(data, data.buffer ? [data.buffer] : []);
  }
  function addObject(name, result) {
    const object = newObject(
      name,
      result.triangles,
      result.points,
      result.info,
    );
    try {
      const next = [...objects, object];
      validateObjects(next);
      onChange(next);
      onSelect(object.id);
      notify("Object added. Pick an optical finish, or design inner layers.");
    } catch (e) {
      setMessage(e.message);
    }
  }
  function addPrimitive(kind) {
    if (busy || objects.length >= MAX_OBJECTS) return;
    process({ primitive: kind }, (result) =>
      addObject(`Glass ${kind}`, result),
    );
  }
  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (objects.length >= MAX_OBJECTS) {
      setMessage("Eight objects maximum. Remove an object before importing.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage("Choose a mesh under 20 MB, with at most 50,000 triangles.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      process({ buffer, name: file.name }, (result) => {
        addObject(file.name, result);
      });
    } catch (e) {
      setMessage(e.message);
    }
  }
  function addLayers() {
    if (!current || objects.length >= MAX_OBJECTS) return;
    const shell = current;
    process(
      {
        triangles: shell.triangles,
        role: "layers",
        layerSettings: layerDefaults,
      },
      (result) => {
        const layer = {
          ...newObject(
            `${shell.name} strata`,
            result.triangles,
            result.points,
            result.info,
            "layers",
          ),
          layerSettings: { ...layerDefaults },
          pointLimits: Array.from(result.limits),
          billow: 0.06,
          position: [...shell.position],
          rotation: [...shell.rotation],
          scale: [...shell.scale],
          color: "#348ca9",
          colorTop: "#ff3c0c",
          gradient: 1,
          opacity: 0.8,
          emission: 3.2,
          pointSize: 1.6,
        };
        try {
          validateObjects([...objects, layer]);
          onChange([...objects, layer]);
          onSelect(layer.id);
          notify("Strata added inside the selected form.");
        } catch (e) {
          setMessage(e.message);
        }
      },
    );
  }
  // A saved particle project becomes live contents of this shell: its solver
  // parameters come across, and the mesh becomes the volume that confines them.
  async function importSimulation(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !current) return;
    if (file.size > 96 * 1024 * 1024) {
      setMessage("Project is too large. Maximum file size is 96 MB.");
      return;
    }
    let saved;
    try {
      saved = validateProject(JSON.parse(await file.text()));
    } catch (err) {
      setMessage(`Could not read that project: ${err.message}`);
      return;
    }
    const id = current.id;
    process({ triangles: current.triangles, role: "field" }, (result) => {
      const conformed = conformSimulation(
        saved.config,
        result.interior,
        current.scale,
      );
      onSimulation({
        container: id,
        field: result.field,
        resolution: result.resolution,
        config: Object.fromEntries(
          simulationKeys.map((key) => [key, conformed[key]]),
        ),
      });
      notify(`${saved.name} is running inside ${current.name}, fitted to it.`);
    });
  }
  function replaceGeometry(next) {
    validateObjects(next);
    onChange(next);
  }
  function buildLayers(settings) {
    process(
      { triangles: current.triangles, role: "layers", layerSettings: settings },
      (result) => {
        replaceGeometry(
          objects.map((o) =>
            o.id === current.id
              ? {
                  ...o,
                  role: "layers",
                  layerSettings: settings,
                  pointLimits: Array.from(result.limits),
                  points: Array.from(result.points),
                  info: result.info,
                }
              : o,
          ),
        );
        notify("Terrain layers rebuilt.");
      },
    );
  }
  function role(next) {
    if (next === "layers") {
      buildLayers(current.layerSettings ?? layerDefaults);
      return;
    }
    if (next === "glass") {
      update("role", next);
      return;
    }
    const id = current.id;
    process({ triangles: current.triangles, role: next }, (result) => {
      replaceGeometry(
        objects.map((o) =>
          o.id === id
            ? {
                ...o,
                role: next,
                pointLimits: undefined,
                points: Array.from(result.points),
                info: result.info,
                opacity: next === "volume" ? 0.5 : 0.6,
              }
            : o,
        ),
      );
    });
  }
  function duplicate() {
    if (!current || objects.length >= MAX_OBJECTS) return;
    const copy = {
      ...current,
      id: crypto.randomUUID(),
      name: `${current.name.slice(0, 70)} copy`,
      position: [...current.position],
      rotation: [...current.rotation],
      scale: [...current.scale],
    };
    try {
      validateObjects([...objects, copy]);
      onChange([...objects, copy]);
      onSelect(copy.id);
    } catch (e) {
      setMessage(e.message);
    }
  }
  const range = (key, label, min, max, step) => (
    <label
      className="object-slider"
      key={key}
      title={
        {
          thickness:
            "Scales measured front-to-back depth for refraction and absorption. Try 0.1 for thin glass; 0.5 for a heavy optical form.",
          dispersion:
            "Separates red and blue refraction slightly. Small values give spectral edges; large values deliberately exaggerate them.",
          studioLight:
            "Brightness of the reflected studio lights. Clear glass needs something bright to reflect.",
          absorption:
            "How strongly the tint filters transmitted light. Thick regions absorb more.",
          defects:
            "Surface irregularity: forming waviness, orange peel, and a scratch field, plus uneven wall thickness. Seeded from the object, so it stays put.",
          inclusions:
            "Seeds and bubbles suspended in the body. They sit at depth and slide against the surface as the camera moves.",
          roughness:
            "Softens studio reflections and blurs the transmitted interior. Keep low for crisp dots.",
          billow:
            "Vertical motion amplitude. Each dot is clamped to its original interior interval, including imported closed meshes. Rebuild older layers to enable motion.",
          flow: "Speed of terrain motion, traveling light, and sparkle animation. Zero pauses the flow.",
          gradient:
            "Blends the lower and upper dot colors using height inside the original mesh.",
          sparkles:
            "Adds rare bright accents without increasing the brightness of every dot.",
        }[key]
      }
    >
      <span>
        {label}
        <output>{current[key]}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current[key]}
        onChange={(e) => update(key, +e.target.value)}
      />
    </label>
  );
  return (
    <section className="object-editor">
      <div className="object-editor-title">
        <span className="eyebrow">YOUR GEOMETRY / YOUR MATERIALS</span>
        <h2>Object composition</h2>
        <p>
          Start with a basic form or import a mesh. Give each object its own
          material.
        </p>
      </div>
      <div className="primitive-actions">
        <button
          disabled={busy || objects.length >= MAX_OBJECTS}
          onClick={() => addPrimitive("orb")}
        >
          + Glass orb
        </button>
        <button
          disabled={busy || objects.length >= MAX_OBJECTS}
          onClick={() => addPrimitive("cylinder")}
        >
          + Glass cylinder
        </button>
      </div>
      <button
        className="primary-button"
        disabled={busy || objects.length >= MAX_OBJECTS}
        onClick={() => input.current.click()}
      >
        {busy ? "Processing mesh…" : "+ Import 3D mesh"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".obj,.stl"
        hidden
        onChange={importFile}
      />
      <p className="mesh-formats">
        OBJ / STL · local processing · 50k triangles per mesh
      </p>
      {message && (
        <p className="mesh-message" role="status">
          {message}
        </p>
      )}
      <div className="object-stack">
        {objects.map((o) => (
          <div
            className={`object-row ${selected === o.id ? "selected" : ""}`}
            key={o.id}
          >
            <button
              disabled={busy}
              aria-pressed={selected === o.id}
              onClick={() => onSelect(o.id)}
            >
              <i style={{ background: o.color }} />
              <span>
                {o.name}
                <small>
                  {o.role === "glass"
                    ? "Glass shell"
                    : o.role === "layers"
                      ? "Procedural strata"
                      : o.role === "volume"
                        ? "Filled dot volume"
                        : "Surface dots"}{" "}
                  · {(o.triangles.length / 9).toLocaleString()} triangles
                </small>
              </span>
            </button>
            <button
              disabled={busy}
              aria-label={`${o.visible ? "Hide" : "Show"} ${o.name}`}
              onClick={() =>
                onChange(
                  objects.map((x) =>
                    x.id === o.id ? { ...x, visible: !x.visible } : x,
                  ),
                )
              }
            >
              {o.visible ? "◉" : "○"}
            </button>
          </div>
        ))}
      </div>
      {current && (
        <fieldset disabled={busy} className="object-properties">
          <label className="material-select">
            Object name
            <input
              aria-label="Object name"
              maxLength={80}
              value={current.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </label>
          <label className="material-select">
            Material
            <select
              aria-label="Object material"
              value={current.role}
              onChange={(e) => role(e.target.value)}
            >
              <option value="glass">Glass container</option>
              <option value="surface">Surface dots</option>
              <option value="volume">Filled volume dots</option>
              <option value="layers">Procedural strata</option>
            </select>
          </label>
          {current.role === "glass" && (
            <>
              <button
                className="primary-button"
                disabled={busy || objects.length >= MAX_OBJECTS}
                onClick={addLayers}
              >
                + Design inner layers
              </button>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => simulationInput.current.click()}
              >
                {particleContainer === current.id
                  ? "Replace contained simulation"
                  : "+ Load particle simulation"}
              </button>
              <input
                ref={simulationInput}
                type="file"
                accept=".json,.boast.json"
                hidden
                onChange={importSimulation}
              />
              {particleContainer === current.id && (
                <button onClick={() => onSimulation(null)}>
                  Empty this enclosure
                </button>
              )}
              <p className="mesh-formats">
                {particleContainer === current.id
                  ? "A saved particle simulation is running inside this shell. Its solver parameters travel with this project; placed fields do not."
                  : "Open a saved .boast.json particle project to run its simulation inside this shell."}
              </p>
            </>
          )}
          {current.role === "layers" && (
            <LayerControls object={current} busy={busy} onBuild={buildLayers} />
          )}
          <p className="mesh-formats">
            {current.role === "layers"
              ? "Independent dot sheets, clipped to the source mesh. Rebuild after changing terrain controls."
              : current.role === "surface"
                ? "Dots follow the imported surface. Open meshes are supported."
                : current.role === "volume"
                  ? "Dots occupy the interior of the closed mesh."
                  : "Geometry defines the shell. Reflection and screen-space refraction reveal objects behind it."}
          </p>
          <label className="object-color">
            {current.role === "glass" ? "Glass tint" : "Dot color"}
            <input
              type="color"
              aria-label="Object color"
              value={current.color}
              onChange={(e) => update("color", e.target.value)}
            />
          </label>
          {current.role === "glass" ? (
            <>
              <span className="eyebrow finish-eyebrow">OPTICAL FINISH</span>
              <div className="primitive-actions glass-finishes">
                {glassFinishes.map(([label, values]) => (
                  <button
                    key={label}
                    onClick={() =>
                      onChange(
                        objects.map((o) =>
                          o.id === selected ? { ...o, ...values } : o,
                        ),
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {range("opacity", "Glass density", 0, 1, 0.01)}
              {range("ior", "Refraction", 1, 2.5, 0.01)}
              {range("roughness", "Roughness", 0, 1, 0.01)}
              {range("thickness", "Optical thickness", 0.01, 1, 0.01)}
              {range("dispersion", "Spectral dispersion", 0, 0.2, 0.005)}
              {range("absorption", "Tint absorption", 0, 3, 0.05)}
              {range("studioLight", "Studio light", 0, 5, 0.05)}
              {range("defects", "Surface defects", 0, 1, 0.01)}
              {range("inclusions", "Bubbles & seeds", 0, 1, 0.01)}
            </>
          ) : (
            <>
              {range("emission", "Dot brightness", 0, 5, 0.05)}
              {range("pointSize", "Dot size", 0.5, 6, 0.1)}
              {range("opacity", "Dot opacity", 0, 1, 0.01)}
              <label className="object-color">
                Upper color
                <input
                  aria-label="Upper dot color"
                  type="color"
                  value={current.colorTop}
                  onChange={(e) => update("colorTop", e.target.value)}
                />
              </label>
              {range("gradient", "Height color blend", 0, 1, 0.01)}
              {range("flow", "Flow speed", 0, 2, 0.01)}
              {current.role === "layers" &&
                range("billow", "Terrain billow", 0, 0.2, 0.005)}
              {range("sparkles", "Sparkle accents", 0, 1, 0.01)}
            </>
          )}
          {["position", "rotation", "scale"].map((key) => (
            <div className="object-transform" key={key}>
              <span>
                {key === "position"
                  ? "Position"
                  : key === "rotation"
                    ? "Rotation · degrees"
                    : "Scale"}
              </span>
              <div>
                {["X", "Y", "Z"].map((axis, i) => (
                  <label key={axis}>
                    {axis}
                    <input
                      type="number"
                      aria-label={`${key} ${axis}`}
                      min={
                        key === "scale" ? 0.05 : key === "rotation" ? -360 : -4
                      }
                      max={key === "scale" ? 4 : key === "rotation" ? 360 : 4}
                      step={key === "rotation" ? 5 : 0.05}
                      value={current[key][i]}
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        const min =
                            key === "scale"
                              ? 0.05
                              : key === "rotation"
                                ? -360
                                : -4,
                          max = key === "rotation" ? 360 : 4;
                        update(
                          key,
                          current[key].map((v, j) =>
                            i === j
                              ? Math.max(min, Math.min(max, +e.target.value))
                              : v,
                          ),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="object-actions">
            <button
              disabled={objects.length >= MAX_OBJECTS}
              onClick={duplicate}
            >
              Duplicate object
            </button>
            <button
              onClick={() => {
                onChange(objects.filter((o) => o.id !== current.id));
                onSelect(objects.find((o) => o.id !== current.id)?.id || null);
                notify("Object removed. Undo restores it.");
              }}
            >
              Remove
            </button>
          </div>
        </fieldset>
      )}
      {!objects.length && (
        <div className="object-empty">
          <span>01 / CREATE</span>
          <p>Add a basic form or import your own model.</p>
          <span>02 / COMBINE</span>
          <p>
            Import a different mesh, or duplicate the first and change its
            material.
          </p>
          <span>03 / COMPOSE</span>
          <p>Scale, move, rotate, and tune each object independently.</p>
        </div>
      )}
    </section>
  );
}
