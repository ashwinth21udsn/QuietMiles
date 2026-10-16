'use strict';
/* ============================================================
   scene.js  -  renderer, terrain and road meshes, scenery instances,
   sky, stars, clouds, rain and the car holder
   ============================================================ */
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xaed4f2,60,780);
const camera=new THREE.PerspectiveCamera(62,1,0.3,1400);
function setQuality(){
  const dpr=window.devicePixelRatio||1, pr=[0.7,1,Math.min(dpr,2)][cfg.q];
  renderer.setPixelRatio(Math.min(pr,dpr));
  resize();
}
function resize(){
  renderer.setSize(window.innerWidth,window.innerHeight,false);
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);

const hemi=new THREE.HemisphereLight(0xbcd8ff,0x6d6a50,0.75);
const sun=new THREE.DirectionalLight(0xffffff,1);
const moon=new THREE.DirectionalLight(0x8fa5d8,0);
scene.add(hemi,sun,sun.target,moon,moon.target);

/* ---------- geometry helpers for merged scenery pieces ---------- */
function tinted(geo,r,g,b){
  const n=geo.attributes.position.count, a=new Float32Array(n*3);
  for(let i=0;i<n;i++){a[i*3]=r;a[i*3+1]=g;a[i*3+2]=b}
  geo.setAttribute('color',new THREE.BufferAttribute(a,3));
  return geo;
}
function mergeGeos(list){
  const pos=[],nor=[],col=[];
  list.forEach(g0=>{
    const g=g0.index?g0.toNonIndexed():g0, p=g.attributes.position.array, n=g.attributes.normal.array;
    const c=g.attributes.color?g.attributes.color.array:null;
    for(let i=0;i<p.length;i++){pos.push(p[i]);nor.push(n[i]);col.push(c?c[i]:1)}
  });
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return out;
}
function deadTreeGeo(){
  const parts=[tinted(new THREE.CylinderGeometry(0.09,0.3,4.8,6).translate(0,2.4,0),1,1,1)];
  const place=(g,b)=>{g.rotateZ(-b[2]);g.rotateY(b[1]);g.translate(0,b[0],0);return g};
  [[2.3,0.3,0.9,1.9,0.075],[3.0,2.4,0.8,1.6,0.065],[3.7,4.4,0.7,1.3,0.055],[1.7,3.6,1.0,1.5,0.065],[4.2,1.2,0.5,1.0,0.045],[2.9,5.3,1.05,1.1,0.05]].forEach(b=>{
    parts.push(tinted(place(new THREE.CylinderGeometry(b[4]*0.45,b[4],b[3],5).translate(0,b[3]/2,0),b),1,1,1));
    const tw=new THREE.CylinderGeometry(b[4]*0.2,b[4]*0.5,b[3]*0.55,4).translate(0,b[3]*0.275,0).rotateZ(0.8).translate(0,b[3]*0.62,0);
    parts.push(tinted(place(tw,b),0.92,0.92,0.92));
  });
  return mergeGeos(parts);
}
function cactusGeo(){
  const parts=[];
  const trunk=new THREE.CylinderGeometry(0.22,0.26,2.7,8).translate(0,1.35,0);
  parts.push(tinted(trunk,1,1,1),tinted(new THREE.SphereGeometry(0.22,8,6).translate(0,2.7,0),1,1,1));
  [[1,1.2,0.8],[-1,1.7,0.6]].forEach(a=>{
    const h=new THREE.CylinderGeometry(0.14,0.14,0.55,7).rotateZ(Math.PI/2).translate(a[0]*0.4,a[1],0);
    const v=new THREE.CylinderGeometry(0.13,0.14,a[2],7).translate(a[0]*0.66,a[1]+a[2]/2,0);
    const c=new THREE.SphereGeometry(0.13,7,5).translate(a[0]*0.66,a[1]+a[2],0);
    parts.push(tinted(h,1,1,1),tinted(v,1,1,1),tinted(c,1,1,1));
  });
  return mergeGeos(parts);
}
function tuftGeo(){
  const pos=[],nor=[],col=[], rnd=(()=>{let s=7;return()=>{s=(s*16807)%2147483647;return s/2147483647}})();
  for(let k=0;k<8;k++){
    const a=rnd()*6.283, r=0.04+rnd()*0.14, bx=Math.cos(a)*r, bz=Math.sin(a)*r, h=0.42+rnd()*0.5, w=0.045+rnd()*0.02;
    const lean=0.1+rnd()*0.16, tx=bx+Math.cos(a)*lean, tz=bz+Math.sin(a)*lean, px=-Math.sin(a)*w, pz=Math.cos(a)*w;
    // each blade is added with both windings so it is lit from either side (a double-sided material would flip the normal)
    pos.push(bx-px,0,bz-pz, bx+px,0,bz+pz, tx,h,tz, bx-px,0,bz-pz, tx,h,tz, bx+px,0,bz+pz);
    for(let j=0;j<6;j++)nor.push(0,1,0);
    col.push(0.62,0.66,0.6, 0.62,0.66,0.6, 1.1,1.12,1.0, 0.62,0.66,0.6, 1.1,1.12,1.0, 0.62,0.66,0.6);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return g;
}
function fenceGeo(){
  const wood=[0.52,0.4,0.28], parts=[];
  [0,5].forEach(x=>parts.push(tinted(new THREE.BoxGeometry(0.1,1.15,0.1).translate(x,0.45,0),...wood)));
  [0.55,0.95].forEach(y=>parts.push(tinted(new THREE.BoxGeometry(5,0.09,0.05).translate(2.5,y,0),wood[0]*1.08,wood[1]*1.08,wood[2]*1.08)));
  return mergeGeos(parts);
}
function postGeo(){
  return mergeGeos([tinted(new THREE.BoxGeometry(0.14,1.0,0.14).translate(0,0.5,0),0.92,0.92,0.88),tinted(new THREE.BoxGeometry(0.15,0.2,0.15).translate(0,0.9,0),0.85,0.2,0.15)]);
}

/* ---------- terrain and road meshes (rewritten as the car advances) ---------- */
const tPos=new Float32Array(NR*NC*3), tCol=new Float32Array(NR*NC*3);
const tGeo=new THREE.BufferGeometry();
const tPosAttr=new THREE.BufferAttribute(tPos,3).setUsage(THREE.DynamicDrawUsage);
const tColAttr=new THREE.BufferAttribute(tCol,3).setUsage(THREE.DynamicDrawUsage);
tGeo.setAttribute('position',tPosAttr);
tGeo.setAttribute('color',tColAttr);
{
  const idx=[];
  for(let r=0;r<NR-1;r++)for(let c=0;c<NC-1;c++){
    if(c===10)continue; // the road sits in this gap
    const a=r*NC+c,b=a+1,cc=a+NC,d=cc+1;
    idx.push(a,b,d,a,d,cc);
  }
  tGeo.setIndex(idx);
}
const terrain=new THREE.Mesh(tGeo,new THREE.MeshPhongMaterial({vertexColors:true,side:THREE.DoubleSide,shininess:0,specular:0x000000}));
terrain.frustumCulled=false;
scene.add(terrain);

const rPos=new Float32Array(NR*6), rUv=new Float32Array(NR*4);
const rGeo=new THREE.BufferGeometry();
const rPosAttr=new THREE.BufferAttribute(rPos,3).setUsage(THREE.DynamicDrawUsage);
const rUvAttr=new THREE.BufferAttribute(rUv,2).setUsage(THREE.DynamicDrawUsage);
rGeo.setAttribute('position',rPosAttr);
rGeo.setAttribute('uv',rUvAttr);
{
  const idx=[];
  for(let r=0;r<NR-1;r++){const a=r*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,d,a,d,c)}
  rGeo.setIndex(idx);
}
function roadTexture(){
  const c=document.createElement('canvas');c.width=64;c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#3d4144';g.fillRect(0,0,64,128);
  for(let k=0;k<420;k++){const v=40+Math.random()*34|0;g.fillStyle='rgba('+v+','+v+','+(v+4)+',.55)';g.fillRect(Math.random()*64,Math.random()*128,1+Math.random()*1.5,1+Math.random()*1.5)}
  g.fillStyle='#8c8470';g.fillRect(0,0,4,128);g.fillRect(60,0,4,128);
  g.fillStyle='#e9e6dc';g.fillRect(6,0,2,128);g.fillRect(56,0,2,128);
  g.fillStyle='#e9d9a0';g.fillRect(31,0,2,52);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=THREE.ClampToEdgeWrapping;t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
  return t;
}
const road=new THREE.Mesh(rGeo,new THREE.MeshPhongMaterial({map:roadTexture(),side:THREE.DoubleSide,shininess:8,specular:0x222222}));
road.frustumCulled=false;
scene.add(road);

