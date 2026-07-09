/**
 * 需求提取kimi版 - Popup 主逻辑
 */

// ==================== 默认提取规则 ====================
// 支持的页面类型：
//  1) 需求系统（BOMC/北极星/TAPD/Jira）：使用 .req-id / #requirementId / [data-field] / td:contains 等
//  2) 工单系统（如 jlwzng 运营工单）：使用 td:contains("工单X") + next-td 邻近选择器
//     工单系统的特点是 label 和 value 都是 <td>，label 包含中文（如「运营工单ID」），下一个 <td> 是值
const DEFAULT_RULES = {
  reqId: '.req-id, #requirementId, [data-field="requirementId"], td:contains("需求编号") + td, .field-id .value, .order-id, .workorder-id, .ticket-id, [data-field="orderId"], [data-field="workOrderId"], [class*="order-id"], [class*="ticket-id"], td:contains("运营工单ID") + td, td:contains("工单ID") + td, td:contains("工单编号") + td, .field:contains("运营工单ID") .value, .field:contains("工单ID") .value, label:contains("运营工单ID") + * .value, label:contains("工单ID") + * .value',
  reqName: '.req-name, #requirementName, [data-field="requirementName"], h2.title, .requirement-title, .detail-title, .order-title, .workorder-title, .ticket-title, [data-field="orderTitle"], [data-field="workOrderTitle"], [class*="order-title"], [class*="ticket-title"], td:contains("需求名称") + td, td:contains("工单标题") + td, .field:contains("工单标题") .value, label:contains("工单标题") + * .value',
  proposer: '.proposer, .creator, #creator, [data-field="creator"], .proposer-name, .submitter, .create-user, .publisher, .issuer, [data-field="publisher"], [data-field="issuer"], [class*="publisher"], [class*="issuer"], td:contains("提出人") + td, td:contains("发布人") + td, td:contains("工单发布人") + td, .field:contains("提出人") .value, .field:contains("发布人") .value, label:contains("提出人") + * .value, label:contains("发布人") + * .value',
  proposeTime: '.propose-time, .create-time, .submit-time, #createTime, [data-field="createTime"], [data-field="proposeTime"], [data-field="submitTime"], .field:contains("提出时间") .value, .field:contains("创建时间") .value, label:contains("提出时间") + * .value, label:contains("创建时间") + * .value, td:contains("提出时间") + td, td:contains("创建时间") + td',
  background: '.background, #reqBg, [data-field="background"], .requirement-background, .bg-desc, td:contains("需求背景及目标") + td, .field:contains("需求背景及目标") .value, label:contains("需求背景及目标") + * .value',
  description: '.description, #reqDesc, #req_detail$text, [name="req_detail"], #req_detail, [data-field="description"], .requirement-description, .detail-content, .req-content, .order-content, .workorder-content, .ticket-content, [data-field="orderContent"], [data-field="workOrderContent"], [class*="order-content"], [class*="ticket-content"], td:contains("需求描述") + td, td:contains("工单内容") + td, .field:contains("需求描述") .value, .field:contains("工单内容") .value, label:contains("需求描述") + * .value, label:contains("工单内容") + * .value'
};

// ==================== 标签→值 通用提取器（工单系统专用）====================
// 工单系统的特点：label 和 value 都是 <td>，label 单元格内是中文标签
// 通过 :contains 找到 label td，取其 next/parent/closest-tr 内的下一个 td 作为值
const LABEL_VALUE_EXTRACTORS = {
  reqId: ['运营工单ID', '工单ID', '工单编号', '需求编号'],
  reqName: ['工单标题', '需求名称'],
  proposer: ['工单发布人', '发布人', '提出人'],
  proposeTime: ['提出时间', '创建时间', '提交时间', '发布时间', '工单创建时间'],
  background: ['需求背景及目标', '需求背景'],
  description: ['工单内容', '需求描述']
};

/**
 * 智能提取：先尝试 DEFAULT_RULES 中配置的所有选择器，若都失败则尝试 label→value 邻近选择器
 * 适用于工单系统（jlwzng 运营工单等）label-value 表格布局
 */
function smartExtractByLabel(fieldName) {
  const labels = LABEL_VALUE_EXTRACTORS[fieldName];
  if (!labels || labels.length === 0) return '';

  for (const label of labels) {
    // 1) 在同一行中找 label td，然后取下一个 td
    // 适配 jlwzng 页面：label 和 value 在同一 tr，label 是 td（colspan=1），value 是 td（colspan=3）
    const escapedLabel = label.replace(/'/g, "\\'");
    const candidates = [
      `td:contains('${escapedLabel}') + td`,                    // 紧邻的下一个 td
      `td:contains('${escapedLabel}'):not([colspan]) + td`,     // 排除 colspan 的 label td 后的下一个
      `td:contains('${escapedLabel}') ~ td:first`,              // 同 tr 内第一个后续 td
    ];

    const multiline = fieldName === 'description' || fieldName === 'background';

    for (const selector of candidates) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const text = getValue(el, multiline);
          if (text && text !== label) {
            return text;
          }
        }
      } catch (e) {
        // 选择器语法错误，忽略
      }
    }

    // 2) 备选：找包含该 label 的最近的 tr，遍历该 tr 内的所有 td，返回第一个非 label 的 td
    try {
      const labelTd = Array.from(document.querySelectorAll('td')).find(
        td => (td.textContent || '').trim() === label
      );
      if (labelTd) {
        const tr = labelTd.closest('tr');
        if (tr) {
          const tds = tr.querySelectorAll('td');
          for (const td of tds) {
            const text = getValue(td, multiline);
            if (text && text !== label) {
              return text;
            }
          }
        }
      }
    } catch (e) {
      // 忽略
    }
  }
  return '';
}

// ==================== 默认 SMTP 配置 ====================
const DEFAULT_SMTP = {
  host: '',
  port: 465,
  secure: true,
  user: '',
  pass: '',
  // IMAP 存档配置
  imapHost: '',
  imapPort: 993,
  // 邮件签名
  signature: '',
  // 默认抄送邮箱
  defaultCc: ''
};

// ==================== 默认数据库配置 ====================
const DEFAULT_DB = {
  host: 'localhost',
  port: 3306,
  database: '',
  user: '',
  pass: '',
  table: 'sent_emails'
};

// ==================== 本地中继服务器地址 ====================
const RELAY_SERVER = 'http://127.0.0.1:2525';

// 缓存的提取数据
let _extractedData = null;

// 附件列表（File 对象数组）
let _attachments = [];

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadCurrentPageInfo();
  await loadContacts();
  await loadSmtpConfig();
  await loadDbConfig();
  bindEvents();
});

// ==================== Tab 切换 ====================
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });
}

// ==================== 当前页面信息 ====================
async function loadCurrentPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    document.getElementById('page-url').textContent = url || '无法获取页面URL';

    const statusEl = document.getElementById('page-status');
    const rules = await getRules();
    if (rules.urlPatterns.length > 0) {
      const matched = rules.urlPatterns.some(pattern => {
        try { return new RegExp(pattern).test(url); } catch { return false; }
      });
      statusEl.textContent = matched ? '✅ 已匹配规则' : '⚠️ 未匹配';
      statusEl.style.background = matched ? '#e6f4ea' : '#fef7e0';
      statusEl.style.color = matched ? '#0f9d58' : '#e37400';
    } else {
      statusEl.textContent = '🌐 通用模式';
    }
  } catch (e) {
    document.getElementById('page-url').textContent = '无法获取页面（请刷新后重试）';
    document.getElementById('page-status').textContent = '❌ 错误';
  }
}

// ==================== 提取需求信息 ====================
async function extractInfo() {
  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 正在提取...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('无法获取当前标签页');

    const rules = await getRules();

    // 注入并执行提取脚本（包含 iframe，适配需小依等微前端场景）
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: extractFromPage,
      args: [rules]
    });

    // 合并所有 iframe / frame 的提取结果，优先取字段最多的结果
    let bestResult = null;
    let bestScore = -1;
    for (const r of results || []) {
      const data = r?.result;
      if (!data) continue;
      const score = Object.values(data).filter(v => v && String(v).trim()).length;
      if (score > bestScore) {
        bestScore = score;
        bestResult = data;
      }
    }

    if (bestResult) {
      await displayResults(bestResult);
    } else {
      showToast('未能提取到信息，请检查页面内容或调整提取规则', 'error');
    }
  } catch (e) {
    console.error('提取失败:', e);
    showToast('提取失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 提取需求信息';
  }
}

/**
 * 在目标页面中执行的提取函数（被注入到目标页面上下文运行）
 */
