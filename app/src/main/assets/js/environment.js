'use strict';
/* ============================================================
   environment.js  -  time of day, sky colours, weather
   ============================================================ */
const K=(h,z,hr,s,i,a,g,hi,st)=>({h,z:new THREE.Color(z),hr:new THREE.Color(hr),s:new THREE.Color(s),i,a:new THREE.Color(a),g:new THREE.Color(g),hi,st});
const KEYS=[
  K(0,0x050a1c,0x141e38,0x7f95c9,0,0x2a3a66,0x10151f,0.42,1),
  K(5.0,0x0d1535,0x3b3558,0x9aa6d8,0,0x2f3f70,0x15181f,0.42,0.9),
  K(6.4,0x35569a,0xe9a27e,0xffb778,0.55,0x7b8fc4,0x4a3d36,0.55,0.25),
  K(7.6,0x4a7fc4,0xf0c9a2,0xffd9a0,0.95,0xa7bde0,0x5d5444,0.68,0),
  K(10,0x2e78d2,0xb9d7ee,0xfff0d2,1.1,0xbcd8ff,0x6d6a50,0.75,0),
  K(14,0x2272d8,0xaed4f2,0xffffff,1.15,0xbcd8ff,0x6d6a50,0.78,0),
  K(16.8,0x3c68b4,0xe8c6a0,0xffd096,1.0,0xb0bfdc,0x6a5a42,0.7,0),
  K(18.2,0x3a4c8c,0xf0a070,0xff9a5c,0.7,0x9aa0c8,0x5a4638,0.6,0.1),
  K(19.2,0x1b2658,0xc26a78,0xff7e5a,0.25,0x6a6a9c,0x3a3036,0.5,0.5),
  K(20.4,0x0b1330,0x363a68,0x8aa0e0,0,0x38477a,0x161a24,0.44,1),
  K(24,0x050a1c,0x141e38,0x7f95c9,0,0x2a3a66,0x10151f,0.42,1)
];
const E={z:new THREE.Color(),hr:new THREE.Color(),s:new THREE.Color(),a:new THREE.Color(),g:new THREE.Color(),i:1,hi:.75,st:0};
const W={fogK:1,lightK:1,grey:0,rain:0};
const WX={
  clear:{fogK:1,lightK:1,grey:0,rain:0,name:'Clear'},
  mist:{fogK:0.3,lightK:0.82,grey:0.35,rain:0,name:'Mist'},
  rain:{fogK:0.55,lightK:0.62,grey:0.7,rain:1,name:'Soft rain'}
};
function keyAt(h){
  let i=0;
  while(i<KEYS.length-2&&h>=KEYS[i+1].h)i++;
  const a=KEYS[i],b=KEYS[i+1],f=sstep(0,1,(h-a.h)/(b.h-a.h));
  E.z.copy(a.z).lerp(b.z,f);E.hr.copy(a.hr).lerp(b.hr,f);E.s.copy(a.s).lerp(b.s,f);
  E.a.copy(a.a).lerp(b.a,f);E.g.copy(a.g).lerp(b.g,f);
  E.i=lerp(a.i,b.i,f);E.hi=lerp(a.hi,b.hi,f);E.st=lerp(a.st,b.st,f);
}
function desat(c,k){const l=c.r*0.3+c.g*0.59+c.b*0.11,m=1-0.22*k;c.r=lerp(c.r,l,k)*m;c.g=lerp(c.g,l,k)*m;c.b=lerp(c.b,l,k)*m}
const sunV=new THREE.Vector3(), moonV=new THREE.Vector3();
let daylight=1;
function applyEnv(dt,hour,cp){
  const tgt=WX[cfg.wx], r=1-Math.exp(-dt*0.5);
  W.fogK=lerp(W.fogK,tgt.fogK,r);W.lightK=lerp(W.lightK,tgt.lightK,r);W.grey=lerp(W.grey,tgt.grey,r);W.rain=lerp(W.rain,tgt.rain,r);
  keyAt(hour);
  desat(E.z,W.grey);desat(E.hr,W.grey);desat(E.a,W.grey*0.6);
  const a=(hour-6)/12*Math.PI;
  sunV.set(Math.cos(a),Math.sin(a),-0.35).normalize();
  const hh=hour>=18?hour-18:hour+6, a2=hh/12*Math.PI;
  moonV.set(Math.cos(a2),Math.sin(a2),-0.3).normalize();
  const sunVis=sstep(-0.04,0.14,sunV.y)*(hour>=5&&hour<=19.5?1:0), moonVis=sstep(-0.04,0.2,moonV.y)*(1-sstep(0.1,0.7,E.i));
  daylight=sunVis*E.i;
  skyMat.uniforms.zen.value.copy(E.z);skyMat.uniforms.hor.value.copy(E.hr);
  const useSun=sunVis>0.02;
  skyMat.uniforms.sunDir.value.copy(useSun?sunV:moonV);
  skyMat.uniforms.sunCol.value.copy(E.s).multiplyScalar((useSun?sunVis*0.9:0.22*moonVis)*(1-W.grey*0.85));
  scene.fog.color.copy(E.hr);
  scene.fog.far=780*W.fogK;scene.fog.near=Math.max(6,70*W.fogK*W.fogK);
  hemi.color.copy(E.a);hemi.groundColor.copy(E.g);hemi.intensity=E.hi*lerp(1,W.lightK,0.8);
  sun.color.copy(E.s);sun.intensity=E.i*sunVis*W.lightK*1.05;
  sun.position.set(cp.x+sunV.x*200,cp.y+sunV.y*200,cp.z+sunV.z*200);sun.target.position.copy(cp);
  moon.intensity=0.34*moonVis*(1-W.grey*0.4);
  moon.position.set(cp.x+moonV.x*200,cp.y+moonV.y*200,cp.z+moonV.z*200);moon.target.position.copy(cp);
  starMat.opacity=clamp(E.st*(1-W.grey*0.9),0,1)*(E.st>0.05?1:0);
  cloudMat.color.setRGB(clamp(E.hr.r*0.55+E.s.r*E.i*0.45*sunVis+0.1,0,1),clamp(E.hr.g*0.55+E.s.g*E.i*0.45*sunVis+0.1,0,1),clamp(E.hr.b*0.55+E.s.b*E.i*0.45*sunVis+0.12,0,1));
  desat(cloudMat.color,W.grey*0.6);
  cloudMat.opacity=lerp(0.92,0.97,W.grey);
  rain.visible=W.rain>0.02;rainMat.opacity=0.4*W.rain;
}
/* how dark it is, 0 (bright day) to 1 (night) - used for the dusk hint */
const darkness=()=>clamp(E.st*1.2+W.grey*0.2,0,1);
