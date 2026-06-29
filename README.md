# 需求催办系统（可分发版本）

基于 Node.js + Express + MySQL 的需求催办管理工具，支持需求列表查看、工作量编辑、邮件催办、微信催办、催办记录查询，以及 Chrome 插件一键提取页面需求信息并发送邮件。

---

## 📁 项目结构

```
2026-06-18-09-00-23-distributable/
├── email-manager/              # 主应用
│   ├── config/                 # 配置加载器
│   │   └── index.js
│   ├── public/                 # 前端静态资源
│   │   ├── css/style.css
│   │   ├── js/index.js
│   │   ├── js/reminder.js
│   │   ├── index.html
│   │   ├── reminder.html
│   │   └── login.html
│   ├── routes/                 # API 路由
│   │   ├── emails.js
│   │   ├── reminders.js
│   │   ├── emailRecords.js
│   │   ├── saInfo.js
│   │   ├── emailConfig.js
│   │   └── auth.js
│   ├── utils/                  # 工具函数
│   │   ├── auth.js
│   │   ├── db.js
│   │   ├── email.js
│   │   └── crypto.js
│   ├── .env.example            # 环境变量示例
│   ├── .gitignore
│   ├── package.json
│   ├── server.js               # 主入口
│   ├── start-server.bat        # Windows 一键启动
│   └── create_shortcut.py      # 创建桌面快捷方式
├── requirement-email-extractor/# Chrome 插件
│   ├── background/             # 后台 Service Worker
│   ├── content/                # 页面内容提取脚本
│   ├── icons/                  # 插件图标
│   ├── lib/                    # Excel 处理库
│   ├── local-smtp-server/      # 插件本地 SMTP 中继服务器
│   │   ├── routes/             # 服务端路由
│   │   ├── utils/              # 数据库、IMAP 工具
│   │   ├── server.js           # 中继服务器入口
│   │   ├── start-server.bat    # 可见窗口启动
│   │   └── start-silent.vbs    # 静默后台启动
│   ├── popup/                  # 插件弹窗页面
│   ├── manifest.json           # 插件配置
│   └── 安装说明.md              # 插件快速说明
├── database/                   # 数据库脚本
│   ├── add_columns.py
│   └── check_table.py
├── docs/                       # 部署文档及截图
│   ├── 需求催办系统_部署文档及操作手册.docx
│   └── screenshots/
├── README.md
└── start-all.bat               # 一键启动 Web 服务 + SMTP 中继
```

---

## 🚀 快速开始

### 1. 安装依赖

进入 `email-manager` 目录，执行：

```bash
cd email-manager
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入真实值：

```bash
cp .env.example .env
```

必填项：

- `DB_PASSWORD`：MySQL 密码
- `SMTP_HOST`、`SMTP_USER`、`SMTP_PASS`：发件邮箱信息
- `AUTH_USER`、`AUTH_PASS`：登录账号密码（默认 admin / changeme，部署前务必修改）

### 3. 初始化数据库字段

```bash
cd ../database
python add_columns.py
```

### 4. 启动服务

本项目需要同时运行 Web 服务（端口 3000）和插件本地 SMTP 中继服务（端口 2525）。

#### 方式一：一键启动所有服务（推荐）

双击运行根目录下的 `start-all.bat`，会自动打开两个窗口分别运行两个服务。

#### 方式二：分别启动

```bash
# 启动 Web 服务
cd email-manager
npm start

# 启动插件本地 SMTP 中继服务（另开窗口）
cd requirement-email-extractor/local-smtp-server
npm start
```

服务启动后，浏览器访问：

```
http://localhost:3000
```

---

## 🔑 默认登录账号

- 用户名：`admin`
- 密码：`changeme`

首次访问会自动跳转到登录页面。

**注意**：部署到生产环境前，请务必修改 `.env` 中的 `AUTH_USER`、`AUTH_PASS`、`CONFIG_ENCRYPTION_KEY` 和 `SESSION_SECRET`。

---

## 📧 邮件催办前提

1. 本地需要运行 SMTP 中继服务器（默认地址 `http://127.0.0.1:2525`）。
2. 在 `.env` 中配置正确的 SMTP 信息。
3. `sa_info` 表中需维护责任人的邮箱地址。

## 🔌 Chrome 插件使用

1. 启动 Web 服务和本地 SMTP 中继服务器。
2. 打开 Chrome，访问 `chrome://extensions/`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `requirement-email-extractor` 文件夹。
4. 打开任意需求/工单页面，点击插件图标，配置 SMTP 和数据库后即可提取信息并发送邮件。

插件相关详细说明见 `docs/需求催办系统_部署文档及操作手册.docx`。

---

## 🛡️ 安全改进说明

与原版相比，本可分发版本做了以下安全整改：

1. **移除所有硬编码密码**：数据库密码、邮箱密码全部从 `.env` 或插件配置中读取。
2. **新增 Session 登录认证**：未登录自动跳转到登录页，支持安全登出。
3. **邮箱配置密码加密**：Web 端 `email-config.json` 与 Chrome 插件 storage 中的 SMTP/DB 密码均使用 AES-256-GCM 加密存储。
4. **修复 SQL 注入**：`LIMIT` 等参数改为参数化查询。
5. **数据库连接池化**：Web 端与插件中继服务器均使用 MySQL 连接池。
6. **插件 CORS 来源校验**：中继服务器仅允许 `chrome-extension://` 来源调用敏感接口。
7. **`.gitignore` 保护**：排除 `.env`、`email-config.json` 等敏感文件。

---

## 🐛 修复的已知问题

1. `create_shortcut.py` 中 `CreateShortut` 拼写错误修正为 `CreateShortcut`。
2. `index.html` 中多余闭合标签 `</div></div>` 已清理。
3. `goPage()` 函数中错误的 `getElementById('tableContainer')` 已修正为类选择器。
4. 前端重复排序逻辑已合并。
5. 删除临时脚本和调试文件（`update_page.py`、`inject_debug*.js`、`test-server.js`、`server.js.bak`、`nul`）。

---

## 📝 常用命令

| 命令 | 说明 |
|---|---|
| `npm start` | 启动服务器 |
| `npm test` | 语法检查 |
| `npm run init-db` | 初始化数据库字段 |

---

## ⚠️ 部署建议

1. 修改默认账号密码。
2. 使用 HTTPS 反向代理（如 Nginx）。
3. 定期备份 MySQL 数据库。
4. 不要将 `.env` 提交到版本控制。
