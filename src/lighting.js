// The studio rig, shared by every workspace that has to light something. It was
// written for the glass stage and then three toy `environment()` functions were
// still sitting in the orb and material shaders, lighting their subjects with a
// hardcoded strip and a blob. One rig means a light moved anywhere moves everywhere.
//
// Needs uLightDir[3] and uLightColor[3], which `lightRig(config, time)` in
// project.js resolves once per frame.
export const studioRig = `
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
`;
