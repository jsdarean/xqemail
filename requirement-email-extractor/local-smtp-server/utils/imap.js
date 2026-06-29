/**
 * IMAP 已发送存档工具
 */

const Imap = require('imap');

/**
 * 通过 IMAP 将已发送的邮件存档到「已发送」文件夹
 */
function saveToSentFolder(mailOptions, smtp, sendTime) {
  return new Promise((resolve, reject) => {
    const imapHost = smtp.imapHost || smtp.host.replace(/^smtp\./, 'imap.');
    console.log(`📁 [IMAP] 开始存档, 连接 ${imapHost}:${smtp.imapPort || 993}, 发送时间: ${sendTime.toLocaleString('zh-CN')}`);

    const imap = new Imap({
      user: smtp.user,
      password: smtp.pass,
      host: imapHost,
      port: smtp.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    let resolved = false;

    imap.once('ready', () => {
      console.log(`📁 [IMAP] 已连接, 获取文件夹列表...`);
      imap.getBoxes((err, boxes) => {
        if (err) {
          console.warn(`📁 [IMAP] 获取文件夹列表失败:`, err.message);
          imap.end();
          if (!resolved) { resolved = true; reject(new Error('获取文件夹列表失败: ' + err.message)); }
          return;
        }

        const allFolders = collectAll(boxes, '');
        console.log(`📁 [IMAP] 所有文件夹:`, allFolders.join(', '));

        const candidates = ['Sent', '已发送', 'Sent Items', 'Sent Mail', 'INBOX.Sent', 'INBOX.已发送'];
        let sentFolder = null;

        function findBox(boxList, parentPath) {
          for (const [name, box] of Object.entries(boxList)) {
            const fullPath = parentPath ? `${parentPath}${box.delimiter}${name}` : name;
            if (candidates.includes(name) || candidates.includes(fullPath)) {
              sentFolder = fullPath;
              return true;
            }
            if (box.children && findBox(box.children, fullPath)) return true;
          }
          return false;
        }

        findBox(boxes, '');

        if (!sentFolder) {
          console.warn(`📁 [IMAP] 未找到匹配的已发送文件夹，尝试降级到 "Sent" 和 "已发送"`);
          tryAppend(imap, 'Sent', mailOptions, sendTime)
            .then(() => { if (!resolved) { resolved = true; resolve(); } })
            .catch((e1) => {
              console.warn(`📁 [IMAP] 降级 Sent 失败:`, e1.message);
              tryAppend(imap, '已发送', mailOptions, sendTime)
                .then(() => { if (!resolved) { resolved = true; resolve(); } })
                .catch((e2) => {
                  console.warn(`📁 [IMAP] 降级 已发送 也失败:`, e2.message);
                  imap.end();
                  if (!resolved) { resolved = true; reject(new Error('所有存档尝试均失败')); }
                });
            });
          return;
        }

        console.log(`📁 [IMAP] 找到已发送文件夹: "${sentFolder}"`);
        tryAppend(imap, sentFolder, mailOptions, sendTime)
          .then(() => { if (!resolved) { resolved = true; resolve(); } })
          .catch((e) => {
            imap.end();
            if (!resolved) { resolved = true; reject(e); }
          });
      });
    });

    imap.once('error', (err) => {
      console.warn(`📁 [IMAP] 连接错误:`, err.message);
      if (!resolved) { resolved = true; reject(new Error('IMAP 连接失败: ' + err.message)); }
    });
    imap.once('end', () => {
      console.log(`📁 [IMAP] 连接关闭`);
    });

    imap.connect();
  });
}

function collectAll(boxList, parentPath) {
  const result = [];
  for (const [name, box] of Object.entries(boxList)) {
    const fullPath = parentPath ? `${parentPath}${box.delimiter}${name}` : name;
    result.push(fullPath);
    if (box.children) {
      result.push(...collectAll(box.children, fullPath));
    }
  }
  return result;
}

function tryAppend(imap, folder, mailOptions, sendTime) {
  return new Promise((resolve, reject) => {
    console.log(`📁 [IMAP] 尝试打开文件夹: "${folder}"`);
    imap.openBox(folder, (err) => {
      if (err) {
        console.warn(`📁 [IMAP] 无法打开 "${folder}":`, err.message);
        reject(new Error(`无法打开文件夹 "${folder}": ` + err.message));
        return;
      }

      console.log(`📁 [IMAP] 已打开 "${folder}", 构建邮件...`);
      try {
        const raw = buildRawEmail(mailOptions);
        console.log(`📁 [IMAP] MIME 构建完成, 大小: ${raw.length} 字节, 准备追加...`);
        imap.append(raw, { mailbox: folder, flags: ['\\Seen'], date: sendTime }, (err2) => {
          if (err2) {
            console.warn(`📁 [IMAP] 追加失败:`, err2.message);
            reject(new Error(`追加邮件失败: ` + err2.message));
          } else {
            console.log(`📁 [IMAP] ✅ 已成功存档到 "${folder}"`);
            resolve();
          }
        });
      } catch (e) {
        console.warn(`📁 [IMAP] 构建 MIME 失败:`, e.message);
        reject(new Error(`构建 MIME 失败: ` + e.message));
      }
    });
  });
}

/**
 * 构建原始 MIME 邮件（含附件支持）
 */
function buildRawEmail(mailOptions) {
  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = mailOptions.date instanceof Date ? mailOptions.date : new Date();

  const headers = [
    `From: ${mailOptions.from}`,
    `To: ${Array.isArray(mailOptions.to) ? mailOptions.to.join(', ') : mailOptions.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(mailOptions.subject, 'utf-8').toString('base64')}?=`,
    `Date: ${formatDateWithOffset(now)}`,
    `MIME-Version: 1.0`,
  ];

  if (mailOptions.cc) {
    headers.push(`Cc: ${Array.isArray(mailOptions.cc) ? mailOptions.cc.join(', ') : mailOptions.cc}`);
  }

  const hasHtml = !!mailOptions.html;
  const hasAttachments = mailOptions.attachments && mailOptions.attachments.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    headers.push('');

    let parts = [];

    parts.push(`--${mixedBoundary}`);
    if (hasHtml) {
      parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      parts.push('');
      parts.push(`--${altBoundary}`);
      parts.push('Content-Type: text/plain; charset="UTF-8"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(mailOptions.text || '', 'utf-8').toString('base64'));
      parts.push(`--${altBoundary}`);
      parts.push('Content-Type: text/html; charset="UTF-8"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(mailOptions.html, 'utf-8').toString('base64'));
      parts.push(`--${altBoundary}--`);
    } else {
      parts.push('Content-Type: text/plain; charset="UTF-8"');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(mailOptions.text || '', 'utf-8').toString('base64'));
    }

    for (const att of mailOptions.attachments) {
      parts.push(`--${mixedBoundary}`);
      const mimeType = att.contentType || 'application/octet-stream';
      const encodedName = `=?UTF-8?B?${Buffer.from(att.filename, 'utf-8').toString('base64')}?=`;
      parts.push(`Content-Type: ${mimeType}; name="${encodedName}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Disposition: attachment; filename="${encodedName}"`);
      parts.push('');
      const content = att.content || att;
      parts.push(Buffer.isBuffer(content) ? content.toString('base64') : content);
    }

    parts.push(`--${mixedBoundary}--`);
    return headers.join('\r\n') + '\r\n' + parts.join('\r\n');
  }

  if (hasHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    headers.push('');

    const textPart = [
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(mailOptions.text || '', 'utf-8').toString('base64'),
    ].join('\r\n');

    const htmlPart = [
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(mailOptions.html, 'utf-8').toString('base64'),
    ].join('\r\n');

    return headers.join('\r\n') + '\r\n' + textPart + '\r\n' + htmlPart + `\r\n--${altBoundary}--`;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    headers.push('');
    return headers.join('\r\n') + '\r\n' + Buffer.from(mailOptions.text || '', 'utf-8').toString('base64');
  }
}

function formatDateWithOffset(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const offsetStr = sign + String(Math.floor(absOffset / 60)).padStart(2, '0') + String(absOffset % 60).padStart(2, '0');

  const d = date.getFullYear();
  const t = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');

  return `${days[date.getDay()]}, ${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]} ${d} ${t}:${m}:${s} ${offsetStr}`;
}

module.exports = { saveToSentFolder };
