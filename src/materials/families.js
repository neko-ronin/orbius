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
float shell(vec3 p){return length(p)-1.+displace(p);}
vec3 normalAt(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(shell(p+e.xyy)-shell(p-e.xyy),shell(p+e.yxy)-shell(p-e.yxy),shell(p+e.yyx)-shell(p-e.yyx)));}
void main(){
 vec2 st=(uv*2.-1.)*vec2(uResolution.x/uResolution.y,1.);mat3 cam=turn();
 vec3 ro=cam*vec3(0,0,3.7),rd=cam*normalize(vec3(st/uZoom,-2.5));
 float travel=0.;bool hit=false;vec3 p;
 // A displaced field overestimates distance, so the step shortens with how far the
 // family is allowed to push the surface.
 float safe=.72/(1.+uMaterialFold*1.2);
 for(int i=0;i<192;i++){if(i>=uSteps)break;p=ro+rd*travel;float d=shell(p);
  if(d<.0015){hit=true;break;}travel+=max(d*safe,.001);if(travel>7.)break;}
 vec3 color=vec3(.003,.005,.009);
 if(!hit){frag=vec4(color,1);return;}
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
 color=sum+reflected*(.025+fres*.6)*uReflection;`
    : ` color=surface(p,n,rd,fres);`
}
 float hueAngle=uHue*6.283185;vec3 hueAxis=normalize(vec3(1.));
 color=color*cos(hueAngle)+cross(hueAxis,color)*sin(hueAngle)+hueAxis*dot(hueAxis,color)*(1.-cos(hueAngle));
 frag=vec4(max(color,0.),1.);
}`;

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
    glsl: `float displace(vec3 p){return 0.;}
vec3 surface(vec3 p,vec3 n,vec3 rd,float fres){
 vec3 q=p*uMaterialScale;
 // atan(0,0) is undefined and that is exactly the pole of the sphere.
 vec2 sphereUV=vec2(atan(p.z,abs(p.x)<1e-5&&abs(p.z)<1e-5?1.:p.x)/6.283185+.5,
  acos(clamp(p.y,-1.,1.))/3.141593);
 float chemical=texture(uChemistry,sphereUV).g;
 float grain=fbm(q*2.)*.12+fbm(q*7.)*.05;
 float f=chemical*1.5+grain;
 float front=1.-smoothstep(.025,.075,abs(f-uSurfaceActivity*.65));
 vec2 tx=vec2(1./256.,1./128.);
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
