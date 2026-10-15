(() => {
  function mount({doc,ui,getSelected,getTargets=()=>[getSelected()],runForTargets=work=>work(),isPicking,canEdit=()=>true,commit,styles,refresh,say}){
    const host=doc.createElement('div');host.dataset.pageStudioUi='';host.style.cssText='all:initial;position:fixed;inset:0;pointer-events:none;';ui.append(host);
    const s=host.attachShadow({mode:'open'});
    s.innerHTML=`<style>:host{all:initial}*{box-sizing:border-box}.frame{position:fixed;pointer-events:none;border:2px solid #438368;display:none}.handle{position:absolute;width:12px;height:12px;background:white;border:2px solid #438368;border-radius:2px;pointer-events:auto;touch-action:none;padding:0;cursor:nwse-resize}.nw{left:-7px;top:-7px}.ne{right:-7px;top:-7px;cursor:nesw-resize}.sw{left:-7px;bottom:-7px;cursor:nesw-resize}.se{right:-7px;bottom:-7px}.e{right:-7px;top:calc(50% - 6px);cursor:ew-resize}.w{left:-7px;top:calc(50% - 6px);cursor:ew-resize}.n{top:-7px;left:calc(50% - 6px);cursor:ns-resize}.so{bottom:-7px;left:calc(50% - 6px);cursor:ns-resize}.bar{position:fixed;display:none;gap:3px;align-items:center;background:white;border:1px solid #cad8c8;padding:4px;border-radius:7px;box-shadow:0 3px 14px #152d2426;pointer-events:auto;font:12px/1.4 system-ui,sans-serif;white-space:nowrap}.bar button{font:inherit;border:0;border-radius:4px;color:#244b39;background:#f0f4eb;padding:5px 8px;cursor:pointer;height:28px}.bar button:hover{background:#dce8d0}.bar button[data-move]{cursor:grab;touch-action:none}.marker{position:fixed;height:3px;background:#438368;pointer-events:none;display:none}.marker:before{content:'放到这里';position:absolute;top:-19px;background:#438368;color:white;padding:2px 6px;font:10px system-ui;border-radius:3px}.size{position:absolute;bottom:7px;right:7px;padding:3px 6px;background:#204b3a;color:white;font:11px system-ui;border-radius:4px}</style><div class="frame">${['nw','ne','sw','se','e','w','n','so'].map(dir=>`<button class="handle ${dir}" data-resize="${dir}" title="拖动调整图片大小" aria-label="缩放图片 ${dir}"></button>`).join('')}<span class="size"></span></div><div class="bar"><button data-align="left" title="左对齐">左</button><button data-align="center" title="居中">中</button><button data-align="right" title="右对齐">右</button><button data-indent="-20" title="减少缩进">←</button><button data-indent="20" title="增加缩进">→</button><button data-move title="拖动改变图片位置">⠿ 移动</button></div><div class="marker"></div>`;
    const frame=s.querySelector('.frame'),bar=s.querySelector('.bar'),marker=s.querySelector('.marker');
    let drag=null,skipClick=false;
    const image=()=>canEdit()&&getSelected()?.tagName==='IMG'?getSelected():null;
    const pos=el=>{const parts=doc.defaultView.getComputedStyle(el).translate.split(/\s+/);return[parseFloat(parts[0])||0,parseFloat(parts[1])||0];};
    const locked=el=>el.dataset.pageStudioRatio!=='free';
    const styleSet=(el,k,v)=>el.style.setProperty(k,v,'important');
    function update(){const el=image();if(!el||!el.isConnected||!isPicking()){frame.style.display=bar.style.display='none';return;}
      const r=el.getBoundingClientRect();Object.assign(frame.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
      s.querySelector('.size').textContent=`${Math.round(r.width)} × ${Math.round(r.height)}`;
      Object.assign(bar.style,{display:drag?'none':'flex',left:Math.max(8,Math.min(r.left,doc.defaultView.innerWidth-265))+'px',top:Math.max(6,r.top-44)+'px'});
    }
    function size(axis,value){const el=image();if(!el)return;const r=el.getBoundingClientRect(),ratio=r.width/(r.height||1),n=Number(value);if(!Number.isFinite(n)||n<16||n>10000)throw new Error('图片尺寸请填写 16–10000 之间的数字。');const updates={[axis]:n+'px','max-width':'none','max-height':'none','min-width':'0','min-height':'0','box-sizing':'border-box'};if(locked(el))updates[axis==='width'?'height':'width']=(axis==='width'?n/ratio:n*ratio)+'px';styles(el,updates);}
    function align(value){const el=image();if(!el)return;styles(el,{display:'block',position:'relative',inset:'auto',float:'none',translate:'0px 0px','margin-left':value==='left'?'0':'auto','margin-right':value==='right'?'0':'auto','justify-self':value==='left'?'start':value==='right'?'end':'center','align-self':value==='left'?'start':value==='right'?'end':'center'});}
    function indent(amount){const el=image();if(!el)return;const left=parseFloat(doc.defaultView.getComputedStyle(el).marginLeft)||0;styles(el,{display:'block','margin-left':Math.max(0,left+amount)+'px','margin-right':'0',translate:'0px 0px'});}
    function offset(axis,value){const el=image();if(!el)return;const p=pos(el);p[axis==='x'?0:1]=Number(value)||0;styles(el,{translate:p[0]+'px '+p[1]+'px'});}
    function start(e,type,dir){const el=image();if(!el||!isPicking()||e.button!==0)return;e.preventDefault();e.stopPropagation();const r=el.getBoundingClientRect();drag={el,type,dir,x:e.clientX,y:e.clientY,r,ratio:r.width/(r.height||1),before:el.getAttribute('style'),translate:pos(el),moved:false,target:null};
      drag.items=getTargets().filter(n=>n?.tagName==='IMG').map(n=>({el:n,before:n.getAttribute('style'),r:n.getBoundingClientRect(),translate:pos(n)}));
      doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',end,true);doc.addEventListener('pointercancel',cancel,true);doc.addEventListener('keydown',escape,true);
    }
    function movable(el){const picture=el.closest('picture');if(picture)return picture;const link=el.closest('a');return link&&link.querySelectorAll('img').length===1&&link.children.length===1?link:el;}
    function move(e){if(!drag)return;if(!canEdit()){finish(true);return;}e.preventDefault();const d=drag,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)<4&&!d.moved)return;d.moved=true;
      if(d.type==='resize'){
        const west=d.dir.includes('w'),north=d.dir==='n'||d.dir.startsWith('n'),horizontal=/[ew]/.test(d.dir);let w=d.r.width+(west?-dx:dx),h=d.r.height+(north?-dy:dy);
        if(!horizontal)w=d.r.width;if(!/[ns]/.test(d.dir))h=d.r.height;
        if(locked(d.el)){if(horizontal)h=w/d.ratio;else w=h*d.ratio;}
        w=Math.max(16,Math.min(10000,w));h=locked(d.el)?w/d.ratio:Math.max(16,Math.min(10000,h));
        for(const[k,v]of Object.entries({width:w+'px',height:h+'px','max-width':'none','max-height':'none','min-width':'0','min-height':'0','box-sizing':'border-box',translate:(d.translate[0]+(west?d.r.width-w:0))+'px '+(d.translate[1]+(north?d.r.height-h:0))+'px'}))styleSet(d.el,k,v);
      }else if(d.el.dataset.pageStudioImageMode==='free')styleSet(d.el,'translate',(d.translate[0]+dx)+'px '+(d.translate[1]+dy)+'px');
      else{
        if(e.clientY<50)doc.defaultView.scrollBy(0,-18);else if(e.clientY>doc.defaultView.innerHeight-50)doc.defaultView.scrollBy(0,18);
        const hit=doc.elementFromPoint(e.clientX,e.clientY),unit=movable(d.el),target=hit?.closest('p,h1,h2,h3,h4,ul,ol,table,figure,img,section,article,div');
        if(target&&target!==unit&&!unit.contains(target)&&!target.contains(unit)&&!target.closest('[data-page-studio-ui]')&&!target.closest('svg')){const r=target.getBoundingClientRect(),before=e.clientY<r.top+r.height/2;d.target={node:target,before};Object.assign(marker.style,{display:'block',left:r.left+'px',width:r.width+'px',top:(before?r.top:r.bottom)+'px'});}else{d.target=null;marker.style.display='none';}
      }
      if(d.type==='resize'||d.el.dataset.pageStudioImageMode==='free'){
        const r=d.el.getBoundingClientRect(),p=pos(d.el);
        for(const item of d.items)if(item.el!==d.el){
          if(d.type==='resize')for(const[k,value]of Object.entries({width:item.r.width*r.width/d.r.width+'px',height:item.r.height*r.height/d.r.height+'px','max-width':'none','max-height':'none','min-width':'0','min-height':'0','box-sizing':'border-box'}))styleSet(item.el,k,value);
          styleSet(item.el,'translate',(item.translate[0]+p[0]-d.translate[0])+'px '+(item.translate[1]+p[1]-d.translate[1])+'px');
        }
      }update();
    }
    function finish(cancelled){const d=drag;if(!d)return;doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',end,true);doc.removeEventListener('pointercancel',cancel,true);doc.removeEventListener('keydown',escape,true);drag=null;marker.style.display='none';skipClick=d.moved;setTimeout(()=>skipClick=false,150);
      const restore=(item,value)=>value===null?item.el.removeAttribute('style'):item.el.setAttribute('style',value);
      if(cancelled){d.items.forEach(item=>restore(item,item.before));update();return;}
      if(d.moved&&(d.type==='resize'||d.el.dataset.pageStudioImageMode==='free')){d.items.forEach(item=>item.after=item.el.getAttribute('style'));commit({redo:()=>d.items.forEach(item=>restore(item,item.after)),undo:()=>d.items.forEach(item=>restore(item,item.before))});}
      else if(d.moved&&d.target){const units=[...new Set(d.items.map(item=>movable(item.el)))],target=d.target.node;
        if(units.some(unit=>unit===target||unit.contains(target)))return update();
        const originals=units.map(unit=>({unit,parent:unit.parentNode,next:unit.nextSibling})),destination=target.parentNode,anchor=d.target.before?target:target.nextSibling;
        commit({redo:()=>units.forEach(unit=>destination.insertBefore(unit,anchor?.parentNode===destination?anchor:null)),undo:()=>[...originals].reverse().forEach(({unit,parent,next})=>parent.insertBefore(unit,next?.parentNode===parent?next:null))});}
      else if(d.moved)say('请把图片拖到其他段落或组件旁，出现绿色落点线后松开。');update();
    }
    const end=()=>finish(!canEdit()),cancel=()=>finish(true),escape=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();finish(true);}};
    s.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-resize]');if(handle)start(e,'resize',handle.dataset.resize);else if(e.target.closest('[data-move]'))start(e,'move');});
    s.addEventListener('click',e=>{Promise.resolve(runForTargets(()=>{if(e.target.dataset.align)align(e.target.dataset.align);if(e.target.dataset.indent)indent(Number(e.target.dataset.indent));})).catch(err=>say(err.message));});
    function pointer(e){if(e.target===image()&&!e.composedPath().includes(host))start(e,'move');}
    function nativeDrag(e){if(e.target===image())e.preventDefault();}
    doc.addEventListener('pointerdown',pointer,true);doc.addEventListener('dragstart',nativeDrag,true);doc.defaultView.addEventListener('scroll',update,true);doc.defaultView.addEventListener('resize',update);
    return{update,size,align,indent,offset,pos,cancel,skipClick:()=>skipClick,dispose(){finish(true);doc.removeEventListener('pointerdown',pointer,true);doc.removeEventListener('dragstart',nativeDrag,true);doc.defaultView.removeEventListener('scroll',update,true);doc.defaultView.removeEventListener('resize',update);host.remove();}};
  }
  globalThis.PageStudioImages={mount};
})();
