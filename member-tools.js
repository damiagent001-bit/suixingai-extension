(() => {
  const properties=['font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration-line','color','background-color','background-image','background-size','background-repeat','background-position','clip-path','border-radius','border-width','border-style','border-color','box-shadow','padding-top','padding-bottom','padding-left','padding-right'];
  const palettes={}, textures={};
  const paletteNames={business:'商务蓝',warm:'暖色品牌',violet:'雅紫展示',aurora:'极光渐变',sunset:'落日余晖',ocean:'海岸蓝调',rose:'玫瑰雾光',lemon:'柠檬汽水',clay:'陶土手记',ink:'水墨留白',gold:'黑金展厅',mint:'薄荷网格',lavender:'薰衣草条纹',peach:'桃色波点',cobalt:'钴蓝印刷'};
  const schemeNames={clean:'简洁白卡',outline:'线框强调',dark:'深绿展示',soft:'柔和圆角',pill:'胶囊',leaf:'叶片弧角',arch:'拱门',ticket:'票券虚线',cut:'切角',offset:'硬边投影',glass:'透光渐变',ribbon:'侧边丝带',dashed:'手账虚线',double:'复古双线',bubble:'气泡圆角',gradient:'极光渐变卡'};
  let memory={plan:'free',styles:[],components:[]};
  async function request(op,payload={}){
    if(globalThis.chrome?.runtime?.sendMessage){const result=await chrome.runtime.sendMessage({type:'html-studio-member',op,...payload});if(!result?.ok)throw new Error(result?.error||'无法连接扩展后台，请重新加载扩展。');return result.data;}
    // Isolated browser test harness only. Never use a site's localStorage.
    if(op==='read')return structuredClone(memory);
    if(op==='plan'){if(!globalThis.PageStudioMemberConfig?.preview)throw new Error('此版本不提供测试身份切换。');memory.plan=payload.plan;}
    if(op==='add'){if(memory.plan!=='member')throw new Error('请先切换为会员测试身份。');const list=memory[payload.kind];if(list.length>=30)throw new Error('最多保存 30 项，请先删除不再使用的项目。');list.push({...payload.item,id:crypto.randomUUID()});}
    if(op==='remove')memory[payload.kind]=memory[payload.kind].filter(x=>x.id!==payload.id);
    return structuredClone(memory);
  }
  function styleCommand(changes){const rows=changes.map(([el,values])=>{const before=el.getAttribute('style'),temp=el.cloneNode(false);for(const[k,v]of Object.entries(values))v===''?temp.style.removeProperty(k):temp.style.setProperty(k,v,'important');return{el,before,after:temp.getAttribute('style')};});const apply=key=>rows.forEach(r=>r[key]===null?r.el.removeAttribute('style'):r.el.setAttribute('style',r[key]));return{redo:()=>apply('after'),undo:()=>apply('before')};}
  function captureStyle(doc,el){const c=doc.defaultView.getComputedStyle(el);return Object.fromEntries(properties.map(p=>[p,c.getPropertyValue(p)]));}
  // Component presets only change geometry. Colors, borders, shadows, spacing
  // and descendants belong to the existing page and are never recolored here.
  const shapes={};
  Object.assign(schemeNames,{clean:'标准圆角',outline:'小圆角',dark:'圆角矩形',ticket:'交错圆角',offset:'反向切角',glass:'椭圆弧角',ribbon:'单侧圆角',dashed:'对角圆弧',double:'直角',gradient:'非对称弧角'});
  function presetCommand(el,name,spec){if(!spec)throw new Error('请选择组件形状。');if(el.tagName==='IMG')throw new Error('请选中标题、按钮或组件容器。');const change=styleCommand([[el,{'clip-path':'none',...spec}]]),before=el.getAttribute('data-page-studio-shape');return{redo(){change.redo();el.setAttribute('data-page-studio-shape',name);},undo(){change.undo();before===null?el.removeAttribute('data-page-studio-shape'):el.setAttribute('data-page-studio-shape',before);}};}
  function similar(doc,el,range){if(!el||el===doc.body)throw new Error('请先选择一个具体元素。');const root=range==='parent'?el.parentElement:doc.body;const classes=[...el.classList].filter(x=>!['active','selected','hover','focus','hidden','open'].includes(x)&&!x.startsWith('page-studio'));if(!classes.length)throw new Error('这个元素没有可匹配的样式类，请选择同组的卡片、标题或段落。');const nodes=[...root.querySelectorAll(el.tagName.toLowerCase())].filter(n=>n!==el&&!n.closest('[data-page-studio-ui]')&&classes.every(c=>n.classList.contains(c))&&n.getClientRects().length);if(nodes.length>100)throw new Error('匹配超过 100 个，请缩小到同一父级。');return nodes;}
  function cleanComponent(doc,source){
    if(['BODY','HTML','SCRIPT','STYLE','IFRAME'].includes(source.tagName))throw new Error('请收藏具体组件，不要收藏整个页面。');
    const node=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],copies=[node,...node.querySelectorAll('*')];
    if(copies.length>300)throw new Error('组件过大，请选中更小的区域（最多 300 个元素）。');
    // Keep visual appearance without carrying a host site's classes/scripts or IDs.
    originals.forEach((original,i)=>{const copy=copies[i];if(copy.namespaceURI!=='http://www.w3.org/1999/xhtml')return;const c=doc.defaultView.getComputedStyle(original);for(const p of [...properties,'display','gap','grid-template-columns','flex-direction','align-items','justify-content','margin-top','margin-bottom'])copy.style.setProperty(p,c.getPropertyValue(p));});
    node.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form,input,textarea,select,[data-page-studio-ui]').forEach(n=>n.remove());
    for(const el of [node,...node.querySelectorAll('*')]){
      for(const a of [...el.attributes])if(/^on/i.test(a.name)||a.name.startsWith('data-page-studio')||['id','class','srcdoc','contenteditable','autofocus'].includes(a.name))el.removeAttribute(a.name);
      for(const name of ['href','src','xlink:href','action','formaction'])if(el.hasAttribute(name)){
        const value=el.getAttribute(name).trim();if(/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)&&name==='src')continue;
        try{const url=new URL(value,doc.baseURI);if(['http:','https:','file:','mailto:','tel:'].includes(url.protocol)&&!value.startsWith('#'))el.setAttribute(name,url.href);else el.removeAttribute(name);}catch{el.removeAttribute(name);}
      }
      el.removeAttribute('srcset');if(el.tagName==='BUTTON')el.setAttribute('type','button');
    }
    if(node.outerHTML.length>500000)throw new Error('组件内容超过 500 KB，请缩小图片后再收藏。');
    return node.outerHTML;
  }
  function restoreComponent(doc,html){const t=doc.createElement('template');t.innerHTML=html;const node=t.content.firstElementChild;if(!node)throw new Error('收藏组件无法读取。');return node;}
  globalThis.PageStudioMember={request,properties,palettes,paletteNames,textures,schemes:shapes,schemeNames,styleCommand,captureStyle,presetCommand,similar,cleanComponent,restoreComponent};
})();
