/**
 * 需求催办系统 - 首页脚本
 */

let originalData = [];
let groupedData = {};
let modifiedData = new Map();
let allExpanded = false;
let currentPage = 1;
const pageSize = 10;
const systemsMap = new Map();
const saMap = new Map();

// 处理 API 认证（基于 Session）
async function fetchWithAuth(url, options = {}) {
    options.credentials = 'same-origin';
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    return res;
}

async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
    } catch (e) {
        console.error('登出请求失败:', e);
    }
    window.location.href = '/login.html';
}

// 更新顶部“我的待办”徽标数字
async function updateTodoBadge() {
    try {
        const res = await fetchWithAuth('/api/emails/todo-count');
        const result = await res.json();
        if (result.success) {
            const badge = document.getElementById('todoBadge');
            if (badge) {
                if (result.count > 0) {
                    badge.textContent = result.count > 99 ? '99+' : result.count;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.error('更新待办徽标失败:', e);
    }
}

function fmtDate(d) {
    if (!d) return '-';
    return String(d).split('T')[0].substring(0, 10);
}

function sortData(data) {
    const groups = {};
    data.forEach(row => {
        const reqId = row.req_id || 'unknown';
        if (!groups[reqId]) groups[reqId] = [];
        groups[reqId].push(row);
    });

    const reqIds = Object.keys(groups);
    reqIds.sort((a, b) => {
        const rowsA = groups[a];
        const rowsB = groups[b];
        const hasWarningA = rowsA.some(r => parseFloat(r.workload) === 0 && Number(r.is_involved) === 1);
        const hasWarningB = rowsB.some(r => parseFloat(r.workload) === 0 && Number(r.is_involved) === 1);
        if (hasWarningA && !hasWarningB) return -1;
        if (!hasWarningA && hasWarningB) return 1;
        const dateA = String(rowsA[0].propose_date || '9999').substring(0, 10);
        const dateB = String(rowsB[0].propose_date || '9999').substring(0, 10);
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(a || '').localeCompare(String(b || ''));
    });

    const result = [];
    reqIds.forEach(reqId => groups[reqId].forEach(row => result.push(row)));
    return result;
}

async function loadData() {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '<tr><td colspan="10" class="loading">正在加载数据...</td></tr>';

    try {
        const response = await fetchWithAuth('/api/emails');
        const result = await response.json();

        if (result.success) {
            originalData = result.data;
            modifiedData.clear();
            currentPage = 1;
            groupAndRenderData(result.data);
            showMessage('数据加载成功！', 'success');
        } else {
            showMessage('加载失败: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('请求失败: ' + error.message, 'error');
    }
}

function groupAndRenderData(data) {
    data = sortData(data);
    groupedData = {};
    data.forEach(row => {
        const reqId = row.req_id || 'unknown';
        if (!groupedData[reqId]) groupedData[reqId] = [];
        groupedData[reqId].push(row);
    });
    renderGroupedTable();
    updateSummary();
}

function getGroupWarning(rows) {
    return rows.some(r => parseFloat(r.workload) === 0 && Number(r.is_involved) === 1);
}

function updateSummary() {
    const summary = document.getElementById('summary');
    if (!summary) return;
    const reqIds = Object.keys(groupedData);
    const pendingCount = reqIds.filter(reqId => getGroupWarning(groupedData[reqId])).length;
    if (pendingCount === 0) {
        summary.innerHTML = '当前所有需求均已完成工作量初评。';
    } else {
        summary.innerHTML = '您当前有 <strong>' + pendingCount + '</strong> 条需求没有完成工作量初评，请到<a href="/reminder.html">“催办提醒”</a>页面完成需求催办，并在此页面录入初评工作量。';
    }
}

function renderGroupedTable() {
    const tableBody = document.getElementById('tableBody');
    const pageInfo = document.getElementById('pageInfo');
    const pageNav = document.getElementById('pageNav');
    tableBody.innerHTML = '';

    const reqIds = Object.keys(groupedData);
    const totalPages = Math.ceil(reqIds.length / pageSize) || 1;
    currentPage = Math.max(1, Math.min(currentPage, totalPages));

    if (reqIds.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="loading">暂无数据</td></tr>';
        pageInfo.textContent = '';
        pageNav.innerHTML = '';
        return;
    }

    // 将标签按每行 1 个堆叠，最多 2 行，+N 气泡放在第 2 行尾部
    function buildStackedTagsHtml(items, renderTag, moreTagHtml) {
        let html = '';
        if (items.length > 0) {
            html += renderTag(items[0]);
        }
        if (items.length > 1 || moreTagHtml) {
            html += '<div class="tag-line">';
            if (items.length > 1) {
                html += renderTag(items[1]);
            }
            if (moreTagHtml) {
                html += moreTagHtml;
            }
            html += '</div>';
        }
        return html;
    }

    // 排序
    reqIds.sort((a, b) => {
        const rowsA = groupedData[a];
        const rowsB = groupedData[b];
        const warnA = getGroupWarning(rowsA);
        const warnB = getGroupWarning(rowsB);
        if (warnA && !warnB) return -1;
        if (!warnA && warnB) return 1;
        const dateA = String(rowsA[0].propose_date || '9999').substring(0, 10);
        const dateB = String(rowsB[0].propose_date || '9999').substring(0, 10);
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(a || '').localeCompare(String(b || ''));
    });

    const startIdx = (currentPage - 1) * pageSize;
    const pageReqIds = reqIds.slice(startIdx, startIdx + pageSize);

    pageReqIds.forEach(reqId => {
        const rows = groupedData[reqId];
        const firstRow = rows[0];

        // 系统标签
        const involvedRows = rows.filter(r => Number(r.is_involved) === 1);

        // 整体行只展示涉及开发的系统
        const systems = involvedRows.map(r => ({
            name: r.system_name || '',
            warning: parseFloat(r.workload) === 0 && Number(r.is_involved) === 1,
            strikethrough: false
        }));

        const uniqueSystems = [];
        const seen = new Set();
        systems.forEach(s => {
            if (!s.name) return;
            if (!seen.has(s.name)) {
                seen.add(s.name);
                uniqueSystems.push(s);
            } else {
                const existing = uniqueSystems.find(us => us.name === s.name);
                if (existing && existing.strikethrough && !s.strikethrough) {
                    existing.strikethrough = false;
                }
            }
        });

        // 缓存涉及开发的系统列表，供 +N tooltip 使用
        systemsMap.set(reqId, uniqueSystems);

        // 系统标签：最多显示 2 个，其余折叠到 +N；每行 1 个，+N 气泡放在第 2 行尾部
        const maxVisible = 2;
        const visibleSystems = uniqueSystems.slice(0, maxVisible);
        const hiddenSystems = uniqueSystems.slice(maxVisible);

        function renderSystemTag(s) {
            let cls = 'system-tag';
            if (s.warning) cls += ' warning';
            if (s.strikethrough) cls += ' not-involved';
            return `<span class="${cls}">${s.name}</span>`;
        }

        const systemMoreTag = hiddenSystems.length > 0
            ? `<span class="system-tag more-tag" onclick="showSystemsTooltip(event, '${reqId.replace(/'/g, "\\'")}')">+${hiddenSystems.length}</span>`
            : '';
        const systemTagsHtml = buildStackedTagsHtml(visibleSystems, renderSystemTag, systemMoreTag);

        const hasWarning = uniqueSystems.some(s => s.warning);

        // 整体行只展示涉及开发的责任人
        const saInfos = [];
        const saSeen = new Set();
        involvedRows.forEach(r => {
            if (!r.sa_name) return;
            if (!saSeen.has(r.sa_name)) {
                saSeen.add(r.sa_name);
                saInfos.push({ name: r.sa_name, involved: true });
            }
        });

        // 缓存涉及开发的责任人列表，供 +N tooltip 使用
        saMap.set(reqId, saInfos);

        // 责任人标签：最多显示 2 个，其余折叠到 +N；每行 1 个，+N 气泡放在第 2 行尾部
        const maxSaVisible = 2;
        const visibleSas = saInfos.slice(0, maxSaVisible);
        const hiddenSas = saInfos.slice(maxSaVisible);

        function renderSaTag(sa) {
            const cls = sa.involved ? '' : 'sa-not-involved';
            const suffix = sa.involved ? '' : '<span class="sa-not-involved-suffix">（不涉及开发）</span>';
            return `<span class="system-tag ${cls}">${sa.name}${suffix}</span>`;
        }

        const saMoreTag = hiddenSas.length > 0
            ? `<span class="system-tag more-tag" onclick="showSaTooltip(event, '${reqId.replace(/'/g, "\\'")}')">+${hiddenSas.length}</span>`
            : '';
        const saTagsHtml = buildStackedTagsHtml(visibleSas, renderSaTag, saMoreTag);

        const totalWorkload = rows.reduce((sum, r) => sum + (parseFloat(r.workload) || 0), 0);
        const anyInvolved = rows.some(r => Number(r.is_involved) === 1);
        const devTicket = firstRow.dev_ticket_no || '';

        const groupRow = document.createElement('tr');
        groupRow.className = 'group-header' + (hasWarning ? ' has-warning' : '');
        groupRow.dataset.reqId = reqId;
        groupRow.innerHTML = `
            <td><span class="expand-icon" onclick="toggleRow('${reqId}', event)">▶</span></td>
            <td><div class="cell-text" onclick="copyText('${reqId.replace(/'/g, "\\'")}')" title="点击复制：${reqId}">${reqId}</div></td>
            <td>${fmtDate(firstRow.propose_date)}</td>
            <td><div class="cell-text"><span class="req-name-link" onclick="showDetail('${reqId}')">${firstRow.req_name || ''}</span></div></td>
            <td>${firstRow.proposer || ''}</td>
            <td><div class="system-tags">${systemTagsHtml}</div></td>
            <td><div class="system-tags">${saTagsHtml}</div></td>
            <td>${totalWorkload > 0 ? totalWorkload.toFixed(1) : '-'}</td>
            <td>${anyInvolved ? '是' : '否'}</td>
            <td>${devTicket ? `<div class="cell-text"><span class="dev-ticket-cell" onclick="copyText('${devTicket.replace(/'/g, "\\'")}')" title="点击复制">${devTicket}</span></div>` : '-'}</td>
        `;
        tableBody.appendChild(groupRow);

        // 子行
        rows.forEach((row, index) => {
            const isInvolved = Number(row.is_involved) === 1;
            const workloadNum = parseFloat(row.workload) || 0;
            const needsWarning = workloadNum === 0 && isInvolved;
            const devTicketNo = row.dev_ticket_no || '';

            const childRow = document.createElement('tr');
            childRow.className = 'child-row';
            childRow.dataset.id = row.id;
            childRow.dataset.reqId = reqId;
            childRow.style.display = 'none';
            childRow.innerHTML = `
                <td></td><td></td><td></td>
                <td style="padding-left: 30px; color: var(--ink-mute);">${rows.length > 1 ? '└ 系统' + (index + 1) + ': ' + (row.system_name || '') : ''}</td>
                <td></td>
                <td>
                    <span class="${!isInvolved ? 'system-name-not-involved' : ''}">${row.system_name || ''}</span>
                    ${needsWarning ? '<span style="color: var(--danger); margin-left: 5px;">⚠️</span>' : ''}
                </td>
                <td>${row.sa_name || ''}</td>
                <td>
                    <input type="number" step="0.5" min="0" value="${row.workload ?? ''}" data-field="workload" data-id="${row.id}"
                        onchange="onWorkloadChange(${row.id}, this.value)" style="${needsWarning ? 'border-color: var(--danger);' : ''}">
                </td>
                <td style="text-align: center;">
                    <select data-field="is_involved" data-id="${row.id}" onchange="onInvolvedChange(${row.id}, this.value)">
                        <option value="1" ${isInvolved ? 'selected' : ''}>是</option>
                        <option value="0" ${!isInvolved ? 'selected' : ''}>否</option>
                    </select>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <input type="text" value="${devTicketNo}" data-field="dev_ticket_no" data-id="${row.id}"
                            onchange="markModified(${row.id}, 'dev_ticket_no', this.value)" placeholder="输入单号" style="flex:1;min-width:80px;">
                        <button type="button" class="btn-success btn-small" onclick="saveRow(${row.id})">保存</button>
                    </div>
                    ${devTicketNo ? `<div class="cell-text"><div class="dev-ticket-cell" onclick="copyText('${devTicketNo.replace(/'/g, "\\'")}')" title="点击复制">${devTicketNo}</div></div>` : ''}
                </td>
            `;
            tableBody.appendChild(childRow);
        });
    });

    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页，共 ${reqIds.length} 个需求`;

    let navHtml = '';
    if (totalPages > 1) {
        navHtml += `<button onclick="goPage(1)" ${currentPage === 1 ? 'disabled' : ''}>首页</button>`;
        navHtml += `<button onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;
        let startP = Math.max(1, currentPage - 2);
        let endP = Math.min(totalPages, startP + 4);
        startP = Math.max(1, endP - 4);
        for (let p = startP; p <= endP; p++) {
            navHtml += `<button onclick="goPage(${p})" class="${p === currentPage ? 'active' : ''}">${p}</button>`;
        }
        navHtml += `<button onclick="goPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
        navHtml += `<button onclick="goPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>末页</button>`;
    }
    pageNav.innerHTML = navHtml;
}

function goPage(page) {
    const reqIds = Object.keys(groupedData);
    const totalPages = Math.ceil(reqIds.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderGroupedTable();
    document.querySelector('.table-container').scrollTop = 0;
}

function toggleRow(reqId, event) {
    event.stopPropagation();
    const groupRow = document.querySelector('tr.group-header[data-req-id="' + reqId + '"]');
    const expandIcon = groupRow.querySelector('.expand-icon');
    const childRows = document.querySelectorAll('tr.child-row[data-req-id="' + reqId + '"]');
    const isExpanded = expandIcon.classList.contains('expanded');

    if (isExpanded) {
        expandIcon.classList.remove('expanded');
        expandIcon.textContent = '▶';
        childRows.forEach(row => row.style.display = 'none');
    } else {
        expandIcon.classList.add('expanded');
        expandIcon.textContent = '▼';
        childRows.forEach(row => row.style.display = '');
    }
}

function toggleAllRows() {
    const groupRows = document.querySelectorAll('tr.group-header');
    allExpanded = !allExpanded;
    groupRows.forEach(row => {
        const reqId = row.dataset.reqId;
        const expandIcon = row.querySelector('.expand-icon');
        const childRows = document.querySelectorAll('tr.child-row[data-req-id="' + reqId + '"]');
        expandIcon.classList.toggle('expanded', allExpanded);
        expandIcon.textContent = allExpanded ? '▼' : '▶';
        childRows.forEach(r => r.style.display = allExpanded ? '' : 'none');
    });
}

function showSystemsTooltip(event, reqId) {
    event.stopPropagation();
    const systems = systemsMap.get(reqId);
    if (!systems || systems.length === 0) return;

    let tooltip = document.getElementById('systemsTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'systemsTooltip';
        tooltip.className = 'systems-tooltip';
        document.body.appendChild(tooltip);
    }

    const tagsHtml = systems.map(s => {
        let cls = 'system-tag';
        if (s.warning) cls += ' warning';
        if (s.strikethrough) cls += ' not-involved';
        return `<span class="${cls}">${s.name}</span>`;
    }).join('');

    tooltip.innerHTML = '<div class="systems-tooltip-title">涉及系统</div><div class="systems-tooltip-body">' + tagsHtml + '</div>';
    tooltip.style.display = 'block';

    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 16;
    }
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    function hide(e) {
        if (!tooltip.contains(e.target)) {
            tooltip.style.display = 'none';
            document.removeEventListener('click', hide);
        }
    }
    setTimeout(() => document.addEventListener('click', hide), 0);
}

function showSaTooltip(event, reqId) {
    event.stopPropagation();
    const sas = saMap.get(reqId);
    if (!sas || sas.length === 0) return;

    let tooltip = document.getElementById('systemsTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'systemsTooltip';
        tooltip.className = 'systems-tooltip';
        document.body.appendChild(tooltip);
    }

    const tagsHtml = sas.map(sa => {
        const cls = sa.involved ? '' : 'sa-not-involved';
        const suffix = sa.involved ? '' : '<span class="sa-not-involved-suffix">（不涉及开发）</span>';
        return `<span class="system-tag ${cls}">${sa.name}${suffix}</span>`;
    }).join('');

    tooltip.innerHTML = '<div class="systems-tooltip-title">责任人</div><div class="systems-tooltip-body">' + tagsHtml + '</div>';
    tooltip.style.display = 'block';

    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - 16;
    }
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    function hide(e) {
        if (!tooltip.contains(e.target)) {
            tooltip.style.display = 'none';
            document.removeEventListener('click', hide);
        }
    }
    setTimeout(() => document.addEventListener('click', hide), 0);
}

function showDetail(reqId) {
    const rows = groupedData[reqId];
    if (!rows || rows.length === 0) return;
    const firstRow = rows[0];

    document.getElementById('modalTitle').textContent = firstRow.req_name || '需求详情';

    let html = '';
    html += '<div class="detail-section"><h3>需求背景</h3><div class="detail-content">' + (firstRow.background || '<span class="empty-text">无</span>') + '</div></div>';
    html += '<div class="detail-section"><h3>需求描述</h3><div class="detail-content">' + (firstRow.description || '<span class="empty-text">无</span>') + '</div></div>';
    html += '<div class="detail-section"><h3>需求澄清</h3><div class="detail-content">' + (firstRow.clarification || '<span class="empty-text">无</span>') + '</div></div>';

    html += '<div class="detail-section"><h3>系统分工</h3>';
    html += '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<tr style="background:var(--ink); color:var(--on-primary);"><th style="padding:8px; border:1px solid var(--hairline); text-align:left; font-weight:400;">系统</th><th style="padding:8px; border:1px solid var(--hairline); text-align:left; font-weight:400;">责任人</th><th style="padding:8px; border:1px solid var(--hairline); text-align:left; font-weight:400;">工作量</th><th style="padding:8px; border:1px solid var(--hairline); text-align:left; font-weight:400;">涉及开发</th></tr>';
    rows.forEach(row => {
        const workloadIsZero = parseFloat(row.workload) === 0 && Number(row.is_involved) === 1;
        const workloadStyle = workloadIsZero ? 'style="color:var(--danger); font-weight:400;"' : '';
        const rowHighlight = workloadIsZero ? 'style="background:var(--danger-light);" ' : '';
        html += '<tr ' + rowHighlight + '>' +
            '<td style="padding:8px; border:1px solid var(--hairline);">' + (row.system_name || '-') + '</td>' +
            '<td style="padding:8px; border:1px solid var(--hairline);">' + (row.sa_name || '-') + '</td>' +
            '<td style="padding:8px; border:1px solid var(--hairline);" ' + workloadStyle + '>' + (row.workload || '-') + '</td>' +
            '<td style="padding:8px; border:1px solid var(--hairline);">' + (Number(row.is_involved) === 1 ? '是' : '否') + '</td>' +
            '</tr>';
    });
    html += '</table></div>';

    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('detailModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
}

function closeEmailRecordsModal() {
    document.getElementById('emailRecordsModal').style.display = 'none';
}

async function openEmailRecords() {
    document.getElementById('emailRecordsModal').style.display = 'block';
    document.getElementById('emailRecordsBody').innerHTML = '<p style="text-align:center;color:var(--ink-mute);">加载中...</p>';

    try {
        const res = await fetchWithAuth('/api/email-records?limit=20');
        const result = await res.json();
        if (!result.success) {
            document.getElementById('emailRecordsBody').innerHTML = '<p style="color:var(--danger);text-align:center;">加载失败：' + (result.error || '未知错误') + '</p>';
            return;
        }

        const records = result.data || [];
        if (records.length === 0) {
            document.getElementById('emailRecordsBody').innerHTML = '<p style="text-align:center;color:var(--ink-mute);">暂无催办记录</p>';
            return;
        }

        let html = '<table class="records-table">';
        html += '<tr><th style="width:20%;">需求编号</th><th style="width:43%;">需求名称</th><th style="width:8%;">收件人</th><th style="width:9%;">状态</th><th style="width:20%;">发送时间</th></tr>';
        records.forEach(r => {
            const statusClass = r.send_status === 'success' ? 'status-success' : 'status-failed';
            const recipientDisplay = r.recipient_name || r.recipient || '-';
            const reqName = r.req_name ? (r.req_name.length > 50 ? r.req_name.substring(0, 50) + '...' : r.req_name) : '-';
            html += '<tr>' +
                '<td>' + (r.req_id || '-') + '</td>' +
                '<td title="' + (r.req_name || '') + '">' + reqName + '</td>' +
                '<td title="' + recipientDisplay + '">' + recipientDisplay + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + (r.send_status === 'success' ? '成功' : '失败') + '</span></td>' +
                '<td>' + (r.created_at || '-') + '</td>' +
                '</tr>';
        });
        html += '</table>';
        document.getElementById('emailRecordsBody').innerHTML = html;
    } catch (err) {
        document.getElementById('emailRecordsBody').innerHTML = '<p style="color:var(--danger);text-align:center;">加载失败：' + err.message + '</p>';
    }
}

function markModified(id, field, value) {
    if (!modifiedData.has(id)) modifiedData.set(id, {});
    modifiedData.get(id)[field] = value;
    const row = document.querySelector('tr.child-row[data-id="' + id + '"]');
    if (row) row.classList.add('modified');
}

function onWorkloadChange(id, value) {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
        const row = document.querySelector('tr.child-row[data-id="' + id + '"]');
        if (row) {
            const select = row.querySelector('select[data-field="is_involved"]');
            if (select && select.value === '0') {
                select.value = '1';
                markModified(id, 'is_involved', 1);
            }
        }
    }
    markModified(id, 'workload', value);
    updateGroupRow(id);
}

function onInvolvedChange(id, value) {
    if (value === '0') {
        const row = document.querySelector('tr.child-row[data-id="' + id + '"]');
        if (row) {
            const input = row.querySelector('input[data-field="workload"]');
            if (input && input.value !== '0') {
                input.value = '0';
                markModified(id, 'workload', '0');
            }
        }
    }
    markModified(id, 'is_involved', parseInt(value));
    updateGroupRow(id);
}

function updateGroupRow(id) {
    const childRow = document.querySelector('tr.child-row[data-id="' + id + '"]');
    if (!childRow) return;
    const reqId = childRow.dataset.reqId;
    const groupRow = document.querySelector('tr.group-header[data-req-id="' + reqId + '"]');
    if (!groupRow) return;

    const childRows = document.querySelectorAll('tr.child-row[data-req-id="' + reqId + '"]');
    let totalWorkload = 0;
    let anyInvolved = false;
    childRows.forEach(row => {
        const workloadInput = row.querySelector('input[data-field="workload"]');
        const involvedSelect = row.querySelector('select[data-field="is_involved"]');
        if (workloadInput) totalWorkload += parseFloat(workloadInput.value) || 0;
        if (involvedSelect && involvedSelect.value === '1') anyInvolved = true;
    });

    groupRow.cells[7].textContent = totalWorkload > 0 ? totalWorkload.toFixed(1) : '-';
    groupRow.cells[8].textContent = anyInvolved ? '是' : '否';
}

function copyText(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showMessage('已复制：' + text, 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showMessage('已复制：' + text, 'success');
    });
}

async function saveRow(id) {
    const row = document.querySelector('tr.child-row[data-id="' + id + '"]');
    if (!row) return;

    const workloadInput = row.querySelector('input[data-field="workload"]');
    const involvedSelect = row.querySelector('select[data-field="is_involved"]');
    const devTicketInput = row.querySelector('input[data-field="dev_ticket_no"]');

    const updates = [{
        id: id,
        workload: workloadInput ? workloadInput.value : '',
        is_involved: involvedSelect ? parseInt(involvedSelect.value) : 1,
        dev_ticket_no: devTicketInput ? devTicketInput.value : ''
    }];

    try {
        const response = await fetchWithAuth('/api/emails/batch-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const result = await response.json();

        if (result.success) {
            showMessage('单行保存成功', 'success');
            // 移除该行的修改标记
            if (modifiedData.has(id)) {
                const remaining = { ...modifiedData.get(id) };
                delete remaining.workload;
                delete remaining.is_involved;
                delete remaining.dev_ticket_no;
                if (Object.keys(remaining).length === 0) {
                    modifiedData.delete(id);
                } else {
                    modifiedData.set(id, remaining);
                }
            }
            row.classList.remove('modified');
            updateGroupRow(id);
            setTimeout(() => loadData(), 500);
        } else {
            showMessage('保存失败: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('请求失败: ' + error.message, 'error');
    }
}

async function saveAll() {
    if (modifiedData.size === 0) {
        showMessage('没有需要保存的修改', 'error');
        return;
    }

    const updates = [];
    for (const [id, modifications] of modifiedData) {
        updates.push({ id, ...modifications });
    }

    try {
        const response = await fetchWithAuth('/api/emails/batch-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const result = await response.json();

        if (result.success) {
            showMessage(result.message, 'success');
            modifiedData.clear();
            document.querySelectorAll('tr.child-row').forEach(tr => tr.classList.remove('modified'));
            setTimeout(() => loadData(), 500);
        } else {
            showMessage('保存失败: ' + result.error, 'error');
        }
    } catch (error) {
        showMessage('请求失败: ' + error.message, 'error');
    }
}

function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
    messageDiv.style.display = 'block';
    setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
}

// 邮箱设置
async function openEmailConfig() {
    const modal = document.getElementById('emailConfigModal');
    modal.classList.add('active');
    const statusEl = document.getElementById('configStatus');
    statusEl.className = 'config-status warn';
    statusEl.textContent = '⚠️ 正在加载配置...';

    try {
        const res = await fetchWithAuth('/api/email-config');
        const result = await res.json();
        if (result.success) {
            const c = result.data;
            document.getElementById('cfg-smtp-host').value = c.smtp?.host || '';
            document.getElementById('cfg-smtp-port').value = c.smtp?.port || 465;
            document.getElementById('cfg-smtp-secure').checked = c.smtp?.secure !== false;
            document.getElementById('cfg-smtp-user').value = c.smtp?.user || '';
            document.getElementById('cfg-smtp-pass').value = '';
            document.getElementById('cfg-imap-host').value = c.smtp?.imapHost || c.imap?.host || '';
            document.getElementById('cfg-imap-port').value = c.smtp?.imapPort || c.imap?.port || 993;
            document.getElementById('cfg-signature').value = c.signature || '';
            document.getElementById('cfg-defaultCc').value = c.defaultCc || '';
            statusEl.className = 'config-status ok';
            statusEl.textContent = '✅ 配置已加载（密码已隐藏，留空表示不修改）';
        } else {
            statusEl.className = 'config-status warn';
            statusEl.textContent = '⚠️ 加载配置失败：' + result.error;
        }
    } catch (e) {
        statusEl.className = 'config-status warn';
        statusEl.textContent = '⚠️ 无法连接服务器：' + e.message;
    }
}

function closeEmailConfig() {
    document.getElementById('emailConfigModal').classList.remove('active');
}

async function saveEmailConfig() {
    const statusEl = document.getElementById('configStatus');
    const passVal = document.getElementById('cfg-smtp-pass').value;
    let currentConfig = {};
    try {
        const res = await fetchWithAuth('/api/email-config');
        const result = await res.json();
        if (result.success) currentConfig = result.data;
    } catch (e) {}

    const newConfig = {
        smtp: {
            host: document.getElementById('cfg-smtp-host').value.trim(),
            port: parseInt(document.getElementById('cfg-smtp-port').value) || 465,
            secure: document.getElementById('cfg-smtp-secure').checked,
            user: document.getElementById('cfg-smtp-user').value.trim(),
            pass: passVal ? passVal : (currentConfig.smtp?.pass || ''),
            imapHost: document.getElementById('cfg-imap-host').value.trim(),
            imapPort: parseInt(document.getElementById('cfg-imap-port').value) || 993
        },
        imap: {
            host: document.getElementById('cfg-imap-host').value.trim(),
            port: parseInt(document.getElementById('cfg-imap-port').value) || 993
        },
        signature: document.getElementById('cfg-signature').value,
        defaultCc: document.getElementById('cfg-defaultCc').value
    };

    if (!newConfig.smtp.host || !newConfig.smtp.user) {
        statusEl.className = 'config-status warn';
        statusEl.textContent = '⚠️ SMTP服务器和发件人邮箱为必填项';
        return;
    }

    try {
        const res = await fetchWithAuth('/api/email-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        });
        const result = await res.json();
        if (result.success) {
            statusEl.className = 'config-status ok';
            statusEl.textContent = '✅ 保存成功！配置已生效，无需重启服务器。';
        } else {
            statusEl.className = 'config-status warn';
            statusEl.textContent = '⚠️ 保存失败：' + result.error;
        }
    } catch (e) {
        statusEl.className = 'config-status warn';
        statusEl.textContent = '⚠️ 保存失败：' + e.message;
    }
}

async function testSmtpConfig() {
    const statusEl = document.getElementById('configStatus');
    statusEl.className = 'config-status warn';
    statusEl.textContent = '📧 正在测试SMTP连接...';

    try {
        const res = await fetchWithAuth('/api/email-config');
        const result = await res.json();
        if (!result.success) {
            statusEl.className = 'config-status warn';
            statusEl.textContent = '❌ 无法读取配置：' + result.error;
            return;
        }
        const c = result.data.smtp;
        const host = document.getElementById('cfg-smtp-host').value.trim() || c.host;
        const port = parseInt(document.getElementById('cfg-smtp-port').value) || c.port || 465;
        const secure = document.getElementById('cfg-smtp-secure').checked;
        const user = document.getElementById('cfg-smtp-user').value.trim() || c.user;
        const passInput = document.getElementById('cfg-smtp-pass').value.trim();
        const pass = passInput || c.pass || '';

        if (!pass) {
            statusEl.className = 'config-status warn';
            statusEl.textContent = '⚠️ 服务器未存储密码，请先在密码框中填写后点击保存，再测试。';
            return;
        }

        const testRes = await fetchWithAuth('/api/email-config/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port, secure, user, pass })
        });
        const testResult = await testRes.json();
        if (testResult.success) {
            statusEl.className = 'config-status ok';
            statusEl.textContent = '✅ SMTP连接测试成功！可以正常发送邮件。';
        } else {
            statusEl.className = 'config-status warn';
            statusEl.textContent = '❌ 测试失败：' + testResult.error;
        }
    } catch (e) {
        statusEl.className = 'config-status warn';
        statusEl.textContent = '❌ 请求失败：' + e.message;
    }
}

// 点击遮罩关闭弹窗
document.addEventListener('click', function(e) {
    const modal = document.getElementById('emailConfigModal');
    if (e.target === modal) closeEmailConfig();
});

window.onclick = function(event) {
    const modal = document.getElementById('detailModal');
    const recordsModal = document.getElementById('emailRecordsModal');
    if (event.target === modal) closeModal();
    if (event.target === recordsModal) closeEmailRecordsModal();
};

window.onload = function() {
    loadData();
    updateTodoBadge();
};
