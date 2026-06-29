# AGENTS.md

> 本文件面向 AI 编程助手。阅读本文档前，默认读者对本项目一无所知。

## 项目概述

本项目是**需求催办系统（可分发版本）**，一套用于管理需求评估流程、发送邮件/微信催办以及查询催办记录的轻量级工具集，主要面向 Windows 环境部署。项目包含三个相互配合的组成部分：

1. **Web 主应用（`email-manager/`）**：基于 Node.js + Express + MySQL 的前后端不分离 Web 应用，用于需求列表查看、工作量编辑、邮件催办、微信催办文案生成、催办记录查询及邮箱设置。
2. **Chrome 扩展（`requirement-email-extractor/`）**：在任意需求/工单页面一键提取需求信息并发送邮件，自动将数据写入 `sent_emails` 表，同时支持收件人管理和数据库联系人同步。
3. **本地 SMTP 邮件中继服务器（`requirement-email-extractor/local-smtp-server/`）**：独立的 Node.js HTTP 服务（默认 `127.0.0.1:2525`），接收 Chrome 扩展或 Web 主应用的发信请求，直接通过公司 SMTP 服务器发送邮件，并支持 IMAP 已发送存档。

Web 前端使用原生 HTML/CSS/JavaScript 通过 `fetch` 调用后端 API；后端使用 Express 提供 API 与静态资源服务。除登录页、登录相关 API 及公开静态资源外，所有页面和接口均通过**基于 Session 的登录认证**保护。

> 自然语言：项目内所有注释、文档、界面文案及日志均使用**简体中文**。

## 技术栈

- **运行时**：Node.js（推荐 v18+）
- **后端框架**：Express 5.x
- **数据库**：MySQL（使用 `mysql2/promise` 连接池）
- **会话管理**：`express-session`
- **邮件**：Nodemailer（SMTP 连接测试与发信），实际 Web 端催办邮件通过本地 SMTP 中继服务器转发
- **IMAP 存档**：`imap` 库用于将已发送邮件存档到邮箱「已发送」文件夹
- **环境配置**：dotenv（从 `.env` 读取）
- **辅助脚本**：Python 3（数据库字段初始化、检查、文档生成、截图生成、创建快捷方式；依赖 `pymysql`、`pywin32`、`python-docx`、`selenium` 等）
- **前端**：原生 HTML5、CSS3、JavaScript（无构建步骤）
- **Chrome 扩展**：Manifest V3，使用 Service Worker、Content Script、Popup 页面

关键配置文件：

- `email-manager/package.json`：Web 主应用依赖与脚本
- `email-manager/.env.example`：Web 主应用环境变量模板
- `email-manager/.gitignore`：排除 `node_modules`、`.env`、`email-config.json` 等敏感文件
- `requirement-email-extractor/local-smtp-server/package.json`：本地 SMTP 中继服务器依赖与脚本
- `requirement-email-extractor/manifest.json`：Chrome 扩展配置
- `requirement-email-extractor/安装说明.md`：插件快速说明

> 注意：本项目没有 `pyproject.toml`、`Cargo.toml`、`webpack.config.js` 等复杂构建配置。

## 目录结构

