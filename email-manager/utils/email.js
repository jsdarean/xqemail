/**
 * 邮件内容构建工具
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function stripHtml(text) {
    if (!text) return '无';
    return String(text).replace(/<[^>]*>/g, '');
}

function buildTextDetail(item) {
    const parts = [
        `【需求编号】${item.req_id || '无'}`,
        `【需求名称】${item.req_name || '无'}`,
        `【提出人】${item.proposer || '无'}`,
        `【提出时间】${String(item.propose_date || '无').substring(0, 10)}`,
        `【需求背景及目标】${stripHtml(item.background)}`,
        `【需求描述】${stripHtml(item.description)}`,
        `【需求澄清】${stripHtml(item.clarification)}`
    ];
    return parts.join('\n\n');
}

function buildHtmlDetail(item) {
    const bg = escapeHtml(stripHtml(item.background));
    const desc = escapeHtml(stripHtml(item.description));
    const clar = escapeHtml(stripHtml(item.clarification));

    return `<div style="margin-bottom:4px;">
        <p style="margin:4px 0;"><b>【需求编号】</b>${escapeHtml(item.req_id || '无')}</p>
        <p style="margin:4px 0;"><b>【需求名称】</b>${escapeHtml(item.req_name || '无')}</p>
        <p style="margin:4px 0;"><b>【提出人】</b>${escapeHtml(item.proposer || '无')}</p>
        <p style="margin:4px 0;"><b>【提出时间】</b>${escapeHtml(String(item.propose_date || '无').substring(0, 10))}</p>
        <p style="margin:4px 0;"><b>【需求背景及目标】</b>${bg}</p>
        <p style="margin:4px 0;"><b>【需求描述】</b>${desc}</p>
        <p style="margin:4px 0;"><b>【需求澄清】</b>${clar}</p>
    </div>`;
}

function buildReminderEmail(saName, items, signature) {
    const count = items.length;
    const divider = '─'.repeat(50);

    const textDetailParts = items.map((item, i) => {
        const detail = buildTextDetail(item);
        const separator = i > 0 ? '\n' + divider + '\n\n' : '';
        return `${separator}第 ${i + 1} 条需求：\n${detail}`;
    }).join('');

    const text = `您岗上共有 ${count} 条需求待提供初评工作量，请及时处理。\n\n${textDetailParts}` +
        (signature ? `\n\n${signature}` : '');

    const htmlDetailParts = items.map((item, i) => {
        const separator = i > 0
            ? '<hr style="border:none;border-top:2px solid #ff9800;margin:24px 0;">'
            : '';
        return `${separator}<h3 style="margin:16px 0 8px 0;">第 ${i + 1} 条需求</h3><div style="margin-bottom:18px;padding:12px 16px;border-left:4px solid #ff9800;background:#fff8e1;">${buildHtmlDetail(item)}</div>`;
    }).join('');

    const subject = `【需求评估催办】您岗上共有${count}条需求待提供初评工作量，请及时处理。`;
    const html = `<p>您岗上共有 <strong>${count}</strong> 条需求待提供初评工作量，请及时处理。以下是需求详细信息：</p>${htmlDetailParts}` +
        (signature ? `<br><br><div style="margin-top:18px;padding-top:12px;border-top:1px solid #ddd;color:#555;font-size:13px;">${escapeHtml(signature).replace(/\n/g, '<br>')}</div>` : '');

    return { subject, text, html };
}

module.exports = {
    buildReminderEmail,
    escapeHtml,
    stripHtml
};
