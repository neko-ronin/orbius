import { objectOptics } from "./model.js";
import { smoothNormals } from "./geometry.js";
import { quadVertex } from "../shaders.js";
const vertex = `#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 normal;
uniform float uBillow,uFlow,uTime,uIsLayers;
uniform vec3 uPosition,uRotationObject,uScale;uniform float uTilt,uRotation,uZoom,uAspect,uPointSize,uPixelRatio;
out vec3 vNormal,vView,vLocal;out float vDepth;
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
void main(){vec3 local=position;
if(uIsLayers>.5) local.y=clamp(local.y+sin(local.x*4.+local.z*3.+uTime*uFlow*2.)*uBillow,normal.x,normal.y);
mat3 model=rz(radians(uRotationObject.z))*ry(radians(uRotationObject.y))*rx(radians(uRotationObject.x));mat3 camera=rx(uTilt)*ry(uRotation);vec3 p=camera*(model*(local*uScale)+uPosition);float d=4.-p.z;
vLocal=local;vView=vec3(p.xy,-d);vNormal=camera*model*(normal/uScale);vDepth=d;gl_Position=vec4(p.x*2.5*uZoom/uAspect,p.y*2.5*uZoom,(20.1/19.9)*d-(4./19.9),d);gl_PointSize=clamp(uPointSize*uPixelRatio*3.5/max(d,.1),1.,32.);}`;
const dots = `#version 300 es
precision highp float;in float vDepth;in vec3 vLocal;out vec4 frag;uniform vec3 uTint,uColorTop;uniform float uEmission,uOpacity,uGradient,uFlow,uSparkles,uTime;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
float h=fract(sin(dot(vLocal,vec3(127.1,311.7,74.7)))*43758.5453);
float wave=.78+.22*sin(vLocal.x*7.+vLocal.z*5.+uTime*uFlow*3.);
float spark=step(1.-uSparkles*.025,h)*pow(.5+.5*sin(uTime*uFlow*2.+h*97.),8.)*6.;
float a=exp(-r*r*4.)*.6*uEmission*uOpacity*exp(-max(vDepth-3.,0.)*.12);
vec3 color=mix(uTint,uColorTop,smoothstep(-.35,.5,vLocal.y)*uGradient);
float peak=pow(.5+.5*sin(vLocal.x*7.+vLocal.z*5.),8.);
frag=vec4((color*wave*(1.+peak*1.8)+vec3(spark))*a,a);}`;
const env = `
vec3 envLight(vec3 d,float rough){
 float sharp=1.-rough;float az=atan(d.x,d.z);
 vec3 sky=mix(vec3(.010,.014,.024),vec3(.048,.060,.082),smoothstep(-.9,.9,d.y));
 float key=pow(max(0.,dot(d,normalize(vec3(-.45,.5,.74)))),mix(2.5,26.,sharp));
 float band=smoothstep(-.95,-.35,d.y)*smoothstep(1.05,.35,d.y);
 float strip=exp(-pow((az-1.15)*mix(2.5,9.,sharp),2.))*band;
 float edge=exp(-pow((az+2.05)*mix(3.,15.,sharp),2.))*band;
 float bounce=smoothstep(.15,-.85,d.y);
 return sky+vec3(1.,.97,.93)*key*1.9+vec3(.72,.86,1.)*strip*2.6+vec3(1.,.74,.48)*edge*2.1+vec3(.55,.34,.26)*bounce*.5;
}`;
const backdropFragment = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;uniform float uAspect,uBackdrop;
void main(){vec2 p=(uv*2.-1.)*vec2(uAspect,1.);vec2 q=(p-vec2(0.,-.25))*vec2(.6,1.);
 vec3 c=mix(vec3(.052,.058,.072),vec3(.006,.008,.013),smoothstep(-1.,.9,p.y));
 frag=vec4((c+vec3(.10,.11,.135)*exp(-dot(q,q)*1.5))*uBackdrop,1.);}`;
const backDepth = `#version 300 es
precision highp float;in float vDepth;out vec4 frag;void main(){frag=vec4(vDepth/16.,0,0,1);}`;
const glass = `#version 300 es
precision highp float;in vec3 vNormal,vView;in float vDepth;out vec4 frag;
uniform sampler2D uContents,uBackDepth;uniform vec2 uResolution;uniform vec3 uTint;
uniform float uOpacity,uIor,uRoughness,uThickness,uDispersion,uStudioLight,uAbsorption,uZoom,uAspect,uSamples;
${env}
void main(){vec3 n=normalize(vNormal),view=normalize(-vView);float nv=max(.001,dot(n,view));
 float f0=pow((uIor-1.)/(uIor+1.),2.);float f=f0+(1.-f0)*pow(1.-nv,5.);
 vec2 uv=gl_FragCoord.xy/uResolution;
 float exitDepth=texture(uBackDepth,uv).r;
 float chord=exitDepth>.999 ? .15 : max(.02,exitDepth*16.-vDepth);
 float thickness=chord*uThickness;
 vec3 ray=refract(-view,n,1./uIor);
 vec2 bend=(ray.xy/max(.2,abs(ray.z))+view.xy/max(.2,view.z))*thickness*vec2(2.5*uZoom/uAspect,2.5*uZoom)/max(vDepth,1.);
 vec3 contents=vec3(0.);
 for(int i=0;i<12;i++){if(float(i)>=uSamples)break;float span=(float(i)+.5)/uSamples;
 float a=float(i)*2.399963;vec2 offset=vec2(cos(a),sin(a))*sqrt(span)*uRoughness*uRoughness*.035;
 // Smear the spectrum across the samples rather than taking three fixed taps:
 // strong dispersion then reads as a spectral edge instead of colour noise.
 vec2 split=bend*uDispersion*(.35+1.3*span);
 vec2 base=uv+bend+offset;
 vec3 tap=vec3(texture(uContents,base+split).r,texture(uContents,base).g,texture(uContents,base-split).b);
 // A lookup past the edge of the screen would repeat the border pixel into a
 // streak, so fade those back to looking straight through the shell.
 vec2 over=max(vec2(0.),max(abs(split)-base,base+abs(split)-1.));
 float lost=min(1.,(over.x+over.y)*20.);
 if(lost>0.) tap=mix(tap,texture(uContents,clamp(uv+offset,vec2(0.),vec2(1.))).rgb,lost);
 contents+=tap;}
 contents/=uSamples;
 vec3 absorption=exp(-max(vec3(.001),vec3(1.)-uTint)*(uAbsorption+uOpacity)*thickness*4.);
 vec3 reflection=envLight(reflect(-view,n),uRoughness)*uStudioLight;
 // Grazing sheen: the thin bright edge a real shell shows against a dark studio.
 reflection+=mix(vec3(.6,.72,1.),uTint,.35)*pow(1.-nv,6.)*uStudioLight*.4;
 frag=vec4(contents*absorption*(1.-f)+reflection*f,1.);
}`;
export class ObjectRenderer {
  constructor(engine) {
    this.engine = engine;
    this.glass = engine.program(vertex, glass);
    this.dots = engine.program(vertex, dots);
    this.backDepth = engine.program(vertex, backDepth);
    this.backdrop = engine.program(quadVertex, backdropFragment);
    this.resources = new Map();
  }
  sync(objects) {
    const g = this.engine.gl;
    const ids = new Set(objects.map((o) => o.id));
    for (const [id, r] of this.resources)
      if (!ids.has(id)) {
        this.deleteResource(r);
        this.resources.delete(id);
      }
    for (const object of objects) {
      const previous = this.resources.get(object.id);
      if (
        previous?.triangles === object.triangles &&
        previous?.points === object.points &&
        previous?.pointLimits === object.pointLimits
      )
        continue;
      if (previous) this.deleteResource(previous);
      const mesh = Float32Array.from(object.triangles),
        normals = smoothNormals(mesh),
        points = Float32Array.from(object.points);
      const limits = object.pointLimits
        ? new Float32Array(points.length)
        : null;
      if (limits)
        for (let i = 0; i < points.length / 3; i++) {
          limits[i * 3] = object.pointLimits[i * 2];
          limits[i * 3 + 1] = object.pointLimits[i * 2 + 1];
        }
      const buffers = [],
        vaos = [];
      for (const [positions, normalData] of [
        [mesh, normals],
        [points, limits],
      ]) {
        const vao = g.createVertexArray();
        g.bindVertexArray(vao);
        vaos.push(vao);
        for (const [index, data] of [
          [0, positions],
          [1, normalData],
        ]) {
          if (!data) {
            g.disableVertexAttribArray(index);
            g.vertexAttrib3f(index, 0, 0, 1);
            continue;
          }
          const buffer = g.createBuffer();
          buffers.push(buffer);
          g.bindBuffer(g.ARRAY_BUFFER, buffer);
          g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
          g.enableVertexAttribArray(index);
          g.vertexAttribPointer(index, 3, g.FLOAT, false, 0, 0);
        }
      }
      this.resources.set(object.id, {
        triangles: object.triangles,
        points: object.points,
        pointLimits: object.pointLimits,
        vaos,
        buffers,
        meshCount: mesh.length / 3,
        pointCount: points.length / 3,
      });
    }
    g.bindVertexArray(null);
  }
  colorTarget(filter, depth) {
    const g = this.engine.gl,
      { width: w, height: h } = this;
    const texture = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      this.engine.hdr ? g.RGBA16F : g.RGBA8,
      w,
      h,
      0,
      g.RGBA,
      this.engine.hdr ? g.HALF_FLOAT : g.UNSIGNED_BYTE,
      null,
    );
    for (const key of [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER])
      g.texParameteri(g.TEXTURE_2D, key, filter);
    for (const key of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T])
      g.texParameteri(g.TEXTURE_2D, key, g.CLAMP_TO_EDGE);
    const fb = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fb);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      texture,
      0,
    );
    if (depth)
      g.framebufferRenderbuffer(
        g.FRAMEBUFFER,
        g.DEPTH_ATTACHMENT,
        g.RENDERBUFFER,
        depth,
      );
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw Error(
        "Could not allocate object rendering target. Lower render quality.",
      );
    return { texture, fb };
  }
  depthRenderbuffer(samples) {
    const g = this.engine.gl,
      buffer = g.createRenderbuffer();
    g.bindRenderbuffer(g.RENDERBUFFER, buffer);
    g.renderbufferStorageMultisample(
      g.RENDERBUFFER,
      samples,
      g.DEPTH_COMPONENT16,
      this.width,
      this.height,
    );
    return buffer;
  }
  // The accumulator every object draws into. Multisampling it is what gives the
  // shell silhouettes clean edges; the fragment shader still runs once per pixel.
  accumulatorTarget(samples) {
    const g = this.engine.gl;
    const color = g.createRenderbuffer(),
      depth = this.depthRenderbuffer(samples);
    g.bindRenderbuffer(g.RENDERBUFFER, color);
    g.renderbufferStorageMultisample(
      g.RENDERBUFFER,
      samples,
      this.engine.hdr ? g.RGBA16F : g.RGBA8,
      this.width,
      this.height,
    );
    const fb = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fb);
    for (const [slot, buffer] of [
      [g.COLOR_ATTACHMENT0, color],
      [g.DEPTH_ATTACHMENT, depth],
    ])
      g.framebufferRenderbuffer(g.FRAMEBUFFER, slot, g.RENDERBUFFER, buffer);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE)
      return { fb, color, depth, samples };
    g.deleteFramebuffer(fb);
    g.deleteRenderbuffer(color);
    g.deleteRenderbuffer(depth);
    return null;
  }
  resize(w, h) {
    if (this.width === w && this.height === h) return;
    const g = this.engine.gl;
    this.disposeTarget();
    this.width = w;
    this.height = h;
    // Sample count drops on large targets: a multisampled RGBA16F buffer at show
    // resolution is the largest allocation this renderer makes. Zero samples is a
    // plain renderbuffer, which is the fallback when the GPU refuses the rest.
    const wanted = Math.min(w * h > 2e6 ? 2 : 4, g.getParameter(g.MAX_SAMPLES));
    this.accumulator =
      this.accumulatorTarget(wanted) || this.accumulatorTarget(0);
    if (!this.accumulator)
      throw Error(
        "Could not allocate object rendering target. Lower render quality.",
      );
    // Shells composite back to front, each refracting the layers already behind
    // it, so the accumulator resolves here for the next shell to read.
    this.scene = this.colorTarget(g.LINEAR, null);
    this.backDepthBuffer = this.depthRenderbuffer(0);
    this.back = this.colorTarget(g.NEAREST, this.backDepthBuffer);
  }
  render(objects, config, shared, w, h, target) {
    const e = this.engine,
      g = e.gl;
    this.sync(objects);
    this.resize(w, h);
    g.viewport(0, 0, w, h);
    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    const accumulator = this.accumulator.fb;
    g.bindFramebuffer(g.FRAMEBUFFER, accumulator);
    g.clearColor(0.002, 0.004, 0.007, 1);
    g.clearDepth(1);
    g.depthMask(true);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    // Studio sweep behind the objects, so refraction and reflection have a world to show.
    if (config.backdrop > 0) {
      e.set(this.backdrop, {
        uZoom: shared.uZoom,
        uAspect: shared.uAspect,
        uBackdrop: config.backdrop,
      });
      g.bindVertexArray(e.emptyVAO);
      g.drawArrays(g.TRIANGLES, 0, 3);
    }
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE);
    const draw = (o, program, points) => {
      o = { ...objectOptics, ...o };
      const r = this.resources.get(o.id);
      e.set(program, {
        ...shared,
        uPosition: o.position,
        uRotationObject: o.rotation,
        uScale: o.scale,
        uTint: [1, 3, 5].map(
          (i) => parseInt(o.color.slice(i, i + 2), 16) / 255,
        ),
        uColorTop: [1, 3, 5].map(
          (i) => parseInt(o.colorTop.slice(i, i + 2), 16) / 255,
        ),
        uBillow: o.billow,
        uIsLayers: points && o.role === "layers" && o.pointLimits ? 1 : 0,
        uGradient: o.gradient,
        uFlow: o.flow,
        uSparkles: o.sparkles,
        uThickness: o.thickness,
        uDispersion: o.dispersion,
        uStudioLight: o.studioLight,
        uAbsorption: o.absorption,
        uSamples: e.show ? 12 : 4,
        uEmission: o.emission,
        uOpacity: o.opacity,
        uIor: o.ior,
        uRoughness: o.roughness,
        uPointSize: o.pointSize,
        uPixelRatio: w / e.canvas.getBoundingClientRect().width,
        uResolution: [w, h],
      });
      if (!points) {
        e.uniform(program, "uContents", 3, "int");
        e.uniform(program, "uBackDepth", 4, "int");
      }
      g.bindVertexArray(r.vaos[points ? 1 : 0]);
      g.drawArrays(
        points ? g.POINTS : g.TRIANGLES,
        0,
        points ? r.pointCount : r.meshCount,
      );
    };
    objects
      .filter((o) => o.visible && o.role !== "glass")
      .forEach((o) => draw(o, this.dots, true));
    g.disable(g.BLEND);
    // Camera-space depth of each origin: the vertex shader tilts, then rotates.
    const cameraZ = (p) =>
      Math.sin(shared.uTilt) * p[1] +
      Math.cos(shared.uTilt) *
        (Math.cos(shared.uRotation) * p[2] - Math.sin(shared.uRotation) * p[0]);
    const shells = objects
      .filter((o) => o.visible && o.role === "glass")
      .sort((a, b) => cameraZ(a.position) - cameraZ(b.position));
    g.enable(g.CULL_FACE);
    g.depthFunc(g.LESS);
    for (const o of shells) {
      // Measure this shell's back faces for optical thickness.
      g.bindFramebuffer(g.FRAMEBUFFER, this.back.fb);
      g.enable(g.DEPTH_TEST);
      g.clearColor(1, 0, 0, 1);
      g.clearDepth(1);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      g.cullFace(g.FRONT);
      draw(o, this.backDepth, false);
      // Resolve everything behind the shell so it has something to refract, then
      // shade it back into the accumulator. The depth buffer there keeps nearer
      // shells in front, per pixel, and survives the resolve.
      g.bindFramebuffer(g.READ_FRAMEBUFFER, accumulator);
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.scene.fb);
      g.blitFramebuffer(0, 0, w, h, 0, 0, w, h, g.COLOR_BUFFER_BIT, g.NEAREST);
      g.bindFramebuffer(g.FRAMEBUFFER, accumulator);
      g.activeTexture(g.TEXTURE3);
      g.bindTexture(g.TEXTURE_2D, this.scene.texture);
      g.activeTexture(g.TEXTURE4);
      g.bindTexture(g.TEXTURE_2D, this.back.texture);
      g.activeTexture(g.TEXTURE0);
      g.cullFace(g.BACK);
      draw(o, this.glass, false);
    }
    g.bindFramebuffer(g.READ_FRAMEBUFFER, accumulator);
    g.bindFramebuffer(g.DRAW_FRAMEBUFFER, target);
    g.blitFramebuffer(0, 0, w, h, 0, 0, w, h, g.COLOR_BUFFER_BIT, g.NEAREST);
    g.bindFramebuffer(g.FRAMEBUFFER, target);
    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    g.bindVertexArray(null);
  }
  deleteResource(r) {
    const g = this.engine.gl;
    r.buffers.forEach((b) => g.deleteBuffer(b));
    r.vaos.forEach((v) => g.deleteVertexArray(v));
  }
  disposeTarget() {
    const g = this.engine.gl;
    for (const t of [this.scene, this.back])
      if (t) {
        g.deleteTexture(t.texture);
        g.deleteFramebuffer(t.fb);
      }
    if (this.accumulator) {
      g.deleteFramebuffer(this.accumulator.fb);
      g.deleteRenderbuffer(this.accumulator.color);
      g.deleteRenderbuffer(this.accumulator.depth);
    }
    if (this.backDepthBuffer) g.deleteRenderbuffer(this.backDepthBuffer);
    this.scene = this.back = this.accumulator = this.backDepthBuffer = null;
  }
  dispose() {
    for (const r of this.resources.values()) this.deleteResource(r);
    this.resources.clear();
    this.disposeTarget();
  }
}
