/**
 * Content Script — 需求提取kimi版 - 页面需求信息提取器
 * 
 * 在目标页面中运行，负责根据 CSS 选择器提取需求信息。
 * 支持：
 * 1. 精确 CSS 选择器
 * 2. 表单元素值提取（input/textarea/select）
 * 3. label[for] 配对查找
 * 4. 表格行 td 配对查找
 * 5. 相邻元素匹配
 * 6. 智能模糊匹配
 * 7. 监听来自 popup 的消息
 */

// ==================== 消息监听 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract') {
    const result = extractInfo(request.rules);
    sendResponse(result);
  }
  return true;
});

// ==================== 提取逻辑 ====================
function extractInfo(rules) {
  if (!rules) rules = {};

  const FIELD_KEYWORDS = {
    reqId: ['需求编号', '需求ID', '需求单号', '需求号', '工单编号', '编号', 'ID'],
    reqName: ['需求名称', '需求标题', '需求主题', '需求名'],
    proposer: ['提出人', '创建人', '申请人', '提交人', '创建者', '作者'],
    background: ['需求背景', '背景及目标', '项目背景', '业务背景', '背景'],
    description: ['需求描述', '详细描述', '功能描述', '描述', '详细']
  };

  function getValue(el) {
    if (!el) return '';
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input') return el.value || el.placeholder || '';
    if (tag === 'textarea') return el.value || el.placeholder || '';
    if (tag === 'select') {
      if (el.selectedIndex >= 0 && el.options) {
        return el.options[el.selectedIndex].text || '';
      }
      return el.value || '';
    }
    return (el.textContent || '').replace(/[\s\u00a0\u3000]+/g, ' ').trim();
  }

  function clean(text) {
    return (text || '').replace(/[\s\u00a0\u3000]+/g, ' ').trim();
  }

  function matchKeyword(elText, keyword) {
    return elText.replace(/^[\*\•\●\#\s]+/, '').includes(keyword);
  }

  function getFirstValue(els) {
    for (const el of els) {
      if (!el) continue;
      const v = getValue(el);
      if (v) return v;
    }
    return '';
  }

  // 策略 1: CSS 选择器
  function strategyCSS(selectorList) {
    if (!selectorList) return '';
    const selectors = selectorList.split(',').map(s => s.trim()).filter(Boolean);
    for (const sel of selectors) {
      try {
        const v = getValue(document.querySelector(sel));
        if (v) return v;
      } catch (e) { /* ignore */ }
    }
    return '';
  }

  // 策略 2: label[for] 配对
  function strategyLabelFor(kws) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      const labelText = clean(label.textContent);
      for (const kw of kws) {
        if (!matchKeyword(labelText, kw)) continue;
        const forId = label.getAttribute('for');
        if (forId) {
          const v = getValue(document.getElementById(forId));
          if (v) return v;
        }
        const v = getFirstValue(label.querySelectorAll('input, textarea, select'));
        if (v) return v;
      }
    }
    return '';
  }

  // 策略 3: 表格行 tr td 配对
  function strategyTableRow(kws) {
    const rows = document.querySelectorAll('tr');
    for (const row of rows) {
      const cells = row.querySelectorAll('td, th');
      for (let i = 0; i < cells.length; i++) {
        const cellText = clean(cells[i].textContent);
        for (const kw of kws) {
          if (!matchKeyword(cellText, kw)) continue;
          for (let j = i + 1; j < cells.length; j++) {
            const valEl = cells[j].querySelector('input, textarea, select') || cells[j];
            const v = getValue(valEl);
            if (v) return v;
          }
        }
      }
    }
    return '';
  }

  // 策略 4: 相邻元素（遍历文本节点）
  function strategyAdjacent(kws) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const candidates = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = clean(node.textContent);
      for (const kw of kws) {
        if (matchKeyword(text, kw)) { candidates.push(node); break; }
      }
    }

    for (const textNode of candidates) {
      let labelEl = textNode.parentElement;
      if (!labelEl) continue;
      let container = labelEl;
      for (let i = 0; i < 3; i++) {
        let sibling = container.nextElementSibling;
        if (sibling) {
          const v = getFirstValue([
            sibling.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'),
            sibling.querySelector('textarea, select'),
            sibling
          ]);
          if (v) return v;
        }
        const parent = container.parentElement;
        if (parent) {
          const kids = parent.children;
          const idx = Array.from(kids).indexOf(container);
          if (idx >= 0 && idx + 1 < kids.length) {
            const next = kids[idx + 1];
            const v = getFirstValue([
              next.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])'),
              next.querySelector('textarea, select'),
              next
            ]);
            if (v) return v;
          }
        }
        container = parent;
        if (!container || container === document.body) break;
      }
    }
    return '';
  }

  // 策略 5: 表单容器扫描
  function strategyFormContainer(kws) {
    const patterns = [
      '[class*="form"]', '[class*="field"]', '[class*="item"]',
      '[class*="row"]', '[class*="detail"]', '[class*="info"]',
      '[class*="group"]', '[class*="panel"]', 'fieldset', 'dl'
    ];
    const containers = document.querySelectorAll(patterns.join(','));
    for (const container of containers) {
      const allEls = container.querySelectorAll('td, th, label, span, div, dt, dd, p, li');
      for (let i = 0; i < allEls.length; i++) {
        const elText = clean(allEls[i].textContent);
        if (elText.length > 30) continue;
        for (const kw of kws) {
          if (!matchKeyword(elText, kw)) continue;
          for (let j = i + 1; j < allEls.length; j++) {
            const nextEl = allEls[j];
            const valEl = nextEl.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"])') ||
                          nextEl.querySelector('textarea, select') || nextEl;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(valEl.tagName)) {
              const v = getValue(valEl);
              if (v) return v;
            } else {
              const v = getValue(valEl);
              if (v && v.length > 1 && v.length < 500) return v;
            }
          }
        }
      }
    }
    return '';
  }

  // 策略 6: textarea 反向查找
  function strategyTextarea(kws) {
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      const v = getValue(ta);
      if (!v || v.length < 20) continue;
      const labelEl = ta.closest('td')?.previousElementSibling ||
                      ta.closest('tr')?.querySelector('td:first-child, th') ||
                      ta.previousElementSibling;
      if (labelEl) {
        const labelText = clean(labelEl.textContent);
        for (const kw of kws) {
          if (matchKeyword(labelText, kw)) return v;
        }
      }
    }
    return '';
  }

  const fields = ['reqId', 'reqName', 'proposer', 'background', 'description'];
  const result = {};

  for (const field of fields) {
    const selectorList = rules[field] || '';
    const kws = FIELD_KEYWORDS[field] || [];

    const strategies = [
      () => strategyCSS(selectorList),
      () => strategyLabelFor(kws),
      () => strategyTableRow(kws),
      () => strategyAdjacent(kws),
      () => strategyFormContainer(kws),
      () => strategyTextarea(kws)
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
