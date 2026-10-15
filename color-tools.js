(() => {
  // One transactional picker for every CSS color. Preview never enters history.
  function mount({doc,shadow,targets,commit,refresh}) {
    const dialog=doc.createElement('dialog');dialog.className='color-dialog';dialog.setAttribute('aria-label','颜色预览');
    dialog.innerHTML=`<div class="dialog-title"><strong id="color-title">颜色</strong><button type="button" data-color-cancel aria-label="取消颜色预览">×</button></div><div class="color-sv" tabindex="0" role="slider" aria-label="饱和度与明度"><i></i></div><label>色相<input id="color-hue" type="range" min="0" max="360" step="1"></label><div class="color-swatches"></div><label>色号<input id="color-hex" maxlength="7" spellcheck="false" aria-label="颜色 HEX"></label><p class="hint">拖动或指向色块即预览，应用后保留。</p><div class="row"><button type="button" data-color-cancel>取消</button><button type="button" class="save" data-color-apply>应用</button></div>`;
    shadow.append(dialog);const $=s=>dialog.querySelector(s);let session=null,h=0,s=1,v=1;
    const rgb=()=>{const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+a.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');};
    function fromHex(hex){const a=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255),max=Math.max(...a),min=Math.min(...a),d=max-min;v=max;s=max?d/max:0;h=!d?0:max===a[0]?60*((a[1]-a[2])/d%6):max===a[1]?60*((a[2]-a[0])/d+2):60*((a[0]-a[1])/d+4);if(h<0)h+=360;}
    function paint(){ $('.color-sv').style.backgroundColor=`hsl(${h} 100% 50%)`;$('.color-sv i').style.cssText=`left:${s*100}%;top:${(1-v)*100}%`;$('#color-hue').value=h;$('#color-hex').value=rgb();$('.color-sv').setAttribute('aria-valuetext',rgb());}
    function preview(hex){if(!session)return;session.command?.undo();
      const prop=session.prop,background=prop==='background-color';
      const keys=prop==='border-color'?['border-top-color','border-right-color','border-bottom-color','border-left-color']:[prop];
      const rows=session.nodes.map(el=>{const copy=doc.createElement('div');copy.style.cssText=el.style.cssText;for(const p of [...copy.style])if(!p.startsWith('background'))copy.style.removeProperty(p);return{el,bg:copy.style.cssText,props:keys.map(k=>[k,el.style.getPropertyValue(k),el.style.getPropertyPriority(k)])};});
      session.command={redo:()=>rows.forEach(({el})=>{el.style.setProperty(prop,hex,'important');if(background)el.style.setProperty('background-image','none','important');}),undo:()=>rows.forEach(({el,bg,props})=>{if(background){el.style.removeProperty('background');el.style.cssText+=';'+bg;}else for(const[k,value,priority]of props)value?el.style.setProperty(k,value,priority):el.style.removeProperty(k);})};
      session.command.redo();session.trigger.style.setProperty('--color',hex);session.trigger.querySelector('span').textContent=hex.toUpperCase();}
    function cancel(){if(!session)return;session.command?.undo();const trigger=session.trigger;session=null;dialog.close();refresh();trigger.focus();}
    function apply(){if(!session)return;const {command,trigger}=session;command?.undo();session=null;dialog.close();if(command)commit(command);else refresh();trigger.focus();}
    function open(trigger){cancel();const nodes=targets();if(!nodes.length)return;session={trigger,nodes,prop:trigger.dataset.css,command:null};const raw=doc.defaultView.getComputedStyle(nodes.at(-1)).getPropertyValue(session.prop).match(/[\d.]+/g);const hex=raw?'#'+raw.slice(0,3).map(n=>Math.round(Number(n)).toString(16).padStart(2,'0')).join(''):'#000000';fromHex(hex);paint();$('#color-title').textContent=trigger.getAttribute('aria-label');dialog.showModal();const r=trigger.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(r.right-300,doc.defaultView.innerWidth-308))+'px';dialog.style.top=Math.max(8,Math.min(r.bottom+6,doc.defaultView.innerHeight-dialog.offsetHeight-8))+'px';}
    $('.color-sv').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);point(e);});
    function point(e){const r=$('.color-sv').getBoundingClientRect();s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));paint();preview(rgb());}
    $('.color-sv').addEventListener('pointermove',e=>{if(e.buttons)point(e);});
    $('.color-sv').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();s=Math.max(0,Math.min(1,s+(e.key==='ArrowRight'?.01:e.key==='ArrowLeft'?-.01:0)));v=Math.max(0,Math.min(1,v+(e.key==='ArrowUp'?.01:e.key==='ArrowDown'?-.01:0)));paint();preview(rgb());});
    $('#color-hue').addEventListener('input',e=>{h=Number(e.target.value);paint();preview(rgb());});
    $('#color-hex').addEventListener('input',e=>{if(/^#[a-f\d]{6}$/i.test(e.target.value)){fromHex(e.target.value);paint();preview(rgb());e.target.setCustomValidity('');}else e.target.setCustomValidity('请输入 # 加六位色号');});
    for(const hex of ['#ffffff','#172124','#315f43','#a8d6b2','#275fa5','#6c4e9b','#de6b8d','#ed9b40','#8b342e','#d9ccb1']){const b=doc.createElement('button');b.type='button';b.style.background=hex;b.setAttribute('aria-label',hex);const choose=()=>{fromHex(hex);paint();preview(hex);};b.addEventListener('pointermove',choose);b.addEventListener('focus',choose);b.addEventListener('click',choose);$('.color-swatches').append(b);}
    dialog.querySelectorAll('[data-color-cancel]').forEach(b=>b.onclick=cancel);$('[data-color-apply]').onclick=()=>{if($('#color-hex').reportValidity())apply();};dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
    return {open,cancel,get active(){return !!session;},dispose(){cancel();dialog.remove();}};
  }
  globalThis.PageStudioColors={mount};
})();
