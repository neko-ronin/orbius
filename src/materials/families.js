import { studioRig } from "../lighting.js";
// A family used to be a branch in one enormous fragment shader, selected by an
// integer. Adding one meant editing that file, adding a number to a list, and
// registering its parameters by hand in three more places — none of them reachable
// from the running application, which is the whole reason a person could not add one.
//
// A family is a value now: a name, a kind, a GLSL body, and whatever controls the
// body declares for itself. The scaffold below supplies everything hard — camera,
// march, normals, Fresnel, the studio rig, hue — and the body fills in a small,
// fixed set of functions.

// Every family defines these. `displace` is required rather than optional because
// moving its own surface is what separated Liquid mercury from a painted ball, and a
// family that does not want it writes one line.
export const contracts = {
  volume: {
    label: "Volume",
    // rgb is emission at that point, a is density.
    signature: "vec4 medium(vec3 q)",
    note: "Called along a ray through the interior. Return colour and density.",
  },
  surface: {
    label: "Surface",
    signature: "vec3 surface(vec3 p, vec3 n, vec3 rd, float fres)",
    note: "Called once at the surface. Return the colour seen there.",
  },
};

// `// @control name min max step "field note" [search terms]` — the shader is the
// single source of truth for its own parameters, so a new family arrives with its
// sliders, ranges, clamping, persistence and field notes already described.
const CONTROL =
  /^\s*\/\/\s*@control\s+(\w+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+"([^"]*)"\s*(?:"([^"]*)")?/;
export function parseControls(glsl) {
  const controls = {};
  const defaults = {};
  for (const line of glsl.split("\n")) {
    const m = CONTROL.exec(line);
    if (!m) continue;
    const [, name, min, max, step, note, terms] = m;
    const label = name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase());
    controls[name] = [
      label,
      +min,
      +max,
      +step,
      note,
      terms || "glsl shader parameter",
    ];
    // Midpoint unless the family says otherwise via @default.
    defaults[name] = (+min + +max) / 2;
  }
  for (const line of glsl.split("\n")) {
    const m = /^\s*\/\/\s*@default\s+(\w+)\s+(-?[\d.]+)/.exec(line);
    if (m && m[1] in defaults) defaults[m[1]] = +m[2];
  }
  return { controls, defaults };
}

// The uniform name a control is read through, so a family writes `uScale` for a
// control it declared as `scale`.
export const uniformName = (key) => "u" + key[0].toUpperCase() + key.slice(1);

const COMMON = `#version 300 es
precision highp float;
in vec2 uv;out vec4 frag;
uniform vec2 uResolution;
uniform sampler2D uChemistry;
uniform vec3 uColorA,uColorB,uColorC;
uniform float uTime,uRotation,uTilt,uZoom,uHue,uIor,uReflection,uRoughness;
uniform float uInteriorMotion,uEmission,uMaterialScale,uMaterialFold,uSurfaceActivity;
uniform float uEnclosure,uContained,uPlaceScale;uniform vec3 uPlace;
uniform int uSteps;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+1.7;a*=.5;}return v;}
mat3 turn(){float c=cos(uRotation),s=sin(uRotation),a=cos(uTilt),b=sin(uTilt);return mat3(c,0,s,0,1,0,-s,0,c)*mat3(1,0,0,0,a,-b,0,b,a);}
${studioRig}
// Declared before the body so the body can call them in any order.
float displace(vec3 p);
`;