/* ---------- scenery (instanced) ---------- */
const MAXI=NR*4;
const phongFlat=()=>new THREE.MeshPhongMaterial({color:0xffffff,flatShading:true,shininess:0,specular:0x000000});
const phongVC=()=>new THREE.MeshPhongMaterial({color:0xffffff,vertexColors:true,flatShading:true,shininess:0,specular:0x000000});
const mk=(geo,mat,n)=>{
  const m=new THREE.InstancedMesh(geo,mat,n);
  m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // allocate the colour buffer now: in three r128 setColorAt sizes it from .count, which we set to 0 below
  m.instanceColor=new THREE.BufferAttribute(new Float32Array(n*3),3).setUsage(THREE.DynamicDrawUsage);
  m.count=0;scene.add(m);return m;
};
const IM={
  trunk:mk(new THREE.CylinderGeometry(0.2,0.32,2.8,5).translate(0,1.4,0),new THREE.MeshLambertMaterial({color:0xffffff}),MAXI),
  crown:mk(new THREE.IcosahedronGeometry(2.1,0),phongFlat(),MAXI),
  cone: mk(new THREE.ConeGeometry(2.3,7.8,7).translate(0,3.9,0),phongFlat(),MAXI),
  dead: mk(deadTreeGeo(),phongVC(),NR*2),
  bush: mk(new THREE.IcosahedronGeometry(1,1).scale(1,0.62,1),phongFlat(),NR*3),
  grass:mk(tuftGeo(),new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true}),NR*10),
  flower:mk(new THREE.IcosahedronGeometry(0.13,0).scale(1,0.7,1),new THREE.MeshLambertMaterial({color:0xffffff}),NR*5),
  cactus:mk(cactusGeo(),phongVC(),NR*2),
  rock: mk(new THREE.IcosahedronGeometry(1,0),phongFlat(),NR*2),
  log:  mk(new THREE.CylinderGeometry(0.26,0.3,2.6,7).rotateZ(Math.PI/2).translate(0,0.26,0),phongFlat(),NR),
  fence:mk(fenceGeo(),phongVC(),NR),
  post: mk(postGeo(),phongVC(),NR/8+4)
};
const dummy=new THREE.Object3D(), tc=new THREE.Color();
function put(mesh,n,x,y,z,sx,sy,sz,ry,r,g,b,rz){
  dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz||0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
  mesh.setMatrixAt(n,dummy.matrix);tc.setRGB(r,g,b);mesh.setColorAt(n,tc);
}
const SP={x:0,y:0,z:0,d:0};
function spot(i,k,cx,cz,cs,sn,ry,amp,minD,maxD,pw){
  const side=hash(i,k+1)<0.5?-1:1, dist=minD+Math.pow(hash(i,k+2),pw)*(maxD-minD), jit=(hash(i,k+3)-0.5)*SEG;
  SP.x=cx+cs*side*dist+sn*jit;SP.z=cz+sn*side*dist-cs*jit;SP.d=dist;
  SP.y=terrY(ry,SP.x,SP.z,dist,amp);
}

