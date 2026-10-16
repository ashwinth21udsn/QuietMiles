'use strict';
/* ============================================================
   game.js  -  manual driving physics, camera, controls, gauge, menus, main loop
   You control: steering wheel, gas, brake, gear (D / R), headlights (off / low / high), horn.
   ============================================================ */
let started=false, garageOpen=false;
let s=120, lat=1.8, rel=0, v=0, steerCur=0, thr=0, gear='D', lights=0, trip=0, hour=17.4, t=0;
let snapCam=true, lastDom=-1, orbitA=0.5, rpmS=0.15, gearNo=1, omegaNow=0, accelNow=0, brakeLit=0, hinted=false, curAmp=16;
let camYaw=0, camY=0, viewShift=0, viewLift=0;
const inp={gas:false,brake:false,btn:0,wheel:0,wheelActive:false};
const keys={};

/* ---------- vehicle, paint, lights ---------- */
const MAXROT=1.9; // radians of drag that equal full lock
function spec(){return VEH.spec}
function paintHex(i){return PAINTS[i]==null?spec().paint:PAINTS[i]}
function applyVehicle(){
  setVehicle(cfg.veh,cfg.paint);
  buildDial();
  applyLights();
  snapCam=true;
  [].forEach.call($('vList').children,(b,i)=>b.setAttribute('aria-pressed',String(i===cfg.veh)));
  paintSwatches();
}
function applyLights(){
  const m=VEH.headMat;
  if(lights===0){m.color.setRGB(0.62,0.6,0.52);beam.intensity=0}
  else if(lights===1){m.color.setRGB(1,0.96,0.8);beam.intensity=2.6;beam.distance=110;beam.angle=0.55;beamT.position.set(0,-1.4,-28)}
  else{m.color.setRGB(1,1,0.94);beam.intensity=4.2;beam.distance=190;beam.angle=0.42;beamT.position.set(0,-1.0,-55)}
  $('bLight').dataset.state=lights;
  $('lightTag').textContent=['OFF','LOW','HIGH'][lights];
}

/* ---------- physics ---------- */
const GEARB=[0.16,0.34,0.54,0.76,1.01];
function stepDrive(dt){
  const sp=spec(), gasOn=inp.gas||keys.gas, brakeOn=inp.brake||keys.brake;
  thr+=((gasOn?1:0)-thr)*Math.min(1,dt*(gasOn?3:7));
  const va=Math.abs(v), sgn=Math.sign(v), off=Math.abs(lat)>4.9;
  let a=0;
  const grip=brakeOn?0.15:1;
  // thrust fades towards vt, chosen so drag and thrust balance exactly at the vehicle's rated top speed
  const vt=sp.vt||(sp.vt=sp.vmax/Math.pow(Math.max(0.12,1-(0.35+0.0009*sp.vmax*sp.vmax)/sp.acc),1/2.2));
  if(gear==='D')a+=thr*grip*sp.acc*Math.max(0,1-Math.pow(Math.max(v,0)/vt,2.2))*(v<0?1.6:1);
  else a-=thr*grip*sp.acc*0.55*Math.max(0,1-Math.pow(Math.max(-v,0)/7.5,2))*(v>0?1.6:1);
  a-=sgn*(0.35+0.0009*v*v+(thr<0.05?0.55:0));          // rolling resistance, drag, engine braking
  if(off)a-=sgn*(1.5+0.05*va);                           // grass and gravel slow you down
  if(brakeOn)a-=sgn*sp.brake;
  accelNow=a;
  let nv=v+a*dt;
  if(v!==0&&Math.sign(nv)!==Math.sign(v)&&(brakeOn||thr<0.05||off))nv=0;
  v=nv;

  // steering input: wheel drag, side buttons or keyboard
  let target=inp.wheelActive?inp.wheel:clamp(inp.btn+(keys.r?1:0)-(keys.l?1:0),-1,1);
  const rate=inp.wheelActive?16:(target===0?9:5);
  steerCur+=(target-steerCur)*(1-Math.exp(-dt*rate));
  const av=Math.abs(v);
  const wmax=Math.min(av/sp.wb*Math.tan(sp.steer),sp.lat/Math.max(av,0.5));
  omegaNow=steerCur*wmax*(v<0?-1:1);

  // follow the road: heading is measured relative to the road direction
  const k=curv(s);
  rel+=(omegaNow-k*v*Math.cos(rel))*dt;
  rel=clamp(rel,-1.35,1.35);
  s+=v*Math.cos(rel)*dt;
  lat+=v*Math.sin(rel)*dt;
  trip+=av*dt;
  if(Math.abs(lat)>36){lat=Math.sign(lat)*36;if(Math.sign(rel)===Math.sign(lat))rel*=0.9;v*=Math.exp(-dt*1.2)}
  if(s<80){s=80;if(v<0)v=0}
}
function calcRpm(dt){
  const sp=spec(), va=Math.abs(v);
  let r;
  if(gear==='R'){gearNo=0;r=0.18+va/7.5*0.55+thr*0.2}
  else{
    const B=GEARB.map(x=>x*sp.vmax);
    let g=0;while(g<4&&va>B[g])g++;
    gearNo=g+1;
    const lo=g?B[g-1]:0, f=clamp((va-lo)/(B[g]-lo),0,1);
    r=lerp(0.16+thr*0.5,0.28+0.62*f+thr*0.08,Math.min(1,va/2.5));
  }
  rpmS+=(clamp(r,0.12,1)-rpmS)*(1-Math.exp(-dt*10));
}