function extractFromPage(rules) {
  'use strict';

  // ============== 字段关键词映射 ==============
  // 同时支持需求系统（BOMC/北极星/TAPD）和工单系统（如 jlwzng 运营工单）
  const FIELD_KEYWORDS = {
    reqId: ['需求编号', '需求ID', '需求单号', '需求号', '工单编号', '工单ID', '运营工单ID', '编号', 'ID'],
    reqName: ['需求名称', '需求标题', '需求主题', '需求名', '工单标题'],
    proposer: ['提出人', '创建人', '申请人', '提交人', '创建者', '作者', '工单发布人', '发布人'],
    proposeTime: ['提出时间', '创建时间', '提交时间', '发布时间', '工单创建时间', '创建日期'],
    background: ['需求背景', '背景及目标', '项目背景', '业务背景', '背景'],
    description: ['需求描述', '详细描述', '功能描述', '描述', '详细', '工单内容']
  };

  // ============== 工具函数 ==============

  /** 从元素中获取值（支持 input/textarea/select/普通元素）*/
  function getValue(el, multiline) {
    if (!el) return '';
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input') {
      const type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'hidden' || 
          type === 'submit' || type === 'button' || type === 'reset') return '';
      return el.value || el.placeholder || '';
    }
    if (tag === 'textarea') return el.value || el.placeholder || '';
    if (tag === 'select') {
      if (el.selectedIndex >= 0 && el.options) {
        return el.options[el.selectedIndex].text || '';
      }
      return el.value || '';
    }
    // 普通元素：默认使用 textContent，避免 innerText 因可见性/结构差异导致标签匹配或取值错误
    // multiline=true 时将 <br>/<p> 等转换为换行，保留段落结构
    if (multiline) {
      return getMultilineText(el);
    }
    return (el.textContent || '').trim();
  }

  /** 提取多行文本：将 <br> 及块级元素转换为换行符 */
  function getMultilineText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
    const blockTags = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote'];
    clone.querySelectorAll(blockTags.join(',')).forEach(block => {
      block.appendChild(document.createTextNode('\n'));
    });
    let text = clone.textContent || '';
    // 清理多余空行，但保留有意义的换行
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** 判断字段是否需要保留多行换行 */
  function isMultilineField(field) {
    return field === 'description' || field === 'background';
  }

  /** 验证提取的值是否合理（过滤垃圾值） */
  function isValidValue(v, field) {
    if (!v) return false;
    const lower = v.toLowerCase().trim();
    // 明确的垃圾值
    const garbage = ['on', 'off', 'true', 'false', 'yes', 'no', 'undefined', 'null', '请选择', '请选择...', '--', '—', '无'];
    if (garbage.includes(lower)) return false;
    // 过滤纯符号/单字符垃圾值（如必填标记 *、•、● 等）
    if (/^[\*\•\●\#\-\_\+\=\×\÷]+$/.test(v.trim())) return false;
    // description / background 应该是较长的文本（至少 10 字符）
    if ((field === 'description' || field === 'background') && v.length < 10) return false;
    // reqId/reqName 至少要有实质内容
    if ((field === 'reqId' || field === 'reqName') && v.length <= 2) return false;
    // 值不应该看起来像标签名（避免匹配到了另一个字段的标签）
    // description / background 本身就可能以这些词开头，跳过该检查
    // 1) 精确匹配常见标签关键词（允许后面跟冒号/空格）
    const exactLabels = /^(需求编号|需求ID|需求单号|需求号|工单编号|工单ID|运营工单ID|编号|ID|需求名称|需求标题|需求主题|需求名|工单标题|提出人|创建人|申请人|提交人|创建者|作者|工单发布人|发布人|提出时间|创建时间|提交时间|发布时间|工单创建时间|创建日期|需求背景及目标|需求背景|项目背景|业务背景|背景|需求描述|详细描述|功能描述|描述|详细|工单内容)[：:\s]*$/;
    if (field !== 'description' && field !== 'background' && exactLabels.test(v)) return false;
    // 2) 通用标签前缀匹配（仅对短文本生效，避免误伤以“取消/新增/确认”等开头的需求名称）
    const labelLike = /^(需求|工单|关联|联系|处理|审批|状态|类型|优先级|创建|修改|申请|提交|指派|所属|归属|来源|影响|操作|管理|维护|查看|编辑|删除|新增|确认|取消|详情|附件|备注|意见|说明|描述|内容|标题|名称|编号|ID|状态)/;
    if (field !== 'description' && field !== 'background' && v.length <= 8 && labelLike.test(v)) return false;
    // 字段特定的严格过滤
    if (field === 'proposer') {
      // 提出人/发布人/创建人：应该是 2-4 个汉字的人名，或"姓名+工号"格式
      // 过滤掉明显不是人名的值
      const notPersonLike = /^(操作|管理|维护|查看|编辑|删除|新增|确认|取消|详情|附件|备注|意见|说明|描述|内容|标题|名称|编号|ID|状态|类型|优先级|创建|修改|申请|提交|指派|所属|归属|来源|影响|是|否|无|有|暂无|未|已|请|是$|否$|操作$|查询$|处理$|审批$)/;
      if (notPersonLike.test(v.trim())) return false;
      // 太短（只有 1-2 字符）且不像人名的拒绝
      if (v.length < 2) return false;
    }
    return true;
  }

  /** 多个元素取第一个有有效值的 */
  function getFirstValidValue(els, field) {
    const multiline = isMultilineField(field);
    for (const el of els) {
      const v = getValue(el, multiline);
      if (isValidValue(v, field)) return v;
    }
    return '';
  }

  /** 清理文本：保留换行，仅折叠空格/制表符/不间断空格 */
  function clean(text) {
    return (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t\u00a0\u3000]+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  /** 判断元素文本是否匹配关键词（支持 *需求编号 等前缀） */
  function matchKeyword(elText, keyword) {
    const t = elText.replace(/^[\*\•\●\#\s]+/, ''); // 去掉前导 *,•,●,# 及空白
    return t.includes(keyword);
  }

  /**
   * 解析 textarea 真实值：当 textarea 为空或仅含占位符时，
   * 尝试从同容器内的 hidden input 或 id 对应的 hidden input（如 req_detail$text -> req_detail$value）读取。
   * 适配 miniui 等框架的 readonly textarea 场景。
   */
  function resolveTextareaValue(ta) {
    if (!ta || ta.tagName.toLowerCase() !== 'textarea') return '';
    let v = clean(ta.value);
    if (v && v !== '*') return v;

    // 1) 根据 id 模式推测（miniui 常见：xxx$text 对应 xxx$value）
    const id = ta.id || '';
    if (id && id.includes('$text')) {
      const hiddenId = id.replace('$text', '$value');
      const hiddenById = document.getElementById(hiddenId);
      if (hiddenById && hiddenById.value && hiddenById.value !== '*') return hiddenById.value;
    }

    // 2) 同容器内及向上遍历查找 hidden input（处理 hidden input 与 textarea 不在同一 span 的情况）
    let container = ta.closest('.mini-textbox, .mini-textarea, td, div, span') || ta.parentElement;
    while (container && container !== document.body) {
      const hidden = container.querySelector('input[type="hidden"]');
      if (hidden && hidden.value && hidden.value !== '*') return hidden.value;
      container = container.parentElement;
    }

    return v;
  }

  // ============== 策略 1: CSS 选择器 ==============
  function tryCSSSelector(selectorList, field) {
    if (!selectorList) return '';
    const selectors = selectorList.split(',').map(s => s.trim()).filter(Boolean);
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        let v = clean(getValue(el, isMultilineField(field)));
        // 若匹配到空 textarea，尝试解析其 hidden input 真实值
        if (el && el.tagName && el.tagName.toLowerCase() === 'textarea' && (!v || v === '*')) {
          v = clean(resolveTextareaValue(el));
        }
        if (isValidValue(v, field)) return v;
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  // ============== 策略 2: label[for] → input[id] 配对 ==============
  function tryLabelFor(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const labelText = clean(label.textContent);
      for (const kw of kws) {
        if (!matchKeyword(labelText, kw)) continue;
        // label[for] → 对应 input
        const forId = label.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          const v = clean(getValue(target, isMultilineField(field)));
          if (isValidValue(v, field)) return v;
        }
        // label 包裹 input
        const nestedInput = label.querySelector('input:not([type="checkbox"]):not([type="radio"])');
        if (nestedInput) {
          const v = clean(getValue(nestedInput, isMultilineField(field)));
          if (isValidValue(v, field)) return v;
        }
      }
    }
    return '';
  }

  // ============== 策略 3: 表格行 tr>td 配对 ==============
  function tryTableRow(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td, th');
      for (let i = 0; i < cells.length; i++) {
        const cellText = clean(cells[i].textContent);
        for (const kw of kws) {
          if (!matchKeyword(cellText, kw)) continue;
          // 只从紧接着的下一个 cell 中找值
          for (let j = i + 1; j < cells.length; j++) {
            const container = cells[j];
            const valEl = container.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])') ||
                          container.querySelector('textarea, select') || container;
            let v = clean(getValue(valEl, isMultilineField(field)));
            // 若 textarea 为空，尝试从 hidden input 读取真实值
            if (valEl && valEl.tagName && valEl.tagName.toLowerCase() === 'textarea' && (!v || v === '*')) {
              v = clean(resolveTextareaValue(valEl));
            }
            if (isValidValue(v, field)) return v;
            // fallback：form 元素没有值时，直接取单元格可见文本
            if (!v) {
              const textV = clean(getValue(container, isMultilineField(field)));
              if (isValidValue(textV, field)) return textV;
            }
            // 如果这个 cell 也包含类似标签的文字，不要继续找
            if (clean(container.textContent).length < 20) break;
          }
        }
      }
    }
    return '';
  }

  // ============== 策略 4: 相邻元素配对（td/span/div 布局） ==============
  function tryAdjacentElement(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    
    // 收集所有包含关键词的文本节点，记录其父元素
    const candidates = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = clean(node.textContent);
      for (const kw of kws) {
        if (matchKeyword(text, kw) && text.length <= 15) {
          candidates.push(node.parentElement);
          break;
        }
      }
    }

    for (const labelEl of candidates) {
      if (!labelEl) continue;
      
      // 策略 A: 直接 nextElementSibling
      let sibling = labelEl.nextElementSibling;
      if (sibling) {
        const v = getFirstValidValue([
          sibling.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'),
          sibling.querySelector('textarea, select')
        ], field);
        if (v) return v;
        // 如果 sibling 是纯文本容器（span/div/p）
        const tag = sibling.tagName ? sibling.tagName.toLowerCase() : '';
        if (['span', 'div', 'p', 'td', 'dd'].includes(tag)) {
          const textV = clean(getValue(sibling, isMultilineField(field)));
          if (isValidValue(textV, field) && textV.length < 2000) {
            // 确认这不像标签
            let looksLikeValue = true;
            for (const kw of kws) {
              if (matchKeyword(textV, kw)) { looksLikeValue = false; break; }
            }
            if (looksLikeValue) return textV;
          }
        }
      }
      
      // 策略 B: 父元素的兄弟（处理 <td>*需求编号</td><td>值</td> 结构）
      const parent = labelEl.parentElement;
      if (parent) {
        const parentSibling = parent.nextElementSibling;
        if (parentSibling) {
          const v = getFirstValidValue([
            parentSibling.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'),
            parentSibling.querySelector('textarea, select')
          ], field);
          if (v) return v;
          // 纯文本
          const textV = clean(getValue(parentSibling, isMultilineField(field)));
          if (isValidValue(textV, field) && textV.length < 2000) {
            let looksLikeValue = true;
            for (const kw of kws) {
              if (matchKeyword(textV, kw)) { looksLikeValue = false; break; }
            }
            if (looksLikeValue) return textV;
          }
        }
      }
    }
    return '';
  }

  // ============== 策略 5: 在拥有特定 class 的容器中扫描 ==============
  function tryClassContainers(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    const containerPatterns = [
      '[class*="form"]', '[class*="field"]', '[class*="item"]',
      '[class*="row"]', '[class*="detail"]', '[class*="info"]',
      '[class*="group"]', '[class*="panel"]', '[class*="section"]',
      '.form-row', '.form-item', '.form-group',
      'fieldset', 'dl'
    ];
    const containers = document.querySelectorAll(containerPatterns.join(','));

    for (const container of containers) {
      const allEls = Array.from(container.querySelectorAll('td, th, label, span, div, dt, dd, p, li'));
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        const elText = clean(el.textContent);
        // 只匹配短的文本（标签通常是短文本）
        if (elText.length > 30) continue;
        for (const kw of kws) {
          if (!matchKeyword(elText, kw)) continue;
          // 从紧邻的下一个元素开始找值
          for (let j = i + 1; j < allEls.length; j++) {
            const nextEl = allEls[j];
            // 跳过也是标签的元素
            const nextText = clean(nextEl.textContent);
            if (nextText.length <= 20 && kws.some(k => matchKeyword(nextText, k))) {
              continue; // 这也是一个标签，跳过
            }
            const valEl = nextEl.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])') || 
                          nextEl.querySelector('textarea, select') || nextEl;
            let v = clean(getValue(valEl, isMultilineField(field)));
            // 若 textarea 为空，尝试从 hidden input 读取真实值
            if (valEl && valEl.tagName && valEl.tagName.toLowerCase() === 'textarea' && (!v || v === '*')) {
              v = clean(resolveTextareaValue(valEl));
            }
            if (isValidValue(v, field)) return v;
            // fallback：form 元素没有值时，直接取容器可见文本
            if (!v) {
              const textV = clean(getValue(nextEl, isMultilineField(field)));
              if (isValidValue(textV, field)) return textV;
            }
          }
        }
      }
    }
    return '';
  }

  // ============== 策略 6: textarea 内容提取（针对大段描述） ==============
  function tryTextareaContent(field) {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      // 使用 resolveTextareaValue 获取真实值（兼容 hidden input）
      const v = clean(resolveTextareaValue(ta));
      if (!v || v.length < 20) continue;
      // 尝试找到这个 textarea 前面的标签
      const labelEl = ta.closest('td')?.previousElementSibling ||
                      ta.closest('tr')?.querySelector('td:first-child, th') ||
                      ta.previousElementSibling;
      if (labelEl) {
        const labelText = clean(labelEl.textContent);
        const kws = FIELD_KEYWORDS[field] || [];
        for (const kw of kws) {
          if (matchKeyword(labelText, kw)) return v;
        }
      }
    }
    return '';
  }

  // ============== 策略 7: Element Plus 表单（需小依等）==============
  // 适配 .el-form-item__label + .el-form-item__content 布局，且内容常位于 iframe 中
  function tryElementPlusForm(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    const labels = document.querySelectorAll('.el-form-item__label');
    for (const label of labels) {
      const labelText = clean(label.textContent);
      if (labelText.length > 30) continue;
      let matchedKw = null;
      for (const kw of kws) {
        if (matchKeyword(labelText, kw)) {
          matchedKw = kw;
          break;
        }
      }
      if (!matchedKw) continue;

      // 优先取 label 的下一个兄弟 .el-form-item__content
      let content = null;
      if (label.nextElementSibling && label.nextElementSibling.classList.contains('el-form-item__content')) {
        content = label.nextElementSibling;
      } else {
        // 从父元素中查找 content
        const parent = label.parentElement;
        if (parent) {
          content = parent.querySelector('.el-form-item__content');
        }
      }
      if (!content) continue;

      const v = clean(getValue(content, isMultilineField(field)));
      if (v && v !== matchedKw && isValidValue(v, field) && v.length > 0) {
        return v;
      }
    }
    return '';
  }

  // ============== 策略 8: 工单系统专用（label+value 都是 td 的场景）==============
  // 适配 jlwzng 运营工单页面：label 和 value 都在同一个 tr 内，
  // label td 的文本恰好等于关键词，下一个 td 是 value
  function tryWorkorderTable(field) {
    const kws = FIELD_KEYWORDS[field] || [];
    const allTds = document.querySelectorAll('td');
    for (const labelTd of allTds) {
      const labelText = clean(labelTd.textContent);
      // 只考虑短文本（避免匹配到值）
      if (labelText.length > 30) continue;
      let matchedKw = null;
      for (const kw of kws) {
        // 使用 matchKeyword 支持 *需求描述:、需求描述：等前缀/后缀变体
        if (matchKeyword(labelText, kw)) {
          matchedKw = kw;
          break;
        }
      }
      if (!matchedKw) continue;

      // 找到下一个 td（水平方向）
      const tr = labelTd.closest('tr');
      if (!tr) continue;
      const tdsInTr = tr.querySelectorAll('td');
      const idx = Array.from(tdsInTr).indexOf(labelTd);
      for (let i = idx + 1; i < tdsInTr.length; i++) {
        const valTd = tdsInTr[i];

        // 1) 优先看 td 内的 input / textarea / select
        const inputEl = valTd.querySelector('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])') ||
                        valTd.querySelector('textarea, select');
        if (inputEl) {
          let v = clean(getValue(inputEl, isMultilineField(field)));
          // 若 textarea 为空，尝试从 hidden input 读取真实值
          if (inputEl.tagName && inputEl.tagName.toLowerCase() === 'textarea' && (!v || v === '*')) {
            v = clean(resolveTextareaValue(inputEl));
          }
          if (isValidValue(v, field)) return v;
        }

        // 2) 看 tinymce / contenteditable 富文本（工单内容常出现）
        const editable = valTd.querySelector('.mce-content-body, [contenteditable="true"]');
        if (editable) {
          const v = clean(getValue(editable, isMultilineField(field)));
          if (isValidValue(v, field) && v.length > 5) return v;
        }

        // 3) 普通文本（需要非空、非纯标签）
        const v = clean(getValue(valTd, isMultilineField(field)));
        if (v && v !== matchedKw && isValidValue(v, field) && v.length > 0) {
          // 如果文本太短（< 5）但不像标签，就接受
          if (v.length < 5) {
            // 短文本要确保不像另一个标签
            let isLabel = false;
            for (const otherKw of kws) {
              if (v === otherKw) { isLabel = true; break; }
            }
            if (!isLabel) return v;
          } else {
            return v;
          }
        }
      }
    }

    // 备选策略 B: 跨 tr 查找（工单内容常独占一整行，label 在上面的 tr）
    // 模式: tr1 [td label="工单内容" colspan=N], tr2 [td value ...]
    for (const tr of document.querySelectorAll('tr')) {
      const tds = tr.querySelectorAll('td');
      for (let i = 0; i < tds.length; i++) {
        const td = tds[i];
        const tdText = clean(td.textContent);
        let matchedKw = null;
        for (const kw of kws) {
          // 使用 matchKeyword 支持 *需求描述:、需求描述：等前缀/后缀变体
          if (matchKeyword(tdText, kw)) {
            matchedKw = kw;
            break;
          }
        }
        if (!matchedKw) continue;
        // 检查 colspan：如果 label 跨整行，下一 tr 就是 value
        const colspan = parseInt(td.getAttribute('colspan') || '1');
        const trTdsCount = tds.length;
        if (colspan >= trTdsCount || (trTdsCount === 1 && td === tds[0])) {
          // 找下一个 tr
          const nextTr = tr.nextElementSibling;
          if (nextTr && nextTr.tagName === 'TR') {
            const nextTrVal = nextTr.querySelector('td');
            if (nextTrVal) {
              // 优先 contenteditable 富文本
              const editable = nextTrVal.querySelector('.mce-content-body, [contenteditable="true"]');
              if (editable) {
                const v = clean(getValue(editable, isMultilineField(field)));
                if (isValidValue(v, field) && v.length > 5) return v;
              }
              // 再看 textarea 及其 hidden input 真实值
              const ta = nextTrVal.querySelector('textarea');
              if (ta) {
                const v = clean(resolveTextareaValue(ta));
                if (isValidValue(v, field) && v.length > 5) return v;
              }
              const v = clean(getValue(nextTrVal, isMultilineField(field)));
              if (isValidValue(v, field) && v.length > 5) return v;
            }
          }
        }
      }
    }
    return '';
  }

  // ============== 主提取流程 ==============
  const fields = ['reqId', 'reqName', 'proposer', 'proposeTime', 'background', 'description'];
  const result = {};

  for (const field of fields) {
    const selectorList = (rules && rules[field]) || '';
    
    // 按优先级尝试各个策略
    const strategies = [
      () => tryCSSSelector(selectorList, field),
      () => tryLabelFor(field),
      () => tryTableRow(field),
      () => tryElementPlusForm(field),   // Element Plus 表单（需小依等）
      () => tryWorkorderTable(field),    // 工单系统专用（jlwzng 等）
      () => tryAdjacentElement(field),
      () => tryClassContainers(field),
      () => tryTextareaContent(field)
    ];

    let value = '';
    for (const strategy of strategies) {
      value = strategy();
      if (value) break;
    }
    result[field] = value;
  }

  return result;
}

