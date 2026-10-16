'use strict';
/* ============================================================
   vehicles.js  -  six procedural vehicles
   Every body is a side-view silhouette (with real wheel arches) extruded across the width
   with a rounded bevel, plus a glass cabin, trim, lights, mirrors and spinning wheels.
   Shape x = forward, y = up.  In the car group forward is -Z, so shape x maps to z = -x.
   ============================================================ */
const PAINTS=[null,0xc8372d,0xe08a2e,0xe6c84a,0x3f8c8a,0x2d5fa8,0x6a4c93,0xe9e4d6,0x23262b];
const PAINT_NAMES=['Stock','Red','Amber','Sun yellow','Teal','Blue','Plum','Pearl','Graphite'];

const VEHICLES=[
  {id:'hatch',name:'Sprout',kind:'Hatchback',paint:0x3f8c8a,L:3.94,W:1.72,wr:0.31,tw:0.22,yb:0.30,ax:[1.18,-1.15],wb:2.33,
   vmax:41.7,acc:3.6,brake:9.5,steer:0.58,lat:10.5,snd:1.0,
   body:[[-1.95,.30],[-1.97,.62],[-1.93,.92],[-1.45,.99],[.6,.97],[1.25,.93],[1.75,.78],[1.97,.55],[1.97,.30]],
   cabin:[[-1.80,.94],[.7,.94],[.1,1.52],[-1.28,1.52]],roof:[-1.28,.1,1.52],
   head:{x:1.93,y:.66,lat:.56,w:.36,h:.12},tail:{x:-1.96,y:.76,lat:.58,w:.3,h:.15},grille:.52,plate:'SPR 01'},
  {id:'sedan',name:'Meadowlark',kind:'Sedan',paint:0x2d5fa8,L:4.54,W:1.78,wr:0.32,tw:0.22,yb:0.30,ax:[1.38,-1.32],wb:2.7,
   vmax:47,acc:3.4,brake:10,steer:0.52,lat:11,snd:0.95,
   body:[[-2.25,.30],[-2.27,.64],[-2.2,.92],[-1.8,1.0],[-1.25,1.0],[1.0,.97],[1.75,.9],[2.15,.72],[2.27,.55],[2.27,.30]],
   cabin:[[-1.45,.96],[.75,.96],[.1,1.50],[-.95,1.50]],roof:[-.95,.1,1.50],
   head:{x:2.22,y:.74,lat:.6,w:.38,h:.12},tail:{x:-2.26,y:.8,lat:.62,w:.34,h:.13},grille:.56,plate:'MLK 22'},
  {id:'coupe',name:'Comet',kind:'Coupe',paint:0xc8372d,L:4.34,W:1.86,wr:0.34,tw:0.26,yb:0.30,ax:[1.3,-1.28],wb:2.58,
   vmax:58,acc:5.2,brake:12,steer:0.5,lat:14,snd:1.25,
   body:[[-2.15,.30],[-2.17,.62],[-2.0,.88],[-1.2,.95],[.4,.9],[1.3,.8],[1.85,.62],[2.15,.5],[2.17,.30]],
   cabin:[[-1.35,.9],[.45,.88],[-.15,1.30],[-.95,1.31]],roof:[-.95,-.15,1.31],
   head:{x:2.12,y:.56,lat:.64,w:.36,h:.09},tail:{x:-2.16,y:.78,lat:.66,w:.42,h:.1},grille:.44,plate:'CMT 88'},
  {id:'pickup',name:'Ridge',kind:'Pickup',paint:0xe08a2e,L:5.24,W:1.96,wr:0.40,tw:0.30,yb:0.45,ax:[1.6,-1.5],wb:3.1,
   vmax:39,acc:3.0,brake:8.5,steer:0.5,lat:8.5,snd:0.8,
   body:[[-2.6,.45],[-2.62,.8],[-2.6,1.04],[-.5,1.06],[-.35,1.12],[1.25,1.10],[1.8,1.0],[2.45,.86],[2.6,.62],[2.6,.45]],
   cabin:[[-.55,1.08],[1.0,1.08],[.5,1.8],[-.45,1.8]],roof:[-.45,.5,1.8],
   head:{x:2.56,y:.86,lat:.7,w:.42,h:.14},tail:{x:-2.62,y:.86,lat:.8,w:.12,h:.26},grille:.74,plate:'RDG 40'},
  {id:'camper',name:'Wanderer',kind:'Camper van',paint:0x4c8f86,L:5.04,W:2.0,wr:0.36,tw:0.26,yb:0.42,ax:[1.55,-1.4],wb:2.95,
   vmax:30.5,acc:1.9,brake:7.5,steer:0.5,lat:7,snd:0.85,
   body:[[-2.5,.42],[-2.52,2.15],[-2.3,2.42],[.9,2.42],[1.5,2.3],[2.2,1.55],[2.5,.95],[2.5,.42]],
   cabin:[[.95,1.42],[2.3,1.46],[1.58,2.30],[.95,2.30]],roof:null,cabinWide:0.03,
   head:{x:2.48,y:.78,lat:.7,w:.3,h:.18},tail:{x:-2.52,y:.9,lat:.78,w:.12,h:.32},grille:.6,plate:'WND 07'},
  {id:'jeep',name:'Trailblazer',kind:'Off-roader',paint:0x6f8a3c,L:3.96,W:1.82,wr:0.42,tw:0.30,yb:0.50,ax:[1.2,-1.15],wb:2.35,
   vmax:33,acc:3.1,brake:9,steer:0.56,lat:9.5,snd:0.9,
   body:[[-1.95,.5],[-1.97,1.1],[-1.8,1.17],[.85,1.17],[1.0,1.1],[1.9,1.06],[1.97,.9],[1.97,.5]],
   cabin:[[-1.9,1.14],[.5,1.14],[.35,1.82],[-1.9,1.82]],roof:[-1.9,.35,1.82],
   head:{x:1.95,y:.9,lat:.6,w:.3,h:.3,round:true},tail:{x:-1.98,y:.9,lat:.7,w:.1,h:.26},grille:.78,plate:'TRL 04'}
];

