(() => {
  const toData=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
  // Never retain a source <base>: a fragment link would reopen the unedited source.
  function fixResources(root,baseURL,sourceURL){
    const source=new URL(sourceURL||baseURL);
    const absolute=(value,anchor=false)=>{
      if(!value||/^(?:#|data:|blob:|javascript:|mailto:|tel:)/i.test(value.trim()))return value;
      try{const u=new URL(value,baseURL);if(anchor&&u.hash&&u.origin===source.origin&&u.pathname===source.pathname&&u.search===source.search)return u.hash;return u.href;}catch{return value;}
    };
    const css=text=>text.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(_,q,url)=>`url(${q||'"'}${absolute(url)}${q||'"'})`).replace(/(@import\s+)(['"])(.*?)\2/gi,(_,p,q,url)=>p+q+absolute(url)+q);
    root.querySelectorAll('base').forEach(el=>el.remove());
    root.querySelectorAll('*').forEach(el=>{
      for(const name of ['src','href','poster','action','formaction','background','xlink:href'])if(el.hasAttribute(name))el.setAttribute(name,absolute(el.getAttribute(name),name==='href'&&['A','AREA'].includes(el.tagName)));
      for(const name of ['srcset','imagesrcset'])if(el.hasAttribute(name)){const value=el.getAttribute(name);if(!value.includes('data:'))el.setAttribute(name,value.split(',').map(part=>{const[url,...size]=part.trim().split(/\s+/);return[absolute(url),...size].join(' ');}).join(', '));}
      if(el.hasAttribute('style'))el.setAttribute('style',css(el.getAttribute('style')));
      if(el.tagName==='STYLE'&&!el.hasAttribute('data-page-studio-font'))el.textContent=css(el.textContent);
    });
  }
  function serialize(doc,keepScripts){
    const root=doc.documentElement.cloneNode(true);root.querySelectorAll('[data-page-studio-ui]').forEach(el=>el.remove());
    // Switching through the font menu must not embed every previously previewed font.
    const fontUses=[...root.querySelectorAll('[style]')].map(el=>el.style.fontFamily).join(' ')+' '+[...root.querySelectorAll('style:not([data-page-studio-font])')].map(el=>el.textContent).join(' ');
    root.querySelectorAll('style[data-page-studio-font]').forEach(el=>{if(!fontUses.includes(el.dataset.pageStudioFont))el.remove();});
    root.querySelectorAll('meta[http-equiv]').forEach(el=>{if(/content-security-policy|refresh/i.test(el.httpEquiv))el.remove();});
    if(!keepScripts){root.querySelectorAll('script').forEach(el=>el.remove());root.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||(/^(href|src|action|formaction)$/i.test(a.name)&&/^\s*javascript:/i.test(a.value)))el.removeAttribute(a.name);}));}
    const sources=[...doc.querySelectorAll('input,textarea,select')].filter(el=>!el.closest('[data-page-studio-ui]')),targets=[...root.querySelectorAll('input,textarea,select')];
    sources.forEach((el,i)=>{const t=targets[i];if(!t)return;if(el.tagName==='TEXTAREA')t.textContent=el.value;else if(el.tagName==='SELECT')[...t.options].forEach((o,j)=>o.toggleAttribute('selected',el.options[j].selected));else if(!['password','file'].includes(el.type)){t.setAttribute('value',el.value);t.toggleAttribute('checked',el.checked);}else t.removeAttribute('value');});
    fixResources(root,doc.baseURI,doc.URL);
    const charset=root.querySelector('meta[charset]');if(charset)charset.setAttribute('charset','utf-8');else{const meta=doc.createElement('meta');meta.setAttribute('charset','utf-8');root.querySelector('head').prepend(meta);}
    return '<!DOCTYPE html>\n'+root.outerHTML;
  }
  async function extractPalette(file,doc){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error('请上传 PNG、JPEG、WebP 或 GIF 图片。');
    if(file.size>20*1024*1024)throw new Error('图片请小于 20 MB。');
    const data=await toData(file),img=new Image();img.src=data;await img.decode();
    const canvas=doc.createElement('canvas');canvas.width=96;canvas.height=Math.min(192,Math.max(1,Math.round(96*img.height/img.width)));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,buckets=new Map();
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<128)continue;const rgb=[pixels[i],pixels[i+1],pixels[i+2]].map(v=>Math.min(255,Math.round(v/24)*24)),key=rgb.join(',');const item=buckets.get(key)||{rgb,count:0};item.count++;buckets.set(key,item);}
    const sorted=[...buckets.values()].sort((a,b)=>b.count-a.count);if(!sorted.length)throw new Error('图片没有可提取的可见颜色。');
    const lum=rgb=>rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0),hex=rgb=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
    const bg=sorted[0].rgb,dark=lum(bg)<128,accent=sorted.find(e=>Math.max(...e.rgb)-Math.min(...e.rgb)>35&&Math.abs(lum(e.rgb)-lum(bg))>35)?.rgb||(dark?[160,210,185]:[49,95,67]);
    return{data,palette:[hex(bg),dark?'#f4f6f0':'#243029',hex(accent),hex(bg.map(v=>v*.9+(dark?255:0)*.1))]};
  }
  globalThis.PageStudioExport={serialize,fixResources,toData,extractPalette};
})();
