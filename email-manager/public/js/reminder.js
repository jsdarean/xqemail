/**
 * 需求催办系统 - 催办页面脚本
 */

let reminderData = {};
let sortAsc = true;
let currentReminderName = '';

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

async function loadData() {
    const container = document.getElementById('tableContainer');
    container.innerHTML = '<div class="loading">正在加载数据...</div>';

    try {
        const response = await fetchWithAuth('/api/reminders');
        const result = await response.json();

        if (result.success) {
            reminderData = result.data;
            renderTable();
        } else {
            container.innerHTML = '<div class="empty">加载失败：' + result.error + '</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="empty">请求失败：' + error.message + '</div>';
    }
}

function renderTable() {
    const container = document.getElementById('tableContainer');
    let names = Object.keys(reminderData);

    names.sort((a, b) => {
        const getEarliest = (name) => {
            const items = reminderData[name];
            let earliest = null;
            items.forEach(item => {
                if (item.propose_date && (!earliest || item.propose_date < earliest)) {
                    earliest = item.propose_date;
                }
            });
            return fmtDate(earliest);
        };
        const dateA = getEarliest(a);
        const dateB = getEarliest(b);
        return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });

    if (names.length === 0) {
        container.innerHTML = '<div class="empty">🎉 太棒了！所有涉及开发的任务都已填写工作量，没有待催办事项。</div>';
        document.getElementById('summary').innerHTML = '当前没有待催办的需求。';
        return;
    }

    let totalItems = 0;
    names.forEach(name => { totalItems += reminderData[name].length; });

    document.getElementById('summary').innerHTML =
        '当前共有 <strong>' + names.length + '</strong> 位责任人有待催办需求，合计 <strong>' + totalItems + '</strong> 条需求未填写工作量。';

    const sortIcon = sortAsc ? '⬆️' : '⬇️';
    let html = '<table><thead><tr>' +
        '<th style="width:40px;"></th>' +
        '<th>责任人</th>' +
        '<th>待填工作量条数</th>' +
        '<th style="cursor:pointer;" onclick="toggleSort()">提出时间 ' + sortIcon + '</th>' +
        '<th style="width:220px; text-align:center;">操作</th>' +
        '</tr></thead><tbody>';

    names.forEach(name => {
        const items = reminderData[name];
        const count = items.length;
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');

        let earliestDate = null;
        items.forEach(item => {
            if (item.propose_date && (!earliestDate || item.propose_date < earliestDate)) {
                earliestDate = item.propose_date;
            }
        });

        html += '<tr class="person-row" onclick="toggleDetails(\'' + name.replace(/'/g, "\\'") + '\')">' +
            '<td><span class="expand-icon" id="icon-' + safeName + '">▶</span></td>' +
            '<td><span class="person-name">' + name + '</span></td>' +
            '<td><span class="count-badge">' + count + ' 条</span></td>' +
            '<td><span class="propose-date">' + fmtDate(earliestDate) + '</span></td>' +
            '<td style="white-space:nowrap; text-align:center;">' +
            '<button class="btn-danger btn-small" onclick="event.stopPropagation(); openReminderModal(\'' + name.replace(/'/g, "\\'") + '\')">📧 邮件催办</button> ' +
            '<button class="btn-success btn-small" onclick="event.stopPropagation(); openWechatReminder(\'' + name.replace(/'/g, "\\'") + '\')">💬 微信催办</button>' +
            '</td>' +
            '</tr>';

        items.forEach(item => {
            html += '<tr class="detail-row" id="detail-' + safeName + '" style="display:none;">' +
                '<td></td>' +
                '<td colspan="3">' +
                '<span class="req-id">' + (item.req_id || '') + '</span>' +
                ' - ' + (item.req_name || '') +
                ' <span class="system-tag">' + (item.system_name || '') + '</span>' +
                '</td>' +
                '<td><span class="propose-date">' + fmtDate(item.propose_date) + '</span></td>' +
                '</tr>';
        });
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function toggleSort() {
    sortAsc = !sortAsc;
    renderTable();
}

function toggleDetails(name) {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const rows = document.querySelectorAll('tr.detail-row[id^="detail-' + safeName + '"]');
    const icon = document.getElementById('icon-' + safeName);
    if (!rows.length) return;

    const isExpanded = icon.classList.contains('expanded');
    icon.classList.toggle('expanded', !isExpanded);
    icon.textContent = isExpanded ? '▶' : '▼';
    rows.forEach(row => row.style.display = isExpanded ? 'none' : '');
}

function openReminderModal(name) {
    currentReminderName = name;
    const items = reminderData[name];
    document.getElementById('modal-sa-name').textContent = name;
    document.getElementById('modal-count').textContent = (items ? items.length : 0) + ' 条';
    document.getElementById('reminderModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('reminderModal').style.display = 'none';
    currentReminderName = '';
}

async function openWechatReminder(name) {
    const items = reminderData[name];
    if (!items || items.length === 0) return;

    let wechatName = name;
    try {
        const res = await fetchWithAuth('/api/sa-wechat/wechat?sa_name=' + encodeURIComponent(name));
        const result = await res.json();
        if (result.success && result.wechat_nickname) {
            wechatName = result.wechat_nickname;
        }
    } catch (e) {
        console.warn('[微信催办] 获取微信昵称失败:', e.message);
    }

    let text = '【需求催办】请及时提供以下需求的初评工作量：\n';
    items.forEach(item => {
        text += (item.req_id || '') + '，' + (item.req_name || '') + '\n';
    });
    text += '@' + wechatName;

    document.getElementById('wechatText').textContent = text;
    document.getElementById('wechatModal').style.display = 'block';
    copyToClipboard(text);
}

function closeWechatModal() {
    document.getElementById('wechatModal').style.display = 'none';
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板');
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
        showToast('已复制到剪贴板');
    } catch (e) {
        showToast('复制失败，请手动复制');
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

async function confirmSendReminder() {
    if (!currentReminderName || !reminderData[currentReminderName]) {
        alert('数据错误');
        return;
    }

    const items = reminderData[currentReminderName];
    const btnSend = document.getElementById('btn-send-reminder');
    btnSend.disabled = true;
    btnSend.textContent = '发送中...';

    try {
        const response = await fetchWithAuth('/api/reminders/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sa_name: currentReminderName, items: items })
        });
        const result = await response.json();

        if (result.success) {
            alert('催办邮件发送成功！\n' + result.message);
            closeModal();
        } else {
            alert('发送失败：' + result.error);
        }
    } catch (error) {
        alert('发送失败：' + error.message);
    } finally {
        btnSend.disabled = false;
        btnSend.textContent = '确认发送';
    }
}

window.onclick = function(event) {
    const reminderModal = document.getElementById('reminderModal');
    const wechatModal = document.getElementById('wechatModal');
    if (event.target === reminderModal) closeModal();
    if (event.target === wechatModal) closeWechatModal();
};

window.onload = function() {
    loadData();
    updateTodoBadge();
};
