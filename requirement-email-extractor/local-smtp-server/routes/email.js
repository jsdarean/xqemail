/**
 * 邮件发送路由
 */

const nodemailer = require('nodemailer');
const { saveToSentFolder } = require('../utils/imap');

async function handleSendEmail(req, res, body) {
  const result = await sendEmail(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    messageId: result.messageId,
    imap: result.imapResult || { success: false, message: '未知' }
  }));
}

async function sendEmail(params) {
  const { to, cc, subject, body, html, attachments, smtp } = params;

  if (!to) throw new Error('缺少收件人 (to)');
  if (!subject) throw new Error('缺少邮件主题 (subject)');
  if (!body) throw new Error('缺少邮件正文 (body)');
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    throw new Error('缺少 SMTP 配置 (host/user/pass)');
  }

  console.log(`\n📧 正在发送邮件...`);
  console.log(`   收件人: ${to}`);
  if (cc) console.log(`   抄送: ${cc}`);
  console.log(`   主题: ${subject}`);
  console.log(`   SMTP: ${smtp.host}:${smtp.port || 465}`);

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 465,
    secure: smtp.secure !== false,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const mailOptions = {
    from: smtp.user,
    to: to,
    cc: cc || undefined,
    subject: subject,
    text: body,
  };

  if (html) {
    mailOptions.html = html;
  }

  if (attachments && attachments.length > 0) {
    console.log(`   📎 附件: ${attachments.map(a => a.filename).join(', ')}`);
    mailOptions.attachments = attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType || 'application/octet-stream',
    }));
  }

  const sendTime = new Date();
  mailOptions.date = sendTime;

  const _attachmentsForImap = mailOptions.attachments
    ? mailOptions.attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || 'application/octet-stream',
      }))
    : null;

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ 邮件发送成功! Message-ID: ${info.messageId}`);

  const mailOptionsForImap = { ...mailOptions };
  if (_attachmentsForImap) {
    mailOptionsForImap.attachments = _attachmentsForImap;
  }

  let imapResult = { success: false, message: '未尝试' };
  try {
    console.log(`📁 [IMAP] 开始存档到已发送文件夹...`);
    await Promise.race([
      saveToSentFolder(mailOptionsForImap, smtp, sendTime),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IMAP 存档超时 (10s)')), 10000))
    ]);
    imapResult = { success: true, message: '已存档到已发送文件夹' };
    console.log(`📁 [IMAP] ✅ 存档成功`);
  } catch (imapErr) {
    imapResult = { success: false, message: imapErr.message };
    console.error(`📁 [IMAP] ❌ 存档失败:`, imapErr.message);
  }

  info.imapResult = imapResult;
  return info;
}

module.exports = { handleSendEmail };