// The body sits between these two halves. Loop bounds are constants here and only
// here: a family contributes function bodies, never a bound, so no authored or
// imported family can hang the GPU with an unbounded march.
const TAIL = (kind) => `
// Anything outside the silhouette. A family opts in with \`#define HAS_HALO\` and its
// own \`halo\`; without one the miss path costs a return. Solar cartography needs it
// because a star's corona is the part of it that is not the star.
#ifndef HAS_HALO
vec3 halo(vec3 ro,vec3 rd){return vec3(0.);}
#endif
float shell(vec3 p){return length(p)-1.+displace(p);}
vec3 normalAt(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(shell(p+e.xyy)-shell(p-e.xyy),shell(p+e.yxy)-shell(p-e.yxy),shell(p+e.yyx)-shell(p-e.yyx)));}
void main(){
 vec2 st=(uv*2.-1.)*vec2(uResolution.x/uResolution.y,1.);mat3 cam=turn();
 vec3 ro=cam*vec3(0,0,3.7),rd=cam*normalize(vec3(st/uZoom,-2.5));
 float travel=0.;bool hit=false;vec3 p;
 if(uContained>.5){
  // Rendered inside another workspace's scene: take that camera, and map the
  // placement back onto this family's own unit sphere so the march is unchanged.
  vec2 ndc=uv*2.-1.;float aspect=uResolution.x/uResolution.y;
  mat3 inv=transpose(viewMatrix(uTilt,uRotation));
  vec3 eyeW=inv*vec3(0,0,4.);
  vec3 dirW=inv*normalize(vec3(ndc.x*aspect/(2.5*uZoom),ndc.y/(2.5*uZoom),-1.));
  ro=(eyeW-uPlace)/uPlaceScale;rd=normalize(dirW);
  // Start at the sphere rather than walking to it: placed small, the entry point is
  // far outside the march's range, and the body would simply never be reached.
  float b=dot(ro,rd),c=dot(ro,ro)-1.;float disc=b*b-c;
  if(disc<0.){frag=vec4(halo(ro,rd),1);return;}
  travel=max(0.,-b-sqrt(disc));
 }
 // A displaced field overestimates distance, so the step shortens with how far the
 // family is allowed to push the surface.
 float safe=.72/(1.+uMaterialFold*1.2);
 for(int i=0;i<192;i++){if(i>=uSteps)break;p=ro+rd*travel;float d=shell(p);
  if(d<.0015){hit=true;break;}travel+=max(d*safe,.001);if(travel>7.)break;}
 vec3 color=vec3(.003,.005,.009);
 // Contained, this is composited additively into somebody else's frame, so a miss
 // contributes the family's halo and nothing else — never its own background.
 if(!hit){vec3 h=halo(ro,rd);frag=vec4(uContained>.5?h:color+h,1);return;}
 vec3 n=normalAt(p);float fres=pow(1.-max(0.,dot(n,-rd)),5.);
${
  kind === "volume"
    ? ` vec3 reflected=envRoom(reflect(rd,n),uRoughness);
 vec3 sum=vec3(0);float trans=1.;float ds=2.1/float(uSteps);
 for(int i=0;i<192;i++){if(i>=uSteps)break;
  vec3 q=p+rd*(float(i)+.5)*ds;if(length(q)>1.01)break;
  vec4 m=medium(q);
  float alpha=1.-exp(-m.a*ds*3.5);
  sum+=m.rgb*alpha*trans;trans*=1.-alpha;
  if(trans<.01)break;}
 color=sum+reflected*(.025+fres*.6)*uReflection*uEnclosure;`
    : ` color=surface(p,n,rd,fres);`
}
 float hueAngle=uHue*6.283185;vec3 hueAxis=normalize(vec3(1.));
 color=color*cos(hueAngle)+cross(hueAxis,color)*sin(hueAngle)+hueAxis*dot(hueAxis,color)*(1.-cos(hueAngle));
 frag=vec4(max(color,0.),1.);
}`;

