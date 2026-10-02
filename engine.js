(function (root) {
  'use strict';
  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]], T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]]
  };
  const COLORS = {I:'#83e9df',O:'#d5ff6a',T:'#b6a0fa',S:'#a9d973',Z:'#fa91b1',J:'#86b7fb',L:'#f5bd76'};
  const clone = m => m.map(r => r.slice());
  class Game {
    constructor(random = Math.random) { this.random=random; this.reset(); }
    reset(mode='marathon') {
      this.board=Array.from({length:20},()=>Array(10).fill(null));
      this.queue=[]; this.bag=[]; this.current=null; this.held=null; this.holdUsed=false;
      this.score=0; this.lines=0; this.level=1; this.combo=-1; this.backToBack=false;
      this.elapsed=0; this.fall=0; this.lockTime=0; this.lockResets=0;
      this.mode=mode; this.state='ready'; this.events=[]; this.fillQueue();
    }
    emit(type,data={}) { this.events.push({type,...data}); }
    consumeEvents() { return this.events.splice(0); }
    fillQueue() {
      while(this.queue.length<5) {
        if(!this.bag.length) {
          this.bag=Object.keys(SHAPES);
          for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
        }
        this.queue.push(this.bag.pop());
      }
    }
    start(mode=this.mode) { this.reset(mode); this.state='playing'; this.spawn(); this.emit('start'); }
    spawn(type) {
      if(!type){type=this.queue.shift();this.fillQueue();}
      const matrix=clone(SHAPES[type]);
      this.current={type,matrix,x:Math.floor((10-matrix.length)/2),y:type==='I'?-1:0};
      this.fall=0;this.lockTime=0;this.lockResets=0;
      if(this.collides()){this.state='over';this.emit('over');}
    }
    collides(matrix=this.current?.matrix,x=this.current?.x,y=this.current?.y) {
      if(!matrix)return true;
      for(let r=0;r<matrix.length;r++)for(let c=0;c<matrix[r].length;c++)if(matrix[r][c]){
        const bx=x+c,by=y+r;
        if(bx<0||bx>=10||by>=20||(by>=0&&this.board[by][bx]))return true;
      }
      return false;
    }
    grounded() { return this.current&&this.collides(this.current.matrix,this.current.x,this.current.y+1); }
    resetLock(wasGrounded) { if(wasGrounded&&this.lockResets<15){this.lockTime=0;this.lockResets++;} }
    move(dx,dy=0,soft=false) {
      if(this.state!=='playing'||!this.current)return false;
      const p=this.current,was=this.grounded();
      if(this.collides(p.matrix,p.x+dx,p.y+dy))return false;
      p.x+=dx;p.y+=dy;
      if(soft&&dy>0)this.score+=dy;
      if(dx)this.resetLock(was);
      if(dy>0)this.lockTime=0;
      return true;
    }
    rotate(direction=1) {
      if(this.state!=='playing'||!this.current||this.current.type==='O')return false;
      const p=this.current,n=p.matrix.length;
      const rotated=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>direction>0?p.matrix[n-1-c][r]:p.matrix[c][n-1-r]));
      const was=this.grounded();
      for(const [dx,dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]]){
        if(!this.collides(rotated,p.x+dx,p.y+dy)){p.matrix=rotated;p.x+=dx;p.y+=dy;this.resetLock(was);this.emit('rotate');return true;}
      }
      return false;
    }
    ghostY() {
      if(!this.current)return 0;
      let y=this.current.y;
      while(!this.collides(this.current.matrix,this.current.x,y+1))y++;
      return y;
    }
    hardDrop() {
      if(this.state!=='playing'||!this.current)return;
      const y=this.ghostY();this.score+=(y-this.current.y)*2;this.current.y=y;
      this.emit('drop',{x:this.current.x,y,type:this.current.type});this.lock();
    }
    hold() {
      if(this.state!=='playing'||this.holdUsed||!this.current)return false;
      const type=this.current.type;
      if(this.held){const swap=this.held;this.held=type;this.spawn(swap);}else{this.held=type;this.spawn();}
      this.holdUsed=true;this.emit('hold');return true;
    }
    lock() {
      const p=this.current;
      if(!p||this.state!=='playing')return;
      let above=false;
      for(let r=0;r<p.matrix.length;r++)for(let c=0;c<p.matrix[r].length;c++)if(p.matrix[r][c]){
        const y=p.y+r;if(y<0)above=true;else this.board[y][p.x+c]=p.type;
      }
      if(above){this.state='over';this.emit('over');return;}
      const rows=[];
      this.board.forEach((row,i)=>{if(row.every(Boolean))rows.push(i);});
      if(rows.length){
        const oldLevel=this.level;
        this.combo++;
        let points=[0,100,300,500,800][rows.length]*oldLevel;
        if(rows.length===4&&this.backToBack)points=Math.floor(points*1.5);
        points+=Math.max(0,this.combo)*50*oldLevel;
        this.backToBack=rows.length===4;
        this.score+=points;this.lines+=rows.length;this.level=Math.floor(this.lines/10)+1;
        this.board=this.board.filter((_,i)=>!rows.includes(i));
        while(this.board.length<20)this.board.unshift(Array(10).fill(null));
        this.emit('clear',{rows,points,combo:this.combo,count:rows.length});
        if(this.level>oldLevel)this.emit('level',{level:this.level});
        if(this.mode==='sprint'&&this.lines>=40){this.state='won';this.emit('won');return;}
      }else this.combo=-1;
      this.holdUsed=false;this.emit('lock');this.spawn();
    }
    pause() {
      if(this.state==='playing'){this.state='paused';this.emit('pause');}
      else if(this.state==='paused'){this.state='playing';this.emit('resume');}
    }
    tick(dt) {
      if(this.state!=='playing')return;
      this.elapsed+=dt;this.fall+=dt;
      const interval=Math.max(65,850*Math.pow(.79,this.level-1));
      while(this.fall>=interval&&this.state==='playing'){this.fall-=interval;this.move(0,1);}
      if(this.grounded()){this.lockTime+=dt;if(this.lockTime>=500)this.lock();}
      else this.lockTime=0;
    }
  }
  const api={Game,SHAPES,COLORS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.NeonTetris=api;
})(globalThis);
