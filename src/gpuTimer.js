// Wall-clock frame rate measures how often the browser asks for a frame, which is
// a fact about the tab — a backgrounded or throttled one reports single digits for
// a scene the GPU is finishing in two milliseconds. GPU timer queries measure the
// work itself, so a number taken from a throttled tab is still the truth about the
// renderer. That is the whole reason this exists.
//
// One TIME_ELAPSED query can be active at a time, which suits a render pass list:
// the passes are already sequential, so each gets its own query in the same frame
// and the results are collected once the driver has them, a few frames later.
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.pending = [];
    this.spare = [];
    this.active = null;
    // Labels in the order they were first seen, so the breakdown reads in render
    // order rather than reshuffling as timings arrive.
    this.order = [];
    this.results = new Map();
  }
  get available() {
    return !!this.ext;
  }
  // Measure one pass. The callback shape means a pass can never be left open by an
  // early return, which would silently poison every later query in the frame.
  span(label, run) {
    if (!this.ext || this.active) return run();
    const gl = this.gl;
    const query = this.spare.pop() ?? gl.createQuery();
    this.active = query;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    try {
      return run();
    } finally {
      gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.active = null;
      if (!this.order.includes(label)) this.order.push(label);
      this.pending.push({ label, query });
    }
  }
  // Call once a frame. A disjoint means the GPU was interrupted and every result in
  // flight is meaningless, so throw them away rather than reporting a spike that
  // never happened.
  poll() {
    if (!this.ext) return null;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    const keep = [];
    for (const entry of this.pending) {
      if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
        keep.push(entry);
        continue;
      }
      if (!disjoint) {
        const ms = gl.getQueryParameter(entry.query, gl.QUERY_RESULT) / 1e6;
        // A rolling mean: a single frame's timing is noisy enough to be unreadable
        // as a live number, and the question is always what a pass usually costs.
        const previous = this.results.get(entry.label);
        this.results.set(
          entry.label,
          previous === undefined ? ms : previous * 0.8 + ms * 0.2,
        );
      }
      this.spare.push(entry.query);
    }
    this.pending = keep;
    if (!this.results.size) return null;
    const passes = this.order
      .filter((label) => this.results.has(label))
      .map((label) => ({ label, ms: this.results.get(label) }));
    return { passes, total: passes.reduce((sum, p) => sum + p.ms, 0) };
  }
  // Labels come and go with the workspace; stale ones would sit in the breakdown
  // forever reporting a pass that no longer runs. Queries already in flight have to
  // go too — they belong to the workspace being left, and letting them land would
  // re-register the very labels this is clearing.
  reset() {
    this.order = [];
    this.results.clear();
    for (const { query } of this.pending) this.spare.push(query);
    this.pending = [];
  }
  dispose() {
    for (const { query } of this.pending) this.gl.deleteQuery(query);
    for (const query of this.spare) this.gl.deleteQuery(query);
    this.pending = [];
    this.spare = [];
  }
}