// Where the author's first line lands in the assembled shader, so a compiler
// message can be translated back. Derived from the assembly itself, so it cannot
// drift when the preamble changes.
export function sourceOffset(family) {
  const source = familySource(family);
  return source.slice(0, source.indexOf(family.glsl)).split("\n").length - 1;
}
export function familySource(family) {
  const declared = Object.keys(parseControls(family.glsl).controls)
    .map((k) => `uniform float ${uniformName(k)};`)
    .join("");
  return COMMON + declared + "\n" + family.glsl + TAIL(family.kind);
}
// The built-ins, as records. They are seeds, not special cases: an authored family
// is the same shape and goes through the same scaffold.
export const builtins = [
  {
    id: "silk",
    name: "Prismatic silk",
    kind: "volume",
    glsl: `// @control filament 4 60 0.5 "How tightly the sheets pinch into threads. Low values give broad veils; high values give fine silk." "isosurface thickness volumetric"
// @default filament 24
// @control weave 0.5 3 0.05 "How many times the interference pattern repeats through the volume." "trigonometric interference surface"
// @default weave 1
float displace(vec3 p){return 0.;}
vec4 medium(vec3 q){
 vec3 w=q*uMaterialScale*uWeave;
 w+=sin(w.yzx*1.5+uTime*uInteriorMotion)*uMaterialFold;
 float v=dot(sin(w),cos(w.zxy));
 float den=exp(-abs(v)*uFilament)*.6;
 vec3 c=.5+.5*cos(vec3(0,2,4)+w.y*1.2+w.z);
 // Constants carried over from this family's own integrator, which the scaffold's
 // canonical one replaced: 1.137 and 1.368 make the two agree to within a few
 // percent at peak density, rather than leaving the port visibly thinner.
 return vec4(mix(c,uColorC,.2)*uEmission*1.368,den*1.137);
}`,
  },
  {
    id: "solar",
    name: "Solar cartography",
    kind: "surface",
    glsl: `#define HAS_HALO
// @control corona 0 1.5 0.05 "How far the atmosphere reaches past the limb. Streamers grow from wherever the surface is active, so a quiet star keeps a thin ring." "corona atmosphere prominence limb"
// @default corona 0.6
float displace(vec3 p){return 0.;}
// The pole is where atan(0,0) is undefined, on the surface and above it alike.
vec2 sphereMap(vec3 d){
 return vec2(atan(d.z,abs(d.x)<1e-5&&abs(d.z)<1e-5?1.:d.x)/6.283185+.5,
  acos(clamp(d.y,-1.,1.))/3.141593);
}
vec3 halo(vec3 ro,vec3 rd){
 // Closest approach to the star. Behind the camera there is nothing to glow.
 float t=-dot(ro,rd);
 if(t<=0.)return vec3(0.);
 vec3 near=ro+rd*t;float d=length(near);
 if(d<1.)return vec3(0.);
 vec3 dir=near/d;
 // Anchored to the chemistry, so a streamer stands over an active region rather
 // than being an even shell of fog.
 float act=texture(uChemistry,sphereMap(dir)).g;
 float reach=.05+act*.45*uCorona;
 float glow=exp(-(d-1.)/max(reach,.015));
 float flicker=.65+.35*noise(dir*11.+uTime*uInteriorMotion*.5);
 return mix(vec3(1.,.42,.1),uColorA,.3)*glow*flicker*uEmission*uCorona*.5;
}
vec3 surface(vec3 p,vec3 n,vec3 rd,float fres){
 vec3 q=p*uMaterialScale;
 vec2 sphereUV=sphereMap(p);
 float chemical=texture(uChemistry,sphereUV).g;
 float grain=fbm(q*2.)*.12+fbm(q*7.)*.05;
 float f=chemical*1.5+grain;
 float front=1.-smoothstep(.025,.075,abs(f-uSurfaceActivity*.65));
 vec2 tx=1./vec2(textureSize(uChemistry,0));
 vec2 g=vec2(texture(uChemistry,sphereUV+vec2(tx.x,0)).g-texture(uChemistry,sphereUV-vec2(tx.x,0)).g,
             texture(uChemistry,sphereUV+vec2(0,tx.y)).g-texture(uChemistry,sphereUV-vec2(0,tx.y)).g);
 float relief=clamp(.7+(g.x*.8-g.y*.55)*5.,0.,1.5);
 vec3 crust=vec3(.03,.014,.01)*(.35+noise(q*12.)*.9)*relief;
 // A luminous body darkens toward its limb rather than brightening.
 float limb=pow(max(0.,dot(n,-rd)),.55);
 vec3 c=(crust+mix(uColorA,uColorC,front)*front*uEmission*1.15*relief)*mix(.3,1.,limb);
 return c+vec3(.9,.3,.08)*pow(1.-limb,2.5)*uEmission*.18;
}`,
  },
  {
    id: "mercury",
    name: "Liquid mercury",
    kind: "surface",
    glsl: `float displace(vec3 p){
 // Liquid moves its own surface. The silhouette is what sells it.
 vec3 q=p*2.1+uTime*uInteriorMotion*.35;
 float bead=sin(q.x)*sin(q.y)*sin(q.z);
 float ripple=sin(q.x*1.9+q.y*1.3)*sin(q.z*1.7-q.y*1.1);
 return (bead*.13+ripple*.055)*uMaterialFold;
}
vec3 surface(vec3 p,vec3 n,vec3 rd,float fres){
 // Metals have no diffuse term and a coloured Fresnel.
 vec3 tint=mix(uColorA,uColorC,.5+.5*sin(p.y*2.4+uTime*uInteriorMotion*.3));
 vec3 f0=mix(vec3(.78,.79,.8),tint,.4);
 vec3 c=envRoom(reflect(rd,n),uRoughness)*(f0+(1.-f0)*fres)*(.6+uReflection*.8);
 return c*(1.-pow(1.-abs(dot(n,-rd)),8.)*.35);
}`,
  },
  {
    id: "composer",
    name: "Composed fields",
    kind: "volume",
    glsl: `uniform float uFieldA,uFieldB,uFieldOperation,uFieldMix,uFieldOffset,uFieldRatio,uFieldWidth,uFieldColor;
float field(vec3 p,float kind){
 if(kind<.5)return dot(sin(p),cos(p.zxy))*.65;
 if(kind<1.5)return sin(length(p.xz)*2.-p.y*1.3);
 if(kind<2.5)return (fbm(p*1.4)-.47)*3.;
 return (sin(p.x)+sin(p.y*1.2)+cos(p.z))*.4;
}
float displace(vec3 p){return 0.;}
vec4 medium(vec3 q){
 vec3 w=q*uMaterialScale;
 w+=sin(w.yzx*1.3+uTime*uInteriorMotion*.5)*uMaterialFold;
 float a=field(w,uFieldA),b=field(w*uFieldRatio+vec3(uFieldOffset,0.,-uFieldOffset*.4),uFieldB);
 float da=exp(-abs(a)/uFieldWidth),db=exp(-abs(b)/uFieldWidth),density;
 if(uFieldOperation<.5)density=exp(-abs(mix(a,b,uFieldMix))/uFieldWidth);
 else if(uFieldOperation<1.5)density=max(da,db*uFieldMix);
 else if(uFieldOperation<2.5)density=da*mix(1.,db,uFieldMix);
 else density=da*(1.-db*uFieldMix);
 vec3 tint=mix(uColorA,uColorB,.5+.5*sin(w.y*uFieldColor+w.z*.3));
 tint=mix(tint,uColorC,pow(clamp(density,0.,1.),3.)*.65);
 return vec4(tint*uEmission*1.8,density);
}`,
  },
];
export const familyById = Object.fromEntries(builtins.map((f) => [f.id, f]));
// Saved projects carry the old integer. Nothing in a file should have to change for
// a refactor that is supposed to be invisible.
export const LEGACY = { 1: "silk", 2: "solar", 3: "mercury", 4: "composer" };

