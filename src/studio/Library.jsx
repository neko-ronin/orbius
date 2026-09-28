import React, { useEffect, useState } from "react";
import { Engine } from "../engine.js";
import { defaults } from "../project.js";
import { materialBase } from "../materials/catalog.js";
const cache = new Map();
// Mirrors persistenceNotes.collect in main.jsx: hovering Collect explains the
// document-vs-bookmark split the same way every slider explains itself.
const collectNote = [
  "Collect specimen",
  0,
  1,
  1,
  "Bookmarks this moment with a thumbnail into your on-device collection (16 max) for quick revisits. Handy, but not a file — Save above for the durable copy that survives a cleared browser.",
  "orbius collection specimens bookmarks",
];
// One offscreen context, sequential recipes, no perpetual gallery render loops.
export default function Library({
  recipes,
  kind,
  onChoose,
  saved,
  onSave,
  onLoad,
  onDelete,
  tip,
}) {
  const [previews, setPreviews] = useState({});
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => {
    if (recipes.every((r) => cache.has(JSON.stringify(r)))) {
      setPreviews(
        Object.fromEntries(
          recipes.map((r) => [r.id, cache.get(JSON.stringify(r))]),
        ),
      );
      return;
    }
    let cancelled = false,
      renderer;
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "width:240px;height:190px;position:fixed;left:-1000px";
    document.body.append(canvas);
    const run = async () => {
      try {
        renderer = new Engine(
          canvas,
          () => {},
          () => {},
          false,
        );
        for (const recipe of recipes) {
          if (cancelled) break;
          const key = JSON.stringify(recipe);
          let preview = cache.get(key);
          if (!preview) {
            renderer.config = {
              ...defaults,
              ...(recipe.mode === "particles" ? {} : materialBase),
              ...recipe.values,
              devScale: 1,
            };
            renderer.mode = recipe.mode;
            renderer.reset(renderer.config);
            renderer.time = 4;
            for (let i = 0; i < (recipe.mode === "particles" ? 30 : 1); i++)
              renderer.render(1 / 60, [240, 190]);
            preview = canvas.toDataURL("image/jpeg", 0.85);
            cache.set(key, preview);
          }
          if (!cancelled) setPreviews((p) => ({ ...p, [recipe.id]: preview }));
          await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        renderer?.dispose();
        renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      }
    };
    run().catch(() => {
      if (!cancelled) setPreviewError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [recipes]);
  return (
    <>
      <div className="panel-eyebrow">
        THE COLLECTION <span>{String(recipes.length).padStart(2, "0")}</span>
      </div>
      <h2>{kind === "glass" ? "Your scenes." : "Living matter."}</h2>
      <p className="intro">
        {kind === "glass" ? (
          "Objects you bring. Materials you choose. Save the compositions worth keeping."
        ) : (
          <>
            A study in light, form
            <br />
            and unexpected behavior.
          </>
        )}
      </p>
      <div className="preset-list">
        {recipes.map((r) => (
          <button
            className="preset specimen"
            key={r.id}
            title={r.review}
            onClick={() => onChoose(r)}
          >
            <div className="specimen-image">
              {previews[r.id] ? (
                <img src={previews[r.id]} alt={`${r.name} rendered preview`} />
              ) : (
                <span>
                  {previewError ? "Preview unavailable" : "Rendering specimen…"}
                </span>
              )}
            </div>
            <div className="preset-meta">
              <b>{r.name}</b>
              <small>{r.tag}</small>
            </div>
          </button>
        ))}
      </div>
      <div className="collection-heading">
        <span>YOUR SPECIMENS</span>
        <button
          aria-label="Collect this moment into your on-device collection"
          onMouseEnter={() => tip?.show("persistence-collect", collectNote)}
          onMouseLeave={() => tip?.hide()}
          onFocus={() => tip?.show("persistence-collect", collectNote)}
          onBlur={() => tip?.hide()}
          onClick={onSave}
        >
          + Collect
        </button>
      </div>
      {saved.length === 0 ? (
        <p className="empty-collection">
          Save a moment worth returning to. Your collection stays on this
          device.
        </p>
      ) : (
        saved.map((item) => (
          <div className="saved-specimen" key={item.id}>
            <button onClick={() => onLoad(item.project)}>
              <img src={item.preview} alt="" />
              <span>
                {item.project.name}
                <small>{item.project.mode}</small>
              </span>
            </button>
            <button
              aria-label={`Delete ${item.project.name}`}
              onClick={() => onDelete(item.id)}
            >
              ×
            </button>
          </div>
        ))
      )}
    </>
  );
}