/* ---------- placing the car and the camera ---------- */
const carPos=new THREE.Vector3(), pF=new THREE.Vector3(), pB=new THREE.Vector3(), camTgt=new THREE.Vector3(), camLook=new THREE.Vector3();
function groundPt(sd,lt,out){
  const c=centre(sd), cs=Math.cos(c.th), sn=Math.sin(c.th), x=c.x+cs*lt, z=c.z+sn*lt;
  out.set(x,terrY(c.y,x,z,Math.abs(lt),curAmp),z);
}
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const CAMS=[{fov:62},{fov:58},{fov:74}];
function poseCar(dt){
  const sp=spec(), top=sp.cabin.reduce((m,p)=>Math.max(m,p[1]),0)+0.1;
  const c=centre(s), th=c.th;
  groundPt(s,lat,carPos);
  const cr=Math.cos(rel), sr=Math.sin(rel), h=sp.wb*0.5;
  groundPt(s+cr*h,lat+sr*h,pF);groundPt(s-cr*h,lat-sr*h,pB);
  const yaw=th+rel;
  const off=Math.abs(lat)>4.9&&Math.abs(v)>1;
  const bump=off?(vn1(s*0.9)-0.5)*0.04*Math.min(1,Math.abs(v)/12):0;
  const pitch=Math.atan2(pF.y-pB.y,Math.hypot(pF.x-pB.x,pF.z-pB.z))+clamp(accelNow*0.0055,-0.05,0.04)+bump;
  const roll=clamp(omegaNow*v*0.009,-0.07,0.07)+bump*0.7;
  carWrap.position.set(carPos.x,carPos.y+Math.abs(bump)*0.3,carPos.z);
  carWrap.rotation.order='YXZ';
  carWrap.rotation.set(pitch,-yaw,roll);

  // wheels
  VEH.wheels.forEach(w=>{
    w.spin.rotation.x-=v/w.R*dt;
    if(w.front)w.pivot.rotation.y=-steerCur*0.5;
  });
  // lamps that depend on pedals and gear
  brakeLit+=(((inp.brake||keys.brake)?1:0)-brakeLit)*Math.min(1,dt*20);
  const base=lights>0?0.55:0.4;
  VEH.tailMat.color.setRGB(lerp(base,1,brakeLit),lerp(base*0.12,0.1,brakeLit),lerp(base*0.12,0.08,brakeLit));
  const rv=gear==='R'?1:0;
  VEH.revMat.color.setRGB(lerp(0.5,1,rv),lerp(0.5,1,rv),lerp(0.47,0.95,rv));

  // camera
  const orbit=garageOpen||!started;
  const fwd=(a,out)=>out.set(Math.sin(a),0,-Math.cos(a));
  let fov=CAMS[cfg.cam].fov;
  VEH.group.visible=orbit||cfg.cam!==2;
  if(orbit){
    orbitA+=dt*0.35;
    const ro=sp.L*1.15+3.2;
    const oa=-yaw+orbitA;   // orbit is relative to the car: 0 = behind, PI = in front
    camTgt.set(carPos.x+Math.sin(oa)*ro,carPos.y+1.4+top*0.7,carPos.z+Math.cos(oa)*ro);
    camLook.set(carPos.x,carPos.y+top*0.45,carPos.z);
    camera.position.lerp(camTgt,snapCam?1:1-Math.exp(-dt*4));
    camera.lookAt(camLook);fov=42;
  }else{
    camYaw+=wrapA(yaw-camYaw)*(snapCam?1:1-Math.exp(-dt*(cfg.cam===2?30:3.5)));
    const f=new THREE.Vector3();
    if(cfg.cam===2){
      fwd(yaw,f);
      const cx=(sp.cabin[0][0]+sp.cabin[1][0])/2+0.2;
      camera.position.set(carPos.x+f.x*cx,carPos.y+top*0.78,carPos.z+f.z*cx);
      camera.lookAt(carPos.x+f.x*40,camera.position.y+pitch*30+Math.min(0.0,0),carPos.z+f.z*40);
    }else{
      fwd(camYaw,f);
      const back=cfg.cam===0?sp.L*0.9+4.2+Math.abs(v)*0.025:sp.L+9, up=cfg.cam===0?top+1.7:top+8;
      const ty=carPos.y+up;
      camY=snapCam?ty:camY+(ty-camY)*(1-Math.exp(-dt*6));
      camera.position.set(carPos.x-f.x*back,Math.max(camY,carPos.y+1.2),carPos.z-f.z*back);
      camLook.set(carPos.x+f.x*(cfg.cam===0?14:20),carPos.y+top*0.5+1.0,carPos.z+f.z*(cfg.cam===0?14:20));
      camera.lookAt(camLook);
    }
    if(off){camera.position.y+=bump*3;}
    fov+=Math.min(8,Math.abs(v)/36*8);
  }
  if(Math.abs(camera.fov-fov)>0.05){camera.fov=lerp(camera.fov,fov,snapCam?1:0.08);camera.updateProjectionMatrix()}
  // slide the picture left while a menu panel covers the right side
  // also lift the picture a little in chase and high cameras so the speedometer does not sit on the car
  const W0=window.innerWidth, H0=window.innerHeight;
  const wantShift=(garageOpen&&W0>H0)?W0*0.19:0;
  const wantLift=(orbit||cfg.cam===2)?0:H0*0.13;
  viewShift+=(wantShift-viewShift)*Math.min(1,dt*6);
  viewLift+=(wantLift-viewLift)*Math.min(1,dt*6);
  if(Math.abs(viewShift)>0.5||Math.abs(viewLift)>0.5)camera.setViewOffset(W0,H0,viewShift,viewLift,W0,H0);
  else if(camera.view&&camera.view.enabled)camera.clearViewOffset();
  snapCam=false;
}