// What a new family starts as. Enough to compile and show something, so the first
// thing an author sees is a working object rather than an error.
export const templates = {
  volume: `// @control density 0.5 6 0.1 "How much light the body holds." "volumetric density"
// @default density 2.4
// @control scale 1 12 0.1 "How many times the structure repeats." "procedural noise frequency"
// @default scale 4
float displace(vec3 p){return 0.;}
vec4 medium(vec3 q){
 vec3 w=q*uScale;
 w+=sin(w.yzx*1.4+uTime*uInteriorMotion)*uMaterialFold;
 float v=dot(sin(w),cos(w.zxy));
 float den=exp(-abs(v)*8.)*uDensity;
 vec3 tint=mix(uColorA,uColorC,.5+.5*sin(w.y+w.z));
 return vec4(tint*uEmission,den);
}`,
  surface: `// @control sheen 0 1 0.01 "How much of the studio the surface returns." "specular reflectance"
// @default sheen 0.6
// @control ripple 0 0.3 0.005 "How far the surface departs from a sphere." "signed distance displacement"
// @default ripple 0.08
float displace(vec3 p){
 vec3 q=p*3.+uTime*uInteriorMotion*.3;
 return sin(q.x)*sin(q.y)*sin(q.z)*uRipple;
}
vec3 surface(vec3 p,vec3 n,vec3 rd,float fres){
 vec3 tint=mix(uColorA,uColorC,.5+.5*n.y);
 return envRoom(reflect(rd,n),uRoughness)*mix(tint,vec3(1.),fres)*uSheen;
}`,
};
// Ids the author never types: a family is identified, not named, so renaming one
// cannot orphan the parameters saved against it.
export const newFamily = (kind, name) => ({
  id: `f${crypto.randomUUID().slice(0, 8)}`,
  name: name || "Untitled family",
  kind,
  glsl: templates[kind],
});
// A project carries its own families; the built-ins are always there. Ids are
// unique across both, so a lookup never has to know where a family came from.
export function resolveFamilies(userFamilies = []) {
  return Object.fromEntries(
    [...builtins, ...userFamilies].map((f) => [f.id, f]),
  );
}
// A rough measure of how hard a family will make the GPU work per pixel. It is not
// static analysis and does not pretend to be: it counts the shapes that turn a
// bounded march into a slow one, so an obviously pathological source can be refused
// before it reaches a driver. Loop bounds are the scaffold's, so a family cannot
// make the march longer — only each step of it more expensive, up to 192 times.
export function complexity(glsl) {
  const body = glsl.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const count = (re) => (body.match(re) || []).length;
  // Nesting is the multiplier that matters: work inside a loop inside the march.
  let depth = 0,
    deepest = 0;
  for (const ch of body) {
    if (ch === "{") deepest = Math.max(deepest, ++depth);
    else if (ch === "}") depth = Math.max(0, --depth);
  }
  return {
    length: body.length,
    loops: count(/\b(for|while)\s*\(/g),
    calls: count(
      /\b(texture|fbm|noise|pow|exp|sin|cos|normalize|inverse)\s*\(/g,
    ),
    depth: deepest,
  };
}
export const COMPLEXITY_LIMITS = { loops: 8, calls: 400, depth: 12 };
export function tooComplex(glsl) {
  const c = complexity(glsl);
  for (const [key, limit] of Object.entries(COMPLEXITY_LIMITS))
    if (c[key] > limit)
      return `This family is too heavy to run safely: ${c[key]} ${key} (limit ${limit}). It would stall the GPU rather than render.`;
  return null;
}
export const MAX_FAMILIES = 24;
export const MAX_GLSL = 20000;
export function validateFamilies(list) {
  if (list === undefined) return [];
  if (!Array.isArray(list) || list.length > MAX_FAMILIES)
    throw Error(`A project supports up to ${MAX_FAMILIES} families.`);
  const seen = new Set(builtins.map((f) => f.id));
  return list.map((f) => {
    if (
      !f ||
      typeof f.id !== "string" ||
      !/^f[a-z0-9]{4,32}$/.test(f.id) ||
      seen.has(f.id) ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      f.name.length > 80 ||
      !contracts[f.kind] ||
      typeof f.glsl !== "string" ||
      f.glsl.length > MAX_GLSL
    )
      throw Error("Invalid shader family.");
    // A family is executable content. Refuse the obviously pathological before it
    // reaches a compiler, rather than discovering it by losing the GPU context.
    const heavy = tooComplex(f.glsl);
    if (heavy) throw Error(heavy);
    seen.add(f.id);
    return { id: f.id, name: f.name, kind: f.kind, glsl: f.glsl };
  });
}
