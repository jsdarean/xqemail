/**
 * 邮件发送记录相关路由
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');

// 保存邮件发送记录
router.post('/', async (req, res) => {
    try {
        const {
            req_id, req_name, email_type, recipient, recipient_name,
            subject, content, send_status, error_msg, source, sender
        } = req.body;

        if (!recipient || !subject || !email_type) {
            return res.status(400).json({ success: false, error: 'recipient、subject、email_type 为必填项' });
        }

        await pool.execute(
            `INSERT INTO email_records
             (req_id, req_name, email_type, recipient, recipient_name, subject, content, send_status, error_msg, source, sender)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req_id || null,
                req_name || null,
                email_type || '未知',
                recipient,
                recipient_name || null,
                subject,
                content || null,
                send_status || 'success',
                error_msg || null,
                source || 'email-manager',
                sender || null
            ]
        );
        res.json({ success: true, message: '记录已保存' });
    } catch (error) {
        console.error('[邮件记录] 保存失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 查询邮件发送记录（修复 SQL 注入）
router.get('/', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
        if (isNaN(limit) || limit < 1) {
            return res.status(400).json({ success: false, error: 'limit 参数无效' });
        }

        // 使用 pool.query 而非 execute，因为某些 MySQL 版本不支持 LIMIT ? 参数化
        const [rows] = await pool.query(
            `SELECT id, req_id, req_name, email_type, recipient, recipient_name,
                    subject, send_status, source, sender,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
             FROM email_records
             ORDER BY id DESC
             LIMIT ${limit}`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('[邮件记录] 查询失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
