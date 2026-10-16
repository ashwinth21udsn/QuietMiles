'use strict';
/* ============================================================
   audio.js  -  everything is synthesised, no sound files:
   a slow chord pad, wind, rain, birds, tyre noise, a gear-aware engine and a horn
   ============================================================ */
let AC=null,master=null,reverb=null,nWind,nRain,nGrav,nRoad,eng,horn=null,padV=[],nextChord=0,chordI=0,nextBird=0;
const CHORDS=[[196,246.9,293.7,370],[164.8,220,261.6,329.6],[174.6,220,261.6,329.6],[146.8,196,246.9,293.7],[220,261.6,329.6,392],[196,261.6,329.6,392]];
function impulse(sec){
  const n=Math.floor(AC.sampleRate*sec),b=AC.createBuffer(2,n,AC.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6)}
  return b;
}
function noiseSrc(kind){
  const n=AC.sampleRate*4,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);
  let last=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;if(kind==='brown'){last=(last+0.02*w)/1.02;d[i]=last*3.2}else d[i]=w}
  const s=AC.createBufferSource();s.buffer=b;s.loop=true;s.start();return s;
}
function chain(src,type,freq,q){
  const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;
  const g=AC.createGain();g.gain.value=0;src.connect(f);f.connect(g);g.connect(master);return {f,g};
}
function startAudio(){
  if(AC){if(AC.state==='suspended')AC.resume();return}
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
  try{
    AC=new Ctx();
    master=AC.createGain();master.gain.value=cfg.vol/100*0.9;master.connect(AC.destination);
    reverb=AC.createConvolver();reverb.buffer=impulse(3.4);
    const wet=AC.createGain();wet.gain.value=0.55;reverb.connect(wet);wet.connect(master);
    nWind=chain(noiseSrc('brown'),'lowpass',380,0.7);
    nRoad=chain(noiseSrc('brown'),'lowpass',900,0.5);
    nRain=chain(noiseSrc('white'),'highpass',3200,0.5);
    nGrav=chain(noiseSrc('white'),'bandpass',1400,0.8);
    // engine: two oscillators through a low-pass filter whose cutoff follows the revs
    const eg=AC.createGain();eg.gain.value=0;
    const ef=AC.createBiquadFilter();ef.type='lowpass';ef.frequency.value=300;ef.Q.value=2;
    const o1=AC.createOscillator();o1.type='sawtooth';o1.frequency.value=48;
    const o2=AC.createOscillator();o2.type='square';o2.frequency.value=24;
    const g2=AC.createGain();g2.gain.value=0.5;
    o1.connect(ef);o2.connect(g2);g2.connect(ef);ef.connect(eg);eg.connect(master);o1.start();o2.start();
    eng={g:eg,f:ef,o1,o2};
    const ch=CHORDS[0];
    for(let v=0;v<4;v++){
      const vg=AC.createGain();vg.gain.value=0.0;
      const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1100;
      const pan=AC.createStereoPanner?AC.createStereoPanner():null;if(pan)pan.pan.value=(v-1.5)*0.4;
      const oa=AC.createOscillator(),ob=AC.createOscillator();
      oa.type='triangle';ob.type='sine';oa.frequency.value=ch[v];ob.frequency.value=ch[v]*2.002;
      const og=AC.createGain();og.gain.value=0.35;oa.connect(vg);ob.connect(og);og.connect(vg);vg.connect(lp);
      if(pan){lp.connect(pan);pan.connect(master);pan.connect(reverb)}else{lp.connect(master);lp.connect(reverb)}
      const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=0.05+v*0.021;lg.gain.value=0.012;lfo.connect(lg);lg.connect(vg.gain);lfo.start();
      vg.gain.setTargetAtTime(0.03,AC.currentTime,4);
      oa.start();ob.start();padV.push({oa,ob});
    }
    nextChord=AC.currentTime+15;nextBird=AC.currentTime+4;
  }catch(e){AC=null}
}
function chirp(){
  const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain(),pan=AC.createStereoPanner?AC.createStereoPanner():null;
  o.type='sine';const base=2400+Math.random()*2200,n=2+(Math.random()*3|0);
  let tt=t;
  g.gain.setValueAtTime(0,t);
  for(let k=0;k<n;k++){
    const f=base*(0.9+Math.random()*0.3);
    o.frequency.setValueAtTime(f,tt);o.frequency.exponentialRampToValueAtTime(f*(Math.random()<0.5?1.35:0.75),tt+0.07);
    g.gain.setValueAtTime(0.0001,tt);g.gain.exponentialRampToValueAtTime(0.05,tt+0.015);g.gain.exponentialRampToValueAtTime(0.0001,tt+0.09);
    tt+=0.12;
  }
  o.connect(g);
  if(pan){pan.pan.value=Math.random()*1.6-0.8;g.connect(pan);pan.connect(master);pan.connect(reverb)}else{g.connect(master);g.connect(reverb)}
  o.start(t);o.stop(tt+0.1);
}
/* engine state: rpm 0..1 comes from the game (it simulates a 5-speed automatic) */
function audioTick(speed,thr,rpm,offroad,snd){
  if(!AC||AC.state!=='running')return;
  const t=AC.currentTime,sp=speed/36;
  nWind.g.gain.setTargetAtTime(0.05+sp*0.5,t,0.4);nWind.f.frequency.setTargetAtTime(260+sp*700,t,0.4);
  nRoad.g.gain.setTargetAtTime(Math.min(0.2,sp*0.22),t,0.3);
  nRain.g.gain.setTargetAtTime(0.07*W.rain,t,0.8);
  nGrav.g.gain.setTargetAtTime(offroad?0.02*Math.min(1,sp*2+0.2):0,t,0.25);
  const f=(40+rpm*95)*snd;
  eng.o1.frequency.setTargetAtTime(f,t,0.08);eng.o2.frequency.setTargetAtTime(f*0.5,t,0.08);
  eng.f.frequency.setTargetAtTime(160+rpm*620+thr*380,t,0.1);
  eng.g.gain.setTargetAtTime(0.014+thr*0.026+rpm*0.01,t,0.1);
  if(t>nextChord){
    chordI=(chordI+1)%CHORDS.length;const ch=CHORDS[chordI];
    padV.forEach((v,k)=>{v.oa.frequency.setTargetAtTime(ch[k],t,2.6);v.ob.frequency.setTargetAtTime(ch[k]*2.002,t,2.6)});
    nextChord=t+13+Math.random()*6;
  }
  if(t>nextBird){
    if(daylight>0.45&&W.rain<0.3&&speed<30)chirp();
    nextBird=t+3+Math.random()*7;
  }
}
function setVolume(){if(AC)master.gain.setTargetAtTime(cfg.vol/100*0.9,AC.currentTime,0.1)}
function hornOn(){
  if(!AC||horn)return;
  const t=AC.currentTime,g=AC.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.09,t+0.03);
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1800;
  const a=AC.createOscillator(),b=AC.createOscillator();a.type='sawtooth';b.type='sawtooth';a.frequency.value=392;b.frequency.value=494;
  a.connect(f);b.connect(f);f.connect(g);g.connect(master);g.connect(reverb);a.start(t);b.start(t);
  horn={a,b,g};
}
function hornOff(){
  if(!horn)return;
  const t=AC.currentTime,h=horn;horn=null;
  h.g.gain.cancelScheduledValues(t);h.g.gain.setValueAtTime(h.g.gain.value,t);h.g.gain.linearRampToValueAtTime(0,t+0.08);
  h.a.stop(t+0.1);h.b.stop(t+0.1);
}
document.addEventListener('visibilitychange',()=>{
  if(!AC)return;
  if(document.hidden)AC.suspend();else if(typeof started!=='undefined'&&started)AC.resume();
});