/**
 * 显示提取结果
 */
async function displayResults(data) {
  _extractedData = data;

  const fields = {
    'field-req-id': data.reqId,
    'field-req-name': data.reqName,
    'field-proposer': data.proposer,
    'field-propose-time': data.proposeTime,
    'field-background': data.background,
    'field-description': data.description
  };

  let hasContent = false;
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (value) {
      el.textContent = value;
      el.classList.remove('empty');
      hasContent = true;
    } else {
      el.textContent = '（未提取到）';
      el.classList.add('empty');
    }
  }

  document.getElementById('extract-result-card').style.display = 'block';

  if (hasContent) {
    document.getElementById('email-card').style.display = 'block';
    await updateEmailPreview(data);
  }

  showToast(hasContent ? '✅ 信息提取成功！' : '⚠️ 部分字段未提取到，请检查提取规则', hasContent ? 'success' : '');
}

// ==================== 邮件预览 ====================
// 全局：当前邮件的纯文本和 HTML 内容
let _emailPlainText = '';
let _emailHtml = '';

async function updateEmailPreview(data) {
  const clarify = document.getElementById('requirement-clarify')?.value?.trim();
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const sig = smtpConfig?.signature || '';

  // ---- 纯文本版本 ----
  const t = [];
  t.push('需求信息详情');
  t.push('='.repeat(40));
  if (data.reqId) t.push(`需求编号：${data.reqId}`);
  if (data.reqName) t.push(`需求名称：${data.reqName}`);
  if (data.proposer) t.push(`提出人：${data.proposer}`);
  if (data.proposeTime) t.push(`提出时间：${data.proposeTime}`);
  if (data.background) t.push(`\n需求背景及目标：\n${data.background}`);
  if (data.description) t.push(`\n需求描述：\n${data.description}`);
  if (clarify) t.push(`\n需求澄清：\n${clarify}`);
  if (sig) t.push(`\n---\n${sig.replace(/<br\s*\/?>/gi, '\n')}`);
  _emailPlainText = t.join('\n');

  // ---- 美观 HTML 版本 ----
  const row = (label, value) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top;width:90px;color:#888;font-size:13px;white-space:nowrap;">${escHtml(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#333;font-size:14px;line-height:1.6;">${escHtml(value).replace(/\n/g, '<br>')}</td>
    </tr>`;

  const rows = [];
  if (data.reqId) rows.push(row('需求编号', data.reqId));
  if (data.reqName) rows.push(row('需求名称', data.reqName));
  if (data.proposer) rows.push(row('提出人', data.proposer));
  if (data.proposeTime) rows.push(row('提出时间', data.proposeTime));
  if (data.background) rows.push(row('需求背景及目标', data.background));
  if (data.description) rows.push(row('需求描述', data.description));
  if (clarify) rows.push(row('需求澄清', clarify));

  _emailHtml = [
    '<div style="font-family:Segoe UI,Microsoft YaHei,Arial,sans-serif;font-size:14px;color:#333;max-width:640px;margin:0 auto;padding:0;">',
    '  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">',
    '    <tr>',
    '      <td style="background:linear-gradient(135deg,#1a73e8 0%,#4285f4 100%);color:#fff;padding:16px 20px;font-size:15px;font-weight:600;">需求评估信息</td>',
    '    </tr>',
    '    <tr>',
    '      <td style="padding:16px 20px;">',
    '        <table cellpadding="0" cellspacing="0" border="0" width="100%">',
                  rows.join('\n'),
    '        </table>',
    '      </td>',
    '    </tr>',
    sig ? `    <tr><td style="padding:0 20px 16px 20px;"><div style="padding-top:12px;border-top:1px solid #e8eaed;color:#666;font-size:13px;line-height:1.6;">${sig}</div></td></tr>` : '',
    '  </table>',
    '</div>',
  ].join('\n');

  document.getElementById('email-preview').innerHTML = _emailHtml;

  // 更新邮件主题
  const subject = document.getElementById('email-subject');
  if (!subject.value || subject.value === subject.defaultValue) {
    subject.value = data.reqName
      ? `【需求评估】${data.reqName}`
      : '【需求评估】';
  }
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== 附件管理 ====================
function renderAttachmentList() {
  const container = document.getElementById('attachment-list');
  if (_attachments.length === 0) {
    container.innerHTML = '<div class="empty-hint" style="padding:8px;">暂无附件</div>';
    return;
  }
  container.innerHTML = _attachments.map((file, i) => {
    const sizeStr = file.size < 1024 * 1024
      ? `${(file.size / 1024).toFixed(1)} KB`
      : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    return `
      <div class="attachment-item">
        <span class="file-name" title="${escHtml(file.name)}">📄 ${escHtml(file.name)}</span>
        <span class="file-size">${sizeStr}</span>
        <button class="btn-icon" data-attach-idx="${i}" title="移除">✕</button>
      </div>
    `;
  }).join('');

  // 绑定移除按钮
  container.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.attachIdx);
      _attachments.splice(idx, 1);
      renderAttachmentList();
    });
  });
}

function addAttachments(files) {
  for (const file of files) {
    // 检查重复（按名称+大小）
    const dup = _attachments.some(a => a.name === file.name && a.size === file.size);
    if (!dup) _attachments.push(file);
  }
  renderAttachmentList();
}

/**
 * 将 File 对象转换为 base64 字符串
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result 格式: "data:*/*;base64,xxxxx"
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== 发送邮件（本地 SMTP 直发）====================
async function sendDirect() {
  const selected = getSelectedRecipients();
  if (selected.length === 0) {
    showToast('请至少选择一个收件人', 'error');
    return;
  }

  // 读取 SMTP 配置
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const cfg = { ...smtpConfig };
  if (cfg.pass) cfg.pass = await decrypt(cfg.pass);
  if (!cfg || !cfg.host || !cfg.user || !cfg.pass) {
    showToast('请先在「邮箱设置」中配置 SMTP 信息', 'error');
    return;
  }

  // 检测本地服务器是否在线
  const serverOnline = await checkRelayServer();
  if (!serverOnline) {
    showToast('❌ 本地邮件服务器未启动，请先运行 start-server.bat', 'error');
    return;
  }

  const to = selected.map(r => `${r.name || ''} <${r.email}>`).join(', ');
  const cc = document.getElementById('cc-emails').value.trim();
  const subject = document.getElementById('email-subject').value.trim() || '【需求评估】';
  const text = _emailPlainText || '';
  const html = _emailHtml || '';

  const btn = document.getElementById('btn-send-direct');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 发送中...';
  showToast('⏳ 正在通过本地服务器发送邮件...', 'info');

  try {
    // 将附件转为 base64
    let attachments = [];
    if (_attachments.length > 0) {
      for (const file of _attachments) {
        const content = await fileToBase64(file);
        attachments.push({
          filename: file.name,
          content: content,
          contentType: file.type || 'application/octet-stream'
        });
      }
    }

    const response = await fetch(`${RELAY_SERVER}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to,
        cc: cc,
        subject: subject,
        body: text,
        html: html,
        attachments: attachments,
        smtp: {
          host: cfg.host,
          port: cfg.port || 465,
          secure: cfg.secure !== false,
          user: cfg.user,
          pass: cfg.pass,
          imapHost: cfg.imapHost,
          imapPort: cfg.imapPort || 993
        }
      })
    });

    const result = await response.json();
    if (result.success) {
      showToast('✅ 邮件发送成功！', 'success');

      // 显示 IMAP 已发送存档状态
      if (result.imap) {
        if (result.imap.success) {
          console.log('[IMAP] ✅ 已存档到已发送文件夹');
        } else {
          showToast('⚠️ 邮件已发送，但存档到已发送文件夹失败：' + result.imap.message, 'error');
          console.warn('[IMAP] ❌ 存档失败:', result.imap.message);
        }
      }

      // 发送成功后写入数据库
      const selected = getSelectedRecipients();
      const clarification = document.getElementById('requirement-clarify').value.trim();
      const now = new Date();
      const sendDateTime = now.toLocaleString('zh-CN', { hour12: false });

      for (const recipient of selected) {
        await writeToDatabase({
          reqId: _extractedData.reqId || '',
          reqName: _extractedData.reqName || '',
          proposer: _extractedData.proposer || '',
          proposeTime: _extractedData.proposeTime || '',
          involveDev: '是',
          background: _extractedData.background || '',
          description: _extractedData.description || '',
          clarification: clarification,
          system: recipient.system || '',
          sa: recipient.name || '',
          sendDateTime: sendDateTime
        });
      }
    } else {
      showToast('❌ 发送失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (e) {
    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      showToast('❌ 无法连接到本地邮件服务器，请确认已启动 start-server.bat', 'error');
    } else {
      showToast('❌ 发送失败: ' + e.message, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ==================== 检测本地中继服务器 ====================
async function checkRelayServer() {
  try {
    const resp = await fetch(`${RELAY_SERVER}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await resp.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

// ==================== 发送邮件（mailto 协议）====================
function sendViaMailto() {
  const selected = getSelectedRecipients();
  if (selected.length === 0) {
    showToast('请至少选择一个收件人', 'error');
    return;
  }

  const to = selected.map(r => r.email).join(',');
  const cc = document.getElementById('cc-emails').value.trim();
  const subject = document.getElementById('email-subject').value.trim() || '需求信息';
  const body = _emailPlainText || document.getElementById('email-preview').textContent || '';

  // 构建 mailto URL
  let mailto = `mailto:${encodeURIComponent(to)}`;
  const params = [];
  params.push(`subject=${encodeURIComponent(subject)}`);
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  params.push(`body=${encodeURIComponent(body)}`);
  mailto += '?' + params.join('&');

  // 打开默认邮件客户端
  chrome.tabs.create({ url: mailto, active: false }, (tab) => {
    // 延迟关闭此标签页，让邮件客户端有时间打开
    setTimeout(() => {
      chrome.tabs.remove(tab.id).catch(() => {});
    }, 1000);
  });

  showToast('✅ 已打开邮件客户端，请确认发送', 'success');
}

// ==================== 复制邮件内容 ====================
function copyEmailContent() {
  const content = _emailPlainText || document.getElementById('email-preview').textContent || '';
  navigator.clipboard.writeText(content).then(() => {
    showToast('✅ 邮件内容已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败，请手动复制', 'error');
  });
}

// ==================== 收件人管理 ====================
async function loadContacts() {
  // 优先从数据库 sa_info 表加载收件人
  let dbContacts = null;
  let dbError = null;
  try {
    const dbConfig = await getDecryptedDbConfig();
    if (dbConfig.host && dbConfig.user && dbConfig.database) {
      const response = await fetch(`${RELAY_SERVER}/query-sa-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbConfig })
      });
      const result = await response.json();
      console.log('[Contacts] 数据库查询结果:', result);
      if (result.success && result.contacts) {
        dbContacts = result.contacts;
        console.log(`[Contacts] 从数据库加载了 ${dbContacts.length} 个收件人`);
      } else if (!result.success) {
        dbError = result.error;
        console.warn('[Contacts] 数据库查询失败:', result.error);
      } else {
        dbError = '返回数据格式错误';
        console.warn('[Contacts] 返回数据格式错误:', result);
      }
    } else {
      dbError = '数据库配置不完整，请先在「MySQL 数据库设置」中保存配置';
      console.warn('[Contacts] 数据库配置不完整:', dbConfig);
    }
  } catch (e) {
    dbError = e.message === 'Failed to fetch'
      ? '本地邮件服务器未启动或无法连接（请双击运行 local-smtp-server/start-server.bat）'
      : e.message;
    console.warn('[Contacts] 从数据库加载失败，使用本地联系人:', e.message);
  }

  // 数据库加载成功，使用数据库数据
  if (dbContacts) {
    window._cachedContacts = dbContacts;
    window._contactsFromDb = true;
    renderContactList(dbContacts);
    renderRecipientOptions(dbContacts);
    return;
  }

  // 显示数据库加载失败的原因
  if (dbError) {
    showToast('⚠️ 从数据库加载失败：' + dbError, 'error');
  }

  // 数据库加载失败，降级到本地存储
  let { contacts = [] } = await chrome.storage.local.get('contacts');
  if (!contacts || contacts.length === 0) {
    try {
      const resp = await fetch(chrome.runtime.getURL('default_contacts.json'));
      contacts = await resp.json();
      await chrome.storage.local.set({ contacts });
    } catch (e) {
      // 默认文件不存在时忽略
    }
  }

  window._cachedContacts = contacts;
  window._contactsFromDb = false;
  renderContactList(contacts);
  renderRecipientOptions(contacts);
}