let builtI0=-999;
function rebuild(i0){
  builtI0=i0;
  ensure(i0+NR+3);
  let p=0;
  const N={trunk:0,crown:0,cone:0,dead:0,bush:0,grass:0,flower:0,cactus:0,rock:0,log:0,fence:0,post:0};
  for(let r=0;r<NR;r++){
    const i=i0+r, s=i*SEG, bm=biomeAt(s);
    const cx=R.x[i], cz=R.z[i], th=R.th[i], ry=R.y[i], cs=Math.cos(th), sn=Math.sin(th);
    for(let c=0;c<NC;c++){
      const d=COLS[c], ad=Math.abs(d), x=cx+cs*d, z=cz+sn*d, y=terrY(ry,x,z,ad,bm.amp);
      tPos[p]=x;tPos[p+1]=y;tPos[p+2]=z;
      const n=vn2(x*0.03,z*0.03), rel=clamp((y-ry)/(bm.amp*1.2)*0.5+0.55,0,1);
      const t=clamp(rel*0.75+(n-0.5)*0.55,0,1), sh=0.88+0.24*vn2(x*0.12,z*0.12);
      tCol[p]=lerp(bm.lr,bm.hr,t)*sh;tCol[p+1]=lerp(bm.lg,bm.hg,t)*sh;tCol[p+2]=lerp(bm.lb,bm.hb,t)*sh;
      p+=3;
    }
    const q=r*6;
    rPos[q]=cx-cs*4.2;rPos[q+1]=ry+0.04;rPos[q+2]=cz-sn*4.2;
    rPos[q+3]=cx+cs*4.2;rPos[q+4]=ry+0.04;rPos[q+5]=cz+sn*4.2;
    rUv[r*4]=0;rUv[r*4+1]=s/10;rUv[r*4+2]=1;rUv[r*4+3]=s/10;

    const dom=BIO[bm.dom], pal=dom.pal, amp=bm.amp;
    const gA=BIO[bm.ia].gcol, gB=BIO[bm.ib].gcol;
    // trees
    for(let k=0;k<4;k++){
      if(hash(i,k*6+1)>=dom.tree)continue;
      spot(i,k*6+2,cx,cz,cs,sn,ry,amp,11,99,1.5);
      const h1=hash(i,k*6+6), h2=hash(i,k*6+7), ry2=h1*6.28;
      const col=pal[Math.floor(h2*pal.length)%pal.length], v=0.86+0.28*h1;
      if(dom.kind===1){
        const sc=0.8+h2*1.0;
        put(IM.trunk,N.trunk++,SP.x,SP.y,SP.z,sc*0.8,sc*0.55,sc*0.8,ry2,0.3*v,0.2*v,0.13*v);
        put(IM.cone,N.cone++,SP.x,SP.y+1.0*sc,SP.z,sc,sc*(0.95+h1*0.5),sc,ry2,col[0]*v,col[1]*v,col[2]*v);
      }else if(dom.kind===0){
        const sc=0.75+h2*0.9;
        put(IM.trunk,N.trunk++,SP.x,SP.y,SP.z,sc,sc,sc,ry2,0.33*v,0.22*v,0.14*v);
        put(IM.crown,N.crown++,SP.x,SP.y+3.5*sc,SP.z,sc*(0.95+h1*0.4),sc*0.85,sc*(0.95+h2*0.3),ry2,col[0]*v,col[1]*v,col[2]*v);
      }else{
        const sc=0.6+h2*0.8;
        put(IM.crown,N.crown++,SP.x,SP.y+0.35*sc,SP.z,sc*1.2,sc*0.5,sc*1.2,ry2,col[0]*v,col[1]*v,col[2]*v);
      }
    }
    // dead trees
    for(let k=0;k<2;k++){
      if(hash(i,30+k*8)>=dom.dead*0.5)continue;
      spot(i,31+k*8,cx,cz,cs,sn,ry,amp,9,75,1.2);
      const h1=hash(i,36+k*8), sc=0.75+hash(i,37+k*8)*0.8, v=0.8+0.35*h1, dune=bm.dom===3;
      put(IM.dead,N.dead++,SP.x,SP.y-0.1,SP.z,sc,sc,sc,h1*6.28,(dune?0.62:0.44)*v,(dune?0.5:0.38)*v,(dune?0.36:0.3)*v,(hash(i,38+k*8)-0.5)*0.28);
    }
    // bushes
    for(let k=0;k<3;k++){
      if(hash(i,50+k*8)>=dom.bush*0.5)continue;
      spot(i,51+k*8,cx,cz,cs,sn,ry,amp,6,48,1.3);
      const h1=hash(i,56+k*8), sc=0.55+hash(i,57+k*8)*0.8, col=pal[Math.floor(h1*pal.length)%pal.length], v=0.7+0.35*h1;
      put(IM.bush,N.bush++,SP.x,SP.y+0.3*sc,SP.z,sc*1.3,sc,sc*1.1,h1*6.28,col[0]*v,col[1]*v,col[2]*v);
    }
    // grass tufts
    for(let k=0;k<10;k++){
      if(hash(i,80+k*5)>=dom.grass*0.7)continue;
      spot(i,81+k*5,cx,cz,cs,sn,ry,amp,4.8,34,1.6);
      const h1=hash(i,84+k*5), sc=0.8+hash(i,85+k*5)*0.9, v=0.78+0.4*h1;
      put(IM.grass,N.grass++,SP.x,SP.y-0.03,SP.z,sc,sc*(0.8+h1*0.6),sc,h1*6.28,lerp(gA[0],gB[0],bm.f)*v,lerp(gA[1],gB[1],bm.f)*v,lerp(gA[2],gB[2],bm.f)*v);
    }
    // flowers
    for(let k=0;k<5;k++){
      if(hash(i,140+k*5)>=dom.flower*0.5)continue;
      spot(i,141+k*5,cx,cz,cs,sn,ry,amp,5,30,1.4);
      const fp=dom.fpal[Math.floor(hash(i,144+k*5)*dom.fpal.length)%dom.fpal.length], sc=1+hash(i,145+k*5)*0.7;
      put(IM.flower,N.flower++,SP.x,SP.y+0.28,SP.z,sc,sc,sc,0,fp[0],fp[1],fp[2]);
    }
    // cacti
    for(let k=0;k<2;k++){
      if(hash(i,190+k*5)>=dom.cactus*0.5)continue;
      spot(i,191+k*5,cx,cz,cs,sn,ry,amp,8,60,1.2);
      const h1=hash(i,194+k*5), sc=0.8+hash(i,195+k*5)*0.8;
      put(IM.cactus,N.cactus++,SP.x,SP.y-0.05,SP.z,sc,sc*(0.9+h1*0.4),sc,h1*6.28,0.36+h1*0.08,0.55,0.33);
    }
    // rocks
    if(hash(i,210)<dom.rock*1.6){
      spot(i,211,cx,cz,cs,sn,ry,amp,11,61,1);
      const h=hash(i,215), warm=bm.dom===3?1:0, sc=0.7+h*1.8;
      put(IM.rock,N.rock++,SP.x,SP.y+0.2*sc,SP.z,sc*(0.9+h*0.6),sc*(0.55+h*0.3),sc,h*6.28,0.5+warm*0.2,0.48+warm*0.1,0.45-warm*0.05);
    }
    // fallen logs
    if(hash(i,220)<dom.log){
      spot(i,221,cx,cz,cs,sn,ry,amp,7,35,1);
      const h=hash(i,225);
      put(IM.log,N.log++,SP.x,SP.y,SP.z,0.8+h*0.6,0.8+h*0.5,0.8+h*0.5,h*6.28,0.36,0.26,0.18);
    }
    // fence runs (a block of 14 rows = 70 m)
    const blk=Math.floor(i/14);
    if(dom.fence>0&&hash(blk,230)<dom.fence){
      const side=hash(blk,231)<0.5?-1:1, X=cx+cs*side*9.5, Z=cz+sn*side*9.5, Y=terrY(ry,X,Z,9.5,amp)-0.1;
      put(IM.fence,N.fence++,X,Y,Z,1,1,1,Math.PI/2-th,1,1,1);
    }
    // roadside posts every 200 m
    if(i%40===0){
      const X=cx+cs*5.5, Z=cz+sn*5.5, Y=terrY(ry,X,Z,5.5,amp);
      put(IM.post,N.post++,X,Y-0.05,Z,1,1,1,0,1,1,1);
    }
  }
  Object.keys(N).forEach(k=>{
    const m=IM[k];m.count=N[k];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;
  });
  tPosAttr.needsUpdate=true;tColAttr.needsUpdate=true;rPosAttr.needsUpdate=true;rUvAttr.needsUpdate=true;
  tGeo.computeVertexNormals();rGeo.computeVertexNormals();
}

