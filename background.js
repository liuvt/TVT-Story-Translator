const MENU_ID = 'tvt-translate-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'TVT: Dịch / hiệu đính đoạn được chọn',
    contexts: ['selection']
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  // sidePanel.open needs a direct extension user gesture: call before other awaits.
  const opened = chrome.sidePanel.open({windowId: tab.windowId}).catch(console.error);
  if (typeof tab.id === 'number') {
    try {
      const result = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          const el = document.activeElement;
          if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') &&
              el.type !== 'password' && typeof el.selectionStart === 'number') {
            return (el.value || '').slice(el.selectionStart, el.selectionEnd);
          }
          return (window.getSelection()?.toString() || '').trim();
        }
      });
      const selection = result?.[0]?.result?.trim();
      if (selection) await chrome.storage.session.set({incomingSelection: {text: selection, capturedAt: Date.now()}});
    } catch { /* Restricted chrome:// or store pages cannot be scripted. */ }
  }
  await opened;
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  // Opening here preserves the user gesture on Chrome 116+.
  if (tab?.windowId != null) chrome.sidePanel.open({windowId: tab.windowId}).catch(console.error);
  const text = info.selectionText?.trim();
  if (text) chrome.storage.session.set({incomingSelection: {text, capturedAt: Date.now()}}).catch(console.error);
});