function renderContactList(contacts) {
  const container = document.getElementById('contact-list');
  const countEl = document.getElementById('contact-count');
  const sourceEl = document.getElementById('contact-source');

  // 更新数据来源标签
  if (sourceEl) {
    if (window._contactsFromDb) {
      sourceEl.textContent = '数据库';
      sourceEl.style.background = '#e8f0fe';
      sourceEl.style.color = '#1a73e8';
    } else {
      sourceEl.textContent = '本地';
      sourceEl.style.background = '#f1f3f4';
      sourceEl.style.color = '#5f6368';
    }
  }

  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<div class="empty-hint">暂无联系人，请导入 Excel 或手动添加</div>';
    countEl.textContent = '0人';
    return;
  }

  countEl.textContent = `${contacts.length}人`;
  container.innerHTML = contacts.map((c, i) => `
    <div class="contact-item" data-index="${i}">
      <div class="contact-avatar" style="background: ${getAvatarColor(i)}">
        ${c.name ? c.name.charAt(0) : '?'}
      </div>
      <div class="contact-detail">
        <div class="name">${escHtml(c.name || '未知')}</div>
        <div class="email">${escHtml(c.email || '')}</div>
        ${c.system ? `<div class="system">📌 ${escHtml(c.system)}</div>` : ''}
        ${c.wechatNickname ? `<div class="wechat">💬 ${escHtml(c.wechatNickname)}</div>` : ''}
      </div>
      <div class="contact-actions">
        <button class="btn-icon btn-edit-contact" data-index="${i}" title="编辑">✏️</button>
        <button class="btn-icon btn-delete-contact" data-index="${i}" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');

  // 绑定编辑按钮
  container.querySelectorAll('.btn-edit-contact').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startEditContact(parseInt(btn.dataset.index));
    });
  });

  // 绑定删除按钮
  container.querySelectorAll('.btn-delete-contact').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteContact(parseInt(btn.dataset.index));
    });
  });
}

// ==================== 收件人 CRUD ====================
// 在手动添加卡片内显示提示
function showAddContactMsg(message, type) {
  const el = document.getElementById('add-contact-msg');
  el.textContent = message;
  el.className = 'add-contact-msg ' + (type || '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'add-contact-msg'; }, 3000);
}

async function addContact() {
  try {
  const name = document.getElementById('add-contact-name').value.trim();
  const system = document.getElementById('add-contact-system').value.trim();
  const email = document.getElementById('add-contact-email').value.trim();
  const wechatNickname = document.getElementById('add-contact-wechat').value.trim();

  if (!name) { showAddContactMsg('请输入姓名', 'error'); return; }
  if (!email) { showAddContactMsg('请输入邮箱', 'error'); return; }
  if (!email.includes('@')) { showAddContactMsg('请输入正确的邮箱地址', 'error'); return; }

  // 如果收件人来自数据库，同步写入 sa_info 表
  if (window._contactsFromDb) {
    const dbConfig = await getDecryptedDbConfig();
    // 先检查同名同系统是否重复
    try {
      const checkResp = await fetch(`${RELAY_SERVER}/check-sa-info-duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbConfig, sa_name: name, system_name: system })
      });
      const checkResult = await checkResp.json();
      if (checkResult.success && checkResult.exists) {
        showAddContactMsg(`同一系统「${system}」下已存在姓名「${name}」`, 'error');
        return;
      }
    } catch (e) {
      showAddContactMsg('❌ 检查重复失败：' + e.message, 'error');
      return;
    }
    // 写入数据库
    try {
      const addResp = await fetch(`${RELAY_SERVER}/add-sa-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbConfig, sa_name: name, system_name: system, email, wechat_nickname: wechatNickname })
      });
      const addResult = await addResp.json();
      if (!addResult.success) {
        showAddContactMsg('❌ 写入数据库失败：' + (addResult.error || '未知错误'), 'error');
        return;
      }
    } catch (e) {
      showAddContactMsg('❌ 写入数据库失败：' + e.message, 'error');
      return;
    }
    // 重新从数据库加载
    showAddContactMsg('✅ 已添加到数据库，正在刷新...', 'success');
    await loadContacts();
    // 清空表单
    document.getElementById('add-contact-name').value = '';
    document.getElementById('add-contact-email').value = '';
    document.getElementById('add-contact-wechat').value = '';
    return;
  }

  // 本地模式：检查重复
  const dup = window._cachedContacts.some(c => c.email === email);
  if (dup) { showAddContactMsg('该邮箱已存在', 'error'); return; }

  window._cachedContacts.push({ name, system, email });
  await chrome.storage.local.set({ contacts: window._cachedContacts });

  // 清空表单
  document.getElementById('add-contact-name').value = '';
  document.getElementById('add-contact-system').value = '';
  document.getElementById('add-contact-email').value = '';

  renderContactList(window._cachedContacts);
  renderRecipientOptions(window._cachedContacts);
  showAddContactMsg('✅ 已添加', 'success');
  } catch (err) {
    console.error('[addContact] 错误:', err);
    showAddContactMsg('❌ 添加失败：' + err.message, 'error');
  }
}

function startEditContact(index) {
  const c = window._cachedContacts[index];
  const container = document.getElementById('contact-list');
  const originalHTML = container.innerHTML;

  // 替换该行为编辑表单
  const allItems = container.querySelectorAll('.contact-item');
  const targetItem = allItems[index];
  targetItem.outerHTML = `
    <div class="contact-item contact-item-editing" data-index="${index}">
      <div class="contact-avatar" style="background: ${getAvatarColor(index)}">
        ${c.name ? c.name.charAt(0) : '?'}
      </div>
      <div class="contact-edit-form">
        <input type="text" class="input input-sm" id="edit-name-${index}" value="${escHtml(c.name || '')}" placeholder="姓名">
        <input type="text" class="input input-sm" id="edit-system-${index}" value="${escHtml(c.system || '')}" placeholder="系统">
        <input type="email" class="input input-sm" id="edit-email-${index}" value="${escHtml(c.email || '')}" placeholder="邮箱">
        <input type="text" class="input input-sm" id="edit-wechat-${index}" value="${escHtml(c.wechatNickname || '')}" placeholder="微信昵称（选填）">
      </div>
      <div class="contact-actions">
        <button class="btn-icon btn-save-contact" data-index="${index}" title="保存">✅</button>
        <button class="btn-icon btn-cancel-edit" data-index="${index}" title="取消">❌</button>
      </div>
    </div>
  `;

  // 绑定保存
  container.querySelector('.btn-save-contact').addEventListener('click', () => saveEditContact(index));
  // 绑定取消
  container.querySelector('.btn-cancel-edit').addEventListener('click', () => {
    renderContactList(window._cachedContacts);
  });
  // 回车保存
  container.querySelector(`#edit-email-${index}`).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEditContact(index);
  });
}

