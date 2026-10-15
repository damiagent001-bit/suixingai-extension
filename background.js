if (typeof importScripts === 'function') importScripts('member-config.js');
if (typeof importScripts === 'function' && !globalThis.PageStudioMemberConfig?.preview) importScripts('account-service.js');
chrome.action.onClicked.addListener(async tab => {
  try {
    if (!/^(https?|file):/.test(tab.url || '')) throw new Error('请打开普通网页或本地 HTML；浏览器设置页和扩展商店无法编辑。');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['member-config.js','member-tools.js','member-fonts.js','ui.js','export.js','text-tools.js','theme-tools.js','image-tools.js','color-tools.js','studio.js','content.js']});
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
    await chrome.action.setTitle({tabId:tab.id,title:'随心改 · 点击展开编辑面板'});
  } catch(error) {
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await chrome.action.setBadgeBackgroundColor({tabId:tab.id,color:'#aa4635'});
    const message=tab.url?.startsWith('file:')?'请在扩展详情开启“允许访问文件网址”，然后重新点击插件。':error.message;
    await chrome.action.setTitle({tabId:tab.id,title:'随心改：'+message});
  }
});

// Serialized extension-owned storage keeps private libraries out of page storage,
// and avoids concurrent tabs overwriting each other's changes.
let memberQueue=Promise.resolve();
chrome.runtime?.onMessage?.addListener((message,sender,respond)=>{
  if(message?.type!=='html-studio-member')return;
  if(sender.id!==chrome.runtime.id){respond({ok:false,error:'请求来源无效。'});return;}
  const task=async()=>{
    if(message.op==='account'){await globalThis.SuixingaiAccount?.open();return {};}
    if(message.op==='recipe')return globalThis.SuixingaiAccount.recipe(message.kind,message.name);
    await globalThis.SuixingaiAccount?.ready;
    const key='htmlStudioMemberV1',saved=(await chrome.storage.local.get(key))[key];
    const state={plan:'free',styles:[],components:[],...saved};
    if(!globalThis.PageStudioMemberConfig?.preview)Object.assign(state,await globalThis.SuixingaiAccount.profile());
    const {op,kind,item,id,plan}=message;
    if(!['read','plan','add','remove'].includes(op))throw new Error('不支持的操作。');
    if(op==='plan'){
      if(!globalThis.PageStudioMemberConfig?.preview)throw new Error('此版本不支持本地身份切换。');
      if(!['free','member'].includes(plan))throw new Error('身份无效。');state.plan=plan;
    }
    if(op==='add'||op==='remove'){
      if(!['styles','components'].includes(kind))throw new Error('收藏类型无效。');
      if(op==='remove')state[kind]=state[kind].filter(x=>x.id!==id);
      else{
        if(state.plan!=='member')throw new Error('此操作需要会员。');
        if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>40)throw new Error('名称请填写 1–40 个字。');
        if(JSON.stringify(item).length>550000)throw new Error('收藏内容过大。');
        if(kind==='styles'&&(!item.values||typeof item.values!=='object'))throw new Error('样式数据无效。');
        if(kind==='components'&&typeof item.html!=='string')throw new Error('组件数据无效。');
        if(state[kind].length>=30)throw new Error('最多保存 30 项，请先删除旧项目。');
        state[kind].push({...item,name:item.name.trim(),id:crypto.randomUUID()});
      }
    }
    if(JSON.stringify(state).length>3000000)throw new Error('收藏空间已满（3 MB），请删除部分项目。');
    if(op!=='read')await chrome.storage.local.set({[key]:state});
    return state;
  };
  const result=memberQueue.then(task);memberQueue=result.catch(()=>{});
  result.then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message}));return true;
});
