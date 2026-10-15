(() => {
  const claimEvent = 'html-studio-claim-session';
  if (globalThis.__pageStudio && document.querySelector('[data-page-studio-session]')?.getAttribute('data-page-studio-session') === globalThis.__pageStudioSession) {
    globalThis.__pageStudio.reveal(); return;
  }
  // Isolated extension worlds share the DOM but not globalThis. Retire the
  // previous session before mounting another panel, including after reloads.
  document.dispatchEvent(new Event(claimEvent));
  globalThis.__pageStudio?.dispose();
  const oldUI = [...document.querySelectorAll('[data-page-studio-ui]')];
  // Pre-session builds cannot receive disposal events. Put their picker into
  // browse mode before removing the UI so their capture handlers stay dormant.
  for (const el of oldUI) el.shadowRoot?.querySelector('[data-action=preview]')?.click();
  for (const el of oldUI) el.remove();
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  globalThis.__pageStudioSession = token;
  const host = document.createElement('div');
  host.setAttribute('data-page-studio-ui', '');
  host.setAttribute('data-page-studio-session', token);
  host.style.cssText = 'all:initial!important;position:fixed!important;top:12px!important;right:12px!important;width:352px!important;height:calc(100vh - 24px)!important;z-index:2147483647!important;display:block!important;';
  document.documentElement.append(host);
  globalThis.__pageStudio = globalThis.PageStudio.mount(document, host, {direct:true, baseURL:document.baseURI});
  const instance = globalThis.__pageStudio;
  document.addEventListener(claimEvent, () => {
    instance.dispose();host.remove();
    if (globalThis.__pageStudio === instance) globalThis.__pageStudio = null;
  }, {once:true});
})();