async function saveEditContact(index) {
  const name = document.getElementById(`edit-name-${index}`).value.trim();
  const system = document.getElementById(`edit-system-${index}`).value.trim();
  const email = document.getElementById(`edit-email-${index}`).value.trim();
  const wechatNickname = document.getElementById(`edit-wechat-${index}`).value.trim();

  if (!name) { showToast('请输入姓名', 'error'); return; }
  if (!email) { showToast('请输入邮箱', 'error'); return; }
  if (!email.includes('@')) { showToast('请输入正确的邮箱地址', 'error'); return; }

  // 如果收件人来自数据库，同步更新 sa_info 表
  if (window._contactsFromDb) {
    const old = window._cachedContacts[index];
    const dbConfig = await getDecryptedDbConfig();
    try {
      const resp = await fetch(`${RELAY_SERVER}/update-sa-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbConfig,
          old_name: old.name,
          old_system: old.system,
          old_email: old.email,
          sa_name: name,
          system_name: system,
          email: email,
          wechat_nickname: wechatNickname
        })
      });
      const result = await resp.json();
      if (!result.success) {
        showToast('❌ 更新数据库失败：' + result.error, 'error');
        return;
      }
    } catch (e) {
      showToast('❌ 更新数据库失败：' + e.message, 'error');
      return;
    }
    showToast('✅ 已更新到数据库，正在刷新...', 'success');
    await loadContacts();
    return;
  }

  // 本地模式：检查重复（排除自身）
  const dup = window._cachedContacts.some((c, i) => i !== index && c.email === email);
  if (dup) { showToast('该邮箱已存在', 'error'); return; }

  window._cachedContacts[index] = { name, system, email, wechatNickname };
  await chrome.storage.local.set({ contacts: window._cachedContacts });

  renderContactList(window._cachedContacts);
  renderRecipientOptions(window._cachedContacts);
  showToast('✅ 已保存', 'success');
}

async function deleteContact(index) {
  const c = window._cachedContacts[index];
  if (!confirm(`确定要删除「${c.name}」吗？`)) return;

  // 如果收件人来自数据库，同步删除 sa_info 表中的记录
  if (window._contactsFromDb) {
    const dbConfig = await getDecryptedDbConfig();
    try {
      const resp = await fetch(`${RELAY_SERVER}/delete-sa-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbConfig,
          sa_name: c.name,
          system_name: c.system,
          email: c.email
        })
      });
      const result = await resp.json();
      if (!result.success) {
        showToast('⚠️ 删除数据库记录失败：' + result.error, 'error');
      }
    } catch (e) {
      console.warn('[DB] 删除数据库记录失败:', e.message);
    }
    // 重新从数据库加载
    await loadContacts();
    return;
  }

  window._cachedContacts.splice(index, 1);
  await chrome.storage.local.set({ contacts: window._cachedContacts });

  renderContactList(window._cachedContacts);
  renderRecipientOptions(window._cachedContacts);
  showToast('✅ 已删除', 'success');
}

