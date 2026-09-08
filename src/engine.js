import {
  quadVertex,
  simVertex,
  emptyFragment,
  particleVertex,
  particleFragment,
  fadeFragment,
  compositeFragment,
  orbFragment,
} from "./shaders.js";
import { palettes, defaultShader } from "./project.js";
const rgb = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const fieldTypes = ["attract", "repel", "vortex", "light", "burst", "freeze"];
export class Engine {
  constructor(canvas, onStats, onError) {
    this.canvas = canvas;
    this.onStats = onStats;
    this.onError = onError;
    this.gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!this.gl)
      throw Error(
        "WebGL 2 is unavailable. Try a current Chrome, Edge, Firefox, or Safari with hardware acceleration enabled.",
      );
    this.hdr = !!this.gl.getExtension("EXT_color_buffer_float");
    this.time = 0;
    this.tick = 0;
    this.read = 0;
    this.trailRead = 0;
    this.targets = [];
    this.buffers = [];
    this.vaos = [];
    this.programs = [];
    this.lost = false;
    this.contextLost = (e) => {
      e.preventDefault();
      this.lost = true;
      onError(
        "The GPU context was lost. Reload the page to restore the renderer; your last local autosave is available.",
      );
    };
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.sim = this.program(simVertex, emptyFragment, [
      "vPosition",
      "vVelocity",
    ]);
    this.particles = this.program(particleVertex, particleFragment);
    this.fade = this.program(quadVertex, fadeFragment);
    this.composite = this.program(quadVertex, compositeFragment);
    this.orb = this.program(quadVertex, orbFragment(defaultShader));
    const gl = this.gl;
    this.emptyVAO = gl.createVertexArray();
    this.feedback = gl.createTransformFeedback();
    this.last = performance.now();
    this.statTime = this.last;
    this.frames = 0;
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }
  program(vertex, fragment, varyings) {
    const gl = this.gl;
    const p = gl.createProgram();
    const shaders = [];
    try {
      for (const [type, src] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ]) {
        const s = gl.createShader(type);
        shaders.push(s);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      if (varyings)
        gl.transformFeedbackVaryings(p, varyings, gl.INTERLEAVED_ATTRIBS);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(p));
      this.programs.push(p);
      return { p, locations: {} };
    } catch (e) {
      gl.deleteProgram(p);
      throw e;
    } finally {
      shaders.forEach((s) => gl.deleteShader(s));
    }
  }
  compile(source) {
    const next = this.program(quadVertex, orbFragment(source));
    this.gl.deleteProgram(this.orb.p);
    this.programs = this.programs.filter((p) => p !== this.orb.p);
    this.orb = next;
  }
  uniform(prog, name, value, type) {
    const gl = this.gl;
    const loc =
      prog.locations[name] ??
      (prog.locations[name] = gl.getUniformLocation(prog.p, name));
    if (loc === null) return;
    if (type === "int") gl.uniform1i(loc, value);
    else if (type === "v4") gl.uniform4fv(loc, value);
    else if (type === "v3") gl.uniform3fv(loc, value);
    else if (Array.isArray(value)) gl[`uniform${value.length}fv`](loc, value);
    else gl.uniform1f(loc, value);
  }
  set(prog, values) {
    this.gl.useProgram(prog.p);
    for (const [key, val] of Object.entries(values))
      this.uniform(prog, key, val);
  }
  reset(c) {
    const gl = this.gl;
    this.buffers.forEach((b) => gl.deleteBuffer(b));
    this.vaos.forEach((v) => gl.deleteVertexArray(v));
    this.buffers = [];
    this.vaos = [];
    this.count = Math.round(c.count);
    const data = new Float32Array(this.count * 8);
    let seed = 483921;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < this.count; i++) {
      const r = Math.sqrt(rand()) * c.spread,
        a =
          (Math.floor(rand() * c.arms) * Math.PI * 2) / c.arms +
          r * c.twist +
          (rand() - 0.5) * 0.25;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      data.set(
        [
          x,
          (rand() - 0.5) * c.depth * (0.2 + r * 0.45),
          z,
          rand() * c.life,
          -z * c.spin * 0.3,
          0,
          x * c.spin * 0.3,
          i + 0.5,
        ],
        i * 8,
      );
    }
    for (let i = 0; i < 2; i++) {
      const b = gl.createBuffer(),
        v = gl.createVertexArray();
      gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
      for (let a = 0; a < 2; a++) {
        gl.enableVertexAttribArray(a);
        gl.vertexAttribPointer(a, 4, gl.FLOAT, false, 32, a * 16);
      }
      this.buffers.push(b);
      this.vaos.push(v);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.read = 0;
    this.clear();
  }
  clear() {
    this.rendered = false;
    const gl = this.gl;
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize(width, height) {
    const gl = this.gl,
      old = this.targets,
      oldWidth = this.canvas.width,
      oldHeight = this.canvas.height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.targets = [];
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        this.hdr ? gl.RGBA16F : gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      );
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw Error(
          "Could not allocate render target. Lower the rendering resolution.",
        );
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (old.length) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, old[this.trailRead].fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fb);
        gl.blitFramebuffer(
          0,
          0,
          oldWidth,
          oldHeight,
          0,
          0,
          width,
          height,
          gl.COLOR_BUFFER_BIT,
          gl.LINEAR,
        );
      }
      this.targets.push({ tex, fb });
    }
    old.forEach((t) => {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  fields(prog, fields) {
    const pos = new Float32Array(48),
      extra = new Float32Array(48),
      colors = new Float32Array(36);
    fields.slice(0, 12).forEach((f, i) => {
      pos.set([f.x, f.y, fieldTypes.indexOf(f.type), f.strength], i * 4);
      extra.set([f.radius, 0, 0, 0], i * 4);
      colors.set(rgb(f.color), i * 3);
    });
    this.uniform(prog, "uFieldCount", Math.min(fields.length, 12), "int");
    this.uniform(prog, "uFields[0]", pos, "v4");
    this.uniform(prog, "uFieldExtra[0]", extra, "v4");
    this.uniform(prog, "uFieldColors[0]", colors, "v3");
  }
  render(delta = 0, forceSize) {
    if (!this.config || this.lost) return;
    const c = this.config,
      gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    let ratio = this.show ? c.showScale : c.devScale;
    let w = Math.max(2, Math.round(rect.width * ratio)),
      h = Math.max(2, Math.round(rect.height * ratio));
    const limit = Math.min(3840, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if (Math.max(w, h) > limit) {
      const scale = limit / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    if (forceSize) [w, h] = forceSize;
    if (
      this.canvas.width !== w ||
      this.canvas.height !== h ||
      !this.targets.length
    )
      this.resize(w, h);
    if (this.count !== Math.round(c.count)) this.reset(c);
    const dt = this.paused ? 0 : Math.min(delta, 0.033) * c.speed;
    this.time += dt;
    this.tick += dt;
    const rotation = c.rotation + this.time * c.autoRotate;
    const colors = palettes[c.palette].colors.map(rgb);
    const shared = {
      uTilt: c.tilt,
      uRotation: rotation,
      uAspect: w / h,
      uZoom: c.zoom,
      uTime: this.time,
      uColorA: colors[0],
      uColorB: colors[1],
      uColorC: colors[2],
      uHue: c.hue,
    };
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (this.mode === "particles") {
      if (dt > 0) {
        this.set(this.sim, {
          ...shared,
          uDt: dt,
          uLife: c.life,
          uSpread: c.spread,
          uSpin: c.spin,
          uTurbulence: c.turbulence,
          uFrequency: c.frequency,
          uDrag: c.drag,
          uGravity: c.gravity,
          uDepth: c.depth,
          uArms: c.arms,
          uTwist: c.twist,
        });
        this.fields(this.sim, this.fieldList || []);
        gl.bindVertexArray(this.vaos[this.read]);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
        gl.bindBufferBase(
          gl.TRANSFORM_FEEDBACK_BUFFER,
          0,
          this.buffers[1 - this.read],
        );
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.count);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        this.read = 1 - this.read;
      }
      if (!this.paused || !this.rendered || this.previousConfig !== c) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[1 - this.trailRead].fb);
        gl.bindVertexArray(this.emptyVAO);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.targets[this.trailRead].tex);
        this.set(this.fade, {
          uFade:
            c.trail === 0 ? 0 : Math.pow(c.trail, Math.max(delta, 0.008) * 60),
        });
        this.uniform(this.fade, "uTexture", 0, "int");
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        this.set(this.particles, {
          ...shared,
          uLife: c.life,
          uSize: c.size,
          uPixelRatio: w / rect.width,
        });
        this.fields(this.particles, this.fieldList || []);
        gl.bindVertexArray(this.vaos[this.read]);
        gl.drawArrays(gl.POINTS, 0, this.count);
        gl.disable(gl.BLEND);
        this.trailRead = 1 - this.trailRead;
        this.rendered = true;
        this.previousConfig = c;
      }
    } else if (this.mode === "orb") {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[this.trailRead].fb);
      gl.bindVertexArray(this.emptyVAO);
      this.set(this.orb, {
        ...shared,
        uResolution: [w, h],
        uMorph: c.orbMorph,
        uRadius: c.orbScale,
        uDisplace: c.displacement,
        uDetail: c.detail,
        uTwist: c.twist,
        uTurbulence: c.turbulence,
        uFrequency: c.frequency,
        uRoughness: c.roughness,
        uMetallic: c.metallic,
        uIor: c.ior,
        uReflection: c.reflection,
        uShadow: c.shadow,
        uAmbient: c.ambient,
        uKeyLight: c.keyLight,
      });
      this.uniform(this.orb, "uSteps", this.show ? 192 : 80, "int");
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[this.trailRead].fb);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(this.emptyVAO);
    gl.bindTexture(gl.TEXTURE_2D, this.targets[this.trailRead].tex);
    this.set(this.composite, {
      uResolution: [w, h],
      uBloom: c.bloom,
      uExposure: c.exposure,
      uGrain: c.grain,
      uVignette: c.vignette,
      uTime: this.time,
    });
    this.uniform(this.composite, "uTexture", 0, "int");
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  frame(now) {
    if (this.disposed) return;
    const delta = (now - this.last) / 1000;
    this.last = now;
    try {
      this.render(delta);
    } catch (e) {
      this.onError(e.message);
      this.disposed = true;
      return;
    }
    this.frames++;
    if (now - this.statTime > 800) {
      this.onStats({
        fps: Math.round((this.frames * 1000) / (now - this.statTime)),
        width: this.canvas.width,
        height: this.canvas.height,
        time: this.time,
        count: this.count || 0,
      });
      this.statTime = now;
      this.frames = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  }
  async capture(width = 3840) {
    const rect = this.canvas.getBoundingClientRect();
    const max = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
    const w = Math.min(width, max),
      h = Math.min(max, Math.round((w * rect.height) / rect.width));
    const previous = this.show;
    try {
      this.show = true;
      this.render(0, [w, h]);
      const blob = await new Promise((resolve) =>
        this.canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("PNG export failed.");
      return blob;
    } finally {
      this.show = previous;
    }
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const gl = this.gl;
    this.programs.forEach((p) => gl.deleteProgram(p));
    this.buffers.forEach((b) => gl.deleteBuffer(b));
    this.vaos.forEach((v) => gl.deleteVertexArray(v));
    this.targets.forEach((t) => {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    });
    gl.deleteVertexArray(this.emptyVAO);
    gl.deleteTransformFeedback(this.feedback);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
  }
}
