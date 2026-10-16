'use strict';
/* ============================================================
   world.js  -  noise, the endless road, landscapes (biomes)
   Shared helpers live in the global scope so the other scripts can use them.
   ============================================================ */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

/* ---------- saved settings ---------- */
let store={};
try{store=JSON.parse(localStorage.getItem('quietmiles2')||'{}')||{}}catch(e){store={}}
const cfg={
  vol:store.vol==null?70:store.vol, q:store.q==null?1:store.q,
  veh:store.veh|0, paint:store.paint|0,
  steer:store.steer||'wheel', unit:store.unit||'kmh',
  cam:0, time:'auto', wx:'clear'
};
function save(){
  try{localStorage.setItem('quietmiles2',JSON.stringify({vol:cfg.vol,q:cfg.q,veh:cfg.veh,paint:cfg.paint,steer:cfg.steer,unit:cfg.unit}))}catch(e){}
}

/* ---------- noise ---------- */
let SEED=(Math.random()*9000+100)|0;
function hash(x,y){
  let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(SEED,1274126177);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function vn1(x){
  const i=Math.floor(x), f=x-i, u=f*f*(3-2*f);
  return lerp(hash(i,7),hash(i+1,7),u);
}
function vn2(x,y){
  const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
  const ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  const a=hash(ix,iy), b=hash(ix+1,iy), c=hash(ix,iy+1), d=hash(ix+1,iy+1);
  return lerp(lerp(a,b,ux),lerp(c,d,ux),uy);
}
function fbm(x,z){
  return vn2(x*0.006,z*0.006)*0.58+vn2(x*0.017+31,z*0.017+17)*0.30+vn2(x*0.045+7,z*0.045+53)*0.12;
}

/* ---------- the road: one point every SEG metres ---------- */
const SEG=5;
const R={x:[0],z:[0],th:[0],y:[0]};
const curv=s=>0.0042*(0.65*(vn1(s*0.003)*2-1)+0.35*(vn1(s*0.0011+50)*2-1));
const elev=s=>20*vn1(s*0.0021+9)+7*vn1(s*0.0065+31)-12;
function resetRoad(){R.x=[0];R.z=[0];R.th=[0];R.y=[elev(0)]}
resetRoad();
function ensure(n){
  while(R.x.length<=n){
    const i=R.x.length-1, th=R.th[i], k=curv(i*SEG+SEG/2), tm=th+k*SEG/2;
    R.x.push(R.x[i]+Math.sin(tm)*SEG);
    R.z.push(R.z[i]-Math.cos(tm)*SEG);
    R.th.push(th+k*SEG);
    R.y.push(elev((i+1)*SEG));
  }
}
/* centre line at distance s along the road */
const CP={x:0,y:0,z:0,th:0,k:0};
function centre(s){
  const f0=s/SEG, i=Math.floor(f0), f=f0-i;
  ensure(i+2);
  CP.x=lerp(R.x[i],R.x[i+1],f); CP.z=lerp(R.z[i],R.z[i+1],f);
  CP.y=lerp(R.y[i],R.y[i+1],f); CP.th=lerp(R.th[i],R.th[i+1],f);
  CP.k=curv(s);
  return CP;
}

/* ---------- landscapes ----------
   lo/hi: ground colour in valleys / on hills.  The rates (0..1) say how often each kind of
   scenery appears per 5 m of road on each side.  pal = tree colours, grass = tuft tint. */
const BIO=[
  {name:'Meadow country', sub:'Soft hills and wide sky', lo:[.30,.52,.19],hi:[.58,.72,.31],amp:16,
   tree:.22,kind:0,pal:[[.28,.55,.2],[.36,.62,.24],[.22,.46,.2]],
   grass:1.0,gcol:[.46,.78,.28],flower:.5,fpal:[[.97,.97,.9],[.98,.82,.25],[.9,.35,.6],[.6,.55,.95]],
   dead:.05,bush:.28,cactus:0,rock:.03,log:.03,fence:.30},
  {name:'Autumn woods',   sub:'The leaves are turning',  lo:[.40,.38,.15],hi:[.62,.38,.14],amp:24,
   tree:.80,kind:0,pal:[[.85,.42,.1],[.8,.2,.1],[.92,.68,.14],[.62,.3,.1]],
   grass:.55,gcol:[.72,.55,.22],flower:.05,fpal:[[.95,.5,.15],[.9,.8,.3]],
   dead:.20,bush:.40,cactus:0,rock:.04,log:.08,fence:.10},
  {name:'Pine highlands', sub:'Cool air, long ridges',   lo:[.16,.32,.21],hi:[.56,.6,.57],amp:46,
   tree:.78,kind:1,pal:[[.1,.27,.17],[.13,.33,.2],[.09,.22,.16]],
   grass:.40,gcol:[.3,.5,.3],flower:.12,fpal:[[.7,.6,.95],[.95,.95,.95]],
   dead:.24,bush:.12,cactus:0,rock:.22,log:.07,fence:0},
  {name:'Golden dunes',   sub:'Warm sand, open horizon', lo:[.80,.64,.36],hi:[.94,.79,.5],amp:20,
   tree:.04,kind:2,pal:[[.55,.55,.25],[.7,.62,.3]],
   grass:.22,gcol:[.82,.7,.38],flower:0,fpal:[[.9,.4,.2]],
   dead:.38,bush:.12,cactus:.26,rock:.10,log:.03,fence:0}
];
const BM={lr:0,lg:0,lb:0,hr:0,hg:0,hb:0,amp:0,dom:0,ia:0,ib:1,f:0};
function biomeAt(s){
  const t=s/2600, k=Math.floor(t), f=sstep(0.8,1,t-k);
  const ia=((k%4)+4)%4, ib=(ia+1)%4, a=BIO[ia], b=BIO[ib];
  BM.ia=ia;BM.ib=ib;BM.f=f;
  BM.lr=lerp(a.lo[0],b.lo[0],f);BM.lg=lerp(a.lo[1],b.lo[1],f);BM.lb=lerp(a.lo[2],b.lo[2],f);
  BM.hr=lerp(a.hi[0],b.hi[0],f);BM.hg=lerp(a.hi[1],b.hi[1],f);BM.hb=lerp(a.hi[2],b.hi[2],f);
  BM.amp=lerp(a.amp,b.amp,f);
  BM.dom=f>0.5?ib:ia;
  return BM;
}
/* ground height beside the road: flat on the road, a shallow ditch at the verge, hills further out */
function terrY(roadY,x,z,ad,amp){
  const w=sstep(10,95,ad);
  const ditch=-0.4*sstep(4.2,7,ad)*(1-sstep(7,14,ad));
  return roadY+(fbm(x,z)-0.45)*amp*1.5*w+ditch;
}
const COLS=[-110,-80,-60,-45,-33,-24,-17,-12,-8.5,-6,-4.2,4.2,6,8.5,12,17,24,33,45,60,80,110];
const NC=COLS.length, NR=170, BACK=12;