/* ---------- geometry helpers ---------- */
function roundShape(pts,rad){
  const sh=new THREE.Shape(), n=pts.length;
  for(let i=0;i<n;i++){
    const p0=pts[(i+n-1)%n], p1=pts[i], p2=pts[(i+1)%n], r=Array.isArray(rad)?rad[i]:rad;
    const d1=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])||1, d2=Math.hypot(p2[0]-p1[0],p2[1]-p1[1])||1;
    const a=Math.min(r,d1*0.5,d2*0.5);
    const ax=p1[0]+(p0[0]-p1[0])/d1*a, ay=p1[1]+(p0[1]-p1[1])/d1*a;
    const bx=p1[0]+(p2[0]-p1[0])/d2*a, by=p1[1]+(p2[1]-p1[1])/d2*a;
    if(i===0)sh.moveTo(ax,ay);else sh.lineTo(ax,ay);
    if(a>0.0001)sh.quadraticCurveTo(p1[0],p1[1],bx,by);
  }
  sh.closePath();
  return sh;
}
function extrudePart(pts,rad,width,bevel,mat){
  const depth=Math.max(0.02,width-2*bevel);
  const g=new THREE.ExtrudeGeometry(roundShape(pts,rad),{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel*0.65,bevelSegments:3,curveSegments:5});
  g.translate(0,0,-depth/2);
  const m=new THREE.Mesh(g,mat);
  m.rotation.y=Math.PI/2;           // shape x -> -Z (forward), extrusion -> X (width)
  return m;
}
/* body outline = top profile + wheel arches cut into the underside */
function bodyOutline(spec){
  const pts=[], rad=[], top=spec.body;
  for(let i=0;i<top.length;i++){pts.push(top[i]);rad.push((i===0||i===top.length-1)?0.04:0.2)}
  const ra=spec.wr+0.07, d=spec.yb-spec.wr, phi0=Math.asin(clamp(d/ra,-0.99,0.99));
  spec.ax.slice().sort((a,b)=>b-a).forEach(ax=>{
    const steps=10;
    for(let k=0;k<=steps;k++){
      const phi=lerp(phi0,Math.PI-phi0,k/steps);
      pts.push([ax+ra*Math.cos(phi),spec.wr+ra*Math.sin(phi)]);rad.push(0);
    }
  });
  return {pts,rad};
}
function box(len,h,wid,mat,x,y,lat,g){
  const m=new THREE.Mesh(new THREE.BoxGeometry(wid,h,len),mat);
  m.position.set(lat,y,-x);g.add(m);return m;
}
function plateTexture(text){
  const c=document.createElement('canvas');c.width=128;c.height=40;
  const x=c.getContext('2d');
  x.fillStyle='#eceadf';x.fillRect(0,0,128,40);
  x.strokeStyle='#23282a';x.lineWidth=3;x.strokeRect(2,2,124,36);
  x.fillStyle='#1d2224';x.font='700 24px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,64,21);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function makeWheel(R,tw,M){
  const pivot=new THREE.Group(), spin=new THREE.Group();
  pivot.add(spin);
  const cyl=(r,w,mat)=>new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,28).rotateZ(Math.PI/2),mat);
  spin.add(cyl(R,tw,M.tire),cyl(R*0.8,tw+0.012,M.wall),cyl(R*0.62,tw+0.024,M.rim),cyl(R*0.15,tw+0.045,M.hub));
  for(let k=0;k<5;k++){
    const sp=new THREE.Mesh(new THREE.BoxGeometry(tw+0.04,R*0.1,R*1.18),M.spoke);
    sp.rotation.x=k*Math.PI/5;spin.add(sp);
  }
  // a small lug nut ring so the spin is easy to see
  for(let k=0;k<5;k++){
    const a=k/5*Math.PI*2, n=cyl(R*0.045,tw+0.05,M.hub);
    n.position.set(0,Math.cos(a)*R*0.3,Math.sin(a)*R*0.3);spin.add(n);
  }
  return {pivot,spin};
}

