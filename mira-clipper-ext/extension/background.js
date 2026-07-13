/**
 * Mira Clipper - Background Service Worker
 * 职责：右键菜单注册、跨域请求兜底
 */

const CAPTURE_MENU_ID = 'mira-clipper-capture';

async function ensureContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CAPTURE_MENU_ID,
    title: '采集到 Mira',
    contexts: ['page', 'selection', 'image']
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus();
});

// 扩展更新或后台脚本重新加载时，也确保已有安装实例能看到菜单。
ensureContextMenus();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CAPTURE_MENU_ID) return;

  const imageUrl = (info.srcUrl || '').trim();
  const selectedText = (info.selectionText || '').trim();
  await chrome.storage.session.set({
    pendingCapture: imageUrl
      ? { contentType: 'image', imageUrl }
      : { selectedText },
  });
  chrome.action.openPopup();
});