```
.
├── email-manager/                          # Web 主应用
│   ├── config/                             # 配置加载器
│   │   └── index.js                        # 从 .env 加载配置，提供统一 config 对象
│   ├── public/                             # 前端静态资源
│   │   ├── css/style.css                   # 全局样式
│   │   ├── js/index.js                     # 首页脚本（需求列表、编辑、邮箱设置、催办记录）
│   │   ├── js/reminder.js                  # 催办页面脚本
│   │   ├── index.html                      # 需求列表首页
│   │   ├── reminder.html                   # 需求催办页面
│   │   └── login.html                      # 登录页面
│   ├── routes/                             # Express API 路由
│   │   ├── auth.js                         # 登录、登出、当前用户查询
│   │   ├── emails.js                       # 需求邮件记录查询与批量更新
│   │   ├── reminders.js                    # 催办列表查询与发送催办邮件
│   │   ├── emailRecords.js                 # 邮件发送记录保存与查询
│   │   ├── saInfo.js                       # 责任人（SA）微信昵称查询
│   │   └── emailConfig.js                  # 邮箱配置读写与 SMTP 测试
│   ├── utils/                              # 工具模块
│   │   ├── auth.js                         # 基于 Session 的认证中间件
│   │   ├── db.js                           # MySQL 连接池
│   │   ├── email.js                        # 邮件内容构建（HTML/纯文本）
│   │   └── crypto.js                       # AES-256-GCM 配置加密
│   ├── .env.example                        # 环境变量示例
│   ├── .gitignore
│   ├── package.json
│   ├── server.js                           # 应用入口
│   ├── start-server.bat                    # Windows 一键启动脚本
│   └── create_shortcut.py                  # 创建桌面快捷方式
│
├── requirement-email-extractor/            # Chrome 扩展
│   ├── background/                         # 后台 Service Worker
│   │   └── background.js                   # 安装初始化、右键菜单、快捷键、消息中转
│   ├── content/                            # 页面内容提取脚本
│   │   └── content.js                      # 从当前页面提取需求字段
│   ├── popup/                              # 扩展弹窗页面
│   │   ├── popup.html
│   │   ├── popup.css
│   │   ├── popup.js
│   │   └── utils/crypto.js                 # 插件端 AES-256-GCM 加密工具
│   ├── local-smtp-server/                  # 插件本地 SMTP 中继服务器
│   │   ├── routes/                         # 服务端路由
│   │   │   ├── health.js                   # 健康检查
│   │   │   ├── email.js                    # 邮件发送
│   │   │   └── database.js                 # 数据库测试/写入/sa_info 管理
│   │   ├── utils/                          # 工具模块
│   │   │   ├── db.js                       # MySQL 连接池管理
│   │   │   └── imap.js                     # IMAP 已发送存档
│   │   ├── server.js                       # 中继服务器入口
│   │   ├── package.json
│   │   ├── start-server.bat                # 可见窗口启动（自动查找系统 node）
│   │   └── start-silent.vbs                # 静默后台启动
│   ├── lib/                                # Excel 处理库
│   │   └── xlsx.full.min.js
│   ├── icons/                              # 扩展图标
│   ├── default_contacts.json               # 示例联系人
│   ├── manifest.json                       # 插件配置
│   └── 安装说明.md                          # 插件快速说明
│
├── database/                               # 数据库脚本
│   ├── add_columns.py                      # 补齐 sent_emails 表字段
│   └── check_table.py                      # 检查表结构与数据样本
│
├── docs/                                   # 部署文档及截图
│   ├── 需求催办系统_部署文档及操作手册.docx
│   └── screenshots/
│
├── generate_manual.py                      # 生成 Word 操作手册
├── generate_plugin_screenshots.py          # 生成插件界面截图
├── take_screenshots.py                     # 生成 Web 端界面截图
├── start-all.bat                           # 一键启动 Web 服务 + SMTP 中继
├── README.md
└── AGENTS.md
```

## 构建与运行命令

### Web 主应用

所有命令在 `email-manager/` 目录下执行：

```bash
cd email-manager

# 安装依赖
npm install

# 启动服务（生产/开发均使用同一命令）
npm start

# 语法检查（测试）
npm test

# 初始化数据库字段（封装了 database/add_columns.py）
npm run init-db
```

### 本地 SMTP 中继服务器

命令在 `requirement-email-extractor/local-smtp-server/` 目录下执行：

```bash
cd requirement-email-extractor/local-smtp-server

# 安装依赖
npm install

# 启动中继服务
npm start
```

Windows 用户也可以直接双击 `start-server.bat`（可见窗口）或 `start-silent.vbs`（后台静默）。

### 辅助 Python 脚本

