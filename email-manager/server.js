/**
 * 需求催办系统 - 主入口（可分发版本）
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { encryptEmailConfig } = require('./utils/crypto');
const requireAuth = require('./utils/auth');

const emailsRouter = require('./routes/emails');
const remindersRouter = require('./routes/reminders');
const emailRecordsRouter = require('./routes/emailRecords');
const saInfoRouter = require('./routes/saInfo');
const emailConfigRouter = require('./routes/emailConfig');
const authRouter = require('./routes/auth');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Session 配置
app.use(session({
    name: 'email_manager_session',
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 小时
    }
}));

// 初始化邮箱配置文件（如果不存在，从环境变量生成并加密）
const configPath = path.join(__dirname, 'email-config.json');
if (!fs.existsSync(configPath)) {
    const initialConfig = {
        smtp: config.email.smtp,
        imap: config.email.imap,
        signature: config.email.signature,
        defaultCc: config.email.defaultCc
    };
    const encryptedConfig = encryptEmailConfig(initialConfig, config.encryption.key);
    fs.writeFileSync(configPath, JSON.stringify(encryptedConfig, null, 4), 'utf-8');
    console.log('✅ 已从 .env 生成 email-config.json（密码已加密）');
}

// 公开访问的静态文件：登录页和认证相关资源
app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// 公开 API：登录、登出、当前用户
app.use('/api/auth', authRouter);

// 其他所有页面和 API 需要认证
app.use(requireAuth);

// 受保护的静态资源
app.use(express.static('public', {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// 根路径重定向到首页
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// API 路由
app.use('/api/emails', emailsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/email-records', emailRecordsRouter);
app.use('/api/sa-wechat', saInfoRouter);
app.use('/api/email-config', emailConfigRouter);

// 健康检查
app.get('/health', (req, res) => {
    res.json({ success: true, message: '服务运行中' });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('未捕获错误:', err);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(config.server.port, config.server.host, () => {
    console.log(`服务器运行在 http://${config.server.host}:${config.server.port}`);
    console.log(`请使用浏览器访问 http://localhost:${config.server.port}`);
});
