import { objectOptics } from "./model.js";
import { lightRig } from "../project.js";
import { smoothNormals } from "./geometry.js";
import { quadVertex } from "../shaders.js";
// Defects are keyed to the object's identity, so a given vessel keeps the same
// bubbles and scratches across sessions without storing a field of them.
const seedOf = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h * 0.017;
};
const FOOTPRINT = 256;
const STAGE_EXTENT = 5;
const transforms = `
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
mat3 modelMatrix(vec3 d){return rz(radians(d.z))*ry(radians(d.y))*rx(radians(d.x));}`;
// Straight down over the stage: a coverage mask of what stands above each patch
// of floor, which is all a contact shadow needs and works for any mesh.
const footprintFragment = `#version 300 es
precision highp float;out vec4 frag;void main(){frag=vec4(1.);}`;
const footprintVertex = `#version 300 es
precision highp float;layout(location=0)in vec3 position;
uniform vec3 uPosition,uRotationObject,uScale;uniform float uStageExtent;
${transforms}
void main(){vec3 w=modelMatrix(uRotationObject)*(position*uScale)+uPosition;
 gl_Position=vec4(w.x/uStageExtent,w.z/uStageExtent,0.,1.);}`;
const vertex = `#version 300 es
precision highp float;layout(location=0)in vec3 position;layout(location=1)in vec3 normal;
uniform float uBillow,uFlow,uTime,uIsLayers;
uniform vec3 uPosition,uRotationObject,uScale;uniform float uTilt,uRotation,uZoom,uAspect,uPointSize,uPixelRatio;
out vec3 vNormal,vView,vLocal;out float vDepth;
${transforms}
void main(){vec3 local=position;
if(uIsLayers>.5) local.y=clamp(local.y+sin(local.x*4.+local.z*3.+uTime*uFlow*2.)*uBillow,normal.x,normal.y);
mat3 model=modelMatrix(uRotationObject);mat3 camera=rx(uTilt)*ry(uRotation);vec3 p=camera*(model*(local*uScale)+uPosition);float d=4.-p.z;
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
// The studio rig, and the world it stands in. Both are evaluated from world-space
// directions so the lights stay put when the camera orbits: highlights that sweep
// across a shell as you move are most of what separates glass from a painted ball.
const world = `
uniform sampler2D uFootprint;uniform float uStageExtent;
uniform vec4 uLightDir[3],uLightColor[3];
mat3 viewMatrix(float tilt,float rotation){
 float c=cos(rotation),s=sin(rotation),ct=cos(tilt),st=sin(tilt);
 return mat3(1,0,0,0,ct,st,0,-st,ct)*mat3(c,0,-s,0,1,0,s,0,c);}