```bash
# 初始化/补齐 sent_emails 表字段（依赖 email-manager/.env）
cd database
python add_columns.py

# 检查 sent_emails 表结构与样本数据
cd database
python check_table.py

# 创建桌面快捷方式（依赖 pywin32）
cd email-manager
python create_shortcut.py

# 生成 Word 操作手册（依赖 python-docx）
python generate_manual.py

# 生成 Web 端截图（依赖 selenium）
python take_screenshots.py

# 生成插件截图（依赖 selenium）
python generate_plugin_screenshots.py
```

### Windows 一键启动

- 双击根目录 `start-all.bat`：同时启动 Web 服务（端口 3000）和本地 SMTP 中继服务（端口 2525）。
- 双击 `email-manager/start-server.bat`：仅启动 Web 服务。
- 双击 `requirement-email-extractor/local-smtp-server/start-silent.vbs`：后台静默启动中继服务。

## 代码风格指南

- **模块系统**：全部使用 CommonJS（`require` / `module.exports`），不使用 ES Module。
- **注释风格**：文件顶部使用 JSDoc 风格的多行注释说明模块用途；关键逻辑使用行内 `//` 注释，注释使用简体中文。
- **缩进与格式**：4 个空格缩进；字符串优先使用单引号；对象属性、函数参数等保持一致风格。
- **错误处理**：后端路由统一使用 `try/catch` 包裹，错误输出到控制台并返回 `{ success: false, error: ... }` 的 JSON。
- **数据库操作**：必须使用 `mysql2/promise` 的 `execute(sql, params)` 进行参数化查询，禁止字符串拼接 SQL（历史问题已修复）。`LIMIT` 等数值参数也经过 `parseInt` 校验。
- **API 响应格式**：统一返回 `{ success: true/false, data?: ..., error?: ..., message?: ... }`。
- **变量命名**：函数/变量使用 camelCase；数据库字段使用 snake_case；CSS 类名使用中划线连接的小写（BEM-like）。
- **前端脚本**：原生 DOM 操作，不引入第三方框架；认证依赖 Session Cookie，`fetch` 调用需携带 `credentials: 'same-origin'`。
- **加密**：Web 端 `email-config.json` 与 Chrome 插件 storage 中的 SMTP/DB 密码均使用 AES-256-GCM 加密存储。

## 测试说明

本项目的测试策略非常简单：

- `email-manager` 的 `npm test` 仅执行 Node.js 的语法检查（`node --check`），覆盖 `server.js`、`routes/*.js`、`utils/*.js`、`config/*.js`。
- 没有单元测试框架（如 Jest/Mocha）或集成测试套件。
- 注意：Windows 默认使用 `cmd.exe` 运行 npm 脚本，而 `cmd.exe` 不会展开 `*` 通配符，直接执行 `npm test` 可能报 `Cannot find module '...\routes\*.js'`。可在 Git Bash 或 PowerShell 中手动执行：`node --check server.js && node --check routes/*.js && node --check utils/*.js && node --check config/*.js`。
- 验证功能时通常需要：
  1. 正确配置 `email-manager/.env`；
  2. 确保 MySQL 服务运行且 `sent_emails`、`sa_info`、`email_records` 等表已存在；
  3. 如需邮件催办或插件发件，启动本地 SMTP 中继服务器（默认 `http://127.0.0.1:2525`）；
  4. Chrome 扩展需通过 `chrome://extensions/` 加载 `requirement-email-extractor` 目录。

## 安全注意事项

本项目已做以下安全整改，修改或扩展时务必保持：

1. **无硬编码密码**：数据库密码、SMTP 密码、Session 密钥等均从 `.env` 读取。
2. **Session 登录认证**：未登录请求会被重定向到 `/login.html`，API 请求返回 401；凭据由 `AUTH_USER` / `AUTH_PASS` 控制。
3. **防止 SQL 注入**：所有 SQL 查询使用参数化占位符 `?`，`LIMIT` 等数值参数也经过 `parseInt` 校验。
4. **敏感配置加密**：Web 端 `email-config.json` 与 Chrome 插件 storage 中的密码使用 AES-256-GCM 加密存储。
5. **敏感文件保护**：`.gitignore` 已排除 `.env`、`email-config.json`、日志和 IDE 配置文件。
6. **默认弱口令**：默认账号 `admin` / `changeme`，部署前必须修改。
7. **本地 SMTP 中继服务器仅监听本机**：`requirement-email-extractor/local-smtp-server/server.js` 默认监听 `127.0.0.1:2525`，并对敏感接口启用 CORS 来源校验，仅允许 `chrome-extension://` 来源及本机来源调用。
8. **部署建议**：生产环境应使用 HTTPS 反向代理（如 Nginx），并定期备份 MySQL 数据库。

