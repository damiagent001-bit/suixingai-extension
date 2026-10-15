(() => {
  const inline=new Set('A ABBR B BDI BDO BR CITE CODE DEL EM FONT I INS KBD MARK Q RP RT RUBY S SAMP SMALL SPAN STRONG SUB SUP TIME U VAR WBR SVG PATH USE'.split(' '));
  function editable(el){return !['BODY','IMG','INPUT','TEXTAREA','SELECT','IFRAME','VIDEO','AUDIO','CANVAS','SVG','HR','BR'].includes(el.tagName)&&[...el.querySelectorAll('*')].every(n=>inline.has(n.tagName.toUpperCase()));}
  function segments(el){const parts=[];let offset=0;function visit(n){if(n.nodeType===3){parts.push({node:n,start:offset,end:offset+n.data.length,text:n.data});offset+=n.data.length;}else if(n.nodeType===1){if(n.tagName==='BR'){parts.push({node:n,start:offset,end:offset+1,text:'\n'});offset++;}else if(!['SVG','SCRIPT','STYLE'].includes(n.tagName.toUpperCase()))n.childNodes.forEach(visit);}}el.childNodes.forEach(visit);return parts;}
  const read=el=>segments(el).map(p=>p.text).join('');
  function snapshot(el){const records=[];function visit(n){records.push({node:n,children:[...n.childNodes],text:n.nodeType===3?n.data:null});n.childNodes.forEach(visit);}visit(el);return()=>{for(const r of records)if(r.text!==null)r.node.data=r.text;else r.node.replaceChildren(...r.children);};}
  function command(el,value){
    const parts=segments(el),old=parts.map(p=>p.text).join('');if(old===value)return null;
    const undo=snapshot(el);let start=0,suffix=0;
    while(start<old.length&&start<value.length&&old[start]===value[start])start++;
    while(suffix<old.length-start&&suffix<value.length-start&&old[old.length-1-suffix]===value[value.length-1-suffix])suffix++;
    const a=old.slice(start,old.length-suffix),b=value.slice(start,value.length-suffix),edits=[];
    // Multiple separated edits must not flatten the formatting between them.
    if(a.length*b.length<=2000000){
      const cols=b.length+1,dp=new Uint32Array((a.length+1)*cols);
      for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i*cols+j]=a[i]===b[j]?dp[(i+1)*cols+j+1]+1:Math.max(dp[(i+1)*cols+j],dp[i*cols+j+1]);
      let i=0,j=0,edit=null;const flush=()=>{if(edit){edits.push(edit);edit=null;}};
      while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){flush();i++;j++;continue;}if(!edit)edit={start:start+i,end:start+i,text:''};if(i<a.length&&(j===b.length||dp[(i+1)*cols+j]>=dp[i*cols+j+1])){i++;edit.end=start+i;}else edit.text+=b[j++];}flush();
    }else edits.push({start,end:old.length-suffix,text:b});
    for(const edit of edits.reverse()){
      const current=segments(el);
      function point(offset,end){const p=current.find(p=>end?offset<=p.end:offset<p.end)||current.at(-1);if(!p)return[el,el.childNodes.length];if(p.node.nodeType===3)return[p.node,Math.max(0,Math.min(p.node.length,offset-p.start))];const parent=p.node.parentNode,index=[...parent.childNodes].indexOf(p.node);return[parent,index+(offset>p.start?1:0)];}
      const range=el.ownerDocument.createRange(),begin=point(edit.start,false);range.setStart(...begin);range.setEnd(...(edit.start===edit.end?begin:point(edit.end,true)));range.deleteContents();
      const fragment=el.ownerDocument.createDocumentFragment();edit.text.split('\n').forEach((text,i)=>{if(i)fragment.append(el.ownerDocument.createElement('br'));if(text)fragment.append(el.ownerDocument.createTextNode(text));});range.insertNode(fragment);
    }
    const redo=snapshot(el);undo();return{redo,undo};
  }
  globalThis.PageStudioText={editable,read,command};
})();