/* ---------- sky dome, stars, clouds ---------- */
const skyMat=new THREE.ShaderMaterial({
  uniforms:{zen:{value:new THREE.Color(0x2272d8)},hor:{value:new THREE.Color(0xaed4f2)},sunCol:{value:new THREE.Color(0xffffff)},sunDir:{value:new THREE.Vector3(0,1,0)}},
  vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 zen,hor,sunCol,sunDir;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=clamp(d.y,0.0,1.0);vec3 c=mix(hor,zen,pow(h,0.5));float sd=max(dot(d,normalize(sunDir)),0.0);c+=sunCol*(pow(sd,6.0)*0.20+pow(sd,420.0)*1.4);if(d.y<0.0)c=hor;gl_FragColor=vec4(c,1.0);}',
  side:THREE.BackSide,depthWrite:false,fog:false
});
const sky=new THREE.Mesh(new THREE.SphereGeometry(1000,24,16),skyMat);
sky.frustumCulled=false;sky.renderOrder=-10;
scene.add(sky);

const starGeo=new THREE.BufferGeometry();
{
  const a=new Float32Array(600*3);
  for(let k=0;k<600;k++){
    const u=Math.random()*6.2832, v=Math.pow(Math.random(),0.7), r=Math.sqrt(1-v*v)*950;
    a[k*3]=Math.cos(u)*r;a[k*3+1]=v*950+20;a[k*3+2]=Math.sin(u)*r;
  }
  starGeo.setAttribute('position',new THREE.BufferAttribute(a,3));
}
const starMat=new THREE.PointsMaterial({color:0xffffff,size:1.8,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false});
const stars=new THREE.Points(starGeo,starMat);
stars.frustumCulled=false;stars.renderOrder=-9;
scene.add(stars);

