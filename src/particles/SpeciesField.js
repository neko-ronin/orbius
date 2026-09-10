// A projected XZ density field: each color channel represents one population.
// This is art-directed field coupling, not an incompressible 3D fluid solver.
export class SpeciesField {
  constructor(engine) {
    this.engine = engine;
    const g = engine.gl;
    this.program = engine.program(
      `#version 300 es
precision highp float;layout(location=0)in vec4 aPosition;layout(location=1)in vec4 aVelocity;flat out int species;
void main(){species=int(mod(floor(aVelocity.w),3.));gl_Position=vec4(aPosition.xz/4.,0,1);gl_PointSize=9.;}`,
      `#version 300 es
precision highp float;flat in int species;out vec4 frag;
void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.)*.04;frag=vec4(species==0?a:0.,species==1?a:0.,species==2?a:0.,1.);}`,
    );
    this.tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, this.tex);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      engine.hdr ? g.RGBA16F : g.RGBA8,
      128,
      128,
      0,
      g.RGBA,
      engine.hdr ? g.HALF_FLOAT : g.UNSIGNED_BYTE,
      null,
    );
    for (const filter of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER])
      g.texParameteri(g.TEXTURE_2D, filter, g.LINEAR);
    for (const axis of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T])
      g.texParameteri(g.TEXTURE_2D, axis, g.CLAMP_TO_EDGE);
    this.fb = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, this.fb);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      this.tex,
      0,
    );
  }
  render() {
    const e = this.engine,
      g = e.gl;
    g.bindFramebuffer(g.FRAMEBUFFER, this.fb);
    g.viewport(0, 0, 128, 128);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE);
    g.useProgram(this.program.p);
    g.bindVertexArray(e.vaos[e.read]);
    g.drawArrays(g.POINTS, 0, e.count);
    g.disable(g.BLEND);
  }
  dispose() {
    const g = this.engine.gl;
    g.deleteTexture(this.tex);
    g.deleteFramebuffer(this.fb);
  }
}