vec3 envLight(vec3 d,float rough){
 vec3 sum=mix(vec3(.010,.014,.024),vec3(.048,.060,.082),smoothstep(-.9,.9,d.y))
  +vec3(.55,.34,.26)*smoothstep(.15,-.85,d.y)*.5;
 for(int i=0;i<3;i++){
  vec3 L=uLightDir[i].xyz;
  // A softbox is a rectangle, not a point. Build a basis on the light axis and
  // measure the two tangential offsets separately, so one expression gives both a
  // round octa and a tall strip. No azimuth to wrap and it holds at the poles.
  vec3 up=abs(L.y)>.95?vec3(1,0,0):vec3(0,1,0);
  vec3 t=normalize(cross(up,L)),b=cross(L,t);
  // The softbox height rides in the colour's fourth channel rather than costing a
  // third uniform array.
  vec2 box=vec2(uLightDir[i].w,uLightColor[i].a),wide=box+rough*.55;
  float x=dot(d,t)/wide.x,y=dot(d,b)/wide.y;
  // Roughness spreads the lobe, so give some of the energy back: a blurred
  // reflection of a light is wider and dimmer, never wider and brighter. The
  // square root rather than the full ratio because the broad lookups here double as
  // the ambient term, and conserving exactly leaves the room with no fill at all.
  float spread=sqrt(box.x*box.y/(wide.x*wide.y));
  sum+=uLightColor[i].rgb*exp(-(x*x+y*y))*spread*smoothstep(-.25,.15,dot(d,L));}
 return sum;
}
// The stage floor, as an analytic plane rather than geometry: it is infinite, it
// needs no depth, and refraction through a shell bends a real horizon instead of
// a flat gradient.
// rough is how sharply the caller sees the room, not the floor's own finish: a
// polished shell must see crisp softboxes where a frosted one sees a glow, and
// the floor reads its own polish from uStageRoughness either way.
vec3 stage(vec3 eye,vec3 dir,float floorY,float rough,float lit){
 float t=(floorY-eye.y)/dir.y;
 if(dir.y>-1e-4||t<=0.) return envLight(dir,rough)*lit;
 vec3 hit=eye+dir*t;
 // Shift the lookup toward the key light so the shadow falls away from it, and
 // sample wide enough that the edge is a penumbra rather than a cutout. Derived
 // from the key rather than fixed, so moving the light moves its shadow.
 vec2 foot=(hit.xz+uLightDir[0].xz/max(uLightDir[0].y,.25)*.3)/uStageExtent*.5+.5;
 float shade=0.;
 for(int i=0;i<8;i++){float a=float(i)*2.399963;
  vec2 o=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/8.)*.055;
  shade+=texture(uFootprint,foot+o).r;}
 shade=clamp(shade/8.,0.,1.);
 // Sheen: the rig reflected in the floor is what draws the light pools, and they
 // travel when a light moves because they are the same function.
 vec3 sheen=envLight(reflect(dir,vec3(0,1,0)),uStageRoughness);
 vec3 ambient=envLight(vec3(0,1,0),1.)+envLight(normalize(vec3(dir.x,.6,dir.z)),.85);
 vec3 surface=(vec3(.30,.31,.335)*ambient*(1.-shade*.82)+sheen*mix(1.1,.12,uStageRoughness)*(1.-shade*.55))*lit;
 // The seam where the floor meets the far wall: a real horizon for a shell to
 // bend, which a screen-space gradient can never give it.
 float far=smoothstep(3.5,9.,length(hit.xz-eye.xz));
 return mix(surface,envLight(dir,rough)*lit,far);
}`;
const backdropFragment = `#version 300 es
precision highp float;in vec2 uv;out vec4 frag;
uniform float uAspect,uZoom,uBackdrop,uTilt,uRotation,uStageFloor,uStageRoughness;
${world}
void main(){vec2 ndc=uv*2.-1.;
 mat3 cam=viewMatrix(uTilt,uRotation),inv=transpose(cam);
 vec3 eye=inv*vec3(0,0,4.);
 vec3 dir=inv*normalize(vec3(ndc.x*uAspect/(2.5*uZoom),ndc.y/(2.5*uZoom),-1.));
 frag=vec4(stage(eye,dir,uStageFloor,.3,uBackdrop),1.);}`;
const backDepth = `#version 300 es
precision highp float;in float vDepth;out vec4 frag;void main(){frag=vec4(vDepth/16.,0,0,1);}`;
// Real glass is never the ideal solid. The surface keeps the waviness of how it
// was formed and the scratches of having been handled, and the body keeps the
// seeds the furnace left behind. Flawlessness is the loudest tell of a render.
const flaws = `
float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float vnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 vec4 a=vec4(hash3(i),hash3(i+vec3(1,0,0)),hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)));
 vec4 b=vec4(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)));
 vec4 m=mix(a,b,f.z);
 return mix(mix(m.x,m.y,f.x),mix(m.z,m.w,f.x),f.y);}
// The slope of the noise, which is the direction the surface should tilt along.
vec3 wobble(vec3 p,float f){float e=.07,c=vnoise(p*f);
 return (vec3(vnoise(p*f+vec3(e,0,0)),vnoise(p*f+vec3(0,e,0)),vnoise(p*f+vec3(0,0,e)))-c)/e;}
// One seed per cell, jittered, most of them too small to see. A bubble never
// spans a cell, so the neighbouring cells never have to be checked.
float seed(vec3 p,float size){vec3 i=floor(p),f=fract(p);
 vec3 c=vec3(hash3(i),hash3(i+11.3),hash3(i+23.7))*.6+.2;
 // Cube the draw: a real melt leaves a few big seeds and a great many specks,
 // where a flat distribution reads as evenly sprinkled dots.
 float h=hash3(i+37.1);float r=size*(.06+.94*h*h*h);
 return 1.-smoothstep(r*.45,r,length(f-c));}
