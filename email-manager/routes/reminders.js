/**
 * 需求催办相关路由
 */
const express = require('express');
const http = require('http');
const { URL } = require('url');
const router = express.Router();
const config = require('../config');
const { pool } = require('../utils/db');
const { buildReminderEmail } = require('../utils/email');

// 查询需要催办的记录
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, req_id, req_name, proposer, system_name, sa_name,
                    COALESCE(workload, 0) AS workload, COALESCE(is_involved, 1) AS is_involved,
                    dev_ticket_no, background, description, clarification,
                    DATE(propose_time) AS propose_date, propose_time
             FROM sent_emails
             WHERE COALESCE(is_involved, 1) = 1
               AND (workload IS NULL OR workload = 0)
             ORDER BY sa_name, propose_time ASC, req_id`
        );

        const grouped = {};
        rows.forEach(row => {
            const name = row.sa_name || '未分配';
            if (!grouped[name]) grouped[name] = [];
            grouped[name].push(row);
        });

        // 按 req_id 去重
        const result = {};
        for (const [name, items] of Object.entries(grouped)) {
            const seen = new Set();
            result[name] = [];
            items.forEach(item => {
                if (!seen.has(item.req_id)) {
                    seen.add(item.req_id);
                    result[name].push(item);
                }
            });
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('催办查询错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 发送催办邮件
router.post('/send-email', async (req, res) => {
    let connection;
    try {
        const { sa_name, items } = req.body;
        if (!sa_name || !items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, error: '缺少必要参数' });
        }

        const emailConfig = config.email;
        if (!emailConfig.smtp.host || !emailConfig.smtp.user || !emailConfig.smtp.pass) {
            return res.status(500).json({ success: false, error: 'SMTP配置不完整，请在 .env 中配置' });
        }

        connection = await pool.getConnection();
        const [emailRows] = await connection.execute(
            `SELECT DISTINCT email
             FROM sa_info
             WHERE sa_name = ? AND email IS NOT NULL AND email != ''`,
            [sa_name]
        );

        if (emailRows.length === 0) {
            return res.status(400).json({ success: false, error: `未找到责任人 "${sa_name}" 的邮箱地址，请在 sa_info 表中维护` });
        }

        const toEmail = emailRows[0].email;

        const { subject, text, html } = buildReminderEmail(sa_name, items, emailConfig.signature);

        console.log(`[催办] 正在通过中继服务器发送邮件 → ${toEmail}`);

        const postData = JSON.stringify({
            to: `${sa_name} <${toEmail}>`,
            cc: emailConfig.defaultCc,
            subject,
            body: text,
            html,
            smtp: {
                host: emailConfig.smtp.host,
                port: emailConfig.smtp.port,
                secure: emailConfig.smtp.secure,
                user: emailConfig.smtp.user,
                pass: emailConfig.smtp.pass,
                imapHost: emailConfig.smtp.imapHost,
                imapPort: emailConfig.smtp.imapPort
            }
        });

        const relayUrl = new URL(config.relay.server + '/send');
        const options = {
            hostname: relayUrl.hostname,
            port: relayUrl.port,
            path: relayUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 30000
        };

        const relayResult = await new Promise((resolve, reject) => {
            const httpReq = http.request(options, (httpRes) => {
                let data = '';
                httpRes.on('data', chunk => { data += chunk; });
                httpRes.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error('中继服务器返回无效响应')); }
                });
            });
            httpReq.on('error', reject);
            httpReq.on('timeout', () => {
                httpReq.destroy();
                reject(new Error('连接中继服务器超时'));
            });
            httpReq.write(postData);
            httpReq.end();
        });

        if (!relayResult.success) {
            throw new Error(relayResult.error || '中继服务器返回错误');
        }

        console.log(`[催办] ✅ 邮件发送成功: ${relayResult.messageId}`);

        // 写入邮件发送记录
        try {
            for (const item of items) {
                await connection.execute(
                    `INSERT INTO email_records
                     (req_id, req_name, email_type, recipient, recipient_name, subject, content, send_status, source, sender)
                     VALUES (?, ?, '催办', ?, ?, ?, NULL, 'success', 'email-manager', ?)`,
                    [
                        item.req_id || null,
                        item.req_name || null,
                        toEmail,
                        sa_name,
                        subject,
                        emailConfig.smtp.user
                    ]
                );
            }
            console.log(`[催办] ✅ 已写入 ${items.length} 条邮件记录到 email_records`);
        } catch (logErr) {
            console.error('[催办] ⚠️ 写入邮件记录失败（不影响邮件发送）:', logErr.message);
        }

        res.json({
            success: true,
            message: `催办邮件已发送至 ${toEmail}`,
            messageId: relayResult.messageId,
            imap: relayResult.imap || null
        });

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('中继')) {
            console.error('[催办] 中继服务器不可用:', error.message);
            return res.status(500).json({
                success: false,
                error: `本地邮件中继服务器(${config.relay.server})未启动或无法连接。请先启动 Chrome 插件项目的 local-smtp-server/start-server.bat`
            });
        }
        console.error('[催办] 邮件发送错误:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