const NCL=34;
const cloudMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.92,fog:false,depthWrite:false});
const clouds=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),cloudMat,NCL*3);
clouds.frustumCulled=false;clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(clouds);
const cloudData=[];
for(let k=0;k<NCL;k++){
  const bx=Math.random()*2800,bz=Math.random()*2800,by=150+Math.random()*90,w=70+Math.random()*90;
  for(let j=0;j<3;j++)cloudData.push({bx:bx+(j-1)*w*0.9,bz:bz+(Math.random()-0.5)*w*0.4,by:by+(Math.random()-0.5)*10,sx:w*(j===1?1:0.7),sy:w*0.17,sz:w*0.5});
}
function updateClouds(t,cam){
  for(let k=0;k<cloudData.length;k++){
    const c=cloudData[k];
    const x=((c.bx+t*4-cam.x)%2800+2800)%2800-1400+cam.x;
    const z=((c.bz+t*1.5-cam.z)%2800+2800)%2800-1400+cam.z;
    dummy.position.set(x,c.by,z);dummy.rotation.set(0,0,0);dummy.scale.set(c.sx,c.sy,c.sz);dummy.updateMatrix();
    clouds.setMatrixAt(k,dummy.matrix);
  }
  clouds.instanceMatrix.needsUpdate=true;
}

