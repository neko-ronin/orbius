import {
  readStored,
  writeStored,
  writeProject,
  listProjects,
  readProject,
} from "./studio/storage.js";
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
import Control from "./studio/Control.jsx";
import CodeEditor from "./studio/CodeEditor.jsx";
import {
  parseControls,
  resolveFamilies,
  sourceOffset,
  contracts,
  MAX_GLSL,
} from "./materials/families.js";
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
  viewProject,
  viewUnproject,
  viewAxis,
  fieldCoordinate,
  FIELD_EXTENT,
} from "./project.js";
import { authorMessage } from "./shaders.js";
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
// Field-note entries for the persistence trio, so hovering Save, Open or Collect
// explains the document-vs-bookmark split the same way every slider explains
// itself. Shape matches a parameter entry; the card reads label, note, terms.
const persistenceNotes = {
  open: [
    "Open project",
    0,
    1,
    1,
    "Loads a saved composition — from the saves folder while developing, or any .orbius.json file from disk when deployed. The current scene stays put until the file validates.",
    "orbius open project saves folder",
  ],
  save: [
    "Save project",
    0,
    1,
    1,
    "Writes this composition as a portable .orbius.json file — ⌘/Ctrl S — to the saves folder while developing, to your downloads when deployed. This is the durable copy; the collection below holds bookmarks, not files.",
    "orbius save project portable file",
  ],
  collect: [
    "Collect specimen",
    0,
    1,
    1,
    "Bookmarks this moment with a thumbnail into your on-device collection (16 max) for quick revisits. Handy, but not a file — Save above for the durable copy that survives a cleared browser.",
    "orbius collection specimens bookmarks",
  ],
  reset: [
    "Reset",
    0,
    1,
    1,
    "Blank slate in this workspace — H. Settings return to entry values; fields, objects, shader and graph edits are cleared. The mode stays put, so this replaces a browser refresh. Asks first.",
    "orbius reset workspace blank slate",
  ],
};
// A marker follows its field through the scene, so it moves on every frame the
// camera does, autorotate included, and is written to directly rather than through
// a React render. Nearer is larger; behind the eye there is nothing to click.
function placeMarker(el, position, view) {
  const [x, y, depth] = viewProject(position, view);
  el.style.left = `${(x + 1) * 50}%`;
  el.style.top = `${(1 - y) * 50}%`;
  el.style.transform = `translate(-50%, -50%) scale(${Math.min(1.6, Math.max(0.6, view.eye / depth))})`;
  el.hidden = depth < 1;
}
// A line through scene points as a path in the guide overlay's -1..1 box. A point
// behind the eye breaks the line rather than folding it back across the screen.
function trace(points, view) {
  let d = "",
    open = false;
  for (const p of points) {
    const [x, y, depth] = viewProject(p, view);
    if (depth < 1) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${x.toFixed(4)} ${(-y).toFixed(4)}`;
    open = true;
  }
  return d;
}
const steps = (n, from, to) =>
  Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
// The plane the particle disc lies in, through the centre, at half-unit spacing.
const gridLines = steps(11, -2.5, 2.5).flatMap((a) => [
  steps(11, -2.5, 2.5).map((b) => [a, 0, b]),
  steps(11, -2.5, 2.5).map((b) => [b, 0, a]),
]);
const ring = steps(9, 0, Math.PI * 2).map((a) => [
  Math.cos(a) * 0.08,
  0,
  Math.sin(a) * 0.08,
]);
const axes = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
// Depth cues, redrawn with the markers every frame. The plane and its axes show
// while placing or dragging; each point field drops a line to the plane with a ring
// where it lands, a vortex shows the axis it turns about, and a column is drawn
// as the line it is.
function drawGuides(svg, fields, view, placing) {
  if (!svg) return;
  const path = (name, d) =>
    svg.querySelector(`.guide-${name}`).setAttribute("d", d);
  path(
    "grid",
    placing ? gridLines.map((line) => trace(line, view)).join("") : "",
  );
  for (const [name, axis] of Object.entries(axes))
    path(name, placing ? trace([[0, 0, 0], axis], view) : "");
  const along = (f, from, to, n) =>
    steps(n, from, to).map((t) => f.position.map((v, i) => v + f.axis[i] * t));
  path(
    "drops",
    fields
      .filter((f) => f.reach === "point")
      .map((f) => {
        const [x, y, z] = f.position;
        return (
          trace([f.position, [x, 0, z]], view) +
          trace(
            ring.map(([u, , w]) => [x + u, 0, z + w]),
            view,
          ) +
          (f.type === "vortex" ? trace(along(f, -0.4, 0.4, 2), view) : "")
        );
      })
      .join(""),
  );
  path(
    "columns",
    fields
      .filter((f) => f.reach === "column")
      .map((f) => trace(along(f, -3, 3, 13), view))
      .join(""),
  );
}
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
        registry,
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
    } catch (e) {
      // This used to blame storage for every failure — a thrown render, a missing
      // canvas, a bad thumbnail all reported "storage is full", which is how a
      // working save comes to look like a broken one.
      notify(`Could not collect this specimen: ${e.message}`);
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
    // The field the canvas click selected. A click near a placed field selects
    // it instead of placing a new one, whatever tool is armed, and the floating
    // card beside the stage edits it — no trip to the bottom of the inspector.
    [selectedFieldId, setSelectedFieldId] = useState(null),
    [stats, setStats] = useState({
      fps: 0,
      gpu: null,
      width: 0,
      height: 0,
      time: 0,
      count: 0,
    }),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [tab, setTab] = useState("parameters"),
    [tipEntry, setTipEntry] = useState(null),
    [recording, setRecording] = useState(false),
    [recover, setRecover] = useState(null),
    [browsing, setBrowsing] = useState(null),
    [families, setFamilies] = useState([]),
    [dirty, setDirty] = useState(false);
  // Built-ins plus whatever this project authored. Everything that looks a family up
  // goes through here, so an authored one is indistinguishable from a shipped one.
  const registry = useMemo(() => resolveFamilies(families), [families]);
  // The editor edits whichever authored family is selected, and falls back to the
  // custom surface. A built-in has to be duplicated first — editing a shipped family
  // in place would leave a project that renders differently from an identical one.
  const editing = families.find((f) => f.id === config.family) ?? null;
  const familyError =
    editing && stats.familyError?.id === editing.id
      ? authorMessage(stats.familyError.message, sourceOffset(editing))
      : null;
  const errorLine = (message) => {
    const m = /^Line (\d+)/.exec(message || "");
    return m ? +m[1] : null;
  };
  const workspaces = useRef({});
  const tipTimer = useRef();
  // Every panel opens the same field-note card, so the handlers live once here and
  // travel to whichever slider asks — including panels with their own parameter
  // tables. The leave delay is what lets you reach the card to follow its link.
  const tip = useRef({
    show: (id, entry) => {
      clearTimeout(tipTimer.current);
      setTipEntry({ id, entry });
    },
    hide: () => {
      tipTimer.current = setTimeout(() => setTipEntry(null), 250);
    },
    toggle: (id, entry) =>
      setTipEntry((t) => (t?.id === id ? null : { id, entry })),
  }).current;
  const canvas = useRef(),
    engine = useRef(),
    file = useRef(),
    noticeTimer = useRef(),
    drag = useRef(),
    markers = useRef(new Map()),
    guides = useRef(),
    fieldDrag = useRef(),
    record = useRef(),
    recordTimer = useRef(),
    latest = useRef(),
    initial = useRef(true),
    // Armed once the pointer enters the floating field card; leaving after that
    // dismisses it. A card that was never entered stays put.
    cardEntered = useRef(false);
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  // A removed field cannot stay selected — clearing, deleting, or a burst
  // expiring drops the card with it.
  useEffect(() => {
    if (selectedFieldId && !fields.some((f) => f.id === selectedFieldId))
      setSelectedFieldId(null);
  }, [fields, selectedFieldId]);
  // A fresh selection starts un-entered, so the enter-then-exit rule applies per
  // opening rather than leaking across selections.
  useEffect(() => {
    cardEntered.current = false;
  }, [selectedFieldId]);
  latest.current = {
    config,
    objects,
    families,
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
      engine.current = new Engine(canvas.current, setStats, (message) => {
        setError(message);
        // The message promises the last autosave, and the autosave is debounced by
        // a second and a half. Write it now so the promise is true for the work
        // that was on screen when the context went.
        writeStored("autosave", project()).catch(() => {});
      });
      engine.current.onFrame = (view) => {
        const { fields, tool } = latest.current;
        for (const f of fields) {
          const el = markers.current.get(f.id);
          if (el) placeMarker(el, f.position, view);
        }
        drawGuides(
          guides.current,
          fields,
          view,
          tool !== "cursor" || !!fieldDrag.current?.moved,
        );
      };
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
        registry,
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
  }, [resolved, show, paused, fields, objects, particleContainer, registry]);
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
    families,
  ]);
  function project() {
    const s = latest.current;
    return {
      format: "orbius-project",
      version: 1,
      name: s.name,
      mode: s.mode,
      config: s.config,
      objects: s.objects,
      ...(s.families.length ? { families: s.families } : {}),
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
      setFields([]);
      setSelectedFieldId(null);
      engine.current?.setContainer(null);
      engine.current?.reset(latest.current.config);
      setDirty(true);
      notify("Enclosure emptied.");
      return;
    }
    const nextConfig = { ...latest.current.config, ...payload.config };
    setConfig(nextConfig);
    setParticleContainer(payload.container);
    // In the glass workspace, fields are only ever the ones a pour brought.
    setFields(payload.fields);
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
      setFamilies(p.families || []);
      setObjects(p.objects || []);
      setSelectedObject(p.objects?.[0]?.id || null);
      objectHistory.current = [];
      setMode(p.mode);
      setGraph(p.graph);
      setFields(p.fields);
      setSelectedFieldId(null);
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
  // The repo's saves/ folder is the default. A built copy has no dev server to write
  // through, so it falls back to a download.
  async function save() {
    const data = project();
    const file = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "untitled";
    const written = await writeProject(file, data).catch(() => null);
    if (written) {
      setDirty(false);
      notify(`Saved to ${written}`);
      return;
    }
    download(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `${file}.orbius.json`,
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
    setSelectedFieldId(null);
    notify("Simulation restarted. Fields cleared.");
  }
  // Back to a blank slate in the current workspace: entry settings, no fields,
  // no objects, the stock shader and graph — but the same mode, no reload. This
  // is destructive, so it asks first; object edits stay undoable afterwards.
  function resetScene() {
    if (
      !window.confirm(
        "Reset this workspace to a blank slate? Fields, objects and edits will be cleared.",
      )
    )
      return;
    const entry =
      mode === "particles" || mode === "nodes"
        ? { ...defaults }
        : { ...defaults, ...materialBase };
    setConfig(entry);
    setFields([]);
    setSelectedFieldId(null);
    setObjects([]);
    setSelectedObject(null);
    setParticleContainer(null);
    engine.current?.setContainer(null);
    engine.current?.reset(entry);
    if (mode === "nodes") setGraph(structuredClone(initialGraph));
    setShader(defaultShader);
    setCompiled(defaultShader);
    setShaderError("");
    setName(mode === "glass" ? "Untitled composition" : "Event horizon");
    setShow(false);
    setPaused(false);
    setDirty(false);
    notify("Workspace reset. Fresh slate, same page.");
  }
  // Compiling and linking this shader measures about a millisecond, so this waits
  // for a pause in typing rather than rationing an expensive operation. 350ms is
  // roughly the gap between words: the render stays one thought behind the text
  // instead of one keystroke, and a half-typed identifier never reaches the driver.
  useEffect(() => {
    if (shader === compiled) return;
    const id = setTimeout(() => {
      try {
        engine.current?.compile(shader);
        setCompiled(shader);
        setShaderError("");
      } catch (e) {
        // The previous program is still running; only the message changes.
        setShaderError(authorMessage(e.message));
      }
    }, 350);
    return () => clearTimeout(id);
  }, [shader, compiled]);
  async function capture() {
    try {
      const blob = await engine.current.capture();
      download(blob, `orbius-${Date.now()}.png`);
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
          `orbius-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`,
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
      // A keydown can arrive with a non-element target, and an exception thrown
      // here takes the whole handler down with it.
      if (e.target?.closest?.("input,textarea,select,[contenteditable]"))
        return;
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
        setTipEntry(null);
        setSelectedFieldId(null);
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
        setSelectedFieldId(null);
        notify("All fields cleared.");
      } else if (k === "h") resetScene();
      else if (k === "?") setHelp((h) => !h);
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
  // Screen-space hit test: the closest placed field under the click, if any.
  // Projected the same way its marker is placed, compared in pixels so the
  // target matches what the eye sees. Markers are 30px across; 28px keeps a
  // near miss forgiving without swallowing empty canvas.
  function fieldAtPointer(clientX, clientY) {
    const rect = canvas.current?.getBoundingClientRect();
    const view = engine.current?.view;
    if (!rect || !view || !fields.length) return null;
    let best = null,
      bestDist = 28;
    for (const f of fields) {
      const [x, y, depth] = viewProject(f.position, view);
      if (depth < 1) continue;
      const px = (x + 1) * 0.5 * rect.width,
        py = (1 - y) * 0.5 * rect.height;
      const d = Math.hypot(px - (clientX - rect.left), py - (clientY - rect.top));
      if (d <= bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }
  function stageDown(e) {
    if (e.button !== 0) return;
    // Selecting beats placing and orbiting alike: a click on a placed field
    // selects it whatever tool is armed, and no new field is born.
    if (resolved.mode === "particles" && fields.length) {
      const hit = fieldAtPointer(e.clientX, e.clientY);
      if (hit) {
        setSelectedFieldId(hit.id);
        return;
      }
      setSelectedFieldId(null);
    }
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
    const view = engine.current?.view;
    if (!view) return;
    const f = {
      id: crypto.randomUUID(),
      type: tool,
      ...viewUnproject(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
        view,
      ),
      reach: "point",
      strength:
        (tool === "light" ? config.lightIntensity : config.fieldStrength) *
        (e.shiftKey ? 2 : 1),
      radius: config.fieldRadius,
      color: config.lightColor,
    };
    setFields((fs) => [...fs, f]);
    setSelectedFieldId(tool === "burst" ? null : f.id);
    setDirty(true);
    if (tool === "burst")
      setTimeout(() => setFields((fs) => fs.filter((v) => v.id !== f.id)), 650);
  }
  function editField(id, change) {
    setFields((fs) => fs.map((v) => (v.id === id ? { ...v, ...change } : v)));
    setDirty(true);
  }
  // A marker drags its field across the view at the depth it stands, or up and down
  // with Alt. Pressing or releasing Alt mid-drag takes hold again from where the
  // field is, so switching never throws it back to where the drag began.
  function grabField(e, f, moved) {
    const view = engine.current?.view;
    if (!view) return;
    const [sx, sy, depth] = viewProject(f.position, view);
    fieldDrag.current = {
      id: f.id,
      x: e.clientX,
      y: e.clientY,
      sx,
      sy,
      z: view.eye - depth,
      start: f.position,
      last: f.position,
      alt: e.altKey,
      moved,
    };
  }
  function dragField(e) {
    const d = fieldDrag.current,
      view = engine.current?.view;
    if (!d || !view) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    // From the drag's own last position: React may not have rendered it yet.
    if (e.altKey !== d.alt)
      return grabField(e, { id: d.id, position: d.last }, true);
    d.moved = true;
    const rect = canvas.current.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / rect.width) * 2,
      dy = ((d.y - e.clientY) / rect.height) * 2;
    // One screen height at the field's depth, in scene units.
    const reach = (view.eye - d.z) / (view.zoom * view.projScale);
    d.last = e.altKey
      ? d.start.with(1, fieldCoordinate(d.start[1] + dy * reach))
      : viewUnproject(d.sx + dx, d.sy + dy, view, d.z).position;
    editField(d.id, { position: d.last });
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
    setTipEntry(null);
    setSelectedFieldId(null);
    setDirty(true);
    engine.current?.clear();
  }
  // Controls a family declared in its own source. They write into a namespace keyed
  // by family, so the panel needs no list of them and two families may both call
  // something "scale".
  function familyControls() {
    const family = registry[config.family];
    if (!family) return null;
    const { controls: declared, defaults: fallback } = parseControls(
      family.glsl,
    );
    const names = Object.keys(declared);
    if (!names.length) return null;
    return [
      `${family.name}`,
      names.map((name) => (
        <Control
          key={name}
          id={`${family.id}.${name}`}
          entry={declared[name]}
          value={config.params?.[family.id]?.[name] ?? fallback[name]}
          onChange={(next) =>
            setConfig((c) => ({
              ...c,
              params: {
                ...c.params,
                [family.id]: { ...c.params?.[family.id], [name]: next },
              },
            })) || setDirty(true)
          }
          tip={tip}
        />
      )),
    ];
  }
  function control(key) {
    const p =
        key === "reflection" && (resolved.mode === "glass" || config.family)
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
    if (resolved.mode === "orb" && config.family) {
      const relevant =
        config.family === "silk" || config.family === "composer"
          ? [
              "materialScale",
              "materialFold",
              "interiorMotion",
              "emission",
              ...(config.family === "composer" ? ["reflection"] : []),
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
      <Control
        key={key}
        id={key}
        entry={p}
        value={v}
        onChange={(next) => update(key, next)}
        tip={tip}
      />
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
            notify("ORBIUS · Light laboratory");
          }}
        >
          <img className="brand-mark" src="/favicon.svg" alt="" />
          ORBIUS
          <span className="brand-divider" />
          <small>LIGHT LABORATORY</small>
        </a>
        <nav aria-label="Workspaces">
          {/* The node composer is left out until it is mature enough to feature;
              its workspace still works for a project saved in it. */}
          {[
            ["particles", "Particle playground", "particles"],
            ["orb", "Orb shaders", "orb"],
            ["glass", "Glass objects", "orb"],
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
            aria-label="Open a project"
            onMouseEnter={() => tip.show("persistence-open", persistenceNotes.open)}
            onMouseLeave={tip.hide}
            onFocus={() => tip.show("persistence-open", persistenceNotes.open)}
            onBlur={tip.hide}
            onClick={async () => {
              // The saves folder is where Save writes, so it is where Open looks
              // first. A file from anywhere else is still one click away.
              const names = await listProjects().catch(() => null);
              if (names?.length) setBrowsing(names);
              else file.current.click();
            }}
          >
            <Icon name="folder" />
            Open
          </button>
          <button
            aria-label="Save project · ⌘/Ctrl S"
            onMouseEnter={() => tip.show("persistence-save", persistenceNotes.save)}
            onMouseLeave={tip.hide}
            onFocus={() => tip.show("persistence-save", persistenceNotes.save)}
            onBlur={tip.hide}
            onClick={save}
          >
            <Icon name="save" />
            Save
          </button>
          <button
            aria-label="Reset workspace · H"
            onMouseEnter={() => tip.show("persistence-reset", persistenceNotes.reset)}
            onMouseLeave={tip.hide}
            onFocus={() => tip.show("persistence-reset", persistenceNotes.reset)}
            onBlur={tip.hide}
            onClick={resetScene}
          >
            <Icon name="expand" />
            Reset
          </button>
          <button
            className="show-button"
            onClick={() => {
              setShow(true);
              notify("Show mode · S or Esc to return · C records · P captures");
            }}
          >
            <Icon name="play" size={14} />
            Orbin time<kbd>S</kbd>
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
            tip={tip}
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
              setSelectedFieldId(null);
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
                    ? !config.family
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
                  {stats.gpu && (
                    <>
                      {" "}
                      <span>·</span> {stats.gpu.total.toFixed(2)} MS GPU
                    </>
                  )}
                </div>
                {/* Frame rate is a fact about the tab; this is a fact about the
                    renderer, and the two disagree the moment the tab is not in
                    front. The breakdown is where a pass that got expensive
                    actually shows itself. */}
                {stats.gpu && !show && (
                  <div className="stage-profile">
                    {stats.gpu.passes.map((p) => (
                      <span key={p.label}>
                        <i>{p.label}</i>
                        {p.ms.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}
                {resolved.mode === "particles" && (
                  <svg
                    className="field-guides"
                    ref={guides}
                    viewBox="-1 -1 2 2"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {["grid", "x", "y", "z", "drops", "columns"].map((n) => (
                      <path key={n} className={`guide-${n}`} />
                    ))}
                  </svg>
                )}
                {(resolved.mode === "particles" ? fields : []).map((f) => (
                  <button
                    className={`field-marker field-${f.type}${f.id === selectedFieldId ? " selected" : ""}`}
                    key={f.id}
                    ref={(el) => {
                      markers.current.set(f.id, el);
                      if (engine.current?.view)
                        placeMarker(el, f.position, engine.current.view);
                      return () => markers.current.delete(f.id);
                    }}
                    aria-label={`Select ${f.type} field`}
                    aria-pressed={f.id === selectedFieldId}
                    title={`${f.type} · strength ${f.strength.toFixed(1)} · drag to move, Alt-drag for height, click to select`}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      grabField(e, f, false);
                    }}
                    onPointerMove={dragField}
                    onPointerCancel={() => (fieldDrag.current = null)}
                    onClick={() => {
                      // Clicking a placed field selects it for the side card —
                      // never places a new one, never deletes this one. A drag
                      // that moved still ends selected at its new spot.
                      setSelectedFieldId(f.id);
                      fieldDrag.current = null;
                    }}
                    style={{ "--field-color": f.color }}
                  >
                    <Icon name={f.type} size={15} />
                    <span>{f.strength.toFixed(1)}</span>
                  </button>
                ))}
                {selectedField && !show && resolved.mode === "particles" && (
                  <section
                    className="field-card"
                    aria-label={`${selectedField.type} field parameters`}
                    onMouseEnter={() => {
                      cardEntered.current = true;
                    }}
                    onMouseLeave={() => {
                      if (cardEntered.current) setSelectedFieldId(null);
                    }}
                  >
                    <header>
                      <span
                        className="field-card-dot"
                        style={{ background: selectedField.color }}
                      />
                      <div>
                        <b>{selectedField.type}</b>
                        <small>
                          {selectedField.reach === "column"
                            ? "column · along line of sight"
                            : "point field"}
                        </small>
                      </div>
                      <button
                        aria-label="Close field parameters"
                        onClick={() => setSelectedFieldId(null)}
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </header>
                    <label>
                      <span>
                        Strength <i>{selectedField.strength.toFixed(1)}</i>
                      </span>
                      <input
                        type="range"
                        min="0.1"
                        max="12"
                        step="0.1"
                        value={selectedField.strength}
                        onChange={(e) =>
                          editField(selectedField.id, {
                            strength: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>
                        Radius <i>{selectedField.radius.toFixed(2)}</i>
                      </span>
                      <input
                        type="range"
                        min="0.1"
                        max="6"
                        step="0.05"
                        value={selectedField.radius}
                        onChange={(e) =>
                          editField(selectedField.id, {
                            radius: +e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="field-card-position">
                      {["x", "y", "z"].map((axis, i) => (
                        <label key={axis}>
                          {axis}
                          <input
                            aria-label={`${selectedField.type} ${axis} position`}
                            type="number"
                            min={-FIELD_EXTENT}
                            max={FIELD_EXTENT}
                            step="0.1"
                            value={selectedField.position[i]}
                            onChange={(e) => {
                              if (e.target.value)
                                editField(selectedField.id, {
                                  position: selectedField.position.with(
                                    i,
                                    fieldCoordinate(+e.target.value),
                                  ),
                                });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    {selectedField.type === "light" && (
                      <label className="field-card-color">
                        Light color
                        <input
                          type="color"
                          value={selectedField.color}
                          onChange={(e) =>
                            editField(selectedField.id, {
                              color: e.target.value,
                            })
                          }
                        />
                      </label>
                    )}
                    {(selectedField.type === "vortex" ||
                      selectedField.reach === "column") && (
                      <label className="field-card-axis">
                        {selectedField.reach === "column"
                          ? "runs along"
                          : "turns about"}
                        <select
                          aria-label={`${selectedField.type} axis`}
                          value={
                            Object.keys(axes).find((k) =>
                              axes[k].every(
                                (v, i) => v === selectedField.axis[i],
                              ),
                            ) ?? "placed"
                          }
                          onChange={(e) =>
                            editField(selectedField.id, {
                              axis:
                                axes[e.target.value] ??
                                viewAxis(
                                  selectedField.position,
                                  engine.current.view,
                                ),
                            })
                          }
                        >
                          <option value="placed">its line of sight</option>
                          <option value="camera">
                            the line of sight from here
                          </option>
                          <option value="x">X</option>
                          <option value="y">Y</option>
                          <option value="z">Z</option>
                        </select>
                      </label>
                    )}
                    <div className="field-card-actions">
                      <button
                        className="field-card-delete"
                        onClick={() => {
                          setFields((fs) =>
                            fs.filter((v) => v.id !== selectedField.id),
                          );
                          setSelectedFieldId(null);
                        }}
                      >
                        <Icon name="trash" size={13} />
                        Delete field
                      </button>
                    </div>
                    <small>Leaves when entered, then left.</small>
                  </section>
                )}
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
                  Add a glass orb, cylinder or cup, or import an OBJ or STL
                  mesh.
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
              onClick={() => {
                setFields([]);
                setSelectedFieldId(null);
              }}
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
                    tip={tip}
                    registry={registry}
                    families={families}
                    collected={saved}
                    onFamilies={(next) => {
                      setFamilies(next);
                      setDirty(true);
                    }}
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
                  tip={tip}
                  families={families}
                  registry={registry}
                  onFamilies={(next) => {
                    setFamilies(next);
                    setDirty(true);
                  }}
                  onStart={() => {
                    setConfig((c) => ({
                      ...c,
                      ...materialBase,
                      family: "composer",
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
                        "stageTexture",
                        "reflections",
                        "bounce",
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
                              "fieldGain",
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
                : resolved.mode === "orb" && config.family
                  ? [
                      ...[familyControls()].filter(Boolean),
                      ...materialSections.orb.slice(0, 2),
                      ...lightRoles.map(([id, label]) => [
                        `${label} light`,
                        lightKeys[id],
                      ]),
                      ...materialSections.orb.slice(2),
                    ]
                  : sections[resolved.mode === "orb" ? "orb" : "particles"]
              ).map(([title, keys], i) => (
                <details key={title} open={i < 2}>
                  <summary>
                    <span>{title}</span>
                    <Icon name="down" size={13} />
                  </summary>
                  <div className="section-controls">
                    {keys.map((k) => (typeof k === "string" ? control(k) : k))}
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
                      <div
                        key={f.id}
                        className={
                          f.id === selectedFieldId ? "field-selected" : ""
                        }
                      >
                        <label>
                          {f.reach === "column" ? `${f.type} · column` : f.type}
                          <input
                            aria-label={`${f.type} strength`}
                            type="number"
                            min="0.1"
                            max="12"
                            step="0.1"
                            value={f.strength}
                            onChange={(e) => {
                              if (e.target.value)
                                editField(f.id, {
                                  strength: Math.max(
                                    0.1,
                                    Math.min(12, +e.target.value),
                                  ),
                                });
                            }}
                          />
                        </label>
                        <button
                          aria-label={`Delete ${f.type}`}
                          onClick={() => {
                            setFields((fs) =>
                              fs.filter((v) => v.id !== f.id),
                            );
                            if (f.id === selectedFieldId)
                              setSelectedFieldId(null);
                          }}
                        >
                          <Icon name="close" size={12} />
                        </button>
                        <div className="field-position">
                          {["x", "y", "z"].map((axis, i) => (
                            <label key={axis}>
                              {axis}
                              <input
                                aria-label={`${f.type} ${axis} position`}
                                type="number"
                                min={-FIELD_EXTENT}
                                max={FIELD_EXTENT}
                                step="0.1"
                                value={f.position[i]}
                                onChange={(e) => {
                                  if (e.target.value)
                                    editField(f.id, {
                                      position: f.position.with(
                                        i,
                                        fieldCoordinate(+e.target.value),
                                      ),
                                    });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        {(f.type === "vortex" || f.reach === "column") && (
                          <label className="field-axis">
                            {f.reach === "column"
                              ? "runs along"
                              : "turns about"}
                            <select
                              aria-label={`${f.type} axis`}
                              value={
                                Object.keys(axes).find((k) =>
                                  axes[k].every((v, i) => v === f.axis[i]),
                                ) ?? "placed"
                              }
                              onChange={(e) =>
                                editField(f.id, {
                                  axis:
                                    axes[e.target.value] ??
                                    viewAxis(f.position, engine.current.view),
                                })
                              }
                            >
                              <option value="placed">its line of sight</option>
                              <option value="camera">
                                the line of sight from here
                              </option>
                              <option value="x">X</option>
                              <option value="y">Y</option>
                              <option value="z">Z</option>
                            </select>
                          </label>
                        )}
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
                  {editing ? (
                    <>
                      <div className="code-intro">
                        <span>{editing.name}.glsl</span>
                      </div>
                      <p>
                        Define <code>displace(p)</code> and{" "}
                        <code>{contracts[editing.kind].signature}</code>.{" "}
                        {contracts[editing.kind].note} Declare a slider with{" "}
                        <code>// @control name min max step "note"</code>.
                      </p>
                      <CodeEditor
                        label="Family GLSL source"
                        value={editing.glsl}
                        maxLength={MAX_GLSL}
                        invalid={!!familyError}
                        errorLine={errorLine(familyError)}
                        onChange={(glsl) => {
                          setFamilies((list) =>
                            list.map((f) =>
                              f.id === editing.id ? { ...f, glsl } : f,
                            ),
                          );
                          setDirty(true);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      {config.family && (
                        <p className="family-code-note">
                          This is the Custom GLSL surface, and it compiles as
                          you type. You are looking at{" "}
                          <b>{registry[config.family].name}</b>, which is built
                          in.
                          <button onClick={() => update("family", "")}>
                            Show this surface
                          </button>
                        </p>
                      )}
                      <div className="code-intro">
                        <span>surface.glsl</span>
                      </div>
                      <p>
                        Define <code>shape(p)</code> and{" "}
                        <code>pigment(p, n)</code>. Geometry, normals, shadows,
                        and reflections share your surface.
                      </p>
                      <CodeEditor
                        label="GLSL shader source"
                        value={shader}
                        maxLength={20000}
                        invalid={!!shaderError}
                        errorLine={errorLine(shaderError)}
                        onChange={(next) => {
                          setShader(next);
                          setDirty(true);
                        }}
                      />
                    </>
                  )}
                  {(editing ? familyError : shaderError) && (
                    <pre className="shader-error" role="alert">
                      {editing ? familyError : shaderError}
                    </pre>
                  )}
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
                        notify("Starter source restored in the editor.");
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
        accept=".json,.orbius.json,application/json"
        ref={file}
        onChange={load}
        hidden
      />
      {tipEntry && !show && (
        <div
          className="parameter-tooltip"
          role="tooltip"
          onMouseEnter={() => clearTimeout(tipTimer.current)}
          onMouseLeave={() => setTipEntry(null)}
        >
          <span>PARAMETER FIELD NOTE</span>
          <h3>{tipEntry.entry[0]}</h3>
          <p>{tipEntry.entry[4]}</p>
          <small>EXPLORE FURTHER</small>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(tipEntry.entry[5])}`}
            target="_blank"
            rel="noreferrer"
          >
            {tipEntry.entry[5]} ↗
          </a>
        </div>
      )}
      {browsing && (
        <div className="modal-backdrop" onClick={() => setBrowsing(null)}>
          <section
            className="saves-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Open a project"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">SAVES / IN THIS REPOSITORY</span>
            <h3>Open a project</h3>
            <ul>
              {browsing.map(({ file, label }) => (
                <li key={file}>
                  <button
                    onClick={async () => {
                      try {
                        const data = await readProject(file);
                        setBrowsing(null);
                        apply(data);
                      } catch (e) {
                        setBrowsing(null);
                        notify(`Could not open ${label}: ${e.message}`);
                      }
                    }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              className="saves-elsewhere"
              onClick={() => {
                setBrowsing(null);
                file.current.click();
              }}
            >
              Open a file from elsewhere…
            </button>
          </section>
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
            <span className="eyebrow">THE ORBIUS FIELD GUIDE</span>
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
                  Drag a field marker to move it, Alt-drag to raise or lower it,
                  click a field to tune it beside the stage. X clears all.
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
                  ["Reset workspace", "H"],
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
              <h3>Three ways to make something extraordinary.</h3>
              <p>
                <b>Particles</b> · Sculpt a living cloud with forces and light.
                <br />
                <b>Orb shaders</b> · Explore iridescent volumes, evolving
                surface chemistry, reflective metal, or a custom GLSL surface.
                <br />
                <b>Glass objects</b> · Import OBJ or STL meshes and combine
                independent glass shells, surface dots, and filled dot volumes.
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