/* ---------- speedometer ---------- */
const gauge=$('gauge'), gctx=gauge.getContext('2d');
let dialImg=null, dialMax=160, dialMajor=20, dispU=0;
const UNIT=()=>cfg.unit==='mph'?2.237:3.6;
const DEG=Math.PI/180, A0=135*DEG, A1=405*DEG;
function buildDial(){
  const sp=spec(), k=UNIT();
  dialMax=Math.ceil(sp.vmax*k/20)*20;
  dialMajor=dialMax<=100?10:20;
  const c=document.createElement('canvas');c.width=c.height=400;
  const x=c.getContext('2d'), C=200;
  x.fillStyle='rgba(12,20,18,0.84)';x.beginPath();x.arc(C,C,192,0,7);x.fill();
  x.strokeStyle='rgba(238,244,236,0.2)';x.lineWidth=3;x.beginPath();x.arc(C,C,190,0,7);x.stroke();
  x.strokeStyle='rgba(238,244,236,0.08)';x.lineWidth=2;x.beginPath();x.arc(C,C,120,0,7);x.stroke();
  const minor=dialMajor/2, labelEvery=dialMax/dialMajor>9?2:1;
  for(let u=0,i=0;u<=dialMax+0.01;u+=minor,i++){
    const a=A0+(A1-A0)*u/dialMax, isMajor=i%2===0, red=u>dialMax*0.86;
    const r0=176, r1=r0-(isMajor?24:12);
    x.strokeStyle=red?'#e0705f':(isMajor?'rgba(238,244,236,0.9)':'rgba(238,244,236,0.45)');
    x.lineWidth=isMajor?4:2.5;x.lineCap='round';
    x.beginPath();x.moveTo(C+Math.cos(a)*r0,C+Math.sin(a)*r0);x.lineTo(C+Math.cos(a)*r1,C+Math.sin(a)*r1);x.stroke();
    if(isMajor&&(i/2)%labelEvery===0){
      x.fillStyle=red?'#f0a89d':'#eef4ec';x.font='600 25px Figtree,Roboto,sans-serif';x.textAlign='center';x.textBaseline='middle';
      x.fillText(String(Math.round(u)),C+Math.cos(a)*128,C+Math.sin(a)*128);
    }
  }
  x.fillStyle='rgba(238,244,236,0.55)';x.font='600 19px Figtree,Roboto,sans-serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText(cfg.unit==='mph'?'MPH':'KM/H',C,262);
  dialImg=c;
}
function drawGauge(){
  const C=200, w=400;
  gctx.clearRect(0,0,w,w);
  if(dialImg)gctx.drawImage(dialImg,0,0);
  const target=Math.abs(v)*UNIT();
  dispU+=(target-dispU)*0.3;
  const u=clamp(dispU,0,dialMax), a=A0+(A1-A0)*u/dialMax;
  if(u>0.5){
    gctx.strokeStyle='rgba(240,187,110,0.9)';gctx.lineWidth=7;gctx.lineCap='round';
    gctx.beginPath();gctx.arc(C,C,184,A0,a);gctx.stroke();
  }
  gctx.strokeStyle='#f0bb6e';gctx.lineWidth=6;gctx.lineCap='round';
  gctx.beginPath();gctx.moveTo(C-Math.cos(a)*22,C-Math.sin(a)*22);gctx.lineTo(C+Math.cos(a)*142,C+Math.sin(a)*142);gctx.stroke();
  gctx.fillStyle='#10191a';gctx.strokeStyle='#f0bb6e';gctx.lineWidth=3;gctx.beginPath();gctx.arc(C,C,15,0,7);gctx.fill();gctx.stroke();
  gctx.fillStyle='#eef4ec';gctx.font='700 58px Bricolage,"Arial Narrow",sans-serif';gctx.textAlign='center';gctx.textBaseline='alphabetic';
  gctx.fillText(String(Math.round(target)),C,312);
  // gear
  gctx.font='700 30px Bricolage,"Arial Narrow",sans-serif';gctx.fillStyle=gear==='R'?'#f0a89d':'#f0bb6e';
  gctx.fillText(gear==='R'?'R':'D'+gearNo,C,352);
  // headlight symbol
  const lc=['rgba(238,244,236,0.25)','#9fe0a8','#8ec5ff'][lights];
  gctx.fillStyle=lc;gctx.strokeStyle=lc;gctx.lineWidth=3;gctx.lineCap='round';
  gctx.beginPath();gctx.arc(128,342,11,-Math.PI/2,Math.PI/2);gctx.closePath();gctx.fill();
  [-8,0,8].forEach(dy=>{gctx.globalAlpha=lights?1:0.5;gctx.beginPath();gctx.moveTo(144,342+dy);gctx.lineTo(160,342+dy+(lights===1?4:0));gctx.stroke();gctx.globalAlpha=1});
  // brake lamp
  if(inp.brake||keys.brake){gctx.fillStyle='#e0705f';gctx.beginPath();gctx.arc(272,342,9,0,7);gctx.fill()}
}