/* ---------- soft rain ---------- */
const NRAIN=520;
const rainBase=[];
for(let k=0;k<NRAIN;k++)rainBase.push([Math.random()*70,Math.random()*40,Math.random()*70]);
const rainPos=new Float32Array(NRAIN*6);
const rainGeo=new THREE.BufferGeometry();
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3).setUsage(THREE.DynamicDrawUsage));
const rainMat=new THREE.LineBasicMaterial({color:0xcfd9e8,transparent:true,opacity:0,fog:false,depthWrite:false});
const rain=new THREE.LineSegments(rainGeo,rainMat);
rain.frustumCulled=false;rain.visible=false;
scene.add(rain);
function updateRain(t,cam){
  for(let k=0;k<NRAIN;k++){
    const b=rainBase[k];
    const x=((b[0]-cam.x)%70+70)%70-35+cam.x;
    const z=((b[2]-cam.z)%70+70)%70-35+cam.z;
    const y=cam.y-12+(((b[1]-t*22)%40)+40)%40;
    const o=k*6;
    rainPos[o]=x;rainPos[o+1]=y;rainPos[o+2]=z;
    rainPos[o+3]=x+0.12;rainPos[o+4]=y+0.9;rainPos[o+5]=z;
  }
  rainGeo.attributes.position.needsUpdate=true;
}

/* ---------- the car holder: vehicle model, shadow blob, headlight beams ---------- */
const carWrap=new THREE.Group();
scene.add(carWrap);
let VEH=null;
const blob=(()=>{
  const bc=document.createElement('canvas');bc.width=bc.height=64;
  const bg=bc.getContext('2d'),gr=bg.createRadialGradient(32,32,2,32,32,31);
  gr.addColorStop(0,'rgba(0,0,0,.72)');gr.addColorStop(1,'rgba(0,0,0,0)');bg.fillStyle=gr;bg.fillRect(0,0,64,64);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc),transparent:true,depthWrite:false,opacity:0.55}));
  m.rotation.x=-Math.PI/2;m.position.y=0.06;m.renderOrder=2;carWrap.add(m);return m;
})();
const beam=new THREE.SpotLight(0xfff0cf,0,120,0.5,0.6,1);
const beamT=new THREE.Object3D();
carWrap.add(beam,beamT);beam.target=beamT;
function setVehicle(idx,paintIdx){
  if(VEH){carWrap.remove(VEH.group);disposeVehicle(VEH)}
  const spec=VEHICLES[idx];
  VEH=buildVehicle(spec,paintIdx);
  carWrap.add(VEH.group);
  blob.scale.set(spec.W+0.9,spec.L+0.9,1);
  beam.position.set(0,spec.yb+0.5,-spec.L/2+0.5);
  beamT.position.set(0,-1.0,-30);
  return VEH;
}
