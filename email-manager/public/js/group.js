/**
 * 集团需求页面脚本
 * 展示需求ID中不包含"敏捷需求"的运营工单，支持分页、勾选和一键导出 Excel。
 */

let allData = [];
let currentPage = 1;
const pageSize = 10;

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

function fmtDateTime(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const pad = n => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
        pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

async function loadData() {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '<div class="loading">正在加载数据...</div>';

    try {
        const response = await fetchWithAuth('/api/emails');
        const result = await response.json();

        if (result.success) {
            // 集团需求：需求ID中不包含"敏捷需求"
            allData = (result.data || []).filter(item => {
                const reqId = String(item.req_id || '');
                return reqId.indexOf('敏捷需求') === -1;
            });

            // 按提出时间从大到小排序
            allData.sort((a, b) => {
                const ta = a.propose_time ? new Date(a.propose_time).getTime() : 0;
                const tb = b.propose_time ? new Date(b.propose_time).getTime() : 0;
                return tb - ta;
            });

            currentPage = 1;
            renderTable();
            renderPagination();
            updateSummary();
        } else {
            container.innerHTML = '<div class="empty">加载失败：' + result.error + '</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="empty">请求失败：' + error.message + '</div>';
    }
}

function updateSummary() {
    const summary = document.getElementById('summary');
    if (allData.length === 0) {
        summary.innerHTML = '当前没有集团需求数据。';
        return;
    }
    summary.innerHTML = '当前共有 <strong>' + allData.length + '</strong> 条集团运营工单。';
}

function getPageData() {
    const start = (currentPage - 1) * pageSize;
    return allData.slice(start, start + pageSize);
}

function renderTable() {
    const container = document.getElementById('tableContainer');

    if (allData.length === 0) {
        container.innerHTML = '<div class="empty">暂无集团需求数据。</div>';
        return;
    }

    const pageData = getPageData();

    let html = '<table><thead><tr>' +
        '<th style="width:40px;text-align:center;"><input type="checkbox" id="selectAll" onclick="toggleSelectAll()"></th>' +
        '<th>运营工单ID</th>' +
        '<th style="width:110px;">工单发布时间</th>' +
        '<th>运营工单名称</th>' +
        '<th style="width:100px;">发布人</th>' +
        '<th style="width:160px;">开发单号或说明</th>' +
        '</tr></thead><tbody>';

    pageData.forEach(item => {
        const reqId = item.req_id || '';
        const safeReqId = reqId.replace(/'/g, "\\'");
        html += '<tr>' +
            '<td style="text-align:center;"><input type="checkbox" class="row-checkbox" data-id="' + item.id + '"></td>' +
            '<td><div class="cell-text" onclick="copyText(\'' + safeReqId + '\')" title="点击复制">' + reqId + '</div></td>' +
            '<td>' + fmtDate(item.propose_time) + '</td>' +
            '<td><div class="cell-text">' + (item.req_name || '') + '</div></td>' +
            '<td>' + (item.proposer || '') + '</td>' +
            '<td><div class="cell-text">' + (item.dev_ticket_no || '') + '</div></td>' +
            '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(allData.length / pageSize);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // 上一页
    html += '<button class="page-btn" ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="goToPage(' + (currentPage - 1) + ')">上一页</button>';

    // 页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += '<button class="page-btn ' + (i === currentPage ? 'active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span class="page-ellipsis">...</span>';
        }
    }

    // 下一页
    html += '<button class="page-btn" ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="goToPage(' + (currentPage + 1) + ')">下一页</button>';

    pagination.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(allData.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const boxes = document.querySelectorAll('.row-checkbox');
    boxes.forEach(box => {
        box.checked = selectAll.checked;
    });
}

function getSelectedItems() {
    const boxes = document.querySelectorAll('.row-checkbox:checked');
    const selectedIds = Array.from(boxes).map(box => Number(box.dataset.id));
    return allData.filter(item => selectedIds.indexOf(Number(item.id)) !== -1);
}

function exportSelected() {
    const items = getSelectedItems();
    if (items.length === 0) {
        alert('请先勾选需要导出的工单。');
        return;
    }

    // 构建导出数据，使用新的表头名称
    const exportData = items.map(item => ({
        '运营工单ID': item.req_id || '',
        '工单发布时间': fmtDate(item.propose_time),
        '运营工单名称': item.req_name || '',
        '发布人': item.proposer || '',
        '开发单号或说明': item.dev_ticket_no || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '集团运营工单');

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    const timeStr = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const fileName = '集团运营工单' + dateStr + timeStr + '.xlsx';

    XLSX.writeFile(wb, fileName);
}

function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制：' + text);
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('已复制：' + text);
    } catch (e) {
        showToast('复制失败');
    }
    document.body.removeChild(ta);
}

function showToast(msg) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-msg';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

window.onload = function() {
    loadData();
    updateTodoBadge();
};