function renderRecipientOptions(contacts) {
  const container = document.getElementById('recipient-list');

  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<div class="empty-hint">请先在「收件人管理」中导入联系人</div>';
    return;
  }

  // 按系统排序
  const sorted = [...contacts].sort((a, b) => {
    const sysA = (a.system || '其他').trim();
    const sysB = (b.system || '其他').trim();
    return sysA.localeCompare(sysB, 'zh') || (a.name || '').localeCompare(b.name || '', 'zh');
  });

  // 按系统分组
  const groups = {};
  sorted.forEach((c, i) => {
    const system = (c.system || '其他').trim();
    if (!groups[system]) groups[system] = [];
    groups[system].push({ ...c, _idx: contacts.indexOf(c) });
  });

  let html = '';

  // 全选行
  html += `
    <div class="recipient-card" style="margin-bottom:8px;">
      <div class="recipient-card-header" style="background:#1a73e8;color:#fff;padding:6px 12px;font-size:12px;font-weight:600;border-radius:6px 6px 0 0;">
        全选 / 取消全选
      </div>
      <div class="recipient-card-body" style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;padding:8px;">
        <label class="recipient-grid-item recipient-select-all-label" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#1a73e8;padding:4px 8px;">
          <input type="checkbox" id="checkbox-select-all" class="recipient-checkbox" style="accent-color:#1a73e8;">
          <span>全选 / 取消全选</span>
        </label>
      </div>
    </div>
  `;

  // 每个系统一个卡片 — 外套 3 列网格容器
  html += '<div class="recipient-card-grid">';

  // 卡片标题栏颜色池
  const headerColors = ['#1a73e8', '#e8710a', '#0d904f', '#9334e6', '#d93025', '#188038', '#c5221f', '#1967d2', '#ea8600', '#a142f4'];

  let colorIdx = 0;
  for (const [system, members] of Object.entries(groups)) {
    const color = headerColors[colorIdx % headerColors.length];
    colorIdx++;
    html += `
      <div class="recipient-card">
        <div class="recipient-card-header" style="background:${color};">${system}</div>
        <div class="recipient-card-body">
          <div class="recipient-grid">
    `;

    members.forEach(m => {
      html += `
            <div class="recipient-grid-item">
              <input type="checkbox" value="${m._idx}" class="recipient-checkbox">
              <span class="recipient-grid-name">${m.name || '未知'}</span>
            </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;
  }

  html += '</div>';

  container.innerHTML = html;

  // 全选逻辑
  const selectAllCb = document.getElementById('checkbox-select-all');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      container.querySelectorAll('.recipient-checkbox').forEach(cb => {
        if (cb.id !== 'checkbox-select-all') {
          cb.checked = selectAllCb.checked;
          cb.closest('.recipient-grid-item').classList.toggle('selected', cb.checked);
        }
      });
    });
  }

  // 勾选框变化
  container.querySelectorAll('.recipient-checkbox').forEach(cb => {
    if (cb.id !== 'checkbox-select-all') {
      cb.addEventListener('change', () => {
        cb.closest('.recipient-grid-item').classList.toggle('selected', cb.checked);
        syncSelectAll();
      });
    }
  });

  // 点击整行切换选中
  container.querySelectorAll('.recipient-grid-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const cb = item.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      item.classList.toggle('selected', cb.checked);
      syncSelectAll();
    });
  });
}

function syncSelectAll() {
  const allCb = document.getElementById('checkbox-select-all');
  if (!allCb) return;
  const checkboxes = document.querySelectorAll('.recipient-checkbox:not(#checkbox-select-all)');
  const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
  allCb.checked = allChecked;
}

function getSelectedRecipients() {
  const contacts = window._cachedContacts || [];
  const checkboxes = document.querySelectorAll('.recipient-checkbox:checked');
  const selected = [];
  checkboxes.forEach(cb => {
    const idx = parseInt(cb.value);
    if (contacts[idx]) selected.push(contacts[idx]);
  });
  return selected;
}

// ==================== Excel 导入 ====================
async function importExcelFile(file) {
  try {
    const data = await readExcelFile(file);
    const contacts = parseExcelData(data);
    if (contacts.length === 0) {
      showToast('Excel 文件中未找到有效数据，请确保包含：姓名、邮箱列', 'error');
      return;
    }

    // 合并或替换
    const { contacts: existing = [] } = await chrome.storage.local.get('contacts');
    const merged = [...existing];
    for (const c of contacts) {
      const exists = merged.find(e => e.email === c.email);
      if (!exists) merged.push(c);
    }

    await chrome.storage.local.set({ contacts: merged });
    window._cachedContacts = merged;
    renderContactList(merged);
    renderRecipientOptions(merged);
    showToast(`✅ 成功导入 ${contacts.length} 个联系人`, 'success');
  } catch (e) {
    console.error('导入失败:', e);
    showToast('导入失败: ' + e.message, 'error');
  }
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function parseExcelData(rows) {
  if (!rows || rows.length < 2) return [];

  // 查找表头行，识别 name/email 列
  const headerRow = rows[0];
  let nameCol = -1, emailCol = -1, systemCol = -1;

  headerRow.forEach((cell, i) => {
    const val = String(cell || '').toLowerCase().trim();
    if (val.includes('name') || val.includes('姓名') || val.includes('名字') || val.includes('名称')) {
      nameCol = i;
    } else if (val.includes('email') || val.includes('邮箱') || val.includes('邮件') || val.includes('mail')) {
      emailCol = i;
    } else if (val.includes('system') || val.includes('系统') || val.includes('部门') || val.includes('组')) {
      systemCol = i;
    }
  });

  // 如果没找到 email 列，尝试在所有列中找包含 @ 的列
  if (emailCol === -1) {
    for (let row = 1; row < Math.min(rows.length, 20); row++) {
      for (let col = 0; col < (rows[row] || []).length; col++) {
        const val = String(rows[row][col] || '');
        if (val.includes('@')) {
          emailCol = col;
          break;
        }
      }
      if (emailCol !== -1) break;
    }
  }

  if (emailCol === -1) {
    throw new Error('未找到邮箱列，请确保 Excel 包含邮箱信息');
  }

  // 解析数据行
  const contacts = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[emailCol]) continue;
    const email = String(row[emailCol]).trim();
    if (!email.includes('@')) continue;

    contacts.push({
      name: nameCol !== -1 ? String(row[nameCol] || '').trim() : '',
      email: email,
      system: systemCol !== -1 ? String(row[systemCol] || '').trim() : ''
    });
  }

  return contacts;
}

// ==================== 默认文件加载 ====================
async function loadDefaultExcel() {
  try {
    const response = await fetch(chrome.runtime.getURL('default_contacts.json'));
    if (!response.ok) throw new Error('默认文件不存在');
    const contacts = await response.json();
    await chrome.storage.local.set({ contacts });
    window._cachedContacts = contacts;
    renderContactList(contacts);
    renderRecipientOptions(contacts);
    showToast(`✅ 已加载 ${contacts.length} 个默认联系人`, 'success');
  } catch (e) {
    // 如果默认文件不存在，则提示
    showToast('请通过 Excel 文件导入联系人', 'error');
  }
}

// ==================== 导出联系人到 Excel ====================
function exportContactsToExcel() {
  const contacts = window._cachedContacts || [];
  if (contacts.length === 0) {
    showToast('没有可导出的联系人', 'error');
    return;
  }

  // 构建二维数组：[表头, ...数据行]
  const rows = [['姓名', '系统', '邮箱']];
  for (const c of contacts) {
    rows.push([c.name || '', c.system || '', c.email || '']);
  }

  // 用 SheetJS 生成 xlsx
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // 设置列宽
  ws['!cols'] = [
    { wch: 12 },  // 姓名
    { wch: 20 },  // 系统
    { wch: 35 },  // 邮箱
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '收件人');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `收件人_${dateStr}.xlsx`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`✅ 已导出 ${contacts.length} 个联系人`, 'success');
}

// ==================== 提取规则管理（UI 已隐藏，保留存储读取供内部使用）====================
async function loadRules() {
  const { rules = DEFAULT_RULES } = await chrome.storage.local.get('rules');
  const reqIdEl = document.getElementById('rule-req-id');
  if (!reqIdEl) return; // 规则页面已隐藏
  reqIdEl.value = rules.reqId || '';
  document.getElementById('rule-req-name').value = rules.reqName || '';
  document.getElementById('rule-proposer').value = rules.proposer || '';
  document.getElementById('rule-background').value = rules.background || '';
  document.getElementById('rule-description').value = rules.description || '';
  document.getElementById('rule-url-patterns').value = (rules.urlPatterns || []).join('\n');
}

// ==================== SMTP 配置管理 ====================
async function loadSmtpConfig() {
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const cfg = { ...DEFAULT_SMTP, ...smtpConfig };
  // 解密密码字段
  if (cfg.pass) cfg.pass = await decrypt(cfg.pass);
  document.getElementById('smtp-host').value = cfg.host || '';
  document.getElementById('smtp-port').value = cfg.port || 465;
  document.getElementById('smtp-secure').checked = cfg.secure !== false;
  document.getElementById('smtp-user').value = cfg.user || '';
  document.getElementById('smtp-pass').value = cfg.pass || '';
  // IMAP 配置
  document.getElementById('imap-host').value = cfg.imapHost || '';
  document.getElementById('imap-port').value = cfg.imapPort || 993;
  // 邮件签名
  document.getElementById('email-signature').value = cfg.signature || '';
  // 默认抄送邮箱
  document.getElementById('default-cc').value = cfg.defaultCc || '';
  // 抄送输入框默认值
  const ccEl = document.getElementById('cc-emails');
  if (!ccEl.value.trim()) {
    ccEl.value = cfg.defaultCc || '';
  }

  // 检测服务器状态
  updateServerStatus();
}

async function saveSmtpConfig() {
  const config = {
    host: document.getElementById('smtp-host').value.trim(),
    port: parseInt(document.getElementById('smtp-port').value) || 465,
    secure: document.getElementById('smtp-secure').checked,
    user: document.getElementById('smtp-user').value.trim(),
    pass: document.getElementById('smtp-pass').value,
    imapHost: document.getElementById('imap-host').value.trim(),
    imapPort: parseInt(document.getElementById('imap-port').value) || 993,
    signature: document.getElementById('email-signature').value
  };

  if (!config.host || !config.user || !config.pass) {
    showToast('请填写 SMTP 服务器、账号和密码/授权码', 'error');
    return;
  }

  // 加密敏感字段后再存储
  config.pass = await encrypt(config.pass);

  await chrome.storage.local.set({ smtpConfig: config });
  showToast('✅ 邮箱设置已保存', 'success');
}

async function saveSignature() {
  const signature = document.getElementById('email-signature').value;
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const config = { ...smtpConfig, signature };
  await chrome.storage.local.set({ smtpConfig: config });
  showToast('✅ 邮件签名已保存', 'success');
}

async function clearSignature() {
  document.getElementById('email-signature').value = '';
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const config = { ...smtpConfig, signature: '' };
  await chrome.storage.local.set({ smtpConfig: config });
  showToast('🗑️ 邮件签名已清空', 'success');
}

async function saveDefaultCc() {
  const defaultCc = document.getElementById('default-cc').value.trim();
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const config = { ...smtpConfig, defaultCc };
  await chrome.storage.local.set({ smtpConfig: config });
  showToast('✅ 默认抄送邮箱已保存', 'success');
}

async function clearDefaultCc() {
  document.getElementById('default-cc').value = '';
  const { smtpConfig } = await chrome.storage.local.get('smtpConfig');
  const config = { ...smtpConfig, defaultCc: '' };
  await chrome.storage.local.set({ smtpConfig: config });
  // 同步清空发送页面的抄送栏
  const ccEl = document.getElementById('cc-emails');
  if (ccEl) ccEl.value = '';
  showToast('🗑️ 默认抄送邮箱已清空', 'success');
}

// ==================== 数据库配置 ====================
async function getDecryptedDbConfig() {
  const { dbConfig } = await chrome.storage.local.get('dbConfig');
  const cfg = { ...DEFAULT_DB, ...dbConfig };
  if (cfg.pass) cfg.pass = await decrypt(cfg.pass);
  return cfg;
}

async function loadDbConfig() {
  const { dbConfig } = await chrome.storage.local.get('dbConfig');
  const cfg = { ...DEFAULT_DB, ...dbConfig };
  // 解密密码字段
  if (cfg.pass) cfg.pass = await decrypt(cfg.pass);
  document.getElementById('db-host').value = cfg.host || 'localhost';
  document.getElementById('db-port').value = cfg.port || 3306;
  document.getElementById('db-name').value = cfg.database || '';
  document.getElementById('db-user').value = cfg.user || '';
  document.getElementById('db-pass').value = cfg.pass || '';
  document.getElementById('db-table').value = cfg.table || 'sent_emails';
}

async function saveDbConfig() {
  const config = {
    host: document.getElementById('db-host').value.trim() || 'localhost',
    port: parseInt(document.getElementById('db-port').value) || 3306,
    database: document.getElementById('db-name').value.trim(),
    user: document.getElementById('db-user').value.trim(),
    pass: document.getElementById('db-pass').value,
    table: document.getElementById('db-table').value.trim() || 'sent_emails'
  };

  if (!config.database) {
    showToast('⚠️ 请填写数据库名', 'error');
    return;
  }
  if (!config.user) {
    showToast('⚠️ 请填写数据库用户名', 'error');
    return;
  }

  // 加密敏感字段后再存储
  config.pass = await encrypt(config.pass);

  await chrome.storage.local.set({ dbConfig: config });
  showToast('✅ 数据库设置已保存', 'success');
}

async function clearDbConfig() {
  document.getElementById('db-host').value = 'localhost';
  document.getElementById('db-port').value = '3306';
  document.getElementById('db-name').value = '';
  document.getElementById('db-user').value = '';
  document.getElementById('db-pass').value = '';
  document.getElementById('db-table').value = 'sent_emails';
  await chrome.storage.local.set({ dbConfig: { ...DEFAULT_DB } });
  showToast('🗑️ 数据库设置已清空', 'success');
}

async function testDbConnection() {
  const resultEl = document.getElementById('db-test-result');
  resultEl.style.display = 'block';
  resultEl.style.color = '#e65100';
  resultEl.textContent = '🔄 正在测试连接...';

  const config = {
    host: document.getElementById('db-host').value.trim() || 'localhost',
    port: parseInt(document.getElementById('db-port').value) || 3306,
    database: document.getElementById('db-name').value.trim(),
    user: document.getElementById('db-user').value.trim(),
    pass: document.getElementById('db-pass').value,
    table: document.getElementById('db-table').value.trim() || 'sent_emails'
  };

  if (!config.database || !config.user) {
    resultEl.style.color = '#d93025';
    resultEl.textContent = '⚠️ 请填写数据库名和用户名';
    return;
  }

  try {
    const resp = await fetch(`${RELAY_SERVER}/test-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await resp.json();
    if (data.success) {
      resultEl.style.color = '#0f9d58';
      resultEl.textContent = '✅ ' + data.message;
    } else {
      resultEl.style.color = '#d93025';
      resultEl.textContent = '❌ ' + data.error;
    }
  } catch (err) {
    resultEl.style.color = '#d93025';
    resultEl.textContent = '❌ 无法连接中继服务: ' + err.message;
  }
}

// ==================== 发送成功后写入数据库 ====================
async function writeToDatabase(emailData) {
  const dbConfig = await getDecryptedDbConfig();
  if (!dbConfig || !dbConfig.database || !dbConfig.user) {
    console.log('[DB] 未配置数据库，跳过写入');
    return;
  }

  try {
    const resp = await fetch(`${RELAY_SERVER}/write-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbConfig, data: emailData })
    });
    const result = await resp.json();
    if (result.success) {
      console.log('[DB] ✅ 数据已写入数据库, 影响行数:', result.affectedRows);
    } else {
      console.warn('[DB] ⚠️ 写入失败:', result.error);
    }
  } catch (err) {
    console.warn('[DB] ⚠️ 写入数据库异常:', err.message);
  }
}

async function updateServerStatus() {
  const badge = document.getElementById('server-status-badge');
  badge.textContent = '检测中...';
  badge.style.background = '#f5f5f5';
  badge.style.color = '#666';

  const online = await checkRelayServer();
  if (online) {
    badge.textContent = '🟢 在线';
    badge.style.background = '#e6f4ea';
    badge.style.color = '#0f9d58';
  } else {
    badge.textContent = '🔴 离线';
    badge.style.background = '#fce8e6';
    badge.style.color = '#d93025';
  }
}

async function checkServerManually() {
  const resultEl = document.getElementById('server-check-result');
  resultEl.style.display = 'block';
  resultEl.textContent = '⏳ 正在检测本地服务器...';
  resultEl.style.color = '#666';

  const online = await checkRelayServer();
  if (online) {
    resultEl.textContent = '✅ 本地邮件服务器运行正常 (127.0.0.1:2525)';
    resultEl.style.color = '#0f9d58';
  } else {
    resultEl.textContent = '❌ 未检测到本地服务器，请先运行 local-smtp-server 目录下的 start-server.bat';
    resultEl.style.color = '#d93025';
  }
  updateServerStatus();
}

async function testSmtpSend() {
  const config = {
    host: document.getElementById('smtp-host').value.trim(),
    port: parseInt(document.getElementById('smtp-port').value) || 465,
    secure: document.getElementById('smtp-secure').checked,
    user: document.getElementById('smtp-user').value.trim(),
    pass: document.getElementById('smtp-pass').value
  };

  if (!config.host || !config.user || !config.pass) {
    showToast('请先填写所有 SMTP 配置', 'error');
    return;
  }

  // 检测本地服务器
  const online = await checkRelayServer();
  if (!online) {
    showToast('❌ 本地邮件服务器未启动，请先运行 start-server.bat', 'error');
    return;
  }

  const btn = document.getElementById('btn-test-smtp');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 测试中...';
  showToast('⏳ 正在发送测试邮件到你的邮箱...', 'info');

  try {
    const response = await fetch(`${RELAY_SERVER}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.user, // 发给自己测试
        cc: '',
        subject: '【测试邮件】需求提取插件 SMTP 连接测试',
        body: '如果您收到此邮件，说明本地邮件中继服务器配置正确，插件可以正常发送邮件。\n\n此邮件由本地SMTP中继服务器发送，数据未经过任何第三方服务。',
        html: '<p>如果您收到此邮件，说明<b>本地邮件中继服务器配置正确</b>，插件可以正常发送邮件。</p><p style="color:#888;font-size:12px;">此邮件由本地SMTP中继服务器发送，数据未经过任何第三方服务。</p>',
        smtp: config
      })
    });

    const result = await response.json();
    if (result.success) {
      showToast('✅ 测试邮件发送成功！请检查收件箱', 'success');
    } else {
      showToast('❌ 发送失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (e) {
    showToast('❌ 发送失败: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

async function getRules() {
  const { rules = DEFAULT_RULES } = await chrome.storage.local.get('rules');
  return {
    reqId: rules.reqId || DEFAULT_RULES.reqId,
    reqName: rules.reqName || DEFAULT_RULES.reqName,
    proposer: rules.proposer || DEFAULT_RULES.proposer,
    background: rules.background || DEFAULT_RULES.background,
    description: rules.description || DEFAULT_RULES.description,
    urlPatterns: rules.urlPatterns || []
  };
}

async function saveRules() {
  const reqIdEl = document.getElementById('rule-req-id');
  if (!reqIdEl) return; // 规则页面已隐藏
  const rules = {
    reqId: reqIdEl.value.trim(),
    reqName: document.getElementById('rule-req-name').value.trim(),
    proposer: document.getElementById('rule-proposer').value.trim(),
    background: document.getElementById('rule-background').value.trim(),
    description: document.getElementById('rule-description').value.trim(),
    urlPatterns: document.getElementById('rule-url-patterns').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  };

  await chrome.storage.local.set({ rules });
  showToast('✅ 规则已保存', 'success');
  await loadCurrentPageInfo();
}

// ==================== Toast ====================
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ==================== 头像颜色 ====================
function getAvatarColor(index) {
  const colors = ['#1a73e8', '#0f9d58', '#e37400', '#d93025', '#7b1fa2', '#c2185b', '#00838f', '#4527a0'];
  return colors[index % colors.length];
}

// ==================== 事件绑定 ====================
function bindEvents() {
  // 提取信息
  document.getElementById('btn-extract').addEventListener('click', extractInfo);

  // 清空提取结果
  document.getElementById('btn-clear-result').addEventListener('click', () => {
    document.getElementById('extract-result-card').style.display = 'none';
    document.getElementById('email-card').style.display = 'none';
    _extractedData = null;
    _attachments = [];
    renderAttachmentList();
  });

  // 发送邮件
  document.getElementById('btn-send-mailto').addEventListener('click', sendViaMailto);

  // 复制内容
  document.getElementById('btn-copy-content').addEventListener('click', copyEmailContent);

  // Excel 导入
  document.getElementById('btn-import-excel').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importExcelFile(e.target.files[0]);
    e.target.value = '';
  });

  // Excel 导出
  document.getElementById('btn-export-excel').addEventListener('click', exportContactsToExcel);

  // 手动添加（使用事件委托 + closest，确保点击按钮内部元素也能响应）
  document.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('#btn-add-contact') : null;
    if (btn) {
      addContact().catch(err => console.error('[btn-add-contact]', err));
    }
  });
  // 回车快捷添加
  document.getElementById('add-contact-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addContact().catch(err => console.error('[enter-add-contact]', err));
  });

  // 默认文件加载
  document.getElementById('btn-load-default').addEventListener('click', loadDefaultExcel);

  // 清空联系人
  document.getElementById('btn-clear-contacts').addEventListener('click', async () => {
    if (!confirm('确定要清空所有联系人吗？此操作不可恢复。')) return;
    await chrome.storage.local.remove('contacts');
    window._cachedContacts = [];
    renderContactList([]);
    renderRecipientOptions([]);
    showToast('已清空所有联系人', 'success');
  });

  // 从数据库刷新收件人
  const btnRefresh = document.getElementById('btn-refresh-contacts');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      showToast('正在从数据库刷新收件人...', 'success');
      window._contactsFromDb = undefined; // 强制重新从数据库加载
      await loadContacts();
      const src = window._contactsFromDb ? '数据库' : '本地缓存';
      showToast(`✅ 已刷新收件人（来源：${src}）`, 'success');
    });
  }

  // ========== 邮箱设置 ==========
  document.getElementById('btn-save-smtp').addEventListener('click', saveSmtpConfig);
  document.getElementById('btn-test-smtp').addEventListener('click', testSmtpSend);
  document.getElementById('btn-send-direct').addEventListener('click', sendDirect);
  document.getElementById('btn-check-server').addEventListener('click', checkServerManually);
  document.getElementById('btn-save-default-cc').addEventListener('click', saveDefaultCc);
  document.getElementById('btn-clear-default-cc').addEventListener('click', clearDefaultCc);
  document.getElementById('btn-save-signature').addEventListener('click', saveSignature);
  document.getElementById('btn-clear-signature').addEventListener('click', clearSignature);

  // ========== 数据库设置 ==========
  document.getElementById('btn-save-db').addEventListener('click', saveDbConfig);
  document.getElementById('btn-clear-db').addEventListener('click', clearDbConfig);
  document.getElementById('btn-test-db').addEventListener('click', testDbConnection);

  // 需求澄清实时预览
  document.getElementById('requirement-clarify').addEventListener('input', () => {
    if (_extractedData) updateEmailPreview(_extractedData);
  });

  // 附件
  document.getElementById('btn-add-attachment').addEventListener('click', () => {
    document.getElementById('attachment-input').click();
  });
  document.getElementById('attachment-input').addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addAttachments(e.target.files);
    }
    e.target.value = '';
  });

  document.getElementById('btn-start-server-help').addEventListener('click', () => {
    const card = document.getElementById('server-help-card');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btn-toggle-pwd').addEventListener('click', () => {
    const input = document.getElementById('smtp-pass');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

// ==================== 点选模式 ====================
const FIELD_LABELS = {
  reqId: '需求编号',
  reqName: '需求名称',
  proposer: '提出人',
  background: '需求背景及目标',
  description: '需求描述'
};
const PICK_FIELDS = ['reqId', 'reqName', 'proposer', 'background', 'description'];

let pickState = {
  active: false,
  currentField: 'reqId',
  values: {}
};

function initPickMode() {
  document.getElementById('btn-pick-mode').addEventListener('click', startPickMode);
  document.getElementById('btn-cancel-pick').addEventListener('click', cancelPickMode);

  document.querySelectorAll('.pick-field-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      setPickField(field);
    });
  });
}

