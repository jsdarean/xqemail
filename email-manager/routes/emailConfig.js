/**
 * 邮箱配置相关路由（支持密码加密）
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const router = express.Router();
const config = require('../config');
const { encryptEmailConfig, decryptEmailConfig } = require('../utils/crypto');

const configPath = path.join(__dirname, '..', 'email-config.json');

function getEmailConfig() {
    try {
        const data = fs.readFileSync(configPath, 'utf-8');
        const cfg = JSON.parse(data);
        return decryptEmailConfig(cfg, config.encryption.key);
    } catch (err) {
        return null;
    }
}

// 读取邮箱配置
router.get('/', (req, res) => {
    try {
        const cfg = getEmailConfig();
        if (!cfg) {
            return res.status(500).json({ success: false, error: '未找到配置文件，请先在 .env 中配置后保存' });
        }
        res.json({ success: true, data: cfg });
    } catch (err) {
        res.status(500).json({ success: false, error: '读取配置失败: ' + err.message });
    }
});

// 保存邮箱配置（自动加密密码）
router.post('/', (req, res) => {
    try {
        const newConfig = req.body;
        if (!newConfig.smtp || !newConfig.smtp.host || !newConfig.smtp.user) {
            return res.status(400).json({ success: false, error: 'SMTP配置不完整，host和user为必填项' });
        }

        const encryptedConfig = encryptEmailConfig(newConfig, config.encryption.key);
        const jsonStr = JSON.stringify(encryptedConfig, null, 4);
        fs.writeFileSync(configPath, jsonStr, 'utf-8');
        console.log('✅ 邮箱配置已更新并保存（密码已加密）');
        res.json({ success: true, message: '配置保存成功' });
    } catch (err) {
        console.error('保存配置失败:', err);
        res.status(500).json({ success: false, error: '保存配置失败: ' + err.message });
    }
});

// 测试 SMTP 连接
router.post('/test', async (req, res) => {
    try {
        const { host, port, secure, user, pass } = req.body;
        if (!host || !user || !pass) {
            return res.status(400).json({ success: false, error: 'SMTP配置不完整' });
        }

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port, 10) || 465,
            secure: secure !== false,
            auth: { user, pass },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        });

        await transporter.verify();
        res.json({ success: true, message: 'SMTP连接测试成功！' });
    } catch (err) {
        console.error('SMTP测试失败:', err);
        res.status(500).json({ success: false, error: '连接失败: ' + err.message });
    }
});

module.exports = router;
