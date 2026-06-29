/**
 * 健康检查路由
 */

function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: '本地SMTP中继服务器运行中' }));
}

module.exports = { handleHealth };