async function startPickMode() {
  pickState.active = true;
  pickState.currentField = 'reqId';
  pickState.values = {};

  document.getElementById('pick-hint').style.display = 'block';
  document.getElementById('btn-extract').style.display = 'none';
  document.getElementById('btn-pick-mode').style.display = 'none';
  document.getElementById('extract-result-card').style.display = 'none';
  document.getElementById('email-card').style.display = 'none';

  // 重置所有字段按钮状态
  document.querySelectorAll('.pick-field-btn').forEach(b => {
    b.classList.remove('active', 'done');
  });
  document.querySelector('.pick-field-btn[data-field="reqId"]')?.classList.add('active');
  updatePickLabel();

  // 注入点击选取脚本到当前页面
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('无法获取当前标签页');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectPickModeScript
    });
    showToast('🎯 点选模式已启动，请在页面上点击对应字段的值', 'success');
  } catch (e) {
    showToast('启动点选模式失败: ' + e.message, 'error');
    cancelPickMode();
  }
}

function setPickField(field) {
  pickState.currentField = field;
  document.querySelectorAll('.pick-field-btn').forEach(b => {
    b.classList.remove('active');
  });
  document.querySelector(`.pick-field-btn[data-field="${field}"]`)?.classList.add('active');
  updatePickLabel();
}