/* ---------- interface ---------- */
const toastEl=$('toast');let toastT=0;
function showToast(a,b){toastEl.innerHTML=a+(b?'<small>'+b+'</small>':'');toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),3800)}
function seg(id,get,set){
  const root=$(id), btns=[].slice.call(root.querySelectorAll('button'));
  const paint=()=>btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v)===String(get())?'true':'false'));
  btns.forEach(b=>b.addEventListener('click',()=>{set(b.dataset.v);paint();save()}));
  paint();return paint;
}
function hold(el,on,off){
  let pid=null;
  el.addEventListener('pointerdown',e=>{
    if(pid!==null)return;pid=e.pointerId;try{el.setPointerCapture(pid)}catch(x){}
    el.classList.add('down');on();e.preventDefault();
  });
  const up=e=>{if(e.pointerId!==pid)return;pid=null;el.classList.remove('down');off()};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>el.addEventListener(n,up));
}
hold($('pGas'),()=>{inp.gas=true},()=>{inp.gas=false});
hold($('pBrake'),()=>{inp.brake=true},()=>{inp.brake=false});
hold($('sbL'),()=>{inp.btn=-1},()=>{if(inp.btn===-1)inp.btn=0});
hold($('sbR'),()=>{inp.btn=1},()=>{if(inp.btn===1)inp.btn=0});
hold($('bHorn'),()=>hornOn(),()=>hornOff());

