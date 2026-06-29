/**
 * 会话认证路由
 */
const express = require('express');
const router = express.Router();
const config = require('../config');

// 登录
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }

    if (username === config.auth.username && password === config.auth.password) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        req.session.loginAt = new Date().toISOString();
        return res.json({
            success: true,
            message: '登录成功',
            user: { username }
        });
    }

    res.status(401).json({ success: false, error: '用户名或密码错误' });
});

// 登出
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('登出失败:', err);
            return res.status(500).json({ success: false, error: '登出失败' });
        }
        res.clearCookie('email_manager_session');
        res.json({ success: true, message: '登出成功' });
    });
});

// 获取当前登录用户
router.get('/me', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.json({
            success: true,
            isAuthenticated: true,
            user: { username: req.session.username }
        });
    } else {
        res.status(401).json({ success: false, isAuthenticated: false, error: '未登录' });
    }
});

module.exports = router;
