import { readStored, writeStored } from "./studio/storage.js";
import ObjectEditor from "./objects/Editor.jsx";
import SpeciesControls from "./studio/SpeciesControls.jsx";
import Library from "./studio/Library.jsx";
import MaterialControls from "./studio/MaterialControls.jsx";
import {
  materialPresets,
  materialBase,
  materialSections,
} from "./materials/catalog.js";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import Icon from "./Icons.jsx";
import NodeEditor from "./NodeEditor.jsx";
import { Engine } from "./engine.js";
import {
  defaults,
  controls,
  presets,
  palettes,
  defaultShader,
  initialGraph,
  resolveGraph,
  validateProject,
  download,
  lightRoles,
  lightKeys,
} from "./project.js";
import "./style.css";
const tools = [
  ["cursor", "Orbit", "1"],
  ["attract", "Gravity well", "G"],
  ["repel", "Repulsion", "R"],
  ["vortex", "Vortex", "V"],
  ["light", "Colored light", "L"],
  ["burst", "Shockwave", "B"],
  ["freeze", "Freeze field", "F"],
];
const sections = {
  particles: [
    ["Emission", ["count", "size", "spread", "life", "arms", "twist", "depth"]],
    [
      "Motion & forces",
      ["speed", "spin", "turbulence", "frequency", "drag", "gravity"],
    ],
    ["Interaction", ["fieldStrength", "fieldRadius", "lightIntensity"]],
    [
      "Light & atmosphere",
      ["trail", "bloom", "exposure", "hue", "grain", "vignette"],
    ],
    ["Camera", ["zoom", "tilt", "rotation", "autoRotate"]],
    ["Render quality", ["devScale", "showScale"]],
  ],
  orb: [
    [
      "Surface geometry",
      [
        "orbScale",
        "displacement",
        "detail",
        "orbMorph",
        "twist",
        "turbulence",
        "frequency",
      ],
    ],
    [
      "Material & interaction",
      ["roughness", "metallic", "ior", "reflection", "shadow"],
    ],
    ["Studio lighting", ["keyLight", "ambient", "bloom", "exposure", "hue"]],
    [
      "Camera & finish",
      ["speed", "zoom", "tilt", "rotation", "autoRotate", "grain", "vignette"],
    ],
    ["Render quality", ["devScale", "showScale"]],
  ],
};
const particleRecipes = [
  ...presets.map((p, i) => ({ ...p, id: `particle-${i}`, mode: "particles" })),
  {
    id: "species",
    mode: "particles",
    name: "Three-body weather",
    tag: "INTERACTING POPULATIONS",
    values: {
      speciesEnabled: 1,
      spin: 0.3,
      turbulence: 0.6,
      depth: 1.2,
      trail: 0.7,
    },
  },
];
function App() {
  const [objects, setObjects] = useState([]),
    [selectedObject, setSelectedObject] = useState(null),
    [particleContainer, setParticleContainer] = useState(null);
  const objectHistory = useRef([]);
  function changeObjects(next) {
    objectHistory.current = [...objectHistory.current.slice(-19), objects];
    setObjects(next);
    setDirty(true);
  }
  function undoObjects() {
    const previous = objectHistory.current.pop();
    if (previous) {
      setObjects(previous);
      setSelectedObject(previous[0]?.id || null);
      setDirty(true);
    }
  }

  const [saved, setSaved] = useState([]);
  useEffect(() => {
    let cancelled = false;
    readStored("collection")
      .then((items) => {
        if (!cancelled && Array.isArray(items))
          setSaved(
            items
              .filter(
                (i) =>
                  typeof i?.id === "string" &&
                  typeof i.preview === "string" &&
                  i.preview.startsWith("data:image/jpeg;") &&
                  typeof i.project?.name === "string" &&
                  i.project.name !== "Phosphor anatomy",
              )
              .slice(0, 16),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  async function collect() {
    if (saved.length >= 16) {
      notify(
        "Your collection is full. Export or remove a specimen before collecting another.",
      );
      return;
    }
    try {
      Object.assign(engine.current, {
        config: resolved.config,
        mode: resolved.mode,
      });
      engine.current.render(0);
      const thumb = document.createElement("canvas");
      thumb.width = 320;
      thumb.height = Math.round(
        (320 * canvas.current.height) / canvas.current.width,
      );
      thumb
        .getContext("2d")
        .drawImage(canvas.current, 0, 0, thumb.width, thumb.height);
      const preview = thumb.toDataURL("image/jpeg", 0.8);
      const next = [
        { id: crypto.randomUUID(), project: project(), preview },
        ...saved,
      ];
      await writeStored("collection", next);
      setSaved(next);
      notify("Specimen added to your collection.");
    } catch {
      notify("Collection storage is full. Save your project to disk.");
    }
  }
  async function deleteSpecimen(id) {
    if (!window.confirm("Remove this specimen from your local collection?"))
      return;
    const next = saved.filter((s) => s.id !== id);
    try {
      await writeStored("collection", next);
      setSaved(next);
    } catch {
      notify("Could not update collection.");
    }
  }
  const [config, setConfig] = useState({ ...defaults }),
    [mode, setMode] = useState("particles"),
    [preset, setPreset] = useState(0),
    [name, setName] = useState("Event horizon"),
    [graph, setGraph] = useState(structuredClone(initialGraph)),
    [shader, setShader] = useState(defaultShader),
    [compiled, setCompiled] = useState(defaultShader),
    [shaderError, setShaderError] = useState(""),
    [show, setShow] = useState(false),
    [paused, setPaused] = useState(false),
    [tool, setTool] = useState("attract"),
    [fields, setFields] = useState([]),
    [stats, setStats] = useState({
      fps: 0,
      width: 0,
      height: 0,
      time: 0,
      count: 0,
    }),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [tab, setTab] = useState("parameters"),
    [tip, setTip] = useState(null),
    [recording, setRecording] = useState(false),
    [recover, setRecover] = useState(null),
    [dirty, setDirty] = useState(false);
  const workspaces = useRef({});
  const tipTimer = useRef(),
    canvas = useRef(),
    engine = useRef(),
    file = useRef(),
    noticeTimer = useRef(),
    drag = useRef(),
    record = useRef(),
    recordTimer = useRef(),
    latest = useRef(),
    initial = useRef(true);
  latest.current = {
    config,
    objects,
    mode,
    graph,
    shader,
    compiled,
    fields,
    name,
    show,
    paused,
    tool,
    particleContainer,
  };
  const recipes = useMemo(
    () =>
      mode === "particles" || mode === "nodes"
        ? particleRecipes
        : mode === "glass"
          ? []
          : materialPresets.filter((p) => p.mode === mode),
    [mode],
  );
  const resolved = useMemo(() => {
    if (mode !== "nodes") return { mode, config, active: [] };
    try {
      return resolveGraph(graph, config);
    } catch {
      return { mode: "empty", config, active: [], invalid: true };
    }
  }, [mode, graph, config]);
  function notify(message) {
    setToast(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setToast(""), 4200);
  }
  function update(key, value) {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
  }
  function changeGraph(value) {
    setGraph(value);
    setDirty(true);
  }
  useEffect(() => {
    try {
      engine.current = new Engine(canvas.current, setStats, setError);
    } catch (e) {
      setError(e.message);
    }
    return () => {
      engine.current?.dispose();
      clearTimeout(noticeTimer.current);
      clearTimeout(recordTimer.current);
      if (record.current?.state === "recording") record.current.stop();
    };
  }, []);
  useEffect(() => {
    if (engine.current) {
      const shell = objects.find(
        (o) => o.id === particleContainer && o.role === "glass" && o.visible,
      );
      Object.assign(engine.current, {
        config: resolved.config,
        mode: resolved.mode,
        show,
        paused,
        fieldList: fields,
        objects,
        // Transforms track the shell live, so moving it carries the contents.
        container: shell
          ? {
              position: shell.position,
              rotation: shell.rotation,
              scale: shell.scale,
              containment: resolved.config.containment,
            }
          : null,
      });
    }
  }, [resolved, show, paused, fields, objects, particleContainer]);
  useEffect(() => {
    let cancelled = false;
    readStored("autosave")
      .then((stored) => {
        if (stored && !cancelled) {
          const p = validateProject(stored);
          if (p.name !== "Phosphor anatomy") setRecover(p);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement;
    const dialog = document.querySelector(".guide-modal");
    const buttons = [...dialog.querySelectorAll("button, a[href]")];
    buttons[0]?.focus();
    const trap = (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      buttons[
        (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      ]?.focus();
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [help]);
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    const id = setTimeout(() => {
      try {
        writeStored("autosave", project()).catch(() =>
          notify("Local autosave is unavailable. Save your project to disk."),
        );
      } catch {
        notify(
          "Local autosave is unavailable. Use Save project to keep your work.",
        );
      }
    }, 1500);
    return () => clearTimeout(id);
  }, [
    config,
    mode,
    graph,
    compiled,
    shader,
    fields,
    name,
    objects,
    particleContainer,
  ]);
  function project() {
    const s = latest.current;
    return {
      format: "boast-project",
      version: 1,
      name: s.name,
      mode: s.mode,
      config: s.config,
      objects: s.objects,
      shader: s.compiled,
      shaderDraft: s.shader,
      graph: s.graph,
      fields: s.fields.filter((f) => f.type !== "burst"),
      ...(s.particleContainer
        ? { particleContainer: s.particleContainer }
        : {}),
    };
  }
  // The occupancy grid is derived from the mesh, so projects store the shell's
  // id and rebuild the field on open rather than carrying a megabyte of voxels.
  function buildContainerField(list, id, nextConfig) {
    const shell = list.find((o) => o.id === id && o.role === "glass");
    if (!shell || !engine.current) {
      engine.current?.setContainer(null);
      return;
    }
    const w = new Worker(
      new URL("./objects/import.worker.js", import.meta.url),
      {
        type: "module",
      },
    );
    w.onmessage = ({ data: result }) => {
      w.terminate();
      if (result.error) {
        setParticleContainer(null);
        engine.current?.setContainer(null);
        notify(`Could not confine the simulation: ${result.error}`);
        return;
      }
      engine.current.container = {
        position: shell.position,
        rotation: shell.rotation,
        scale: shell.scale,
        containment: nextConfig.containment,
      };
      engine.current.setContainer(result.field, result.resolution);
      engine.current.reset(nextConfig);
    };
    w.onerror = () => {
      w.terminate();
      setParticleContainer(null);
      engine.current?.setContainer(null);
      notify("Could not prepare this enclosure for a simulation.");
    };
    w.postMessage({ triangles: shell.triangles, role: "field" });
  }
  function onSimulation(payload) {
    if (!payload) {
      setParticleContainer(null);
      engine.current?.setContainer(null);
      engine.current?.reset(latest.current.config);
      setDirty(true);
      notify("Enclosure emptied.");
      return;
    }
    const nextConfig = { ...latest.current.config, ...payload.config };
    setConfig(nextConfig);
    setParticleContainer(payload.container);
    setDirty(true);
    const shell = latest.current.objects.find(
      (o) => o.id === payload.container,
    );
    if (!shell || !engine.current) return;
    engine.current.container = {
      position: shell.position,
      rotation: shell.rotation,
      scale: shell.scale,
      containment: nextConfig.containment,
    };
    engine.current.setContainer(payload.field, payload.resolution);
    engine.current.reset(nextConfig);
  }
  function apply(data) {
    try {
      const p = validateProject(data);
      engine.current?.compile(p.shader);
      setCompiled(p.shader);
      setShader(p.shaderDraft ?? p.shader);
      setShaderError("");
      setConfig(p.config);
      setObjects(p.objects || []);
      setSelectedObject(p.objects?.[0]?.id || null);
      objectHistory.current = [];
      setMode(p.mode);
      setGraph(p.graph);
      setFields(p.fields);
      setName(p.name);
      setPreset(-1);
      setDirty(false);
      setParticleContainer(p.particleContainer ?? null);
      engine.current?.setContainer(null);
      engine.current?.reset(p.config);
      if (p.particleContainer)
        buildContainerField(p.objects || [], p.particleContainer, p.config);
      setRecover(null);
      notify("Project restored.");
    } catch (e) {
      notify(`Could not load project: ${e.message}`);
    }
  }
  function save() {
    download(
      new Blob([JSON.stringify(project(), null, 2)], {
        type: "application/json",
      }),
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled"}.boast.json`,
    );
    setDirty(false);
    notify("Project saved to your downloads.");
  }
  async function load(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 96 * 1024 * 1024) {
      notify("Project is too large. Maximum file size is 96 MB.");
      return;
    }
    try {
      apply(JSON.parse(await f.text()));
    } catch {
      notify("Could not read that JSON project.");
    }
  }
  function reset() {
    engine.current?.reset(latest.current.config);
    setFields([]);
    notify("Simulation restarted. Fields cleared.");
  }
  function compile() {
    try {
      engine.current?.compile(shader);
      update("family", 0);
      setCompiled(shader);
      setShaderError("");
      setDirty(true);
      notify("Shader compiled successfully.");
    } catch (e) {
      setShaderError(e.message);
      notify("Compile failed. The last working shader is still running.");
    }
  }
  async function capture() {
    try {
      const blob = await engine.current.capture();
      download(blob, `boast-${Date.now()}.png`);
      notify("High-resolution PNG saved.");
    } catch (e) {
      notify(e.message);
    }
  }
  function toggleRecord() {
    if (record.current?.state === "recording") {
      record.current.stop();
      return;
    }
    if (!window.MediaRecorder || !canvas.current.captureStream) {
      notify(
        "Video recording is not supported in this browser. Use PNG export.",
      );
      return;
    }
    const mime = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/mp4",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) {
      notify("No supported video encoder. Try Chrome.");
      return;
    }
    try {
      const stream = canvas.current.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 12000000,
      });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        clearTimeout(recordTimer.current);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        download(
          new Blob(chunks, { type: mime }),
          `boast-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`,
        );
        notify("Recording saved.");
      };
      recorder.onerror = () => {
        clearTimeout(recordTimer.current);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        notify("Recording failed. Try a lower resolution.");
      };
      record.current = recorder;
      recorder.start(1000);
      setRecording(true);
      recordTimer.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30000);
      notify("Recording up to 30 seconds. Press C or click Record to stop.");
    } catch (e) {
      notify(`Recording failed: ${e.message}`);
    }
  }
  useEffect(() => {
    function key(e) {
      if (e.target.closest("input,textarea,select,[contenteditable]")) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === "escape") {
        setShow(false);
        setHelp(false);
        setTip(null);
        return;
      }
      if (k === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (k === "s") setShow((s) => !s);
      else if (k === "c") toggleRecord();
      else if (k === "p") capture();
      else if (k === "x") {
        setFields([]);
        notify("All fields cleared.");
      } else if (k === "?") setHelp((h) => !h);
      else {
        const found = tools.find((t) => t[2].toLowerCase() === k);
        if (found) {
          setTool(found[0]);
          notify(`${found[1]} tool selected.`);
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function stageDown(e) {
    if (e.button !== 0) return;
    if (tool === "cursor" || resolved.mode !== "particles") {
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        rotation: config.rotation,
        tilt: config.tilt,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (fields.length >= 12) {
      notify("The stage holds 12 fields. Remove one or press X to clear.");
      return;
    }
    const rect = canvas.current.getBoundingClientRect();
    const f = {
      id: crypto.randomUUID(),
      type: tool,
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: 1 - ((e.clientY - rect.top) / rect.height) * 2,
      strength:
        (tool === "light" ? config.lightIntensity : config.fieldStrength) *
        (e.shiftKey ? 2 : 1),
      radius: config.fieldRadius,
      color: config.lightColor,
    };
    setFields((fs) => [...fs, f]);
    setDirty(true);
    if (tool === "burst")
      setTimeout(() => setFields((fs) => fs.filter((v) => v.id !== f.id)), 650);
  }
  function stageMove(e) {
    if (!drag.current) return;
    update(
      "rotation",
      Math.max(
        -3.14,
        Math.min(
          3.14,
          drag.current.rotation + (e.clientX - drag.current.x) * 0.005,
        ),
      ),
    );
    update(
      "tilt",
      Math.max(
        0,
        Math.min(1.5, drag.current.tilt + (e.clientY - drag.current.y) * 0.005),
      ),
    );
  }
  function switchMode(next) {
    if (next === mode) return;
    workspaces.current[mode] = { config, name, fields };
    const stored = workspaces.current[next];
    if (stored) {
      setConfig(stored.config);
      setName(stored.name);
      setFields(stored.fields);
    } else if (next === "orb" || next === "glass") {
      const recipe = materialPresets.find((p) => p.mode === next) || {
        name: "Untitled composition",
        values: {},
      };
      setConfig({ ...defaults, ...materialBase, ...recipe.values });
      setName(next === "glass" ? "Untitled composition" : recipe.name);
      setFields([]);
    } else if (next === "particles") {
      setConfig({ ...defaults });
      setName("Event horizon");
      setFields([]);
    }
    setMode(next);
    setTab("parameters");
    setTip(null);
    setDirty(true);
    engine.current?.clear();
  }
  function control(key) {
    const p =
        key === "reflection" && (resolved.mode === "glass" || config.family > 0)
          ? ["Studio reflections", ...controls[key].slice(1)]
          : controls[key],
      v = config[key];
    if (resolved.mode === "glass") {
      if (key === "branchDetail" && config.interior !== 0) return null;
      if (
        ["materialScale", "materialFold"].includes(key) &&
        config.interior !== 2
      )
        return null;
    }
    if (resolved.mode === "orb" && config.family > 0) {
      const relevant =
        config.family === 1 || config.family === 4
          ? [
              "materialScale",
              "materialFold",
              "interiorMotion",
              "emission",
              ...(config.family === 4 ? ["reflection"] : []),
            ]
          : config.family === 2
            ? [
                "materialScale",
                "surfaceActivity",
                "emission",
                "reactionFeed",
                "reactionKill",
              ]
            : [
                "materialScale",
                "materialFold",
                "interiorMotion",
                "roughness",
                "reflection",
              ];
      if (
        [
          "materialScale",
          "materialFold",
          "surfaceActivity",
          "interiorMotion",
          "emission",
          "reactionFeed",
          "reactionKill",
          "roughness",
          "reflection",
        ].includes(key) &&
        !relevant.includes(key)
      )
        return null;
    }
    return (
      <div className="control" key={key}>
        <div className="control-label">
          <button
            onMouseEnter={() => {
              clearTimeout(tipTimer.current);
              setTip(key);
            }}
            onMouseLeave={() => {
              tipTimer.current = setTimeout(() => setTip(null), 250);
            }}
            onFocus={() => setTip(key)}
            onBlur={() => {
              tipTimer.current = setTimeout(() => setTip(null), 250);
            }}
            onClick={() => setTip((t) => (t === key ? null : key))}
            aria-label={`Learn about ${p[0]}`}
          >
            {p[0]}
            <span>?</span>
          </button>
          <input
            aria-label={`${p[0]} value`}
            type="number"
            min={p[1]}
            max={p[2]}
            step={p[3]}
            value={v}
            onChange={(e) => {
              if (e.target.value !== "")
                update(key, Math.max(p[1], Math.min(p[2], +e.target.value)));
            }}
          />
        </div>
        <input
          aria-label={p[0]}
          type="range"
          min={p[1]}
          max={p[2]}
          step={p[3]}
          value={v}
          style={{ "--fill": `${((v - p[1]) / (p[2] - p[1])) * 100}%` }}
          onChange={(e) => update(key, +e.target.value)}
        />
      </div>
    );
  }
  const minutes = String(Math.floor(stats.time / 60)).padStart(2, "0"),
    seconds = String(Math.floor(stats.time % 60)).padStart(2, "0");
  return (
    <div className={`app ${show ? "show-mode" : ""} mode-${mode}`}>
      {show && (
        <button
          className="show-exit"
          aria-label="Exit show mode"
          title="Exit show mode · Esc"
          onClick={() => setShow(false)}
        >
          <Icon name="close" size={18} />
          <span>Back to studio</span>
        </button>
      )}
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            notify("BOAST · Light laboratory");
          }}
        >
          <span className="brand-mark">✳</span>BOAST
          <span className="brand-divider" />
          <small>LIGHT LABORATORY</small>
        </a>
        <nav aria-label="Workspaces">
          {[
            ["particles", "Particle playground", "particles"],
            ["orb", "Orb shaders", "orb"],
            ["glass", "Glass objects", "orb"],
            ["nodes", "Node composer", "nodes"],
          ].map(([m, label, icon]) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
            >
              <Icon name={icon} size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button
            title="Load project from disk"
            onClick={() => file.current.click()}
          >
            <Icon name="folder" />
            Open
          </button>
          <button title="Save project · ⌘/Ctrl S" onClick={save}>
            <Icon name="save" />
            Save
          </button>
          <button
            className="show-button"
            onClick={() => {
              setShow(true);
              notify("Show mode · S or Esc to return · C records · P captures");
            }}
          >
            <Icon name="play" size={14} />
            Show mode<kbd>S</kbd>
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="library" key={`library-${mode}`}>
          <Library
            kind={mode}
            recipes={recipes}
            saved={saved}
            onSave={collect}
            onLoad={apply}
            onDelete={deleteSpecimen}
            onChoose={(r) => {
              const c = {
                ...defaults,
                ...(r.mode === "particles" ? {} : materialBase),
                ...r.values,
              };
              setConfig(c);
              setMode(r.mode);
              setName(r.name);
              setPreset(-1);
              setFields([]);
              setDirty(true);
              engine.current?.reset(c);
            }}
          />
          <button className="guide-button" onClick={() => setHelp(true)}>
            <Icon name="help" size={15} />
            Field guide
            <Icon name="arrow" size={14} />
          </button>
        </aside>
        <main className="main">
          <div className="stage-heading">
            <div>
              <span className="eyebrow">
                {mode === "glass"
                  ? "ENCLOSURES / INNER WORLDS"
                  : mode === "orb"
                    ? "MATERIAL EXPLORATION"
                    : mode === "nodes"
                      ? "COMPOSE THE UNEXPECTED"
                      : "REAL-TIME PARTICLE SYSTEM"}
              </span>
              <div className="project-title">
                <input
                  aria-label="Project name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                />
                <span
                  className="unsaved"
                  title={dirty ? "Unsaved changes" : "Project saved"}
                >
                  {dirty ? "EDITED" : "EXPERIMENT 001"}
                </span>
              </div>
            </div>
            <button
              className="icon-button"
              aria-label="Export high-resolution PNG"
              title="Export high-resolution PNG · P"
              onClick={capture}
            >
              <Icon name="camera" />
            </button>
          </div>
          <div className="stage" data-testid="stage">
            <canvas
              ref={canvas}
              aria-label={
                resolved.mode === "orb"
                  ? "Interactive ray-marched orb preview"
                  : resolved.mode === "particles"
                    ? "Interactive particle visualization"
                    : "Interactive material visualization"
              }
              onPointerDown={stageDown}
              onPointerMove={stageMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) =>
                update(
                  "zoom",
                  Math.max(0.5, Math.min(2, config.zoom - e.deltaY * 0.001)),
                )
              }
            />
            {!show && (
              <>
                <div className="stage-corner">
                  <span className="live-dot" />
                  {paused ? "PAUSED" : "LIVE RENDER"}
                  <span className="renderer-type">WEBGL 2</span>
                </div>
                <div className="stage-top-right">
                  {resolved.mode === "orb"
                    ? config.family === 0
                      ? "SDF / CUSTOM SURFACE"
                      : "GPU / MATERIAL FAMILY"
                    : resolved.mode === "particles"
                      ? "GPU / TRANSFORM FEEDBACK"
                      : "GPU / VOLUMETRIC MATERIAL"}
                </div>
                <div className="stage-bottom-left">
                  <span className="axis-mark">
                    ↗<i>Y</i>└<i>X</i>
                  </span>
                  <span>
                    PERSPECTIVE <b>0{preset + 1 || 1}</b>
                  </span>
                </div>
                <div className="stage-bottom-right">
                  <span className="live-dot" />
                  {stats.fps} FPS <span>·</span> {stats.width} × {stats.height}
                </div>
                {(resolved.mode === "particles" ? fields : []).map((f) => (
                  <button
                    className={`field-marker field-${f.type}`}
                    key={f.id}
                    aria-label={`Remove ${f.type} field`}
                    title={`Remove ${f.type} · strength ${f.strength.toFixed(1)}`}
                    onClick={() =>
                      setFields((fs) => fs.filter((v) => v.id !== f.id))
                    }
                    style={{
                      left: `${(f.x + 1) * 50}%`,
                      top: `${(1 - f.y) * 50}%`,
                      "--field-color": f.color,
                    }}
                  >
                    <Icon name={f.type} size={15} />
                    <span>{f.strength.toFixed(1)}</span>
                  </button>
                ))}
                <div className="stage-crosshair cross-a" />
                <div className="stage-crosshair cross-b" />
                {!fields.length && mode === "particles" && (
                  <div className="stage-hint">
                    <span>YOUR CANVAS. YOUR PHYSICS.</span>Click to place a{" "}
                    {tools.find((t) => t[0] === tool)?.[1].toLowerCase()}
                    <small>Hold Shift for twice the force</small>
                  </div>
                )}
              </>
            )}
            {resolved.mode === "glass" && !objects.length && !show && (
              <div className="mesh-stage-empty">
                <span>OBJECT COMPOSITION</span>
                <h2>Choose a form. Make it yours.</h2>
                <p>
                  Add a glass orb or cylinder, or import an OBJ or STL mesh.
                  <br />
                  Turn it into glass, surface dots, or a filled dot volume.
                </p>
              </div>
            )}
            {error && (
              <div className="render-error" role="alert">
                <Icon name="help" size={30} />
                <h2>The renderer needs attention</h2>
                <p>{error}</p>
                <button onClick={save}>Save project before reloading</button>
              </div>
            )}
          </div>
          {mode === "nodes" && !show && (
            <NodeEditor
              graph={graph}
              onChange={changeGraph}
              config={config}
              notify={notify}
            />
          )}
          <div className="interaction-bar">
            <div className="tool-label">
              <span>MAKE AN IMPACT</span>
              <small>
                {resolved.mode !== "particles"
                  ? "Drag to explore the object"
                  : "Select a tool, then click the canvas"}
              </small>
            </div>
            <div className="tools">
              {tools.map(([id, label, key]) => (
                <button
                  key={id}
                  disabled={resolved.mode !== "particles" && id !== "cursor"}
                  className={tool === id ? "selected" : ""}
                  title={`${label} · ${key}`}
                  aria-label={label}
                  onClick={() => setTool(id)}
                >
                  <Icon name={id} size={19} />
                  <kbd>{key}</kbd>
                </button>
              ))}
            </div>
            <button
              className="clear-fields"
              title="Clear fields · X"
              aria-label="Clear fields"
              onClick={() => setFields([])}
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
          <div className="transport">
            <div className="transport-controls">
              <button
                className="play-control"
                title="Play / Pause · Space"
                aria-label={paused ? "Play" : "Pause"}
                onClick={() => setPaused((p) => !p)}
              >
                <Icon name={paused ? "play" : "pause"} size={15} />
              </button>
              <button
                className="icon-button"
                title="Restart simulation and clear fields"
                aria-label="Reseed"
                onClick={reset}
              >
                <Icon name="reset" size={16} />
              </button>
              <span className="timecode">
                {minutes}:{seconds}
                <small>
                  .{String(Math.floor((stats.time % 1) * 100)).padStart(2, "0")}
                </small>
              </span>
            </div>
            <div className="timeline">
              <i style={{ left: `${((stats.time % 30) / 30) * 100}%` }} />
              {Array.from({ length: 31 }, (_, i) => (
                <span key={i} className={i % 5 === 0 ? "major" : ""} />
              ))}
            </div>
            <div className="transport-end">
              <span>
                {resolved.mode !== "particles"
                  ? "MATERIAL / LIVE"
                  : `${Math.round(config.count / 1000)}K PARTICLES`}
              </span>
              <button
                className={recording ? "recording" : ""}
                onClick={toggleRecord}
              >
                <Icon name="record" size={13} />
                {recording ? "Stop" : "Record"}
              </button>
            </div>
          </div>
        </main>
        <aside className="inspector">
          <div className="inspector-head">
            <span>THE DETAILS</span>
            <Icon name="particles" size={16} />
          </div>
          <div className="inspector-tabs">
            <button
              className={tab === "parameters" ? "active" : ""}
              onClick={() => setTab("parameters")}
            >
              Parameters
            </button>
            <button
              className={tab === "code" ? "active" : ""}
              onClick={() => setTab("code")}
            >
              <Icon name="code" size={14} />
              {resolved.mode === "orb" ? "GLSL editor" : "Scene data"}
            </button>
          </div>
          {tab === "parameters" ? (
            <div className="parameter-scroll">
              <div className="palette-section">
                <div className="section-caption">
                  COLOR STORY <span>{palettes[config.palette].name}</span>
                </div>
                <div className="palette-swatches">
                  {palettes.map((p, i) => (
                    <button
                      key={p.name}
                      aria-label={`${p.name} palette`}
                      title={p.name}
                      className={config.palette === i ? "active" : ""}
                      style={{
                        background: `linear-gradient(130deg,${p.colors.join(",")})`,
                      }}
                      onClick={() => update("palette", i)}
                    >
                      {config.palette === i && <Icon name="check" size={14} />}
                    </button>
                  ))}
                </div>
                <div
                  className="gradient-preview"
                  style={{
                    background: `linear-gradient(90deg,${palettes[config.palette].colors.join(",")})`,
                  }}
                />
                <div className="gradient-labels">
                  <span>SHADOW</span>
                  <span>HIGHLIGHT</span>
                </div>
              </div>
              {resolved.mode === "particles" && (
                <SpeciesControls
                  config={config}
                  update={update}
                  control={control}
                />
              )}
              {resolved.mode === "glass" && (
                <>
                  <ObjectEditor
                    objects={objects}
                    onChange={changeObjects}
                    selected={selectedObject}
                    onSelect={setSelectedObject}
                    notify={notify}
                    particleContainer={particleContainer}
                    onSimulation={onSimulation}
                  />
                  <button
                    className="object-undo"
                    disabled={!objectHistory.current.length}
                    onClick={undoObjects}
                  >
                    Undo object change
                  </button>
                </>
              )}
              {resolved.mode === "orb" && (
                <MaterialControls
                  mode={resolved.mode}
                  config={config}
                  update={update}
                  onCollect={collect}
                  onStart={() => {
                    setConfig((c) => ({
                      ...c,
                      ...materialBase,
                      family: 4,
                      materialScale: 3.2,
                      materialFold: 0.65,
                      emission: 1.5,
                    }));
                    setName("Untitled shader family");
                    setDirty(true);
                  }}
                />
              )}
              {(resolved.mode === "glass"
                ? [
                    ["Camera", ["zoom", "tilt", "rotation", "autoRotate"]],
                    [
                      "Studio & finish",
                      [
                        "backdrop",
                        "stageFloor",
                        "stageRoughness",
                        "bloom",
                        "exposure",
                        "grain",
                        "vignette",
                      ],
                    ],
                    ...lightRoles.map(([id, label]) => [
                      `${label} light`,
                      lightKeys[id],
                    ]),
                    ...(particleContainer
                      ? [
                          [
                            "Contained simulation",
                            [
                              "containment",
                              "count",
                              "size",
                              "speed",
                              "turbulence",
                              "drag",
                              "spin",
                              "gravity",
                              "spread",
                              "frequency",
                              "life",
                              "trail",
                            ],
                          ],
                        ]
                      : []),
                    ["Render quality", ["devScale", "showScale"]],
                  ]
                : resolved.mode === "orb" && config.family > 0
                  ? materialSections.orb
                  : sections[resolved.mode === "orb" ? "orb" : "particles"]
              ).map(([title, keys], i) => (
                <details key={title} open={i < 2}>
                  <summary>
                    <span>{title}</span>
                    <Icon name="down" size={13} />
                  </summary>
                  <div className="section-controls">
                    {keys.map(control)}
                    {title === "Interaction" && (
                      <label className="color-picker">
                        Light color
                        <input
                          type="color"
                          value={config.lightColor}
                          onChange={(e) => update("lightColor", e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                </details>
              ))}
              <details>
                <summary>
                  <span>Placed fields</span>
                  <span>{fields.length}/12</span>
                </summary>
                <div className="field-list">
                  {fields.length ? (
                    fields.map((f) => (
                      <div key={f.id}>
                        <label>
                          {f.type}
                          <input
                            aria-label={`${f.type} strength`}
                            type="number"
                            min="0.1"
                            max="12"
                            step="0.1"
                            value={f.strength}
                            onChange={(e) => {
                              if (e.target.value)
                                setFields((fs) =>
                                  fs.map((v) =>
                                    v.id === f.id
                                      ? {
                                          ...v,
                                          strength: Math.max(
                                            0.1,
                                            Math.min(12, +e.target.value),
                                          ),
                                        }
                                      : v,
                                  ),
                                );
                            }}
                          />
                        </label>
                        <button
                          aria-label={`Delete ${f.type}`}
                          onClick={() =>
                            setFields((fs) => fs.filter((v) => v.id !== f.id))
                          }
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No fields yet. Click the stage to add one.</p>
                  )}
                </div>
              </details>
              <div className="inspector-note">
                <span className="live-dot" />
                Changes happen in real time.
                <br />
                <span>Hover a parameter to get to know it.</span>
              </div>
            </div>
          ) : (
            <div className="code-panel">
              {resolved.mode === "orb" ? (
                <>
                  {config.family > 0 && (
                    <p className="family-code-note">
                      This editor is the Custom GLSL surface. Compiling switches
                      to that family; the built-in material keeps its own
                      renderer.
                    </p>
                  )}
                  <div className="code-intro">
                    <span>surface.glsl</span>
                    <span
                      className={shader === compiled ? "success" : "warning"}
                    >
                      {shader === compiled ? "COMPILED" : "MODIFIED"}
                    </span>
                  </div>
                  <p>
                    Define <code>shape(p)</code> and <code>pigment(p, n)</code>.
                    Geometry, normals, shadows, and reflections share your
                    surface.
                  </p>
                  <textarea
                    spellCheck="false"
                    aria-label="GLSL shader source"
                    value={shader}
                    maxLength={20000}
                    onChange={(e) => {
                      setShader(e.target.value);
                      setDirty(true);
                    }}
                  />
                  {shaderError && (
                    <pre className="shader-error" role="alert">
                      {shaderError}
                    </pre>
                  )}
                  <button className="primary-button" onClick={compile}>
                    <Icon name="play" size={13} />
                    Compile shader
                  </button>
                  <div className="code-actions">
                    <button
                      onClick={() =>
                        download(
                          new Blob([shader], { type: "text/plain" }),
                          "surface.glsl",
                        )
                      }
                    >
                      Export .glsl
                    </button>
                    <button
                      onClick={() => {
                        setShader(defaultShader);
                        notify(
                          "Starter source restored in editor. Compile to apply.",
                        );
                      }}
                    >
                      Reset source
                    </button>
                  </div>
                  <p>
                    Uniforms: uTime, uMorph, uRadius, uDisplace, uDetail,
                    uColorA/B/C. Keep the distance field conservative for stable
                    ray marching.
                  </p>
                </>
              ) : (
                <>
                  <div className="code-intro">
                    <span>scene.json</span>
                    <span className="success">LIVE</span>
                  </div>
                  <p>
                    These values drive the GPU simulation. Use the controls to
                    edit; save the full project to preserve your graph and
                    shader.
                  </p>
                  <pre className="scene-code">
                    {JSON.stringify(config, null, 2)}
                  </pre>
                  <button className="primary-button" onClick={save}>
                    <Icon name="download" size={14} />
                    Export project
                  </button>
                </>
              )}
            </div>
          )}
          <div className="inspector-footer">
            <span>DEVELOPMENT QUALITY</span>
            <b>{Math.round(config.devScale * 100)}%</b>
          </div>
        </aside>
      </div>
      <footer className="statusbar">
        <span>
          <i />
          All systems luminous
        </span>
        <span>
          LOCAL FIRST <b>·</b> GPU POWERED <b>·</b> BUILT TO EXPERIMENT
        </span>
        <button onClick={() => setHelp(true)}>
          Keyboard shortcuts <kbd>?</kbd>
        </button>
      </footer>
      <input
        type="file"
        accept=".json,.boast.json,application/json"
        ref={file}
        onChange={load}
        hidden
      />
      {tip && !show && (
        <div
          className="parameter-tooltip"
          role="tooltip"
          onMouseEnter={() => clearTimeout(tipTimer.current)}
          onMouseLeave={() => setTip(null)}
        >
          <span>PARAMETER FIELD NOTE</span>
          <h3>{controls[tip][0]}</h3>
          <p>{controls[tip][4]}</p>
          <small>EXPLORE FURTHER</small>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(controls[tip][5])}`}
            target="_blank"
            rel="noreferrer"
          >
            {controls[tip][5]} ↗
          </a>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {recover && !show && (
        <div className="recovery">
          <Icon name="save" />
          <div>
            <b>Pick up where you left off?</b>
            <span>Local autosave: {recover.name}</span>
          </div>
          <button onClick={() => apply(recover)}>Restore</button>
          <button
            aria-label="Dismiss autosave recovery"
            onClick={() => setRecover(null)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Field guide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close field guide"
              onClick={() => setHelp(false)}
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">THE BOAST FIELD GUIDE</span>
            <h1>Play is the whole point.</h1>
            <p>Choose a scene. Bend its physics. Make it yours.</p>
            <div className="guide-grid">
              <div>
                <h3>Leave a mark</h3>
                {tools.map(([icon, label, key]) => (
                  <div className="shortcut" key={key}>
                    <Icon name={icon} size={16} />
                    <span>{label}</span>
                    <kbd>{key}</kbd>
                  </div>
                ))}
                <small>
                  Shift + click doubles force. Scroll to zoom.
                  <br />
                  Click a field marker to remove it. X clears all.
                </small>
              </div>
              <div>
                <h3>Take the stage</h3>
                {[
                  ["Show mode / exit", "S / Esc"],
                  ["Pause / play", "Space"],
                  ["High-res PNG", "P"],
                  ["Record / stop (30s max)", "C"],
                  ["Save to disk", "⌘/Ctrl S"],
                  ["Open this guide", "?"],
                ].map(([l, k]) => (
                  <div className="shortcut" key={k}>
                    <span>{l}</span>
                    <kbd>{k}</kbd>
                  </div>
                ))}
                <small>
                  Show mode hides every panel, increases resolution, and raises
                  material sampling quality. Keyboard shortcuts still work.
                </small>
              </div>
            </div>
            <div className="guide-bottom">
              <h3>Four ways to make something extraordinary.</h3>
              <p>
                <b>Particles</b> · Sculpt a living cloud with forces and light.
                <br />
                <b>Orb shaders</b> · Explore iridescent volumes, evolving
                surface chemistry, reflective metal, or a custom GLSL surface.
                <br />
                <b>Glass objects</b> · Import OBJ or STL meshes and combine
                independent glass shells, surface dots, and filled dot volumes.
                <br />
                <b>Node composer</b> · Connect a source through motion, color,
                and bloom to the output. Disconnected nodes don’t affect the
                scene.
              </p>
              <p>
                Projects are saved as portable JSON files. A local autosave
                offers recovery on your next visit. PNG exports use a 3840 px
                wide canvas when supported; video uses the current render
                resolution.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
