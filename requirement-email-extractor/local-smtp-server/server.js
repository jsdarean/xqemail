/**
 * 本地 SMTP 邮件中继服务器（重构版）
 *
 * 用途：接收 Chrome 插件发来的邮件请求，直接通过公司 SMTP 服务器发送邮件。
 * 所有数据仅经过本机，不经过任何第三方服务器。
 *
 * 启动方式：
 *   node server.js
 * 或双击 start-server.bat
 */

const http = require('http');
const { closeAllPools } = require('./utils/db');
const { handleHealth } = require('./routes/health');
const { handleSendEmail } = require('./routes/email');
const {
  handleTestDb,
  handleWriteDb,
  handleQuerySaInfo,
  handleCheckDuplicate,
  handleAddSaInfo,
  handleDeleteSaInfo,
  handleUpdateSaInfo
} = require('./routes/database');

const PORT = 2525;
const HOST = '127.0.0.1'; // 仅监听本机，外部无法访问

/**
 * 判断请求源是否受信任
 * 允许 Chrome 扩展 origin 和本地来源
 */
function isTrustedOrigin(origin) {
  if (!origin) return false;
  if (origin.startsWith('chrome-extension://')) return true;
  if (origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost')) return true;
  return false;
}

/**
 * 设置响应头
 */
function setCorsHeaders(res, origin) {
  // 对受信任来源才反射 Origin；否则不设置 Access-Control-Allow-Origin
  if (origin && isTrustedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      try {
        const data = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('请求体不是有效的 JSON: ' + e.message));
      }
    });
    req.on('error', reject);
  });
}

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: message }));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  setCorsHeaders(res, origin);

  // 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 敏感接口校验来源
  const sensitivePaths = ['/send', '/write-db', '/test-db', '/query-sa-info', '/check-sa-info-duplicate', '/add-sa-info', '/delete-sa-info', '/update-sa-info'];
  if (req.method === 'POST' && sensitivePaths.includes(req.url)) {
    if (!isTrustedOrigin(origin)) {
      console.warn(`[Security] 拒绝非信任来源请求: ${req.url}, origin=${origin || 'none'}`);
      sendError(res, 403, '拒绝访问：请求来源不受信任');
      return;
    }
  }

  try {
    // 健康检查
    if (req.method === 'GET' && req.url === '/health') {
      handleHealth(req, res);
      return;
    }

    // 测试数据库连接
    if (req.method === 'POST' && req.url === '/test-db') {
      const body = await readBody(req);
      await handleTestDb(req, res, body);
      return;
    }

    // 查询 sa_info 收件人列表
    if (req.method === 'POST' && req.url === '/query-sa-info') {
      const body = await readBody(req);
      await handleQuerySaInfo(req, res, body);
      return;
    }

    // 检查 sa_info 重复
    if (req.method === 'POST' && req.url === '/check-sa-info-duplicate') {
      const body = await readBody(req);
      await handleCheckDuplicate(req, res, body);
      return;
    }

    // 新增 sa_info 收件人
    if (req.method === 'POST' && req.url === '/add-sa-info') {
      const body = await readBody(req);
      await handleAddSaInfo(req, res, body);
      return;
    }

    // 删除 sa_info 收件人
    if (req.method === 'POST' && req.url === '/delete-sa-info') {
      const body = await readBody(req);
      await handleDeleteSaInfo(req, res, body);
      return;
    }

    // 更新 sa_info 收件人
    if (req.method === 'POST' && req.url === '/update-sa-info') {
      const body = await readBody(req);
      await handleUpdateSaInfo(req, res, body);
      return;
    }

    // 写入数据库
    if (req.method === 'POST' && req.url === '/write-db') {
      const body = await readBody(req);
      await handleWriteDb(req, res, body);
      return;
    }

    // 发送邮件
    if (req.method === 'POST' && req.url === '/send') {
      const body = await readBody(req);
      await handleSendEmail(req, res, body);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error(`[Server] 处理 ${req.url} 失败:`, err.message);
    sendError(res, 500, err.message);
  }
});

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n[Server] 正在关闭...');
  await closeAllPools();
  server.close(() => {
    console.log('[Server] 已关闭');
    process.exit(0);
  });
});

server.listen(PORT, HOST, () => {
  console.log('='.repeat(50));
  console.log('  📧 本地 SMTP 邮件中继服务器');
  console.log('='.repeat(50));
  console.log(`  地址: http://${HOST}:${PORT}`);
  console.log(`  健康检查: http://${HOST}:${PORT}/health`);
  console.log(`  发送接口: POST http://${HOST}:${PORT}/send`);
  console.log('');
  console.log('  🔒 服务器仅监听本机 (127.0.0.1)，外部无法访问');
  console.log('  🔒 已启用来源校验，仅允许 Chrome 扩展调用敏感接口');
  console.log('  💡 关闭此窗口即可停止服务器');
  console.log('='.repeat(50));
});