/* ---------- build one vehicle ---------- */
function buildVehicle(spec,paintIdx){
  const g=new THREE.Group();
  const paintHex=PAINTS[paintIdx]==null?spec.paint:PAINTS[paintIdx];
  const M={
    body:new THREE.MeshPhongMaterial({color:paintHex,shininess:75,specular:0x5a5e60}),
    glass:new THREE.MeshPhongMaterial({color:0x172229,shininess:120,specular:0x9bb0c0}),
    trim:new THREE.MeshLambertMaterial({color:0x14181a}),
    chrome:new THREE.MeshPhongMaterial({color:0xb9c0c2,shininess:90,specular:0xffffff}),
    tire:new THREE.MeshLambertMaterial({color:0x111314}),
    wall:new THREE.MeshLambertMaterial({color:0x232628}),
    rim:new THREE.MeshPhongMaterial({color:0xc5cacb,shininess:80,specular:0xffffff}),
    spoke:new THREE.MeshPhongMaterial({color:0x7b8284,shininess:60}),
    hub:new THREE.MeshPhongMaterial({color:0x9aa1a3,shininess:90,specular:0xffffff}),
    head:new THREE.MeshBasicMaterial({color:0xaaa591}),
    tail:new THREE.MeshBasicMaterial({color:0x6b1212}),
    rev:new THREE.MeshBasicMaterial({color:0x8a8a84})
  };
  const V={group:g,spec,mats:M,wheels:[],headMat:M.head,tailMat:M.tail,revMat:M.rev,bodyMat:M.body};
  const W=spec.W, L=spec.L, belt=spec.cabin[0][1];

  // body shell and glass cabin
  const o=bodyOutline(spec);
  g.add(extrudePart(o.pts,o.rad,W,0.07,[M.body,M.body]));
  const cw=W-0.2+(spec.cabinWide||0);
  g.add(extrudePart(spec.cabin,0.13,cw,0.045,[M.glass,M.glass]));
  if(spec.roof)box(spec.roof[1]-spec.roof[0]+0.04,0.06,cw-0.04,M.body,(spec.roof[0]+spec.roof[1])/2,spec.roof[2]+0.04,0,g);

  // bumpers, grille, plates
  box(0.16,0.2,W*0.97,M.trim,L/2-0.02,spec.yb+0.08,0,g);
  box(0.16,0.2,W*0.97,M.trim,-L/2+0.02,spec.yb+0.08,0,g);
  box(0.05,0.14,W*0.4,M.trim,L/2-0.02,spec.yb+spec.grille-0.28+0.1,0,g);
  box(0.03,0.02,W*0.4,M.chrome,L/2+0.005,spec.yb+spec.grille-0.28+0.19,0,g);
  const pm=new THREE.MeshBasicMaterial({map:plateTexture(spec.plate)});
  [[1,L/2+0.03],[-1,-L/2-0.03]].forEach(p=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.14),pm);
    m.position.set(0,spec.yb+0.13,-p[1]);if(p[0]<0)m.rotation.y=0;else m.rotation.y=Math.PI;g.add(m);
  });

  // lights (shared materials so the game can switch them on and off)
  const h=spec.head, t=spec.tail;
  [-1,1].forEach(s=>{
    if(h.round){
      const m=new THREE.Mesh(new THREE.CylinderGeometry(h.w/2,h.w/2,0.08,16).rotateX(Math.PI/2),M.head);
      m.position.set(s*h.lat,h.y,-h.x);g.add(m);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(h.w/2+0.01,0.018,6,18),M.chrome);
      ring.position.set(s*h.lat,h.y,-h.x-0.04);g.add(ring);
    }else box(0.07,h.h,h.w,M.head,h.x,h.y,s*h.lat,g);
    box(0.06,t.h,t.w,M.tail,t.x,t.y,s*t.lat,g);
    box(0.05,0.07,0.12,M.rev,t.x,t.y-t.h/2-0.06,s*(t.lat-t.w/2+0.08),g);
  });

  // mirrors, door handles and door lines
  const mx=spec.cabin[1][0]-0.2;
  [-1,1].forEach(s=>{
    box(0.12,0.1,0.14,M.body,mx,belt+0.12,s*(W/2+0.04),g);
    box(0.05,0.1,0.04,M.trim,mx+0.02,belt+0.12,s*(W/2-0.02),g);
    const hx=(spec.cabin[0][0]+spec.cabin[1][0])/2+0.5;
    box(0.16,0.035,0.03,M.chrome,hx,belt-0.07,s*(W/2+0.012),g);
    const dl=belt-spec.yb-0.18;
    box(0.012,dl,0.02,M.trim,spec.cabin[1][0]-0.1,spec.yb+0.12+dl/2,s*(W/2+0.008),g);
    box(0.012,dl,0.02,M.trim,(spec.cabin[0][0]+spec.cabin[1][0])/2+0.05,spec.yb+0.12+dl/2,s*(W/2+0.008),g);
  });

  // wheels (front pair steers)
  const latW=W/2-spec.tw/2-0.015;
  spec.ax.forEach((ax,i)=>{
    [-1,1].forEach(s=>{
      const w=makeWheel(spec.wr,spec.tw,M);
      w.pivot.position.set(s*latW,spec.wr,-ax);
      g.add(w.pivot);
      V.wheels.push({pivot:w.pivot,spin:w.spin,front:i===0,R:spec.wr});
    });
  });

  // vehicle-specific parts
  if(spec.id==='hatch'){
    box(1.3,0.035,0.04,M.trim,-0.55,spec.roof[2]+0.09,0.5,g);box(1.3,0.035,0.04,M.trim,-0.55,spec.roof[2]+0.09,-0.5,g);
  }
  if(spec.id==='coupe'){
    box(0.32,0.05,W*0.82,M.body,-2.0,0.99,0,g);
    box(0.08,0.14,0.05,M.trim,-1.96,0.9,0.55,g);box(0.08,0.14,0.05,M.trim,-1.96,0.9,-0.55,g);
    box(0.5,0.02,0.12,M.trim,1.45,0.84,0,g);
  }
  if(spec.id==='pickup'){
    box(1.95,0.025,W-0.34,M.trim,-1.57,1.065,0,g);
    box(2.05,0.14,0.07,M.body,-1.57,1.12,W/2-0.05,g);box(2.05,0.14,0.07,M.body,-1.57,1.12,-(W/2-0.05),g);
    box(0.07,0.14,W-0.1,M.body,-2.58,1.12,0,g);
    box(0.06,0.2,W-0.2,M.body,-0.6,1.14,0,g);
    box(0.2,0.1,W*0.9,M.chrome,2.62,0.58,0,g);
    box(0.5,0.06,0.5,M.trim,1.9,1.12,0,g);
  }
  if(spec.id==='camper'){
    const stripe=new THREE.MeshPhongMaterial({color:0xf1e6c8,shininess:40});
    box(4.96,0.26,W+0.014,stripe,-0.02,1.1,0,g);
    [-1,1].forEach(s=>{box(1.5,0.55,0.03,M.glass,-1.0,1.78,s*(W/2+0.01),g);box(0.7,0.5,0.03,M.glass,0.35,1.78,s*(W/2+0.01),g)});
    box(0.9,0.12,0.7,new THREE.MeshPhongMaterial({color:0xeeeeea}),-1.2,2.5,0,g);
    box(0.06,1.5,0.06,M.chrome,-2.55,1.4,0.7,g);box(0.06,1.5,0.06,M.chrome,-2.55,1.4,-0.7,g);
  }
  if(spec.id==='jeep'){
    [-1,1].forEach(s=>box(2.2,0.045,0.05,M.trim,-0.8,1.93,s*0.78,g));
    for(let k=0;k<4;k++)box(0.05,0.04,1.6,M.trim,-1.6+k*0.7,1.93,0,g);
    const spare=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.22,22).rotateX(Math.PI/2),M.tire);
    spare.position.set(0,0.95,-(-L/2-0.14));g.add(spare);
    const hubc=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.24,16).rotateX(Math.PI/2),M.rim);
    hubc.position.copy(spare.position);g.add(hubc);
    box(0.5,0.05,W*0.55,M.trim,1.55,1.1,0,g);
    box(0.08,0.1,W*0.7,M.chrome,2.0,0.62,0,g);
  }
  return V;
}
function disposeVehicle(V){
  if(!V)return;
  V.group.traverse(o=>{if(o.geometry)o.geometry.dispose()});
  Object.keys(V.mats).forEach(k=>{if(V.mats[k].map)V.mats[k].map.dispose();V.mats[k].dispose()});
}