`;
const glass = `#version 300 es
precision highp float;in vec3 vNormal,vView,vLocal;in float vDepth;out vec4 frag;
uniform sampler2D uContents,uBackDepth;uniform vec2 uResolution;uniform vec3 uTint;
uniform float uOpacity,uIor,uRoughness,uThickness,uDispersion,uStudioLight,uAbsorption,uZoom,uAspect,uSamples;
uniform float uTilt,uRotation,uStageFloor,uStageRoughness,uDefects,uInclusions,uSeed;
uniform vec3 uRotationObject,uScale;
${transforms}
${flaws}
${world}
void main(){vec3 n=normalize(vNormal),view=normalize(-vView);
 mat3 body=viewMatrix(uTilt,uRotation)*modelMatrix(uRotationObject);
 vec3 q=vLocal*2.+uSeed;
 // Three scales at once: the lens-like waviness of forming, orange peel, and the
 // scratch field. One octave alone reads as a pattern rather than as wear.
 if(uDefects>0.){vec3 g=wobble(q,1.4)*.13+wobble(q,7.)*.03+wobble(q,31.)*.006;
  n=normalize(n-body*(g/max(uScale,.05))*uDefects);}
 float nv=max(.001,dot(n,view));
 float f0=pow((uIor-1.)/(uIor+1.),2.);float f=f0+(1.-f0)*pow(1.-nv,5.);
 vec2 uv=gl_FragCoord.xy/uResolution;
 float exitDepth=texture(uBackDepth,uv).r;
 float chord=exitDepth>.999 ? .15 : max(.02,exitDepth*16.-vDepth);
 // Uneven walls: the reason a real vessel magnifies unevenly as it turns.
 float thickness=chord*uThickness*(1.+(vnoise(q*.9)-.5)*uDefects*.8);
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
 // Walk the body along the refracted ray so seeds sit at depth and slide against
 // the surface as the camera moves, instead of looking painted on.
 if(uInclusions>0.){
  vec3 dir=normalize(transpose(body)*ray/max(uScale,.05));
  float len=clamp(chord/max(dot(uScale,vec3(.3333)),.05),.1,2.);
  vec3 glow=envLight(n,.4)*uStudioLight;
  for(int i=0;i<4;i++){
   float b=seed((vLocal+dir*len*(float(i)+.5)*.25)*7.+uSeed,.06+.24*uInclusions)*uInclusions;
   contents=mix(contents,vec3(.015)+glow*b*.35,b*.85);}}
 vec3 absorption=exp(-max(vec3(.001),vec3(1.)-uTint)*(uAbsorption+uOpacity)*thickness*4.);
 // Reflect the room, not just the rig: the floor wrapping into the underside of a
 // shell is most of what puts an object on a surface rather than in a void. The
 // backdrop control dims what the camera sees directly, never what the glass sees.
 mat3 inv=transpose(viewMatrix(uTilt,uRotation));
 vec3 posW=inv*(vView+vec3(0,0,4.));
 vec3 reflection=stage(posW,inv*reflect(-view,n),uStageFloor,uRoughness,1.)*uStudioLight;
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
    this.footprint = engine.program(footprintVertex, footprintFragment);
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
    // A contained simulation accumulates into its own faded pair, exactly as the
    // particle workspace does: the streaks and most of the brightness of a saved
    // project come from that history, not from a single frame of points.
    this.trail = [
      this.colorTarget(g.LINEAR, null),
      this.colorTarget(g.LINEAR, null),
    ];
    this.trailRead = 0;
    this.clearTrail();
    const previous = [this.width, this.height];
    [this.width, this.height] = [FOOTPRINT, FOOTPRINT];
    this.shadow = this.colorTarget(g.LINEAR, null);
    [this.width, this.height] = previous;
  }
  clearTrail() {
    if (!this.trail) return;
    const g = this.engine.gl;
    for (const t of this.trail) {
      g.bindFramebuffer(g.FRAMEBUFFER, t.fb);
      g.clearColor(0, 0, 0, 1);
      g.clear(g.COLOR_BUFFER_BIT);
    }
  }
  render(objects, config, shared, w, h, target, drawContents) {
    const e = this.engine,
      g = e.gl;
    // The rig is resolved once per frame on the CPU: kelvin, drift and flicker are
    // per-light, never per-pixel, and the shader only ever needs the result.
    const rig = lightRig(config, shared.uTime);
    const bindRig = (program) => {
      e.uniform(program, "uLightDir[0]", rig.direction, "v4");
      e.uniform(program, "uLightColor[0]", rig.color, "v4");
    };
    this.sync(objects);
    this.resize(w, h);
    g.viewport(0, 0, w, h);
    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    // Coverage from straight above, for the floor's contact shadow.
    const casters = objects.filter((o) => o.visible);
    g.bindFramebuffer(g.FRAMEBUFFER, this.shadow.fb);
    g.viewport(0, 0, FOOTPRINT, FOOTPRINT);
    g.clearColor(0, 0, 0, 1);
    g.clear(g.COLOR_BUFFER_BIT);
    for (const o of casters) {
      const r = this.resources.get(o.id);
      e.set(this.footprint, {
        uPosition: o.position,
        uRotationObject: o.rotation,
        uScale: o.scale,
        uStageExtent: STAGE_EXTENT,
      });
      g.bindVertexArray(r.vaos[0]);
      g.drawArrays(g.TRIANGLES, 0, r.meshCount);
    }
    g.viewport(0, 0, w, h);
    g.activeTexture(g.TEXTURE6);
    g.bindTexture(g.TEXTURE_2D, this.shadow.texture);
    g.activeTexture(g.TEXTURE0);
    const accumulator = this.accumulator.fb;
    g.bindFramebuffer(g.FRAMEBUFFER, accumulator);
    g.clearColor(0.002, 0.004, 0.007, 1);
    g.clearDepth(1);
    g.depthMask(true);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    // Studio sweep behind the objects, so refraction and reflection have a world to show.
    if (config.backdrop > 0) {
      e.set(this.backdrop, {
        ...shared,
        uBackdrop: config.backdrop,
        uStageFloor: config.stageFloor,
        uStageRoughness: config.stageRoughness,
        uStageExtent: STAGE_EXTENT,
        uStageExtent: STAGE_EXTENT,
      });
      e.uniform(this.backdrop, "uFootprint", 6, "int");
      bindRig(this.backdrop);
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
        uDefects: o.defects,
        uInclusions: o.inclusions,
        uSeed: seedOf(o.id),
        uDispersion: o.dispersion,
        uStudioLight: o.studioLight,
        uStageFloor: config.stageFloor,
        uStageRoughness: config.stageRoughness,
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
        e.uniform(program, "uFootprint", 6, "int");
        bindRig(program);
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
    if (drawContents) {
      // Fade the history, lay this frame's points over it, then add the result to
      // the scene so the shells refract it alongside the dots.
      const write = 1 - this.trailRead;
      g.disable(g.BLEND);
      g.bindFramebuffer(g.FRAMEBUFFER, this.trail[write].fb);
      g.bindVertexArray(e.emptyVAO);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, this.trail[this.trailRead].texture);
      e.set(e.fade, { uFade: config.trail });
      e.uniform(e.fade, "uTexture", 0, "int");
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      drawContents();
      this.trailRead = write;
      g.bindFramebuffer(g.FRAMEBUFFER, accumulator);
      g.bindVertexArray(e.emptyVAO);
      g.bindTexture(g.TEXTURE_2D, this.trail[this.trailRead].texture);
      e.set(e.fade, { uFade: 1 });
      e.uniform(e.fade, "uTexture", 0, "int");
      g.drawArrays(g.TRIANGLES, 0, 3);
    }
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
    for (const t of [this.scene, this.back, this.shadow, ...(this.trail || [])])
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
    this.trail = this.shadow = null;
  }
  dispose() {
    for (const r of this.resources.values()) this.deleteResource(r);
    this.resources.clear();
    this.disposeTarget();
  }
}
