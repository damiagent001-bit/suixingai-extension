/* Runs only in the extension service worker. No token enters a content script. */
(() => {
  const API='https://suixingai.esecretary.cn',KEY='suixingaiSessionV1';
  let cached=null,inflight=null;
  const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  async function api(path,method='GET',body){
    await ready;
    const saved=(await chrome.storage.local.get(KEY))[KEY];
    let response;
    try{response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(saved?.token?{Authorization:'Bearer '+saved.token}:{})},body:method==='POST'?JSON.stringify(body||{}):undefined,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});}
    catch{throw new Error('连接服务失败，请检查网络后重试。');}
    const result=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(result.error||'服务暂时不可用。');error.status=response.status;throw error;}
    return result;
  }
  async function profile(){
    await ready;
    if(cached&&cached.validUntil>Date.now())return cached;
    if(inflight)return inflight;
    inflight=(async()=>{
      const saved=(await chrome.storage.local.get(KEY))[KEY];
      const fallback={plan:'free',username:'',expires_at:0,validUntil:Date.now()+30000};
      if(!saved?.token)return cached=fallback;
      try{
        const data=await api('/api/v1/me');
        const remaining=Math.max(0,(data.expires_at-data.server_time)*1000);
        return cached={username:data.username,expires_at:data.expires_at,plan:data.plan==='member'&&remaining>0?'member':'free',validUntil:Date.now()+Math.min(60000,data.plan==='member'?remaining:60000),checkout_enabled:data.checkout_enabled};
      }catch(e){if(e.status===401)await chrome.storage.local.remove(KEY);return cached={...fallback,username:e.status===401?'':saved.username||'',notice:e.status===401?'请重新登录。':'暂时无法验证会员；基础编辑和保存仍可使用。'};}
    })();
    try{return await inflight;}finally{inflight=null;}
  }
  async function open(){
    const url=chrome.runtime.getURL('account.html');
    const tabs=await chrome.tabs.query({});const existing=tabs.find(t=>t.url===url);
    if(existing)await chrome.tabs.update(existing.id,{active:true});else await chrome.tabs.create({url});
  }
  let queue=Promise.resolve();
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='suixingai-account')return;
    if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('account.html')){respond({ok:false,error:'请在扩展账号页操作。'});return;}
    const task=async()=>{
      const {action,payload={}}=message;
      if(['login','register','change-password'].includes(action)){
        const data=await api('/api/v1/auth/'+action,'POST',{username:payload.username,password:payload.password,current_password:payload.current_password,new_password:payload.new_password});
        await chrome.storage.local.set({[KEY]:{token:data.token,username:data.profile.username}});cached=null;
        return {profile:await profile()};
      }
      if(action==='logout'){
        await api('/api/v1/auth/logout','POST');await chrome.storage.local.remove(KEY);cached=null;return {profile:await profile()};
      }
      if(action==='profile'){cached=null;return {profile:await profile()};}
      if(action==='orders')return api('/api/v1/payment/orders');
      if(action==='create')return api('/api/v1/payment/create-order','POST');
      if(['query','poll'].includes(action)){
        if(!/^SXG_[0-9a-f]{32}$/.test(payload.order_id||''))throw new Error('订单无效。');
        const data=await api('/api/v1/payment/'+(action==='query'?'query-order/':'poll-order/')+payload.order_id,action==='query'?'GET':'POST');
        cached=null;return data;
      }
      throw new Error('操作无效。');
    };
    const next=queue.then(task);queue=next.catch(()=>{});
    next.then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}));return true;
  });
  async function recipe(kind,name){
    if(!['shape','theme'].includes(kind)||typeof name!=='string'||!/^[a-z]{1,40}$/.test(name))throw new Error('样式请求无效。');
    return api('/api/v1/member/recipe','POST',{kind,name});
  }
  globalThis.SuixingaiAccount={profile,open,ready,recipe};
})();