/* steering wheel: drag around its centre */
const wz=$('steerWheel'), wheelSvg=$('wheelSvg');
let wPid=null, wLast=0, wAng=0;
const wAngle=e=>{const r=wz.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))};
wz.addEventListener('pointerdown',e=>{
  if(wPid!==null)return;wPid=e.pointerId;try{wz.setPointerCapture(wPid)}catch(x){}
  wLast=wAngle(e);wAng=inp.wheel*MAXROT;inp.wheelActive=true;e.preventDefault();
});
wz.addEventListener('pointermove',e=>{
  if(e.pointerId!==wPid)return;
  const a=wAngle(e);wAng=clamp(wAng+wrapA(a-wLast),-MAXROT,MAXROT);wLast=a;inp.wheel=wAng/MAXROT;
});
['pointerup','pointercancel','lostpointercapture'].forEach(n=>wz.addEventListener(n,e=>{
  if(e.pointerId!==wPid)return;wPid=null;inp.wheelActive=false;inp.wheel=0;wAng=0;
}));

/* gear, lights, camera */
const gearBtn=$('bGear');
gearBtn.addEventListener('click',()=>{
  if(Math.abs(v)>2){gearBtn.classList.add('warn');setTimeout(()=>gearBtn.classList.remove('warn'),600);showToast('Stop first','Come to a halt to change gear');return}
  gear=gear==='D'?'R':'D';$('gearTxt').textContent=gear;
});
$('bLight').addEventListener('click',()=>{lights=(lights+1)%3;applyLights();showToast(['Headlights off','Low beam','High beam'][lights])});
const pCam=seg('sCam',()=>cfg.cam,val=>{cfg.cam=+val;snapCam=true});
$('bCam').addEventListener('click',()=>{cfg.cam=(cfg.cam+1)%3;pCam();snapCam=true});
$('bHide').addEventListener('click',()=>document.body.classList.toggle('clean'));

/* settings */
const sheet=$('sheet'), garage=$('garage');
function openSheet(o){sheet.hidden=!o;if(o)openGarage(false)}
function openGarage(o){
  garage.hidden=!o;garageOpen=o;snapCam=false;
  document.body.classList.toggle('parked',o||!started);
  if(o){sheet.hidden=true;inp.gas=inp.brake=false;hornOff()}
}
$('bSet').addEventListener('click',()=>openSheet(sheet.hidden));
$('sClose').addEventListener('click',()=>openSheet(false));
$('bGarage').addEventListener('click',()=>openGarage(garage.hidden));
$('gClose').addEventListener('click',()=>openGarage(false));
const rVol=$('rVol');rVol.value=cfg.vol;$('oVol').textContent=cfg.vol+'%';
rVol.addEventListener('input',()=>{cfg.vol=+rVol.value;$('oVol').textContent=cfg.vol+'%';setVolume();save()});
seg('sTime',()=>cfg.time,val=>{cfg.time=val==='auto'?'auto':parseFloat(val)});
seg('sWx',()=>cfg.wx,val=>{cfg.wx=val;$('wx').textContent=WX[val].name});
function applySteerMode(){$('steerWheel').hidden=cfg.steer!=='wheel';$('steerBtns').hidden=cfg.steer!=='buttons'}
seg('sSteer',()=>cfg.steer,val=>{cfg.steer=val;applySteerMode()});
seg('sUnit',()=>cfg.unit,val=>{cfg.unit=val;buildDial()});
seg('sQ',()=>cfg.q,val=>{cfg.q=+val;setQuality()});
$('bBack').addEventListener('click',()=>{lat=0;rel=0;v=0;steerCur=0;snapCam=true;openSheet(false)});
$('bNew').addEventListener('click',()=>{
  SEED=(Math.random()*9000+100)|0;resetRoad();s=120;lat=1.8;rel=0;v=0;steerCur=0;trip=0;builtI0=-999;snapCam=true;lastDom=-1;hour=17.4;openSheet(false);
});
$('go').addEventListener('click',()=>{
  started=true;$('intro').classList.add('gone');document.body.classList.remove('parked');startAudio();snapCam=false;
  try{if(navigator.wakeLock)navigator.wakeLock.request('screen').catch(()=>{})}catch(e){}
  lastDom=-1;
});

