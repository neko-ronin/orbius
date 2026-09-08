import React, { useState } from "react";
import { nodeKinds, controls, resolveGraph } from "./project.js";
import Icon from "./Icons.jsx";
export default function NodeEditor({ graph, onChange, config, notify }) {
  const [pending, setPending] = useState(null),
    [adding, setAdding] = useState(false);
  let active = [];
  let error = "";
  try {
    active = resolveGraph(graph, config).active;
  } catch (e) {
    error = e.message;
  }
  function connect(id) {
    if (!pending) return;
    if (pending === id) {
      setPending(null);
      return;
    }
    const next = {
      ...graph,
      edges: [...graph.edges.filter((e) => e[1] !== id), [pending, id]],
    };
    const seen = new Set([pending]);
    const follow = (n) => {
      if (seen.has(n)) return true;
      seen.add(n);
      return next.edges.filter((e) => e[0] === n).some((e) => follow(e[1]));
    };
    if (follow(id)) {
      notify("That connection would create a feedback loop.");
      setPending(null);
      return;
    }
    onChange(next);
    setPending(null);
  }
  function drag(e, node) {
    if (e.target.closest("button,input")) return;
    const start = { x: e.clientX, y: e.clientY, nx: node.x, ny: node.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    const target = e.currentTarget;
    const move = (ev) =>
      onChange((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === node.id
            ? {
                ...n,
                x: Math.max(
                  10,
                  Math.min(1400, start.nx + ev.clientX - start.x),
                ),
                y: Math.max(10, Math.min(550, start.ny + ev.clientY - start.y)),
              }
            : n,
        ),
      }));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", up, { once: true });
  }
  return (
    <section className="node-editor" aria-label="Node composer">
      <div className="node-head">
        <div>
          <Icon name="nodes" />
          <b>Composition</b>
          <span className={error ? "warning" : "quiet"}>
            {error || `${active.length} nodes → live output`}
          </span>
        </div>
        <button onClick={() => setAdding(!adding)}>
          <Icon name="plus" size={14} /> Add node
        </button>
        {adding && (
          <div className="node-menu">
            {Object.entries(nodeKinds)
              .filter(([k]) => k !== "output")
              .map(([key, kind]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (graph.nodes.length >= 24) {
                      notify("Maximum 24 nodes.");
                      return;
                    }
                    onChange({
                      ...graph,
                      nodes: [
                        ...graph.nodes,
                        {
                          id: crypto.randomUUID(),
                          type: key,
                          x: 50 + graph.nodes.length * 25,
                          y: 40,
                          value: kind.param ? config[kind.param] : 1,
                        },
                      ],
                    });
                    setAdding(false);
                  }}
                >
                  <i style={{ background: kind.color }} />
                  {kind.label}
                </button>
              ))}
          </div>
        )}
      </div>
      <div className="node-scroll">
        <div
          className="node-world"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPending(null);
          }}
        >
          <svg className="wires" width="1640" height="730">
            {graph.edges.map(([a, b]) => {
              const from = graph.nodes.find((n) => n.id === a),
                to = graph.nodes.find((n) => n.id === b);
              if (!from || !to) return null;
              return (
                <path
                  key={a + b}
                  className={
                    active.includes(a) && active.includes(b) ? "active" : ""
                  }
                  d={`M${from.x + 186},${from.y + 64} C${from.x + 245},${from.y + 64} ${to.x - 60},${to.y + 64} ${to.x},${to.y + 64}`}
                  onClick={() =>
                    onChange({
                      ...graph,
                      edges: graph.edges.filter(
                        (e) => !(e[0] === a && e[1] === b),
                      ),
                    })
                  }
                >
                  <title>Click to disconnect</title>
                </path>
              );
            })}
          </svg>
          {graph.nodes.map((n) => {
            const kind = nodeKinds[n.type],
              p = controls[kind.param];
            return (
              <div
                key={n.id}
                className={`graph-node ${active.includes(n.id) ? "connected" : ""}`}
                style={{ left: n.x, top: n.y, "--node-color": kind.color }}
                onPointerDown={(e) => drag(e, n)}
              >
                <div className="node-type">
                  {kind.category}
                  {n.type !== "output" && (
                    <button
                      aria-label={`Delete ${kind.label}`}
                      onClick={() =>
                        onChange({
                          ...graph,
                          nodes: graph.nodes.filter((v) => v.id !== n.id),
                          edges: graph.edges.filter((e) => !e.includes(n.id)),
                        })
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>
                <b>{kind.label}</b>
                {!["particles", "orb"].includes(n.type) && (
                  <button
                    className={`port input ${pending ? "awaiting" : ""}`}
                    aria-label={`Connect to ${kind.label}`}
                    title="Click to connect the selected output"
                    onClick={() => connect(n.id)}
                  />
                )}
                {n.type !== "output" && (
                  <button
                    className={`port output ${pending === n.id ? "selected" : ""}`}
                    aria-label={`Connect from ${kind.label}`}
                    title="Click output, then click another node's input"
                    onClick={() => setPending(pending === n.id ? null : n.id)}
                  />
                )}
                {p ? (
                  <label className="node-value">
                    <span>
                      {p[0]} <em>{n.value.toFixed(2)}</em>
                    </span>
                    <input
                      aria-label={`${kind.label} amount`}
                      type="range"
                      min={p[1]}
                      max={p[2]}
                      step={p[3]}
                      value={n.value}
                      onChange={(e) =>
                        onChange({
                          ...graph,
                          nodes: graph.nodes.map((v) =>
                            v.id === n.id
                              ? { ...v, value: +e.target.value }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                ) : (
                  <span className="node-caption">
                    {n.type === "output"
                      ? "Final render destination"
                      : "Uses workspace parameters"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="node-foot">
        {pending
          ? "Choose an input port to connect. Click empty space to cancel."
          : "Drag to arrange · Output port → input port to connect · Click a wire to disconnect"}
      </div>
    </section>
  );
}
