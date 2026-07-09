/**
 * Background Service Worker
 * 
 * Chrome 扩展的后台服务，处理：
 * 1. 扩展安装/更新时的初始化
 * 2. 右键菜单集成（快速提取）
 * 3. 消息中转
 */

// ==================== 安装与初始化 ====================
chrome.runtime.onInstalled.addListener((details) => {
  console.log('需求提取kimi版（本机版V2.1）扩展已安装/更新:', details.reason);

  // 首次安装时初始化默认设置
  if (details.reason === 'install') {
    chrome.storage.local.set({
      rules: {
        reqId: '.req-id, #requirementId, [data-field="requirementId"]',
        reqName: '.req-name, #requirementName, [data-field="requirementName"], h2.title, .requirement-title',
        proposer: '.proposer, .creator, #creator, [data-field="creator"], .proposer-name, .submitter',
        background: '.background, #reqBg, [data-field="background"], .requirement-background',
        description: '.description, #reqDesc, [data-field="description"], .requirement-description, .detail-content',
        urlPatterns: []
      },
      contacts: []
    });
  }

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'extract-requirement',
    title: '📋 提取需求信息并发送邮件',
    contexts: ['page']
  });
});

// ==================== 右键菜单处理 ====================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'extract-requirement' && tab?.id) {
    // 通过打开 popup 让用户操作（右键菜单作为快捷入口提示）
    chrome.action.openPopup();
  }
});

// ==================== 消息处理 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse(tabs[0] || null);
    });
    return true;
  }
});

// ==================== 快捷键支持 ====================
chrome.commands.onCommand.addListener((command) => {
  if (command === 'extract-requirement') {
    chrome.action.openPopup();
  }
});
