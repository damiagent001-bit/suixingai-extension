(() => {
  const $=id=>document.getElementById(id);let mode='login',profile=null,order=null,polling=null,busy=false;
  const send=async(action,payload={})=>{const reply=await chrome.runtime.sendMessage({type:'suixingai-account',action,payload});if(!reply?.ok)throw new Error(reply?.error||'扩展连接失败，请重新加载。');return reply.data;};
  const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
  const when=t=>new Date(t*1000).toLocaleString('zh-CN',{hour12:false});
  function setMode(next){clearErrors();mode=next;$('username').maxLength=next==='register'?10:32;$('password').maxLength=next==='login'?128:10;$('password').minLength=next==='login'?1:6;$('username-hint').textContent=next==='register'?'3–10 位英文字母、数字或下划线。':'输入你的账号。';$('password-hint').textContent=next==='login'?'输入你的密码。':'6–10 个字符。';$('login-tab').setAttribute('aria-pressed',next==='login');$('register-tab').setAttribute('aria-pressed',next==='register');$('auth-title').textContent=next==='register'?'创建你的编辑账号':'继续你的编辑';$('auth-note').textContent=next==='register'?'设置账号和密码，即可完成注册。':'登录后，可在不同电脑使用同一份会员。';$('submit').textContent=next==='register'?'创建账号':'登录';$('password').autocomplete=next==='login'?'current-password':'new-password';message('');}
  function showProfile(p){profile=p;const logged=Boolean(p.username);$('auth').hidden=logged;$('account').hidden=!logged;$('history').hidden=!logged;$('account-name').textContent=p.username||'';$('plan').textContent=p.plan==='member'?'月度会员':'免费版';$('expiry').textContent=p.expires_at?`会员${p.plan==='member'?'有效期至':'已到期：'} ${when(p.expires_at)}`:'基础编辑与保存不限次数';$('buy').disabled=!logged||p.checkout_enabled===false||busy;$('buy').textContent=!logged?'登录后开通':p.checkout_enabled===false?'购买暂未开放':p.plan==='member'?'续费一个月 · ¥9.90':'开通一个月 · ¥9.90';if(p.notice)message(p.notice,true);}
  async function history(){const data=await send('orders');$('orders').replaceChildren();if(!data.orders.length){$('orders').textContent='还没有订单。';return;}for(const item of data.orders){const row=document.createElement('div');row.className='order-row';const label=document.createElement('div');label.textContent=`¥9.90 · ${{paid:'已支付',closed:'已关闭 / 已退款',pending:'待付款'}[item.state]||item.state}`;const time=document.createElement('small');time.textContent=when(item.created_at);label.append(time);const number=document.createElement('span');number.className='order-number';number.textContent=item.id;label.append(number);const button=document.createElement('button');button.textContent=item.state==='pending'?'查看 / 继续支付':'查看结果';button.onclick=()=>work(()=>openOrder(item.id));row.append(label,button);$('orders').append(row);}}
  async function refresh(){showProfile((await send('profile')).profile);if(profile.username)await history();}
  async function work(fn){if(busy)return;busy=true;for(const b of document.querySelectorAll('button'))if(!['payment-close','contact-close'].includes(b.id))b.disabled=true;try{await fn();}catch(e){message(e.message,true);}finally{busy=false;for(const b of document.querySelectorAll('button'))b.disabled=false;if(profile)showProfile(profile);}}
  function stop(){clearTimeout(polling);polling=null;}
  function display(data){$('payment').hidden=false;$('order-id').textContent='订单号：'+data.id;$('qr').hidden=!data.qr_image;if(data.qr_image)$('qr').src=data.qr_image;else $('qr').removeAttribute('src');if(data.profile)showProfile({...profile,...data.profile});$('payment-status').textContent=data.state==='paid'?'支付成功，会员已开通。回到编辑页面即可使用。':data.state==='closed'?'订单已关闭或已退款。需要开通时可重新购买。':data.qr_image?'订单待付款。如已退出支付宝付款页，可稍后继续扫码。':'二维码已过期或正在确认，请查询结果后再重新下单。';if(data.state!=='pending'){stop();history().catch(e=>message(e.message,true));}return data.state==='pending';}
  let checking=false,paymentEpoch=0;
  async function check(){
    if(!order||checking)return;checking=true;const id=order,epoch=paymentEpoch;
    try{const data=await send('poll',{order_id:id});if(id!==order||epoch!==paymentEpoch)return;message('');$('payment-status').classList.remove('payment-warning');const pending=display(data);if(pending&&!document.hidden&&$('payment-dialog').open){stop();polling=setTimeout(check,5000);}}
    catch(e){if(id===order&&epoch===paymentEpoch){$('payment-status').textContent='暂时未能查询付款结果，请稍后点击“查询结果”。订单记录会保留。';$('payment-status').classList.add('payment-warning');stop();}}
    finally{checking=false;}
  }
  async function openOrder(id){stop();paymentEpoch++;order=id;message('');display(await send('query',{order_id:id}));if(!$('payment-dialog').open)$('payment-dialog').showModal();await check();}
  function closePayment(){stop();paymentEpoch++;order=null;$('payment-dialog').close();message('付款窗口已关闭，可在订单记录中继续查看。');if(profile?.username)history().catch(e=>message(e.message,true));}
  $('payment-close').onclick=closePayment;$('payment-dialog').addEventListener('cancel',e=>{e.preventDefault();closePayment();});
  $('contact-open').onclick=()=>$('contact-dialog').showModal();$('contact-close').onclick=()=>$('contact-dialog').close();
  $('login-tab').onclick=()=>setMode('login');$('register-tab').onclick=()=>setMode('register');$('forgot').onclick=()=>$('contact-dialog').showModal();
  function clearErrors(){for(const id of ['username','password']){$(id+'-error').textContent='';$(id).removeAttribute('aria-invalid');}}
  function validateForm(){
    clearErrors();const username=$('username').value.trim(),password=$('password').value;let first=null;
    const errors={username:!username?'请输入账号。':username.length<3?'账号至少需要 3 位。':username.length>(mode==='register'?10:32)?`账号最多 ${mode==='register'?10:32} 位。`:!/^[A-Za-z0-9_]+$/.test(username)?'账号只能包含英文字母、数字或下划线。':'',password:!password?'请输入密码。':mode!=='login'&&password.length<6?'密码至少需要 6 个字符。':password.length>(mode==='login'?128:10)?`密码最多 ${mode==='login'?128:10} 个字符。`:''};
    for(const [id,text] of Object.entries(errors))if(text){$(id+'-error').textContent=text;$(id).setAttribute('aria-invalid','true');first ||= $(id);}
    if(first){first.focus();return false;}
    return true;
  }
  for(const id of ['username','password'])$(id).addEventListener('input',()=>{$(id+'-error').textContent='';$(id).removeAttribute('aria-invalid');});
  $('auth-form').onsubmit=e=>{e.preventDefault();if(!validateForm())return;work(async()=>{const data=await send(mode,{username:$('username').value.trim(),password:$('password').value});$('password').value='';showProfile(data.profile);message('已登录。返回页面即可继续编辑。');await history();});};
  function openChange(){$('change-form').reset();$('change-error').textContent='';$('change-username').value=profile?.username||$('username').value.trim();$('change-username').readOnly=Boolean(profile?.username);$('password-dialog').showModal();}
  $('change-from-login').onclick=openChange;$('change-from-account').onclick=openChange;$('change-close').onclick=()=>$('password-dialog').close();
  $('password-dialog').addEventListener('close',()=>{$('change-form').reset();$('change-error').textContent='';});
  $('change-form').onsubmit=async e=>{e.preventDefault();if(busy)return;
    const username=$('change-username').value.trim(),current=$('current-password').value,next=$('new-password').value;
    const error=!/^[A-Za-z0-9_]{3,32}$/.test(username)?'请输入正确的账号。':!current?'请输入当前密码。':next.length<6||next.length>10?'新密码需为 6–10 个字符。':next!==$('confirm-password').value?'两次输入的新密码不一致。':next===current?'新密码不能与当前密码相同。':'';
    $('change-error').textContent=error;if(error)return;busy=true;$('change-form').querySelector('button').disabled=true;
    try{const data=await send('change-password',{username,current_password:current,new_password:next});stop();order=null;paymentEpoch++;$('payment-dialog').close();showProfile(data.profile);$('password-dialog').close();$('password').value='';message('密码已修改，其他设备已退出登录。');await history();}
    catch(e){$('change-error').textContent=e.message;}
    finally{busy=false;$('change-form').querySelector('button').disabled=false;if(profile)showProfile(profile);}
  };
  $('logout').onclick=()=>work(async()=>{stop();order=null;showProfile((await send('logout')).profile);$('payment').hidden=true;$('payment-dialog').close();paymentEpoch++;setMode('login');message('已退出登录。');});
  $('refresh').onclick=()=>work(async()=>{await refresh();message('会员状态已更新。');});
  $('buy').onclick=()=>work(async()=>{const data=await send('create');message('订单已创建，请用支付宝扫码付款。');await openOrder(data.order_id);});
  $('check-payment').onclick=()=>work(check);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(order&&$('payment-dialog').open)check();else refresh().catch(e=>message(e.message,true));});
  setMode('login');work(refresh);
})();
