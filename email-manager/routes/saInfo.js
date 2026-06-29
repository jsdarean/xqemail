/**
 * 责任人（SA）信息相关路由
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');

// 获取责任人的微信昵称
router.get('/wechat', async (req, res) => {
    try {
        const saName = req.query.sa_name;
        if (!saName) {
            return res.status(400).json({ success: false, error: '缺少 sa_name 参数' });
        }

        const [rows] = await pool.execute(
            `SELECT wechat_nickname
             FROM sa_info
             WHERE sa_name = ? AND wechat_nickname IS NOT NULL AND wechat_nickname != ''`,
            [saName]
        );

        res.json({
            success: true,
            wechat_nickname: rows.length > 0 ? rows[0].wechat_nickname : null
        });
    } catch (error) {
        console.error('[微信昵称] 查询失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
