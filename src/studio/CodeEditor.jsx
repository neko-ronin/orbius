import React, { useEffect, useRef } from "react";
import { tokenize, isDeclaration } from "./glsl.js";
// A textarea with a highlighted copy of its own text behind it.
//
// The two layers must agree on every pixel of metrics or the caret drifts from the
// glyphs, which is why the font, padding, line height and border are set once in CSS
// on a shared selector rather than on each element. The textarea keeps its own text
// transparent and its caret visible; everything you can see is the layer behind.
//
// That layer is also what makes scrubbing cheap: every number is already its own
// span, so finding the one under the pointer is a hit test rather than a mapping
// from pixels to character offsets.
const DRAG = 220; // pixels of travel for the full range of a value

// "5." is a float with no digits after the point. Rounding it to "5" would change
// its type in GLSL, so a literal that has a point keeps at least one decimal.
function precisionOf(text) {
  const dot = text.indexOf(".");
  if (dot < 0) return 0;
  return Math.max(1, text.length - dot - 1);
}

export default function CodeEditor({
  value,
  onChange,
  errorLine,
  label,
  invalid,
  maxLength,
}) {
  const area = useRef(),
    back = useRef(),
    root = useRef(),
    drag = useRef(null);

  // The layers scroll as one. Done on the element rather than in React state so it
  // cannot lag a frame behind the text it is highlighting.
  const sync = () => {
    if (!back.current || !area.current) return;
    back.current.scrollTop = area.current.scrollTop;
    back.current.scrollLeft = area.current.scrollLeft;
  };
  useEffect(sync, [value]);

  // Alt announces the gesture while it is held, rather than the pointer only
  // changing once it happens to be over a number.
  useEffect(() => {
    const mark = (e) =>
      root.current?.classList.toggle("is-scrubbable", e.altKey);
    const clear = () => root.current?.classList.remove("is-scrubbable");
    window.addEventListener("keydown", mark);
    window.addEventListener("keyup", mark);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", mark);
      window.removeEventListener("keyup", mark);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // The drag lives in a ref, and writing a ref does not re-run an effect, so these
  // listeners attach once and read the current document through another ref. An
  // earlier version bailed out when drag.current was null at mount and therefore
  // never attached at all: the gesture started and nothing moved.
  const live = useRef({ value, onChange });
  live.current = { value, onChange };
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const { value, onChange } = live.current;
      const travelled = (e.clientX - d.x) / DRAG;
      const next = Math.max(
        d.min,
        Math.min(d.max, d.start + travelled * (d.max - d.min)),
      );
      const text = next.toFixed(d.precision);
      onChange(value.slice(0, d.at) + text + value.slice(d.at + d.length));
      // The replacement can be a different width, so the next one has to know.
      drag.current = { ...d, length: text.length };
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.classList.remove("is-scrubbing");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  function startScrub(e) {
    // Alt is the modifier because dragging plain text has to keep meaning selection.
    if (!e.altKey) return;
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el.dataset?.at !== undefined);
    if (!hit) return;
    e.preventDefault();
    const text = hit.textContent;
    const start = parseFloat(text);
    if (!Number.isFinite(start)) return;
    // A range around the current value, so a drag is always useful whatever the
    // magnitude: 0.5 and 50 both get a workable sweep.
    const reach = Math.max(Math.abs(start) * 2, 1);
    drag.current = {
      at: +hit.dataset.at,
      length: text.length,
      start,
      precision: precisionOf(text),
      min: start - reach,
      max: start + reach,
      x: e.clientX,
    };
    document.body.classList.add("is-scrubbing");
  }

  function onKeyDown(e) {
    if (e.key !== "Tab" || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    // execCommand is deprecated but it is the only way to insert text that the
    // browser's own undo stack knows about. A manual splice makes Cmd-Z discard the
    // whole session's typing instead of one step.
    document.execCommand("insertText", false, "  ");
  }

  let line = 1;
  const lines = value.split("\n").length;
  return (
    <div ref={root} className={`code-editor ${invalid ? "is-invalid" : ""}`}>
      <div className="code-gutter" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={i + 1 === errorLine ? "at-error" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="code-layers">
        <pre ref={back} className="code-back" aria-hidden="true">
          {tokenize(value).map(([kind, text, at], i) => {
            const here = line;
            line += text.split("\n").length - 1;
            const cls =
              kind === "comment" && isDeclaration(text) ? "decl" : kind;
            return (
              <span
                key={i}
                className={`t-${cls}${here === errorLine ? " on-error" : ""}`}
                data-at={kind === "num" ? at : undefined}
              >
                {text}
              </span>
            );
          })}
          {"\n"}
        </pre>
        <textarea
          ref={area}
          className="code-front"
          spellCheck="false"
          aria-label={label}
          value={value}
          maxLength={maxLength}
          onScroll={sync}
          onKeyDown={onKeyDown}
          onPointerDown={startScrub}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
