(() => {
  'use strict';
  const {Game,SHAPES,COLORS}=NeonTetris;
  const $=id=>document.getElementById(id);
  const game=new Game();
  const board=$('board'),ctx=board.getContext('2d'),effects=$('effects'),fx=effects.getContext('2d');
  const CELL=30,W=300,H=600;
  let mode='marathon',soundOn=true,audio=null,last=0,particles=[],flashes=[],toastTimer;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let record=0,sprintRecord=0;
  try{record=Number(localStorage.getItem('mortood-neon-record'))||0;sprintRecord=Number(localStorage.getItem('mortood-neon-sprint'))||0;}catch{}
  const keys=new Map();
  const formatScore=n=>String(n).padStart(6,'0');
  const formatTime=ms=>`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
  function initAudio(){if(!soundOn)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
  function tone(freq,duration=.08,type='sine',volume=.035,delay=0){
    if(!soundOn||!audio)return;
    try{const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,at);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.001,at+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+duration);}catch{}
  }
  function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);for(const canvas of [board,effects]){canvas.width=W*dpr;canvas.height=H*dpr;canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}render();}
  function block(context,x,y,size,type,alpha=1,ghost=false){
    const color=COLORS[type];context.save();context.globalAlpha=alpha;
    const px=x*size+1.5,py=y*size+1.5,s=size-3;
    if(ghost){context.strokeStyle=color;context.lineWidth=1;context.fillStyle=color+'0c';context.fillRect(px,py,s,s);context.strokeRect(px+.5,py+.5,s-1,s-1);context.restore();return;}
    context.fillStyle=color;context.shadowColor=color;context.shadowBlur=alpha===1?5:0;context.fillRect(px,py,s,s);context.shadowBlur=0;
    context.fillStyle='#ffffff40';context.fillRect(px+1,py+1,s-2,2);context.fillRect(px+1,py+1,2,s-2);
    context.fillStyle='#00000019';context.fillRect(px+2,py+s-3,s-4,2);context.fillRect(px+s-3,py+2,2,s-4);
    context.strokeStyle='#ffffff22';context.lineWidth=.7;context.strokeRect(px+5,py+5,s-10,s-10);context.restore();
  }
  function drawPiece(p,y,ghost=false){if(!p)return;p.matrix.forEach((row,r)=>row.forEach((cell,c)=>{if(cell&&y+r>=0)block(ctx,p.x+c,y+r,CELL,p.type,ghost?.65:1,ghost);}));}
  function idleBoard(){
    const sample=['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','....T.....','...TTT....','..........','........LL','JJ....SS.L','.J.OOSS..L','.J.OOZIIII','SSZZ.ZTTT.'];
    sample.forEach((row,y)=>[...row].forEach((t,x)=>{if(t!=='.')block(ctx,x,y,CELL,t,.45);}));
  }
  function render(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#171c15';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#313b253d';ctx.lineWidth=.6;ctx.beginPath();
    for(let x=0;x<=10;x++){ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,H);}for(let y=0;y<=20;y++){ctx.moveTo(0,y*CELL);ctx.lineTo(W,y*CELL);}ctx.stroke();
    if(game.state==='ready')idleBoard();else{
      game.board.forEach((row,y)=>row.forEach((type,x)=>{if(type)block(ctx,x,y,CELL,type);}));
      if(game.current&&!['over','won'].includes(game.state)){drawPiece(game.current,game.ghostY(),true);drawPiece(game.current,game.current.y);}
    }
  }
  function preview(id,type){
    const canvas=$(id),c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
    if(!type){c.strokeStyle='#3b4631';c.lineWidth=1.5;c.setLineDash([4,4]);c.strokeRect(99,39,42,42);c.setLineDash([]);return;}
    const matrix=SHAPES[type],points=[];matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)points.push([x,y]);}));
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),width=Math.max(...xs)-minX+1,height=Math.max(...ys)-minY+1,size=31;
    c.save();c.translate((canvas.width-width*size)/2,(canvas.height-height*size)/2);points.forEach(([x,y])=>block(c,x-minX,y-minY,size,type));c.restore();
  }
  function updateRecord(){
    $('record-label').textContent=mode==='sprint'?'40 行最佳用时':'个人最高分';
    $('record').textContent=mode==='sprint'?(sprintRecord?formatTime(sprintRecord):'--:--'):formatScore(record);
  }
  function stats(){
    $('score').textContent=formatScore(game.score);$('level').textContent=String(game.level).padStart(2,'0');$('lines').textContent=String(game.lines).padStart(2,'0');$('time').textContent=formatTime(game.elapsed);
    const progress=mode==='sprint'?Math.min(game.lines,40):game.lines%10,total=mode==='sprint'?40:10;
    $('progress-label').textContent=mode==='sprint'?'目标消行':'下一等级';$('progress-value').textContent=`${progress} / ${total}`;$('progress-fill').style.width=`${progress/total*100}%`;
    $('game-status').textContent={ready:'READY TO PLAY',playing:'IN THE FLOW',paused:'TAKE A BREATH',over:'ONE MORE TRY?',won:'MISSION COMPLETE'}[game.state];
    $('pause').disabled=!['playing','paused'].includes(game.state);$('pause').textContent=game.state==='paused'?'▶ 继续':'Ⅱ 暂停';$('pause').setAttribute('aria-label',game.state==='paused'?'继续游戏':'暂停游戏');
    $('hold-note').textContent=game.holdUsed?'本轮已暂存，落下后可再用。':'先留一手，再出好牌。';
    for(let i=0;i<3;i++)preview(`next-${i}`,game.queue[i]);preview('hold',game.held);updateRecord();
  }
  function overlay(title,copy,label,kicker,footnote){$('overlay').hidden=false;$('overlay-title').innerHTML=title;$('overlay-copy').textContent=copy;$('start-label').textContent=label;$('overlay-kicker').textContent=kicker;$('overlay-footnote').textContent=footnote;}
  function start(){initAudio();keys.clear();particles=[];flashes=[];game.start(mode);$('overlay').hidden=true;handleEvents();stats();render();tone(330,.12);tone(660,.12,'sine',.03,.1);}
  function showToast(title,subtitle=''){
    clearTimeout(toastTimer);$('toast').replaceChildren(document.createTextNode(title));
    if(subtitle){const small=document.createElement('small');small.textContent=subtitle;$('toast').append(small);}
    $('toast').classList.remove('show');void $('toast').offsetWidth;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),900);
  }
  function saveRecord(won=false){
    if(mode==='marathon'&&game.score>record){record=game.score;try{localStorage.setItem('mortood-neon-record',String(record));}catch{}}
    if(won&&mode==='sprint'&&(!sprintRecord||game.elapsed<sprintRecord)){sprintRecord=game.elapsed;try{localStorage.setItem('mortood-neon-sprint',String(sprintRecord));}catch{}}
    updateRecord();
  }
  function punch(){if(reduced)return;$('board-shell').classList.remove('punch');void $('board-shell').offsetWidth;$('board-shell').classList.add('punch');}
  function handleEvents(){
    for(const e of game.consumeEvents()){
      if(e.type==='rotate')tone(370,.04,'triangle',.02);
      if(e.type==='hold')tone(260,.08,'sine',.03);
      if(e.type==='drop'){tone(100,.13,'triangle',.07);punch();}
      if(e.type==='lock')tone(135,.055,'triangle',.025);
      if(e.type==='clear'){
        const names=['','SINGLE','DOUBLE','TRIPLE','TETRIS!'];showToast(names[e.count],`+${e.points.toLocaleString()}${e.combo>0?` · ${e.combo+1} 连击`:''}`);
        $('combo').textContent=e.combo>0?`${e.combo+1} × COMBO`:'NICE STACK!';
        [523,659,784,1046].slice(0,e.count).forEach((f,i)=>tone(f,.18,'sine',.045,i*.065));
        e.rows.forEach(row=>{
          flashes.push({row,life:.25});
          if(!reduced)for(let i=0;i<35;i++)particles.push({x:Math.random()*W,y:row*CELL+15,vx:(Math.random()-.5)*200,vy:(Math.random()-.7)*220,life:.5+Math.random()*.4,color:Math.random()>.5?'#d5ff6a':'#b6a0fa',size:2+Math.random()*4});
        });saveRecord();
      }
      if(e.type==='level')showToast(`LEVEL ${String(e.level).padStart(2,'0')}`,'节奏再快一点。');
      if(e.type==='pause'){keys.clear();overlay('TAKE A<br><span>BREATH.</span>','歇一下，好状态马上回来。','继续游戏','PAUSED','按 P 或点击继续');}
      if(e.type==='resume')$('overlay').hidden=true;
      if(e.type==='over'){keys.clear();saveRecord();overlay('ONE MORE<br><span>TRY?</span>',`得分 ${game.score.toLocaleString()} · 消除 ${game.lines} 行`,'再来一局','GOOD GAME','每一次落下，都是新的开始。');[250,200,150].forEach((f,i)=>tone(f,.2,'triangle',.035,i*.12));}
      if(e.type==='won'){keys.clear();saveRecord(true);overlay('YOU<br><span>DID IT!</span>',`40 行挑战完成 · 用时 ${formatTime(game.elapsed)}`,'再挑战一次','MISSION COMPLETE','速度与灵感，都属于你。');[523,659,784,1046].forEach((f,i)=>tone(f,.3,'sine',.04,i*.1));}
    }
  }
  function action(name){
    if(game.state!=='playing')return;
    if(name==='left')game.move(-1);if(name==='right')game.move(1);if(name==='down')game.move(0,1,true);
    if(name==='rotate')game.rotate(1);if(name==='counter')game.rotate(-1);if(name==='hard')game.hardDrop();if(name==='hold')game.hold();
    handleEvents();stats();render();
  }
  const keyActions={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'counter',Space:'hard',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold'};
  function keyboardTarget(e){return e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,[contenteditable="true"]');}
  document.addEventListener('keydown',e=>{
    if(e.code==='KeyP'||e.code==='Escape'){if(e.repeat)return;e.preventDefault();game.pause();handleEvents();stats();return;}
    if(e.code==='Enter'&&!keyboardTarget(e)&&['ready','over','won'].includes(game.state)){e.preventDefault();start();return;}
    const name=keyActions[e.code];if(!name||keyboardTarget(e))return;e.preventDefault();if(e.repeat||keys.has(e.code))return;
    action(name);if(['left','right','down'].includes(name)&&game.state==='playing')keys.set(e.code,{name,remaining:name==='down'?40:160});
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();if(game.state==='playing'){game.pause();handleEvents();stats();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.state==='playing'){keys.clear();game.pause();handleEvents();stats();}});
  $('start').addEventListener('click',e=>{if(game.state==='paused'){initAudio();game.pause();handleEvents();stats();}else start();e.currentTarget.blur();});
  $('pause').addEventListener('click',e=>{game.pause();handleEvents();stats();e.currentTarget.blur();});
  $('restart').addEventListener('click',e=>{start();e.currentTarget.blur();});
  $('sound').addEventListener('click',e=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'关闭音效':'开启音效');$('sound').querySelector('span').textContent=soundOn?'音效 ON':'音效 OFF';if(soundOn){initAudio();tone(600,.08);}e.currentTarget.blur();});
  document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
    if(mode===button.dataset.mode)return;
    saveRecord();mode=button.dataset.mode;keys.clear();game.reset(mode);particles=[];flashes=[];
    document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
    overlay('LET’S<br><span>STACK.</span>',mode==='sprint'?'用最快速度，消除 40 行。':'熟悉的方块，全新的心跳。','开始游戏','YOUR NEXT OBSESSION','方向键移动 · 空格落下');handleEvents();stats();render();button.blur();
  }));
  document.querySelectorAll('[data-action]').forEach(button=>{
    const id=`touch-${button.dataset.action}`;
    button.addEventListener('click',e=>{if(e.detail===0){initAudio();action(button.dataset.action);}});
    button.addEventListener('pointerdown',e=>{e.preventDefault();initAudio();button.setPointerCapture(e.pointerId);action(button.dataset.action);if(['left','right','down'].includes(button.dataset.action)&&game.state==='playing')keys.set(id,{name:button.dataset.action,remaining:button.dataset.action==='down'?40:160});});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(id));
  });
  function drawEffects(dt){
    fx.clearRect(0,0,W,H);
    flashes=flashes.filter(f=>{f.life-=dt;fx.fillStyle=`rgba(213,255,106,${Math.max(0,f.life/.25)*.65})`;fx.fillRect(0,f.row*CELL,W,CELL);return f.life>0;});
    particles=particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;fx.globalAlpha=Math.min(1,Math.max(0,p.life)*2);fx.fillStyle=p.color;fx.fillRect(p.x,p.y,p.size,p.size);return p.life>0;});fx.globalAlpha=1;
  }
  let statsAccumulator=0;
  function frame(now){
    const dt=last?Math.min(80,now-last):0;last=now;
    if(game.state==='playing')for(const item of keys.values()){item.remaining-=dt;while(item.remaining<=0&&game.state==='playing'){action(item.name);item.remaining+=item.name==='down'?35:50;}}
    game.tick(dt);handleEvents();render();drawEffects(dt/1000);statsAccumulator+=dt;
    if(statsAccumulator>120){stats();statsAccumulator=0;}
    requestAnimationFrame(frame);
  }
  resize();stats();window.addEventListener('resize',resize);requestAnimationFrame(frame);
})();
