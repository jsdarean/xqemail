/**
 * 统一配置加载器
 * 优先从环境变量读取，未设置则使用默认值
 */
require('dotenv').config();

const config = {
    server: {
        port: parseInt(process.env.PORT, 10) || 3000,
        host: process.env.HOST || '0.0.0.0'
    },
    auth: {
        username: process.env.AUTH_USER || 'admin',
        password: process.env.AUTH_PASS || 'changeme'
    },
    encryption: {
        key: process.env.CONFIG_ENCRYPTION_KEY || ''
    },
    session: {
        secret: process.env.SESSION_SECRET || (process.env.AUTH_PASS || 'changeme')
    },
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'aicoding',
        charset: process.env.DB_CHARSET || 'utf8mb4'
    },
    relay: {
        server: process.env.RELAY_SERVER || 'http://127.0.0.1:2525'
    },
    email: {
        smtp: {
            host: process.env.SMTP_HOST || '',
            port: parseInt(process.env.SMTP_PORT, 10) || 465,
            secure: process.env.SMTP_SECURE !== 'false',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            imapHost: process.env.IMAP_HOST || '',
            imapPort: parseInt(process.env.IMAP_PORT, 10) || 993
        },
        imap: {
            host: process.env.IMAP_HOST || '',
            port: parseInt(process.env.IMAP_PORT, 10) || 993
        },
        signature: process.env.EMAIL_SIGNATURE || '',
        defaultCc: process.env.EMAIL_DEFAULT_CC || ''
    }
};

module.exports = config;