## 部署流程（Windows 推荐）

1. 复制 `email-manager/.env.example` 为 `email-manager/.env`，填写真实配置（重点关注 `DB_PASSWORD`、`SMTP_*`、`AUTH_USER`、`AUTH_PASS`、`CONFIG_ENCRYPTION_KEY`、`SESSION_SECRET`）。
2. 在 `email-manager/` 下执行 `npm install`。
3. 在 `requirement-email-extractor/local-smtp-server/` 下执行 `npm install`。
4. 执行 `npm run init-db` 或在 `database/` 下执行 `python add_columns.py`，确保 `sent_emails` 表包含 `workload`、`is_involved` 字段。
5. 双击根目录 `start-all.bat`，或分别双击 `email-manager/start-server.bat` 与 `requirement-email-extractor/local-smtp-server/start-silent.vbs`。
6. 浏览器访问 `http://localhost:3000`，使用 `.env` 中配置的账号登录。
7. （可选）Chrome 浏览器访问 `chrome://extensions/`，开启开发者模式，加载已解压的扩展程序，选择 `requirement-email-extractor` 文件夹。

## 关键数据表

应用依赖 MySQL 中至少存在以下表：

- `sent_emails`：需求记录主表。Web 主应用读取该表展示需求列表；Chrome 扩展发送邮件后也会向该表写入记录。常用字段包括 `id`、`req_id`、`req_name`、`proposer`、`propose_time`、`background`、`description`、`clarification`、`system_name`、`sa_name`、`send_datetime`、`workload`、`is_involved`、`involve_dev`、`dev_ticket_no`、`created_at` 等。
- `sa_info`：责任人信息表，包含 `sa_name`、`system_name`、`email`、`wechat_nickname`、`created_at` 等。Web 催办邮件从这里读取收件人邮箱，Chrome 扩展从这里加载数据库联系人。
- `email_records`：邮件发送记录表，用于保存催办历史，字段包括 `id`、`req_id`、`req_name`、`email_type`、`recipient`、`recipient_name`、`subject`、`content`、`send_status`、`error_msg`、`source`、`sender`、`created_at` 等。

> `database/add_columns.py` 仅负责补齐 `sent_emails` 表的 `workload` 与 `is_involved` 字段，不会创建整张表；`requirement-email-extractor/local-smtp-server/utils/db.js` 会在首次写入时自动建表（如表不存在）。

## 给 AI 助手的开发提示

- 修改 API 时，请同步检查 `email-manager/public/js/index.js` 或 `email-manager/public/js/reminder.js` 中的调用方，以及 Chrome 扩展 `popup/popup.js`、中继服务器 `local-smtp-server/routes/*.js` 等调用方。
- 新增 Web 路由需要在 `email-manager/server.js` 中 `app.use('/api/...', ...)` 注册，并且会被 `requireAuth` 自动保护。
- 新增环境变量需要在 `email-manager/config/index.js` 中读取，并在 `.env.example` 中补充示例。
- 邮件相关配置通过 `email-config.json` 热更新，保存后无需重启服务器；但首次启动前必须确保 `.env` 已正确配置。
- 不要在前端暴露 SMTP 密码等敏感信息；前端邮箱设置弹窗中密码框留空表示「不修改」。
- 保持所有注释、日志、提示文案使用简体中文。
- 修改 Chrome 扩展时，注意同时检查 `manifest.json`、`background/background.js`、`content/content.js`、`popup/popup.js` 以及中继服务器相关接口的兼容性。
