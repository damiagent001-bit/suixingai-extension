(() => {
  const parse=hex=>hex.match(/[a-f0-9]{2}/gi).slice(0,3).map(s=>parseInt(s,16));
  const mix=(a,b,t)=>'#'+parse(a).map((v,i)=>Math.round(v*(1-t)+parse(b)[i]*t).toString(16).padStart(2,'0')).join('');
  const lum=hex=>parse(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  function readable(accent,bg){let result=accent;const target=contrast('#172124',bg)>=contrast('#ffffff',bg)?'#172124':'#ffffff';for(let i=0;i<12&&contrast(result,bg)<4.5;i++)result=mix(result,target,.18);return result;}
  const visible=rgba=>rgba!=='transparent'&&!/rgba\([^)]*,\s*0\s*\)/.test(rgba);
  function apply(doc,root,id,name,palette,previous){
    const all=[root,...root.querySelectorAll('*')].filter(el=>!el.closest('[data-page-studio-ui]')&&!['SCRIPT','STYLE','LINK','META','BR','IMG','VIDEO','CANVAS','IFRAME','SOURCE'].includes(el.tagName)&&!el.closest('svg'));
    const states=new Map(all.map(el=>[el,el.getAttribute('style')]));
    function set(el,prop,value,priority){if(value)el.style.setProperty(prop,value,priority);else el.style.removeProperty(prop);}
    const backgroundState=el=>{const temp=doc.createElement('div');temp.style.cssText=el.style.cssText;for(const p of [...temp.style])if(!p.startsWith('background'))temp.style.removeProperty(p);return temp.style.cssText;};
    // Remove only the previous theme's values; later manual edits remain intact.
    const oldEdits=JSON.parse(previous?.dataset.themeEdits||'[]');
    for(const edit of oldEdits){const el=doc.querySelector(`[data-page-studio-node="${CSS.escape(edit.id)}"]`);if(!el)continue;if(!states.has(el))states.set(el,el.getAttribute('style'));
      // A multi-layer background is one CSS unit. Restoring its longhands one
      // by one can change the layer count and invalidate later comparisons.
      if(edit.background&&backgroundState(el)===edit.background.applied){el.style.removeProperty('background');el.style.cssText+=';'+edit.background.before;}
      const restore=Object.entries(edit.props).filter(([prop,p])=>el.style.getPropertyValue(prop)===p.applied&&el.style.getPropertyPriority(prop)==='important');for(const[prop,p]of restore)set(el,prop,p.value,p.priority);
    }
    previous?.remove();
    const next=doc.createElement('style');next.dataset.pageStudioTheme=id;next.dataset.themeName=name;next.dataset.palette=JSON.stringify(palette||null);
    if(name!=='none'){
      const[bg,fg,raw,surface]=palette,accent=readable(raw,surface),brand=readable(raw,bg),onBrand=contrast('#ffffff',brand)>=contrast('#172124',brand)?'#ffffff':'#172124',tint=mix(surface,raw,.13),border=mix(surface,raw,.34),edits=[];
      // Read the original computed styles before changing any element.
      const metrics=all.map(el=>{const c=doc.defaultView.getComputedStyle(el);return{el,bg:c.backgroundColor,image:c.backgroundImage,borders:['Top','Right','Bottom','Left'].map(s=>parseFloat(c['border'+s+'Width'])||0),shadow:c.boxShadow,display:c.display,color:c.color};});
      for(const m of metrics){
        const el=m.el,tag=el.tagName,nav=el.closest('nav,header'),button=el.closest('button,[role=button]'),insideNav=nav&&(nav===root||root.contains(nav)),insideButton=button&&(button===root||root.contains(button));
        const callout=tag==='BLOCKQUOTE'||el.getAttribute('role')==='alert'||m.borders[3]>=3||/callout|notice|highlight|alert/i.test(el.className||'');
        const card=['SECTION','ARTICLE','ASIDE'].includes(tag)||/card|panel|rounded|shadow/.test(el.className||'');
        const changes={color:insideButton||insideNav?onBrand:['A','STRONG','EM','B','MARK','H1','H2','H3','H4','H5','H6','I'].includes(tag)?accent:fg};
        if(el===root)changes['background-color']=bg;
        else if(tag==='NAV'||tag==='HEADER'||tag==='BUTTON'||el.getAttribute('role')==='button')changes['background-color']=brand;
        else if(tag==='TH'||tag==='THEAD'||callout)changes['background-color']=tint;
        else if(visible(m.bg)||card)changes['background-color']=surface;
        if(m.image!=='none'&&!/url\(/i.test(m.image))changes['background-image']='none';
        const texture=globalThis.PageStudioMember?.textures?.[name];
        if(el===root&&texture){changes['background-image']=texture;changes['background-size']=name==='mint'?'24px 24px,24px 24px':name==='peach'?'18px 18px':'auto';}
        if(m.borders.some(n=>n>0))changes['border-color']=callout?accent:border;
        if(m.shadow!=='none')changes['box-shadow']='0 6px 24px '+mix(bg,'#172124',.45)+'22';
        if(card&&el!==root)changes['border-radius']='12px';
        if(tag==='A')changes['text-decoration-color']=changes.color;
        const nodeId=el.dataset.pageStudioNode||'n'+crypto.randomUUID().replaceAll('-','');el.dataset.pageStudioNode=nodeId;const props={};
        const background=Object.keys(changes).some(p=>p.startsWith('background'))?{before:backgroundState(el)}:null;
        for(const[prop,value]of Object.entries(changes)){if(!prop.startsWith('background'))props[prop]={value:el.style.getPropertyValue(prop),priority:el.style.getPropertyPriority(prop)};set(el,prop,value,'important');}
        for(const prop of Object.keys(props))props[prop].applied=el.style.getPropertyValue(prop);
        if(background)background.applied=backgroundState(el);
        edits.push({id:nodeId,props,background});
      }
      next.dataset.themeEdits=JSON.stringify(edits);next.textContent='/* 页作整体风格：页面、卡片、提示框、表格、导航和强调文字。原样式记录用于恢复。 */';doc.head.append(next);
    }
    const after=new Map([...states.keys()].map(el=>[el,el.getAttribute('style')]));
    const restore=map=>{for(const[el,style]of map)style===null?el.removeAttribute('style'):el.setAttribute('style',style);};
    restore(states);next.remove();if(previous)doc.head.append(previous);
    return{redo(){restore(after);previous?.remove();if(name!=='none')doc.head.append(next);},undo(){restore(states);next.remove();if(previous)doc.head.append(previous);}};
  }
  globalThis.PageStudioTheme={apply};
})();