function updatePickLabel() {
  const label = FIELD_LABELS[pickState.currentField] || '';
  document.getElementById('pick-target-label').innerHTML = `请在页面上点击「<b>${label}</b>」对应的值`;
}

async function cancelPickMode() {
  pickState.active = false;
  document.getElementById('pick-hint').style.display = 'none';
  document.getElementById('btn-extract').style.display = '';
  document.getElementById('btn-pick-mode').style.display = '';

  // 移除页面注入的选取脚本
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: removePickModeScript
      });
    }
  } catch (e) { /* ignore */ }

  // 显示已收集的值
  const hasValues = Object.values(pickState.values).some(v => v);
  if (hasValues) {
    await displayResults(pickState.values);
  }
}

// ==================== 监听来自 content script 的消息 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'pickValue' && pickState.active) {
    const field = pickState.currentField;
    pickState.values[field] = request.value;

    // 标记当前字段为完成
    const btn = document.querySelector(`.pick-field-btn[data-field="${field}"]`);
    if (btn) {
      btn.classList.remove('active');
      btn.classList.add('done');
    }

    // 自动跳到下一个未完成的字段
    const nextField = PICK_FIELDS.find(f => !pickState.values[f]);
    if (nextField) {
      setPickField(nextField);
      showToast(`✅ ${FIELD_LABELS[field]}: ${request.value.substring(0, 30)}...`, 'success');
    } else {
      showToast('✅ 所有字段已选取完毕！', 'success');
      cancelPickMode();
    }
    sendResponse({ ok: true });
  }
  return true;
});

/**
 * 注入到目标页面的点选脚本
 */
function injectPickModeScript() {
  // 移除旧的点选层
  const old = document.getElementById('__wb_pick_overlay__');
  if (old) old.remove();
  document.body.style.cursor = 'crosshair';

  // 高亮层
  const overlay = document.createElement('div');
  overlay.id = '__wb_pick_overlay__';
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;border:2px solid #1a73e8;background:rgba(26,115,232,0.1);display:none;transition:all 0.1s;';
  document.body.appendChild(overlay);

  function onMouseMove(e) {
    const target = e.target;
    const rect = target.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && rect.width < window.innerWidth && rect.height < window.innerHeight) {
      overlay.style.display = 'block';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
    } else {
      overlay.style.display = 'none';
    }
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    // 获取元素的值
    let value = '';
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'input') {
      value = target.value;
    } else if (tag === 'textarea') {
      value = target.value;
    } else if (tag === 'select') {
      value = target.options[target.selectedIndex]?.text || target.value || '';
    } else {
      value = (target.textContent || '').trim();
    }

    if (value) {
      chrome.runtime.sendMessage({ action: 'pickValue', value: value });
    }

    return false;
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  // 存储清理引用
  document.__wb_pick_cleanup = () => {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    overlay.remove();
    document.body.style.cursor = '';
  };
}

function removePickModeScript() {
  if (document.__wb_pick_cleanup) {
    document.__wb_pick_cleanup();
    delete document.__wb_pick_cleanup;
  }
  const overlay = document.getElementById('__wb_pick_overlay__');
  if (overlay) overlay.remove();
  document.body.style.cursor = '';
}
