import { quadVertex } from "../shaders.js";
// Cell size is set in texels by the reaction's fixed rates, so the map's resolution
// is what decides how large a cell looks on the sphere. 256x128 drew a handful of
// boulders; this draws granulation.
const W = 1024,
  H = 512;
const update = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform sampler2D uState;uniform float uSeed,uFeed,uKill;
vec2 sampleAt(vec2 p){if(p.y<0.)p=vec2(p.x+.5,-p.y);if(p.y>1.)p=vec2(p.x+.5,2.-p.y);return texture(uState,vec2(fract(p.x),clamp(p.y,0.,1.))).rg;}
void main(){if(uSeed>0.){float spot=step(.83,fract(sin(dot(floor(uv*vec2(96.,48.)),vec2(127.1,311.7)))*43758.54));frag=vec4(1.-spot*.5,spot*.5,0,1);return;}
vec2 d=1./vec2(textureSize(uState,0));
// One texel of longitude covers a shrinking angle toward the poles, so a uniform
// stencil diffuses anisotropically and drags cells into streaks. Stretch the
// longitude step to cover equal angular distance, capped so the poles stay finite.
d.x/=max(sin(uv.y*3.141593),.12);
vec2 c=sampleAt(uv);vec2 lap=-c;
lap+=.2*(sampleAt(uv+vec2(d.x,0))+sampleAt(uv-vec2(d.x,0))+sampleAt(uv+vec2(0,d.y))+sampleAt(uv-vec2(0,d.y)));
lap+=.05*(sampleAt(uv+d)+sampleAt(uv-d)+sampleAt(uv+vec2(d.x,-d.y))+sampleAt(uv+vec2(-d.x,d.y)));
float reaction=c.x*c.y*c.y;vec2 next=c+vec2(lap.x-reaction+uFeed*(1.-c.x),.5*lap.y+reaction-(uKill+uFeed)*c.y);frag=vec4(clamp(next,0.,1.),0,1);}`;
// Fixed-resolution feedback is independent of the presentation resolution.
export class Chemistry {
  constructor(engine) {
    this.engine = engine;
    this.read = 0;
    this.accumulator = 0;
    this.program = engine.program(quadVertex, update);
    const gl = engine.gl;
    this.targets = [0, 1].map(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        engine.hdr ? gl.RGBA16F : gl.RGBA8,
        W,
        H,
        0,
        gl.RGBA,
        engine.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      // Longitude is periodic and latitude is not: clamping both made the shader's
      // own lookup stretch the border column into a seam down the sphere.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (const filter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
        gl.texParameteri(gl.TEXTURE_2D, filter, gl.LINEAR);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      );
      return { tex, fb };
    });
    this.reset();
  }
  step(seed = false, feed = 0.036, kill = 0.061) {
    const e = this.engine,
      g = e.gl;
    g.bindFramebuffer(g.FRAMEBUFFER, this.targets[1 - this.read].fb);
    g.viewport(0, 0, W, H);
    g.bindVertexArray(e.emptyVAO);
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, this.targets[this.read].tex);
    e.set(this.program, { uSeed: seed ? 1 : 0, uFeed: feed, uKill: kill });
    e.uniform(this.program, "uState", 1, "int");
    g.drawArrays(g.TRIANGLES, 0, 3);
    this.read = 1 - this.read;
    g.activeTexture(g.TEXTURE0);
  }
  reset() {
    this.step(true);
    // Finer cells grow from the seed more slowly in texel terms, so the map is walked
    // further before it is first shown.
    for (let i = 0; i < 220; i++) this.step();
    this.accumulator = 0;
  }
  advance(dt, feed, kill) {
    this.accumulator = Math.min(this.accumulator + dt * 120, 12);
    while (this.accumulator >= 1) {
      this.step(false, feed, kill);
      this.accumulator--;
    }
  }
  get texture() {
    return this.targets[this.read].tex;
  }
  dispose() {
    const g = this.engine.gl;
    this.targets.forEach((t) => {
      g.deleteTexture(t.tex);
      g.deleteFramebuffer(t.fb);
    });
  }
}
