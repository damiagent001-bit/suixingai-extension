(() => {
  if(globalThis.PageStudio)return;
  const {fonts,template,components}=globalThis.PageStudioUI;
  const {toData,serialize,extractPalette}=globalThis.PageStudioExport;
  const member=globalThis.PageStudioMember;
  const resource=path=>globalThis.chrome?.runtime?.getURL?chrome.runtime.getURL(path):new URL(path,location.href).href;
  const fetchOK=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`资源加载失败 ${r.status}`);return r;};
  const palettes={paper:['#faf6ed','#352e25','#95572f','#efe7d8'],forest:['#f1f4e9','#253b2d','#315f43','#e1e8d4'],night:['#172124','#edf1e6','#a8d6b2','#27363a']};
  const rgbHex=value=>{const m=value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);return m?'#'+m.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#000000';};

  function mount(doc,host){
    const shadow=host.shadowRoot||host.attachShadow({mode:'open'});shadow.innerHTML=template(resource('panel.css'));
    const $=s=>shadow.querySelector(s),$$=s=>[...shadow.querySelectorAll(s)];
    let selected=null,picking=true,disposed=false,busy=false,dirty=false,revision=0,reference=null,fontRequest=0,previousInsertion='after';
    const undo=[],redo=[],pending=new Set(),fontLoads=new Map();
    let memberState={plan:'free',styles:[],components:[]},multi=false,multiNodes=[],group=null,closed=false,operating=false;
    const ui=doc.createElement('div');ui.setAttribute('data-page-studio-ui','');ui.style.cssText='all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483646!important;';
    const box=doc.createElement('div');box.style.cssText='position:absolute;display:none;border:2px solid #4d9370;background:#63ad7810;pointer-events:none;box-sizing:border-box;';ui.append(box);doc.documentElement.append(ui);
    const say=s=>$('#status').textContent=s;
    const isMember=()=>memberState.plan==='member'&&(globalThis.PageStudioMemberConfig?.preview||memberState.validUntil>Date.now());
    function showMembership(feature){$('#member-reason').textContent=feature?`“${feature}”属于会员功能。已有内容不会被删除，基础编辑与保存仍可使用。`:'免费完成基础编辑，会员扩展图片、链接、样式和复用能力。';if(!$('#member-dialog').open)$('#member-dialog').showModal();}
    function requireMember(feature){if(isMember())return true;showMembership(feature);say(`“${feature}”需要会员。当前编辑可以继续免费保存。`);return false;}
    const images=globalThis.PageStudioImages.mount({doc,ui,getSelected:()=>selected,getTargets:()=>targets(),runForTargets:work=>track(forTargets(work)),isPicking:()=>picking,canEdit:isMember,commit,styles,refresh,say});
    const colors=globalThis.PageStudioColors.mount({doc,shadow,targets:()=>{if(selected?.tagName==='IMG'&&!requireMember('图片编辑'))return [];return targets();},commit,refresh});
    const premiumFields={url:'跳转链接设置',image:'图片编辑','image-url':'图片编辑',alt:'图片编辑',reference:'参考图配色','image-width':'图片编辑','image-height':'图片编辑','image-lock':'图片编辑','image-align':'图片编辑','image-mode':'图片编辑','image-x':'图片编辑','image-y':'图片编辑'};
    for(const[id,label]of Object.entries(premiumFields)){
      const el=$('#'+id);el.dataset.premium=label;
      if(['url','image','reference'].includes(id)){const badge=doc.createElement('span');badge.className='member-tag';badge.textContent='会员';el.parentElement.insertBefore(badge,el);}
    }
    $('#component option[value=image]').textContent='图片 · 会员';
    for(const[id,label]of Object.entries(member.paletteNames)){const opt=doc.createElement('option');opt.value=id;opt.textContent=label+' · 会员';$('#theme').insertBefore(opt,$('#theme option[value=reference]'));}
    $('#theme option[value=reference]').textContent='参考图配色 · 会员';
    function updateAccess(){
      $('#plan-name').textContent=isMember()?'月度会员':'免费版';$('#plan-note').textContent=memberState.notice||(isMember()?`有效期至 ${new Date(memberState.expires_at*1000).toLocaleDateString()}`:memberState.username?`${memberState.username} · 基础编辑与保存不限次数`:'无需登录即可基础编辑与保存');
      $('#preview-note').hidden=!globalThis.PageStudioMemberConfig?.preview;$('#test-member').hidden=!globalThis.PageStudioMemberConfig?.preview;
      $('[data-action=test-toggle]').textContent=isMember()?'切换为免费版测试':'切换为会员测试';
      for(const el of $$('[data-premium]')){el.classList.toggle('premium-locked',!isMember());el.title=isMember()?'':el.dataset.premium+' · 会员功能';}
      for(const id of ['url','image-url','alt','image-width','image-height','image-x','image-y'])$('#'+id).readOnly=!isMember();
      if(selected?.tagName==='IMG'&&!isMember())$$('[data-css],#font').forEach(el=>el.disabled=true);
      if(!isMember()){images.cancel();if(multi){colors.cancel();multi=false;multiNodes=[];syncMode();}}
    }
    function library(){for(const kind of ['styles']){const list=$('#saved-'+kind);list.replaceChildren();const items=memberState[kind]||[];if(!items.length){const p=doc.createElement('div');p.className='library-empty';p.textContent='还没有收藏。';list.append(p);}for(const item of items){const row=doc.createElement('div');row.className='library-row';const label=doc.createElement('span');label.textContent=item.name;row.append(label);for(const[action,title]of [['use','应用'],['remove','删除']]){const b=doc.createElement('button');b.textContent=title;b.dataset.library=kind;b.dataset.item=item.id;b.dataset.operation=action;row.append(b);}list.append(row);}}}
    async function loadMember(){try{const state=await member.request('read');if(disposed)return;memberState=state;library();refresh();}catch(e){say('收藏读取失败：'+e.message);}}
    async function setTestPlan(plan){memberState=await member.request('plan',{plan});library();refresh();$('#member-dialog').close();say(plan==='member'?'已进入会员测试身份。此版本不代表正式付费授权。':'已切回免费版。已有页面内容与收藏保留，仍可免费保存。');}
    const valid=el=>el&&el.nodeType===1&&!['HTML','HEAD','SCRIPT','STYLE','LINK','META','BASE','TITLE','NOSCRIPT'].includes(el.tagName)&&!el.closest('[data-page-studio-ui]');
    const linkFor=el=>el?.closest('a');
    const scopeRoot=()=>multi?selected:$('#scope').value==='page'?doc.body:selected;
    const themeStyle=root=>{const id=root?.getAttribute('data-page-studio-scope');return id?doc.querySelector(`style[data-page-studio-theme="${CSS.escape(id)}"]`):null;};
    function syncTheme(){const style=themeStyle(scopeRoot());$('#theme').value=style?.dataset.themeName||'none';if(style?.dataset.themeName==='reference')$('#theme option[value=reference]').disabled=false;}
    const extraBoxes=[];
    function targets(){return multi?multiNodes.filter(n=>n.isConnected):selected?.isConnected?[selected]:[];}
    function outline(){
      images.update();extraBoxes.splice(0).forEach(n=>n.remove());
      if(closed||!picking){box.style.display='none';return;}
      const nodes=targets();box.style.display='none';
      nodes.forEach((el,i)=>{const r=el.getBoundingClientRect(),b=i===0?box:box.cloneNode();if(i){ui.append(b);extraBoxes.push(b);}Object.assign(b.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});});
    }
    function refresh(){
      if(selected&&!selected.isConnected)selected=multiNodes.at(-1)||null;
      $('.panel').dataset.empty=String(!selected);$$('.needs-selection input,.needs-selection select,.needs-selection textarea,.needs-selection button').forEach(el=>el.disabled=!selected);
      $('[data-action=undo]').disabled=!undo.length;$('[data-action=redo]').disabled=!redo.length;$('[data-action=parent]').disabled=!selected||selected===doc.body;
      syncTheme();syncMode();$('#component-style').value=selected?.dataset.pageStudioShape||'';styleExample();
      if(!selected){$('#selected').textContent='点击页面，开始编辑';updateAccess();outline();return;}
      const c=doc.defaultView.getComputedStyle(selected),r=selected.getBoundingClientRect();
      $('#selected').textContent=(multi?'已选 '+targets().length+' 个 · ':'')+selected.tagName.toLowerCase()+(selected.id?'#'+selected.id:'')+(selected.classList.length?'.'+[...selected.classList].slice(0,2).join('.'):'');
      $('#dimensions').textContent=`${Math.round(r.width)} × ${Math.round(r.height)} px · ${selected.children.length} 个子元素`;
      const plain=globalThis.PageStudioText.editable(selected);
      $('#text').disabled=!plain;$('#text').value=plain?globalThis.PageStudioText.read(selected):'';$('#text-hint').textContent=plain?(multi?'文字修改将同步替换所有选中元素的内容。':'可修改整段文字，未改动部分的加粗和链接会保留。'):'请选择具体段落或标题，避免覆盖图片、表格等组件。';
      for(const input of $$('[data-css]')){
        const prop=input.dataset.css;let value=c.getPropertyValue(prop);
        if(input.hasAttribute('data-color')){const hex=rgbHex(value);input.style.setProperty('--color',hex);input.querySelector('span').textContent=hex.toUpperCase();continue;}
        if(input.type==='number'){
          let n=parseFloat(value);if(prop==='line-height')n=value==='normal'?1.2:n/(parseFloat(c.fontSize)||16);
          if(['letter-spacing','gap'].includes(prop)&&!Number.isFinite(n))n=0;if(prop==='opacity')n*=100;
          value=Number.isFinite(n)?Math.round(n*100)/100:'';
        }else if(input.type==='color')value=rgbHex(value);
        else{const inline=selected.style.getPropertyValue(prop);if([...input.options].some(o=>o.value===inline))value=inline||value;if(prop==='text-align'&&value==='start')value='left';if(![...input.options].some(o=>o.value===value))value='';}
        input.value=value;
      }
      $('#font').value=Object.keys(fonts).find(id=>c.fontFamily.includes(id))||'';
      const link=linkFor(selected);$('#url').value=link?.getAttribute('href')||'';
      $('[data-action=open-link]').disabled=!link?.getAttribute('href');
      $('#link-hint').textContent=link?.getAttribute('href')?'链接已设置。点“打开链接”或双击原文测试；浏览模式下单击跳转。':'编辑时单击选中，双击打开链接；浏览模式下单击跳转。';
      const isImage=selected.tagName==='IMG';$('#image-url-field').hidden=!isImage;$('#alt-field').hidden=!isImage;
      $('#image-options').hidden=!isImage;
      if(isImage){$('#image-width').value=Math.round(r.width);$('#image-height').value=Math.round(r.height);$('#image-lock').checked=selected.dataset.pageStudioRatio!=='free';$('#image-mode').value=selected.dataset.pageStudioImageMode||'flow';const p=images.pos(selected);$('#image-x').value=Math.round(p[0]);$('#image-y').value=Math.round(p[1]);$('#image-align').value=selected.style.marginLeft==='auto'?(selected.style.marginRight==='auto'?'center':'right'):'left';}
      $('#image-url').value=isImage?selected.getAttribute('src')||'':'';$('#alt').value=isImage?selected.getAttribute('alt')||'':'';$('#image-label').textContent=isImage?'替换图片':'插入图片';
      $('[data-action=up]').disabled=selected===doc.body||!selected.previousElementSibling;$('[data-action=down]').disabled=selected===doc.body||!selected.nextElementSibling;
      $('[data-action=delete]').disabled=selected===doc.body;$('[data-action=duplicate]').disabled=selected===doc.body;
      const position=$('#position');
      if(selected===doc.body){if(position.value!=='inside')previousInsertion=position.value;position.value='inside';position.dataset.body='true';}
      else if(position.dataset.body){position.value=previousInsertion;delete position.dataset.body;}
      updateAccess();outline();
    }
    function choose(el,internal=false){
      if(operating&&!internal)return say('正在应用修改，请稍候。');
      if(!valid(el))return;colors.cancel();
      if(multi){if(multiNodes.includes(el))multiNodes=multiNodes.filter(n=>n!==el);else{multiNodes=multiNodes.filter(n=>!n.contains(el)&&!el.contains(n));multiNodes.push(el);}selected=multiNodes.at(-1)||null;}
      else selected=el;
      refresh();
    }
    async function forTargets(work,enabled=true){
      if(operating)return say('正在应用修改，请稍候。');
      if(!multi||!enabled||targets().length<2){operating=true;try{return await work();}finally{operating=false;}}
      if(!requireMember('批量选中元素'))return;
      const nodes=targets(),prior=selected;group=[];operating=true;
      try{for(const node of nodes){if(!isMember())throw new Error('会员状态已变化，批量修改已取消。');selected=node;await work();}
        const commands=group;group=null;
        if(commands.length){undo.push({redo:()=>commands.forEach(c=>c.redo()),undo:()=>[...commands].reverse().forEach(c=>c.undo())});if(undo.length>100)undo.shift();redo.length=0;dirty=true;revision++;}
        say(`已同步修改 ${nodes.length} 个元素，可一次撤销。`);
      }catch(e){const commands=group||[];group=null;[...commands].reverse().forEach(c=>c.undo());throw e;}
      finally{operating=false;selected=prior?.isConnected?prior:multiNodes.find(n=>n.isConnected)||null;refresh();}
    }
    function edited(){dirty=true;revision++;refresh();say('已修改 · 点击“保存为 HTML”保留修改。');}
    function commit(action){action.redo();if(group){group.push(action);return;}undo.push(action);if(undo.length>100)undo.shift();redo.length=0;edited();}
    function attrs(el,updates){const previous=Object.fromEntries(Object.keys(updates).map(k=>[k,el.getAttribute(k)]));const apply=values=>{for(const[k,v]of Object.entries(values))v==null?el.removeAttribute(k):el.setAttribute(k,v);};commit({redo:()=>apply(updates),undo:()=>apply(previous)});}
    function styles(el,updates){if(el.tagName==='IMG'&&!requireMember('图片编辑'))return;const temp=el.cloneNode(false);for(const[k,v]of Object.entries(updates))v!==''?temp.style.setProperty(k,v,'important'):temp.style.removeProperty(k);attrs(el,{style:temp.getAttribute('style')});}
    function track(p){pending.add(p);p.finally(()=>pending.delete(p)).catch(()=>{});return p;}
    function ensureFont(id){
      if(fontLoads.has(id))return fontLoads.get(id);
      const promise=(async()=>{
        if(doc.querySelector(`style[data-page-studio-font="${id}"]`))return;
        const[font,license]=await Promise.all([fetchOK(resource(`fonts/${id}.ttf`)).then(async r=>new Blob([await r.arrayBuffer()],{type:'font/ttf'})).then(toData),fetchOK(resource(`fonts/${id}-OFL.txt`)).then(r=>r.text())]);
        if(disposed)return;const style=doc.createElement('style');style.dataset.pageStudioFont=id;
        style.textContent=`/* ${license.replace(/\*\//g,'* /')} */\n@font-face{font-family:'${id}';src:url('${font}') format('truetype');font-weight:${fonts[id][1]};font-display:swap;}`;doc.head.append(style);
        await doc.fonts.load(`16px '${id}'`,'中文');
      })();fontLoads.set(id,promise);promise.catch(()=>fontLoads.delete(id));return track(promise);
    }
    function insert(node,where){let parent,anchor;
      if(where==='inside'){if(/^(IMG|INPUT|HR|BR|IFRAME|VIDEO|AUDIO|CANVAS|TEXTAREA|SELECT)$/.test(selected.tagName))throw new Error('这个元素不能放入组件，请选择“元素之后”或父级。');parent=selected;anchor=null;}
      else{if(selected===doc.body)throw new Error('选中整页时，请选择“元素内部”。');parent=selected.parentNode;anchor=where==='before'?selected:selected.nextSibling;}
      const prior=selected;commit({redo:()=>{parent.insertBefore(node,anchor?.parentNode===parent?anchor:null);selected=node;},undo:()=>{node.remove();selected=prior;}});
    }
    function component(type){const t=doc.createElement('template');t.innerHTML=components[type];return t.content.firstElementChild;}
    async function applyTheme(name,paletteOverride,root=scopeRoot()){
      if((name==='reference'||member.paletteNames[name])&&!requireMember(name==='reference'?'参考图配色':'会员风格')){syncTheme();return;}
      if(!root)throw new Error('请先选中一个区域，或选择“整个页面”。');
      let palette=paletteOverride||palettes[name];
      if(member.paletteNames[name]){const data=await member.request('recipe',{kind:'theme',name});if(disposed||!root.isConnected||!isMember())return;palette=data.palette;member.textures[name]=data.texture;}if(name==='reference')palette=paletteOverride||reference?.palette||JSON.parse(themeStyle(root)?.dataset.palette||'null');
      if(name!=='none'&&!palette)throw new Error('请先上传参考图。');
      const id=root.getAttribute('data-page-studio-scope')||'s'+crypto.randomUUID().replaceAll('-','');root.setAttribute('data-page-studio-scope',id);
      commit(globalThis.PageStudioTheme.apply(doc,root,id,name,palette,themeStyle(root)));
    }
    function setLink(value){
      if(!requireMember('跳转链接设置'))return;
      const el=selected,link=linkFor(el);if(link)return attrs(link,{href:value||null});if(!value)return;
      if(el===doc.body||el.querySelector('a,button,input,select,textarea')||['BUTTON','INPUT','SELECT','TEXTAREA'].includes(el.tagName))throw new Error('请选中普通文字或图片添加链接；不要包裹已有交互控件。');
      const parent=el.parentNode,next=el.nextSibling,a=doc.createElement('a');a.href=value;a.dataset.pageStudioLink='';if(!value.startsWith('#')){a.target='_blank';a.rel='noopener noreferrer';}a.style.cssText='color:inherit;text-decoration:inherit;cursor:pointer';
      commit({redo:()=>{parent.insertBefore(a,el);a.append(el);},undo:()=>{parent.insertBefore(el,next?.parentNode===parent?next:null);a.remove();}});
    }
    function safeURL(value,image=false){if(!value)return value;if(/^(?:javascript|vbscript|data|blob):/i.test(value)&&!(image&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)))throw new Error('请填写网页地址、#章节或相对路径。');try{new URL(value,doc.baseURI);}catch{throw new Error('地址格式不正确。');}return value;}
    function openLink(link=linkFor(selected)){const value=link?.getAttribute('href');if(!value)return say('请先设置链接地址。');safeURL(value);if(value.startsWith('#')){const id=decodeURIComponent(value.slice(1));doc.getElementById(id)?.scrollIntoView({behavior:'smooth'});doc.defaultView.history.replaceState(null,'',value);say('已跳转到页面内对应章节。');}else{doc.defaultView.open(new URL(value,doc.baseURI).href,'_blank','noopener,noreferrer');say('已在新标签页打开链接，当前编辑保留。');}}
    async function getHTML(){colors.cancel();await Promise.all([...pending]);return serialize(doc,$('#scripts').checked);}
    async function download(){
      if(busy)return;busy=true;const button=$('[data-action=save]');button.disabled=true;say('正在生成 HTML…');
      try{const html=await getHTML(),url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'})),a=doc.createElement('a');a.href=url;a.download=(doc.title||'page').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/\.html?$/i,'')+'-edited.html';a.setAttribute('data-page-studio-ui','');host.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);say('已发起下载，请在下载列表确认。页面内导航会留在保存的文件中。');}
      catch(e){say('保存失败：'+e.message);}finally{busy=false;button.disabled=false;}
    }
    function syncMode(){$('.panel').dataset.multi=String(multi);$('[data-action=pick]').classList.toggle('active',picking&&!multi);$('[data-action=multi]').classList.toggle('active',multi);$('#multi-note').hidden=!multi;}
    function setMode(value){colors.cancel();picking=value;multi=false;multiNodes=[];syncMode();outline();say(value?'点击页面元素进行编辑。':'浏览模式：可测试页面交互；点击“选中元素”恢复编辑。');}
    function closeEditor(){colors.cancel();closed=true;picking=false;host.style.setProperty('display','none','important');outline();}
    function nameFor(id){const value=$(id).value.trim();if(!value)throw new Error('请先填写收藏名称。');return value;}
    async function loadStyleFonts(values){for(const id of Object.keys(fonts))if(values['font-family']?.includes(id))await ensureFont(id);}
    async function memberAction(name){
      if(!requireMember(name==='component-style'?'组件样式':'配色与排版收藏'))return;
      if(!selected)throw new Error('请先选择一个元素。');
      if(name==='component-style'){const el=selected,id=$('#component-style').value;const data=await member.request('recipe',{kind:'shape',name:id});if(disposed||!el.isConnected||!isMember())return;member.schemes[id]=data.values;return commit(member.presetCommand(el,id,data.values));}
      if(name==='save-style'){const item={name:nameFor('#style-name'),values:member.captureStyle(doc,selected)};memberState=await member.request('add',{kind:'styles',item});library();say('配色与排版方案已收藏，可跨页面应用。');}
    }
    async function libraryAction(button){const kind=button.dataset.library,item=memberState[kind]?.find(x=>x.id===button.dataset.item);if(!item)return;
      if(button.dataset.operation==='remove'){memberState=await member.request('remove',{kind,id:item.id});library();say('已删除收藏，页面内容不受影响。');return;}
      if(!requireMember(kind==='styles'?'配色与排版收藏':'组件收藏'))return;if(!selected)throw new Error('请先选中应用位置。');const el=selected;
      if(kind==='styles'){const values=Object.fromEntries(Object.entries(item.values).filter(([k,v])=>member.properties.includes(k)&&CSS.supports(k,v)));await loadStyleFonts(values);if(isMember()&&el.isConnected)commit(member.styleCommand([[el,values]]));}
      else{for(const id of Object.keys(fonts))if(item.html.includes(id))await ensureFont(id);if(isMember()&&el.isConnected){selected=el;insert(member.restoreComponent(doc,item.html),$('#position').value);}}
    }
    async function action(name){
      if(name==='account')return member.request('account');if(name==='membership')return showMembership();
      if(name==='test-toggle')return setTestPlan(isMember()?'free':'member');if(name==='test-member')return setTestPlan('member');
      if(['save-style','component-style'].includes(name))return memberAction(name);
      if(name==='close')return closeEditor();
      if(name==='multi'){if(!requireMember('批量选中元素'))return;colors.cancel();multi=!multi;picking=true;multiNodes=multi&&selected?[selected]:[];refresh();say(multi?'点击多个元素；再次点击取消选择。后续修改同步应用。':'已恢复单选。');return;}
      if(name==='pick')return setMode(true);if(name==='preview')return setMode(false);if(name==='save')return download();
      if(name==='collapse'){const compact=$('.panel').classList.toggle('compact');host.style.setProperty('height',compact?'auto':'calc(100vh - 24px)','important');return;}
      if(name==='dock'){const left=host.style.left==='12px';host.style.setProperty('left',left?'auto':'12px','important');host.style.setProperty('right',left?'12px':'auto','important');return;}
      if(name==='body')return choose(doc.body,true);
      if(name==='open-link')return openLink();
      if(name.startsWith('image-')&&!requireMember('图片编辑'))return;
      if(name==='image-indent')return images.indent(20);if(name==='image-outdent')return images.indent(-20);
      if(name==='undo'||name==='redo'){const from=name==='undo'?undo:redo,to=name==='undo'?redo:undo,a=from.pop();if(a){a[name]();to.push(a);edited();}return;}
      if(!selected)return say('请先点击页面选中一个元素。');
      if(name==='parent')return choose(selected.parentElement,true);
      if(selected.tagName==='IMG'&&['delete','duplicate','up','down'].includes(name)&&!requireMember('图片编辑'))return;
      if(name==='delete'){if(selected===doc.body)return;const el=selected,parent=el.parentNode,next=el.nextSibling;return commit({redo:()=>{el.remove();selected=parent;},undo:()=>{parent.insertBefore(el,next?.parentNode===parent?next:null);selected=el;}});}
      if(name==='add'){if($('#component').value==='image'&&!requireMember('图片编辑'))return;return insert(component($('#component').value),$('#position').value);}
      if(name==='duplicate'){const node=selected.cloneNode(true);[node,...node.querySelectorAll('[id],[data-page-studio-scope],[data-page-studio-node]')].forEach(el=>{el.removeAttribute('id');el.removeAttribute('data-page-studio-scope');el.removeAttribute('data-page-studio-node');});return insert(node,'after');}
      if(name==='up'||name==='down'){const el=selected,parent=el.parentNode,oldNext=el.nextSibling,sibling=name==='up'?el.previousElementSibling:el.nextElementSibling;if(el===doc.body||!sibling||!valid(sibling))return;const anchor=name==='up'?sibling:sibling.nextSibling;commit({redo:()=>parent.insertBefore(el,anchor),undo:()=>parent.insertBefore(el,oldNext)});}
    }
    function styleExample(){const el=$('#style-example');el.removeAttribute('style');Object.assign(el.style,{});for(const[k,v]of Object.entries(member.schemes[$('#component-style').value]||{}))el.style.setProperty(k,v);}
    styleExample();
    shadow.addEventListener('click',e=>{
      const premium=e.target.closest('[data-premium]');if(premium&&!isMember()){e.preventDefault();requireMember(premium.dataset.premium);return;}
      const color=e.target.closest('[data-color]');if(color){colors.open(color);return;}
      const saved=e.target.closest('button[data-library]');if(saved){track(forTargets(()=>libraryAction(saved),saved.dataset.operation==='use')).catch(err=>say(err.message));return;}
      const button=e.target.closest('button[data-action]');if(button){const name=button.dataset.action;track(forTargets(()=>action(name),['component-style','add','duplicate','delete','up','down','image-indent','image-outdent'].includes(name))).catch(err=>say(err.message));}
    });
    shadow.addEventListener('change',e=>{
      if(!e.target.closest('.panel'))return;
      const input=e.target,inputValue=input.value,inputFiles=[...(input.files||[])];
      const run=async()=>{
        if(input.type!=='file')input.value=inputValue;
        if(input.id==='font'&&fonts[input.value]?.[2]&&!requireMember('会员字体')){refresh();return;}
        if(input.dataset.premium&&!requireMember(input.dataset.premium)){input.value='';refresh();return;}
        if(input.id==='component-style'){if(input.value)return memberAction('component-style');return;}
        if(input.id==='theme'){return applyTheme(input.value);}
        if(input.id==='scope'){syncTheme();return;}
        if(input.id==='reference'){
          const file=inputFiles[0];if(!file)return;const target=scopeRoot();if(!target)throw new Error('请先选中一个区域，或选择“整个页面”。');say('正在提取参考图配色…');reference=await extractPalette(file,doc);
          if(disposed||!target.isConnected||!isMember())return;$('#reference-preview').src=reference.data;$('#reference-preview').hidden=false;$('#theme option[value=reference]').disabled=false;await applyTheme('reference',reference.palette,target);$('#reference-note').textContent='已应用参考图配色。保存 HTML 后保留背景、正文、强调色与卡片配色。';input.value='';return;
        }
        if(!selected)return;const el=selected;
        if(input.dataset.css){
          const prop=input.dataset.css;let value=input.value;
          if(input.type==='number'&&value!==''){
            if(input.validity.rangeOverflow||input.validity.rangeUnderflow||input.validity.badInput)throw new Error('数值超出范围，请调整后重试。');
            if(prop==='line-height')value=String(Number(value));else if(prop==='opacity')value=String(Number(value)/100);else value+='px';
          }
          if(value&&!CSS.supports(prop,value))throw new Error('这个数值无法应用，请调整后重试。');
          const updates={[prop]:value};if(prop==='border-width'&&Number(input.value)>0&&doc.defaultView.getComputedStyle(el).borderTopStyle==='none')updates['border-style']='solid';if(prop==='grid-template-columns'&&value)updates.display='grid';styles(el,updates);
        }
        if(input.id==='text'&&!input.disabled){if(!globalThis.PageStudioText.editable(el))throw new Error('部分选中元素包含图片或复杂布局，不能整体替换文字。');const change=globalThis.PageStudioText.command(el,input.value);if(change)commit(change);}
        if(input.id==='image-width')images.size('width',input.value);if(input.id==='image-height')images.size('height',input.value);
        if(input.id==='image-lock')attrs(el,{'data-page-studio-ratio':input.checked?'locked':'free'});
        if(input.id==='image-align')images.align(input.value);if(input.id==='image-mode')attrs(el,{'data-page-studio-image-mode':input.value});
        if(input.id==='image-x')images.offset('x',input.value);if(input.id==='image-y')images.offset('y',input.value);
        if(input.id==='font'){const id=input.value,request=++fontRequest;if(id){say('正在加载离线字体…');await ensureFont(id);}if(request===fontRequest&&el.isConnected&&(!fonts[id]?.[2]||isMember()))styles(el,{'font-family':id?`'${id}', sans-serif`:''});}
        if(input.id==='url')setLink(safeURL(input.value.trim()));
        if(input.id==='image-url')attrs(el,{src:safeURL(input.value.trim(),true),srcset:null});
        if(input.id==='alt')attrs(el,{alt:input.value});
        if(input.id==='image'&&inputFiles[0]){
          const file=inputFiles[0];if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error('请上传 PNG、JPEG、WebP 或 GIF。');if(file.size>20*1024*1024)throw new Error('图片请小于 20 MB。');
          const position=$('#position').value,src=await toData(file);if(!el.isConnected||!isMember())return;
          if(el.tagName==='IMG')attrs(el,{src,srcset:null});else{selected=el;const image=component('image');image.src=src;image.alt=file.name;insert(image,position);}input.value='';
        }
      };track(forTargets(run,!['scope','style-name','scripts'].includes(input.id))).catch(err=>{say(err.message);if(input.id==='theme')syncTheme();});
    });
    function click(e){if(e.composedPath().includes(host)||e.target.closest?.('[data-page-studio-ui]'))return;if(images.skipClick()){e.preventDefault();e.stopImmediatePropagation();return;}if(!picking)return;e.preventDefault();e.stopImmediatePropagation();choose(e.target);if(linkFor(e.target)?.getAttribute('href'))say('已选中链接。双击原文或点侧栏“打开链接”即可测试跳转。');}
    function doubleClick(e){if(multi||!picking||e.composedPath().includes(host)||e.target.closest?.('[data-page-studio-ui]'))return;const link=linkFor(e.target);if(link?.getAttribute('href')){e.preventDefault();e.stopImmediatePropagation();try{openLink(link);}catch(err){say(err.message);}}}
    function key(e){if(closed||colors.active)return;if(e.composedPath().includes(host)||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.stopImmediatePropagation();action(e.shiftKey?'redo':'undo');}if(e.key==='Escape'){e.stopImmediatePropagation();setMode(!picking);}}
    const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};
    doc.addEventListener('click',click,true);doc.addEventListener('dblclick',doubleClick,true);doc.addEventListener('submit',click,true);doc.defaultView.addEventListener('keydown',key,true);doc.defaultView.addEventListener('scroll',outline,true);doc.defaultView.addEventListener('resize',outline);doc.defaultView.addEventListener('beforeunload',beforeUnload);
    const storageChanged=(changes,area)=>{if(area==='local'&&changes.htmlStudioMemberV1)loadMember();};globalThis.chrome?.storage?.onChanged?.addListener(storageChanged);
    const memberTimer=setInterval(()=>{if(!disposed&&!closed)loadMember();},30000);doc.defaultView.addEventListener('focus',loadMember);refresh();const ready=loadMember();
    return{getHTML,ready,get dirty(){return dirty;},get revision(){return revision;},reveal(){closed=false;host.style.setProperty('display','block','important');picking=true;syncMode();outline();host.hidden=false;$('.panel').classList.remove('compact');host.style.setProperty('height','calc(100vh - 24px)','important');},dispose(){clearInterval(memberTimer);doc.defaultView.removeEventListener('focus',loadMember);colors.dispose();disposed=true;globalThis.chrome?.storage?.onChanged?.removeListener(storageChanged);images.dispose();doc.removeEventListener('click',click,true);doc.removeEventListener('dblclick',doubleClick,true);doc.removeEventListener('submit',click,true);doc.defaultView.removeEventListener('keydown',key,true);doc.defaultView.removeEventListener('scroll',outline,true);doc.defaultView.removeEventListener('resize',outline);doc.defaultView.removeEventListener('beforeunload',beforeUnload);ui.remove();shadow.replaceChildren();}};
  }
  globalThis.PageStudio={mount};
})();
