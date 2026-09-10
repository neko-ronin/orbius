import { objectOptics } from "./model.js";
import { smoothNormals } from "./geometry.js";
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
const backDepth = `#version 300 es
precision highp float;in float vDepth;out vec4 frag;void main(){frag=vec4(vDepth/16.,0,0,1);}`;
const glass = `#version 300 es
precision highp float;in vec3 vNormal,vView;in float vDepth;out vec4 frag;
uniform sampler2D uContents,uBackDepth;uniform vec2 uResolution;uniform vec3 uTint;
uniform float uOpacity,uIor,uRoughness,uThickness,uDispersion,uStudioLight,uAbsorption,uZoom,uAspect,uSamples;
vec3 studio(vec3 d){
 float blur=mix(65.,8.,uRoughness);
 float key=exp(-pow((d.x+.5)*4.,2.)-pow((d.y-.45)*2.,2.));
 float strip=exp(-pow((d.x-.62)*mix(25.,5.,uRoughness),2.))*smoothstep(-.75,.2,d.y);
 float rim=pow(max(0.,dot(d,normalize(vec3(-1.,.1,-.4)))),blur*.4);
 float floorLight=exp(-pow((d.y+.7)*12.,2.));
 return (vec3(.055,.07,.09)+vec3(.9,.95,1.)*key*1.5+vec3(.65,.85,1.)*strip*3.+vec3(1.,.7,.4)*rim+vec3(.4,.8,1.)*floorLight*.5)*uStudioLight;
}
void main(){vec3 n=normalize(vNormal),view=normalize(-vView);float nv=max(.001,dot(n,view));
 float f0=pow((uIor-1.)/(uIor+1.),2.);float f=f0+(1.-f0)*pow(1.-nv,5.);
 vec2 uv=gl_FragCoord.xy/uResolution;
 float exitDepth=texture(uBackDepth,uv).r;
 float chord=exitDepth>.999 ? .15 : max(.02,exitDepth*16.-vDepth);
 float thickness=chord*uThickness;
 vec3 ray=refract(-view,n,1./uIor);
 vec2 bend=(ray.xy/max(.2,abs(ray.z))+view.xy/max(.2,view.z))*thickness*vec2(2.5*uZoom/uAspect,2.5*uZoom)/max(vDepth,1.);
 vec3 contents=vec3(0.);
 for(int i=0;i<12;i++){if(float(i)>=uSamples)break;float a=float(i)*2.399963;vec2 offset=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/uSamples)*uRoughness*uRoughness*.035;
 vec2 sampleUV=uv+bend+offset;
 contents.r+=texture(uContents,clamp(sampleUV+bend*uDispersion,vec2(0),vec2(1))).r;
 contents.g+=texture(uContents,clamp(sampleUV,vec2(0),vec2(1))).g;
 contents.b+=texture(uContents,clamp(sampleUV-bend*uDispersion,vec2(0),vec2(1))).b;}
 contents/=uSamples;
 vec3 absorption=exp(-max(vec3(.001),vec3(1.)-uTint)*(uAbsorption+uOpacity)*thickness*4.);
 vec3 reflection=studio(reflect(-view,n));
 frag=vec4(contents*absorption*(1.-f)+reflection*f,1.);
}`;
export class ObjectRenderer {
  constructor(engine) {
    this.engine = engine;
    this.glass = engine.program(vertex, glass);
    this.dots = engine.program(vertex, dots);
    this.backDepth = engine.program(vertex, backDepth);
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
  resize(w, h) {
    if (this.width === w && this.height === h) return;
    const g = this.engine.gl;
    this.disposeTarget();
    this.width = w;
    this.height = h;
    this.texture = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, this.texture);
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
      this.texture,
      0,
    );
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw Error(
        "Could not allocate object rendering target. Lower render quality.",
      );
    this.backTexture = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, this.backTexture);
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
      g.texParameteri(g.TEXTURE_2D, key, g.NEAREST);
    for (const key of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T])
      g.texParameteri(g.TEXTURE_2D, key, g.CLAMP_TO_EDGE);
    this.backFB = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, this.backFB);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      this.backTexture,
      0,
    );
    this.depthBuffer = g.createRenderbuffer();
    g.bindRenderbuffer(g.RENDERBUFFER, this.depthBuffer);
    g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, w, h);
    g.framebufferRenderbuffer(
      g.FRAMEBUFFER,
      g.DEPTH_ATTACHMENT,
      g.RENDERBUFFER,
      this.depthBuffer,
    );
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw Error("Could not allocate glass depth target.");
  }
  render(objects, config, shared, w, h, target) {
    const e = this.engine,
      g = e.gl;
    this.sync(objects);
    this.resize(w, h);
    g.viewport(0, 0, w, h);
    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    g.bindFramebuffer(g.FRAMEBUFFER, this.fb);
    g.clearColor(0.002, 0.004, 0.007, 1);
    g.clear(g.COLOR_BUFFER_BIT);
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
    // Copy the dot layer, then shade the imported enclosures against that layer.
    g.bindFramebuffer(g.READ_FRAMEBUFFER, this.fb);
    g.bindFramebuffer(g.DRAW_FRAMEBUFFER, target);
    g.blitFramebuffer(0, 0, w, h, 0, 0, w, h, g.COLOR_BUFFER_BIT, g.NEAREST);
    g.bindFramebuffer(g.FRAMEBUFFER, target);
    g.activeTexture(g.TEXTURE3);
    g.bindTexture(g.TEXTURE_2D, this.texture);
    g.activeTexture(g.TEXTURE0);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.enable(g.CULL_FACE);
    const shells = objects
      .filter((o) => o.visible && o.role === "glass")
      .sort((a, b) => a.position[2] - b.position[2]);
    for (const o of shells) {
      g.disable(g.BLEND);
      g.enable(g.DEPTH_TEST);
      g.depthFunc(g.LESS);
      g.bindFramebuffer(g.FRAMEBUFFER, this.backFB);
      g.clearColor(1, 0, 0, 1);
      g.clearDepth(1);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      g.cullFace(g.FRONT);
      draw(o, this.backDepth, false);
      g.disable(g.DEPTH_TEST);
      g.bindFramebuffer(g.FRAMEBUFFER, target);
      g.activeTexture(g.TEXTURE4);
      g.bindTexture(g.TEXTURE_2D, this.backTexture);
      g.activeTexture(g.TEXTURE0);
      g.cullFace(g.BACK);
      draw(o, this.glass, false);
    }
    g.disable(g.BLEND);
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
    if (this.texture) g.deleteTexture(this.texture);
    if (this.fb) g.deleteFramebuffer(this.fb);
    if (this.backTexture) g.deleteTexture(this.backTexture);
    if (this.backFB) g.deleteFramebuffer(this.backFB);
    if (this.depthBuffer) g.deleteRenderbuffer(this.depthBuffer);
  }
  dispose() {
    for (const r of this.resources.values()) this.deleteResource(r);
    this.resources.clear();
    this.disposeTarget();
  }
}
