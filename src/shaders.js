import { studioRig } from "./lighting.js";
export const quadVertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
export const simVertex = `#version 300 es
precision highp float;
layout(location=0) in vec4 aPosition;
layout(location=1) in vec4 aVelocity;
out vec4 vPosition;out vec4 vVelocity;
uniform float uDt,uTime,uLife,uSpread,uSpin,uTurbulence,uFrequency,uDrag,uGravity,uDepth,uArms,uTwist,uTilt,uRotation,uZoom,uAspect;
uniform float uSpeciesEnabled;
uniform int uFieldCount;
uniform vec4 uFields[12];uniform vec4 uFieldExtra[12];
uniform sampler2D uDensity;uniform vec3 uCouplingA,uCouplingB,uCouplingC,uSpeciesDrag,uSpeciesLift;
precision highp sampler3D;
uniform sampler3D uVolume;uniform float uContain,uContainPush,uEye,uProjScale,uVoxel;
uniform vec3 uContainPos,uContainRot,uContainScale;
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
// Matches the enclosure's own model rotation in the object renderer.
mat3 containModel(){vec3 r=radians(uContainRot);
 float cx=cos(r.x),sx=sin(r.x),cy=cos(r.y),sy=sin(r.y),cz=cos(r.z),sz=sin(r.z);
 return mat3(cz,sz,0,-sz,cz,0,0,0,1)*mat3(cy,0,-sy,0,1,0,sy,0,cy)*mat3(1,0,0,0,cx,sx,0,-sx,cx);}
// CLAMP_TO_EDGE would stretch a border texel to infinity, and any border texel
// the mesh touches then reads as interior — a tunnel of "inside" running out of
// the grid. Outside the unit box is always outside.
float occupancy(vec3 local){vec3 a=abs(local);
 if(max(a.x,max(a.y,a.z))>1.) return 0.;
 return texture(uVolume,local*.5+.5).r;}
vec3 toLocal(mat3 model,vec3 p){return (transpose(model)*(p-uContainPos))/uContainScale;}
// Rejection sample the interior; the centre is the fallback for awkward shells.
vec3 spawnInside(float seed){for(int k=0;k<6;k++){float s=seed+float(k)*7.13;
 vec3 q=vec3(hash(s),hash(s+3.1),hash(s+5.7))*1.8-.9;
 if(occupancy(q)>.8) return q;}
 return vec3(0.);}
vec3 spawn(float seed){float r=sqrt(hash(seed+1.))*uSpread;float a=floor(hash(seed+2.)*uArms)*6.283185/uArms+r*uTwist+(hash(seed+3.)-.5)*.25;return vec3(cos(a)*r,(hash(seed+4.)-.5)*uDepth*(.2+r*.45),sin(a)*r);}
mat3 camera(){float c=cos(uRotation),s=sin(uRotation),ct=cos(uTilt),st=sin(uTilt);return mat3(1,0,0,0,ct,st,0,-st,ct)*mat3(c,0,-s,0,1,0,s,0,c);}
void main(){
 vec3 p=aPosition.xyz,v=aVelocity.xyz;float age=aPosition.w+uDt,seed=aVelocity.w;
 mat3 model=containModel();
 bool held=uContain>.5;
 vec3 home=held?uContainPos:vec3(0.);
 if(age>uLife||length(p-home)>7.){
  // Inside a vessel the emitter is the saved project's own figure, sized to the
  // interior and clipped to it. Seeding uniformly through the volume instead
  // would wash every project into the same featureless fog.
  vec3 born=spawn(seed)/uContainScale;
  if(occupancy(born)<.8) born=spawnInside(seed);
  p=held?home+model*(born*uContainScale):spawn(seed);
  if(uSpeciesEnabled>.5)p.y+=(mod(floor(seed),3.)-1.)*.6;age=0.;v=vec3(-p.z,0.,p.x)*uSpin*.3;}
 vec3 q=p*uFrequency;float t=uTime*.2;
 vec3 flow=vec3(cos(q.y+t)+sin(q.z-t),cos(q.z+t)+sin(q.x),cos(q.x-t)+sin(q.y+t));
 // The pull to the middle is what holds a cloud in the shape its author gave it;
 // without it the material random-walks into featureless fog and the vessel just
 // contains a haze. Keep it, centred on the vessel, and let the walls clip what
 // reaches them. Spin orbits the vessel too.
 vec3 offset=p-home;
 vec3 acc=flow*uTurbulence*.3+vec3(-offset.z,0,offset.x)*uSpin*.18-offset*.055;
 acc.y-=uGravity*.25;
 mat3 cam=camera();vec3 cp=cam*p;
 for(int i=0;i<12;i++){if(i>=uFieldCount)break;vec4 f=uFields[i];vec4 extra=uFieldExtra[i];vec3 target=vec3(f.xy*vec2(uAspect,1.)*(uEye-cp.z)/uZoom/uProjScale,cp.z);vec3 delta=target-cp;float d=length(delta);float fall=exp(-d*d/(extra.x*extra.x));vec3 dir=delta/max(d,.1);vec3 force=vec3(0);int kind=int(f.z);
 if(kind==0)force=dir*f.w*fall;
 if(kind==1||kind==4)force=-dir*f.w*fall*(kind==4?3.:1.);
 if(kind==2)force=vec3(-dir.y,dir.x,0.)*f.w*fall;
 if(kind==5)v*=exp(-fall*f.w*uDt*6.);
 acc+=transpose(cam)*force;
 }
 float damping=uDrag;
 if(uSpeciesEnabled>.5){int species=int(mod(floor(seed),3.));vec2 st=p.xz/8.+.5;vec2 pixel=vec2(1./128.,0);vec3 gx=texture(uDensity,st+pixel).rgb-texture(uDensity,st-pixel).rgb;vec3 gz=texture(uDensity,st+pixel.yx).rgb-texture(uDensity,st-pixel.yx).rgb;vec3 weights=species==0?uCouplingA:species==1?uCouplingB:uCouplingC;acc.xz+=clamp(vec2(dot(gx,weights),dot(gz,weights))*4.,vec2(-2.),vec2(2.));acc.y+=uSpeciesLift[species];damping+=uSpeciesDrag[species];}
 v+=acc*uDt;v*=exp(-damping*uDt);p+=v*uDt;
 if(held){
  vec3 local=toLocal(model,p);float inside=occupancy(local);
  if(inside<.5){
   // The occupancy gradient points into the mesh; it is the wall normal.
   float h=uVoxel;
   vec3 g=vec3(occupancy(local+vec3(h,0,0))-occupancy(local-vec3(h,0,0)),
               occupancy(local+vec3(0,h,0))-occupancy(local-vec3(0,h,0)),
               occupancy(local+vec3(0,0,h))-occupancy(local-vec3(0,0,h)));
   vec3 n=dot(g,g)>1e-9?normalize(model*(g/uContainScale)):normalize(home-p+vec3(0,1e-4,0));
   // Step back to the surface and bounce off it. A restoring force here would
   // pack the material against the inside of the shell and stall it; a wall it
   // rebounds from keeps the interior circulating.
   p+=n*(.5-inside)*uContainPush*.15;
   float into=dot(v,n);
   if(into<0.) v-=n*into*1.55;
   v*=.94;}}
 vPosition=vec4(p,age);vVelocity=vec4(v,seed);gl_Position=vec4(0);
}`;
export const emptyFragment = `#version 300 es
precision highp float;out vec4 frag;void main(){frag=vec4(0);}`;
export const particleVertex = `#version 300 es
precision highp float;
layout(location=0) in vec4 aPosition;layout(location=1) in vec4 aVelocity;
uniform float uTilt,uRotation,uAspect,uZoom,uSize,uPixelRatio,uLife,uHue,uEye,uProjScale;
uniform vec3 uColorA,uColorB,uColorC;
uniform float uSpeciesEnabled;
uniform int uFieldCount;uniform vec4 uFields[12];uniform vec4 uFieldExtra[12];uniform vec3 uFieldColors[12];
out vec3 color;out float alpha;
void main(){float c=cos(uRotation),s=sin(uRotation),ct=cos(uTilt),st=sin(uTilt);vec3 p=mat3(c,0,-s,0,1,0,s,0,c)*aPosition.xyz;p=mat3(1,0,0,0,ct,st,0,-st,ct)*p;float z=max(1.,uEye-p.z);vec2 screen=p.xy*uProjScale*uZoom/vec2(uAspect,1.)/z;gl_Position=vec4(screen,clamp(z/12.,0.,1.),1);
 gl_PointSize=clamp(uSize*uPixelRatio*4./z,1.,32.);
 float f=fract(aVelocity.w*.013+length(aPosition.xyz)*.17+uHue);color=f<.5?mix(uColorA,uColorB,f*2.):mix(uColorB,uColorC,(f-.5)*2.);
 if(uSpeciesEnabled>.5){int species=int(mod(floor(aVelocity.w),3.));color=species==0?vec3(1.,.5,.08):species==1?vec3(.08,.8,1.):vec3(1.,.15,.5);}
 alpha=smoothstep(0.,.6,aPosition.w)*(1.-smoothstep(uLife*.75,uLife,aPosition.w))*(uSpeciesEnabled>.5?.07:.14);
 for(int i=0;i<12;i++){if(i>=uFieldCount)break;if(int(uFields[i].z)==3){float d=length((screen-uFields[i].xy)*vec2(uAspect,1.));color+=uFieldColors[i]*exp(-d*d/(uFieldExtra[i].x*.15))*uFields[i].w;}}
}`;
export const particleFragment = `#version 300 es
precision highp float;in vec3 color;in float alpha;out vec4 frag;
void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=exp(-r*r*4.)*alpha;frag=vec4(color*a,a);}`;
export const fadeFragment = `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D uTexture;uniform float uFade;out vec4 frag;void main(){frag=vec4(texture(uTexture,uv).rgb*uFade,1);}`;
export const compositeFragment = `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D uTexture;uniform vec2 uResolution;uniform float uBloom,uExposure,uGrain,uVignette,uTime;out vec4 frag;
void main(){vec3 col=texture(uTexture,uv).rgb;vec3 glow=vec3(0);for(int i=0;i<12;i++){float a=float(i)*6.283185/12.;vec2 off=vec2(cos(a),sin(a))/uResolution*(uResolution.y/720.);glow+=texture(uTexture,uv+off*4.).rgb*.5+texture(uTexture,uv+off*12.).rgb*.3+texture(uTexture,uv+off*28.).rgb*.2;}col+=glow*uBloom/12.;col=vec3(1.)-exp(-col*uExposure);col=pow(col,vec3(.88));float v=length((uv-.5)*1.4);col*=1.-v*v*uVignette;float noise=fract(sin(dot(uv*uResolution,vec2(12.9898,78.233))+floor(uTime*24.))*43758.5453)-.5;col+=noise*uGrain;frag=vec4(max(col,vec3(.012,.014,.023)),1);}`;
export function orbFragment(source) {
  return `#version 300 es
precision highp float;
in vec2 uv;out vec4 frag;
uniform vec2 uResolution;
uniform float uTime,uMorph,uRadius,uDisplace,uDetail,uRoughness,uMetallic,uIor,uReflection,uShadow,uAmbient,uKeyLight,uZoom,uRotation,uTilt,uHue,uTwist,uTurbulence,uFrequency;
uniform int uSteps;uniform vec3 uColorA,uColorB,uColorC;
${source}
mat3 rot(){float c=cos(uRotation),s=sin(uRotation);return mat3(c,0,-s,0,1,0,s,0,c);}
float map(vec3 p){p=rot()*p;float a=p.y*uTwist*.18;float c=cos(a),s=sin(a);p.xz=mat2(c,-s,s,c)*p.xz;p+=sin(p.yzx*uFrequency+uTime*.15)*uTurbulence*.08;return shape(p);}
vec3 normal(vec3 p){vec2 e=vec2(.0015,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
${studioRig}
float march(vec3 ro,vec3 rd,int limit){float t=.008,best=100.,closest=t;float bound=uRadius+uDisplace+.35;float b=dot(ro,rd),disc=b*b-dot(ro,ro)+bound*bound;if(disc<0.)return -1.;t=max(t,-b-sqrt(disc));float safe=.85/(1.+abs(uDisplace*uDetail)*1.75+abs(uTwist)*.4+uTurbulence*uFrequency*.4);for(int i=0;i<192;i++){if(i>=limit)break;float d=map(ro+rd*t);if(abs(d)<best){best=abs(d);closest=t;}if(abs(d)<max(.0015,t*(uSteps>100?.00035:.001)))return t;t+=max(abs(d)*safe,.0007);if(t>8.)break;}return best<(uSteps>100?.005:.012)?closest:-1.;}
float softShadow(vec3 p,vec3 l){float t=.025,shade=1.;for(int i=0;i<64;i++){if(i>=uSteps/3)break;float h=map(p+l*t);shade=min(shade,10.*max(h,0.)/t);t+=clamp(h*.5,.012,.12);if(h<.001||t>4.)break;}return clamp(shade,0.,1.);}
void main(){vec2 st=(uv-.5)*vec2(uResolution.x/uResolution.y,1.)*2.;vec3 ro=vec3(0.,sin(uTilt-.65)*1.2,3.7/uZoom);vec3 forward=normalize(-ro);vec3 right=normalize(cross(forward,vec3(0,1,0)));vec3 up=cross(right,forward);vec3 rd=normalize(forward*1.8+st.x*right+st.y*up);float t=march(ro,rd,uSteps);vec3 col=vec3(.006,.007,.012);
 if(t>0.){vec3 p=ro+rd*t,n=normal(p),l=uLightDir[0].xyz;vec3 base=pigment(rot()*p,rot()*n);float diffuse=max(dot(n,l),0.);float shadow=mix(1.,softShadow(p+n*.01,l),uShadow);float ao=1.;for(int i=1;i<=4;i++){float h=float(i)*.06;ao-=(h-map(p+n*h))*.9;}ao=clamp(ao,.15,1.);float spec=pow(max(dot(n,normalize(l-rd)),0.),mix(180.,4.,uRoughness));float fres=pow(1.-max(dot(-rd,n),0.),3.);col=base*(uAmbient*ao+diffuse*shadow*uKeyLight*.38);col+=mix(vec3(1.),base,uMetallic)*spec*shadow*uKeyLight;
 vec3 reflected=reflect(rd,n);vec3 refl=envRoom(reflected,uRoughness);if(uReflection>0.){float rt=march(p+n*.015,reflected,uSteps/2);if(rt>0.){vec3 rp=p+n*.015+reflected*rt;refl=pigment(rot()*rp,rot()*normal(rp))*.55;}}col+=refl*(.15+fres)*uReflection;
 vec3 refracted=refract(rd,n,1./uIor);vec3 inside=p+refracted*uRadius*1.6;col+=pigment(rot()*inside,n)*(1.-uMetallic)*.15;col+=uColorB*pow(1.-abs(dot(n,rd)),4.)*.3;
 }frag=vec4(col,1.);
}`;
}