/* garage cards and paint swatches */
VEHICLES.forEach((sp,i)=>{
  const b=document.createElement('button');b.className='vcard';b.type='button';
  b.innerHTML='<b>'+sp.name+'</b><span>'+sp.kind+'</span><em>Top '+Math.round(sp.vmax*3.6)+' km/h</em>';
  b.addEventListener('click',()=>{cfg.veh=i;applyVehicle();save()});
  $('vList').appendChild(b);
});
function paintSwatches(){
  const box=$('paints');box.innerHTML='';
  PAINTS.forEach((p,i)=>{
    const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',PAINT_NAMES[i]);
    b.style.background='#'+(i===0?spec().paint:p).toString(16).padStart(6,'0');
    b.setAttribute('aria-pressed',String(i===cfg.paint));
    b.addEventListener('click',()=>{cfg.paint=i;VEH.bodyMat.color.setHex(paintHex(i));paintSwatches();save()});
    box.appendChild(b);
  });
  $('paintName').textContent=PAINT_NAMES[cfg.paint];
}

/* keyboard (handy on a computer): W/S or arrows, A/D, space = brake, R = gear, L = lights, H = horn, C = camera, G = garage */
window.addEventListener('keydown',e=>{
  if(e.repeat&&e.key.toLowerCase()!=='h')return;
  const k=e.key.toLowerCase();
  if(k==='w'||k==='arrowup')keys.gas=true;
  else if(k==='s'||k==='arrowdown'||k===' ')keys.brake=true;
  else if(k==='a'||k==='arrowleft')keys.l=true;
  else if(k==='d'||k==='arrowright')keys.r=true;
  else if(k==='r')gearBtn.click();
  else if(k==='l')$('bLight').click();
  else if(k==='h')hornOn();
  else if(k==='c')$('bCam').click();
  else if(k==='g')$('bGarage').click();
  else return;
  e.preventDefault();
});
window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if(k==='w'||k==='arrowup')keys.gas=false;
  else if(k==='s'||k==='arrowdown'||k===' ')keys.brake=false;
  else if(k==='a'||k==='arrowleft')keys.l=false;
  else if(k==='d'||k==='arrowright')keys.r=false;
  else if(k==='h')hornOff();
});
window.addEventListener('blur',()=>{keys.gas=keys.brake=keys.l=keys.r=false;inp.gas=inp.brake=false;inp.btn=0;hornOff()});

/* ---------- main loop ---------- */
let last=performance.now(), hudT=0, gFrame=0, lastRot=999;
const pad2=n=>(n<10?'0':'')+n;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-last)/1000);last=now;t+=dt;
  if(started&&!garageOpen)stepDrive(dt);
  else{thr+=(0-thr)*Math.min(1,dt*7);accelNow=0;omegaNow=0}
  calcRpm(dt);
  if(cfg.time==='auto')hour=(hour+dt/30)%24;
  else{const diff=((cfg.time-hour+36)%24)-12;hour=(hour+diff*(1-Math.exp(-dt*2.2))+24)%24}
  const i0=Math.floor(s/SEG)-BACK;
  if(i0!==builtI0)rebuild(i0);
  curAmp=biomeAt(s).amp;
  poseCar(dt);
  applyEnv(dt,hour,carPos);
  sky.position.copy(camera.position);stars.position.copy(camera.position);
  updateClouds(t,camera.position);
  if(rain.visible)updateRain(t,camera.position);
  audioTick(Math.abs(v),thr,rpmS,Math.abs(lat)>4.9&&Math.abs(v)>1,spec().snd);
  const rot=Math.round(steerCur*110*4)/4;
  if(rot!==lastRot){lastRot=rot;wheelSvg.style.transform='rotate('+rot+'deg)'}
  if((gFrame++&1)===0)drawGauge();
  hudT-=dt;
  if(hudT<=0){
    hudT=0.2;
    $('trip').textContent=(trip/1000).toFixed(1);
    $('clock').textContent=pad2(Math.floor(hour))+':'+pad2(Math.floor((hour%1)*60));
    const dom=biomeAt(s).dom;
    if(dom!==lastDom){lastDom=dom;if(started)showToast(BIO[dom].name,BIO[dom].sub)}
    const dk=darkness();
    if(started&&dk>0.5&&lights===0&&!hinted){hinted=true;showToast('Getting dark','Tap the headlight button')}
    if(dk<0.2)hinted=false;
  }
  renderer.render(scene,camera);
}

/* ---------- start up ---------- */
$('wx').textContent=WX[cfg.wx].name;
applySteerMode();
setQuality();
applyVehicle();
document.body.classList.add('parked');
rebuild(Math.floor(s/SEG)-BACK);
camera.position.set(0,R.y[Math.floor(s/SEG)]+4,8);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(buildDial);
requestAnimationFrame(frame);
