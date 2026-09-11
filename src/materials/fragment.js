import { studioRig } from "../lighting.js";
export const materialFragment = `#version 300 es
precision highp float;
in vec2 uv;out vec4 frag;
uniform vec2 uResolution;
uniform sampler2D uChemistry;
uniform vec3 uColorA,uColorB,uColorC;
uniform float uTime,uRotation,uTilt,uZoom,uHue,uIor,uReflection,uRoughness;
uniform float uInteriorMotion,uEmission,uMaterialScale,uMaterialFold,uSurfaceActivity;
uniform int uFamily,uSteps;
uniform float uFieldA,uFieldB,uFieldOperation,uFieldMix,uFieldOffset,uFieldRatio,uFieldWidth,uFieldColor;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+1.7;a*=.5;}return v;}
mat3 turn(){float c=cos(uRotation),s=sin(uRotation),a=cos(uTilt),b=sin(uTilt);return mat3(c,0,s,0,1,0,-s,0,c)*mat3(1,0,0,0,a,-b,0,b,a);}
// Family 3 is liquid, so the surface itself moves rather than only its shading. A
// sphere with a wobbling normal reads as a painted ball; the silhouette is what
// sells it, and the normal follows for free once the field carries the shape.
float shell(vec3 p){
 float d=length(p)-1.;
 if(uFamily==3){
  vec3 q=p*2.1+uTime*uInteriorMotion*.35;
  float bead=sin(q.x)*sin(q.y)*sin(q.z);
  float ripple=sin(q.x*1.9+q.y*1.3)*sin(q.z*1.7-q.y*1.1);
  d+=(bead*.13+ripple*.055)*uMaterialFold;
 }
 return d;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(shell(p+e.xyy)-shell(p-e.xyy),shell(p+e.yxy)-shell(p-e.yxy),shell(p+e.yyx)-shell(p-e.yyx)));}
${studioRig}
float field(vec3 p,float kind){
 if(kind<.5)return dot(sin(p),cos(p.zxy))*.65;
 if(kind<1.5)return sin(length(p.xz)*2.-p.y*1.3);
 if(kind<2.5)return (fbm(p*1.4)-.47)*3.;
 return (sin(p.x)+sin(p.y*1.2)+cos(p.z))*.4;
}
void main(){vec2 st=(uv*2.-1.)*vec2(uResolution.x/uResolution.y,1.);mat3 cam=turn();vec3 ro=cam*vec3(0,0,3.7),rd=cam*normalize(vec3(st/uZoom,-2.5));float travel=0.;bool hit=false;vec3 p;
 for(int i=0;i<192;i++){if(i>=uSteps)break;p=ro+rd*travel;float d=shell(p);if(d<.0015){hit=true;break;}travel+=max(d*(uFamily==3?.72/(1.+uMaterialFold*1.2):.72),.001);if(travel>7.)break;}
 vec3 color=vec3(.003,.005,.009);if(!hit){frag=vec4(color,1);return;}vec3 n=normalAt(p);float fres=pow(1.-max(0.,dot(n,-rd)),5.);vec3 reflected=envRoom(reflect(rd,n),uRoughness);
 if(uFamily==4){
 vec3 sum=vec3(0);float trans=1.;float ds=2.1/float(uSteps);
 for(int i=0;i<192;i++){if(i>=uSteps)break;vec3 q=p+rd*(float(i)+.5)*ds;if(length(q)>1.01)break;
 vec3 w=q*uMaterialScale;w+=sin(w.yzx*1.3+uTime*uInteriorMotion*.5)*uMaterialFold;
 float a=field(w,uFieldA),b=field(w*uFieldRatio+vec3(uFieldOffset,0.,-uFieldOffset*.4),uFieldB);
 float da=exp(-abs(a)/uFieldWidth),db=exp(-abs(b)/uFieldWidth),density;
 if(uFieldOperation<.5)density=exp(-abs(mix(a,b,uFieldMix))/uFieldWidth);
 else if(uFieldOperation<1.5)density=max(da,db*uFieldMix);
 else if(uFieldOperation<2.5)density=da*mix(1.,db,uFieldMix);
 else density=da*(1.-db*uFieldMix);
 vec3 tint=mix(uColorA,uColorB,.5+.5*sin(w.y*uFieldColor+w.z*.3));
 tint=mix(tint,uColorC,pow(clamp(density,0.,1.),3.)*.65);
 float alpha=1.-exp(-density*ds*3.5);sum+=tint*alpha*trans*uEmission*1.8;trans*=1.-alpha;
 if(trans<.01)break;
 }color=sum+reflected*(.025+fres*.6)*uReflection;
 }
 else if(uFamily==1){vec3 sum=vec3(0);float trans=1.;float ds=2.1/float(uSteps);for(int i=0;i<192;i++){if(i>=uSteps)break;vec3 q=p+rd*(float(i)+.5)*ds;if(length(q)>1.01)break;vec3 w=q*uMaterialScale;w+=sin(w.yzx*1.5+uTime*uInteriorMotion)*uMaterialFold;float v=dot(sin(w),cos(w.zxy));float den=exp(-abs(v)*24.)*.6;vec3 c=.5+.5*cos(vec3(0,2,4)+w.y*1.2+w.z);sum+=mix(c,uColorC,.2)*den*trans*.13*uEmission*(88./float(uSteps));trans*=exp(-den*.095*(88./float(uSteps)));}color=sum+reflected*(.1+.6*fres);}
 else if(uFamily==2){
 vec3 q=p*uMaterialScale;
 // atan(0,0) is undefined and that is exactly the pole of the sphere, so keep the
 // longitude defined everywhere rather than letting a NaN out.
 vec2 sphereUV=vec2(atan(p.z,abs(p.x)<1e-5&&abs(p.z)<1e-5?1.:p.x)/6.283185+.5,
  acos(clamp(p.y,-1.,1.))/3.141593);
 float chemical=texture(uChemistry,sphereUV).g;
 // Granulation: the convection cells that give a star its boiling skin, at a much
 // finer scale than the reaction front.
 float grain=fbm(q*2.)*.12+fbm(q*7.)*.05;
 float f=chemical*1.5+grain;
 float front=1.-smoothstep(.025,.075,abs(f-uSurfaceActivity*.65));
 // Relief from the gradient of the chemical field, so the fronts sit in the surface
 // rather than being printed on it. Sampled from the map rather than taken with
 // dFdx: a screen-space derivative of a raymarched hit jumps at every silhouette and
 // every step boundary, which showed up as blocks of noise across the disc.
 vec2 tx=vec2(1./256.,1./128.);
 vec2 g=vec2(texture(uChemistry,sphereUV+vec2(tx.x,0)).g-texture(uChemistry,sphereUV-vec2(tx.x,0)).g,
             texture(uChemistry,sphereUV+vec2(0,tx.y)).g-texture(uChemistry,sphereUV-vec2(0,tx.y)).g);
 float relief=clamp(.7+(g.x*.8-g.y*.55)*5.,0.,1.5);
 vec3 crust=vec3(.03,.014,.01)*(.35+noise(q*12.)*.9)*relief;
 // A luminous body darkens toward its limb, where the line of sight leaves through
 // more of a cooler, thinner layer. The old rim brightening had it backwards.
 float limb=pow(max(0.,dot(n,-rd)),.55);
 color=(crust+mix(uColorA,uColorC,front)*front*uEmission*1.15*relief)*mix(.3,1.,limb);
 color+=vec3(.9,.3,.08)*pow(1.-limb,2.5)*uEmission*.18;}
 else{
 // Mercury is nothing but what it reflects, so the rig is the material. Metals have
 // no diffuse term and a coloured Fresnel: the tint belongs in F0, not in a wash
 // laid over the reflection, which is what made this read as painted plastic.
 vec3 tint=mix(uColorA,uColorC,.5+.5*sin(p.y*2.4+uTime*uInteriorMotion*.3));
 vec3 f0=mix(vec3(.78,.79,.8),tint,.4);
 color=envRoom(reflect(rd,n),uRoughness)*(f0+(1.-f0)*fres)*(.6+uReflection*.8);
 // The dark turn at a grazing edge, where a bead of liquid metal curves away faster
 // than the reflection can follow it.
 color*=1.-pow(1.-abs(dot(n,-rd)),8.)*.35;}
 float hueAngle=uHue*6.283185;vec3 hueAxis=normalize(vec3(1.));color=color*cos(hueAngle)+cross(hueAxis,color)*sin(hueAngle)+hueAxis*dot(hueAxis,color)*(1.-cos(hueAngle));
 frag=vec4(max(color,0.),1.);
}`;
