/**
 * 数据库相关路由
 */

const { getPool, getAdminConnection, ensureSentEmailsTable, ensureSaInfoTable } = require('../utils/db');

async function handleTestDb(req, res, body) {
  const result = await testDbConnectionFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleWriteDb(req, res, body) {
  const result = await writeToDatabaseFn(body.dbConfig, body.data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleQuerySaInfo(req, res, body) {
  const result = await querySaInfoFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleCheckDuplicate(req, res, body) {
  const result = await checkSaInfoDuplicateFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleAddSaInfo(req, res, body) {
  const result = await addSaInfoFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleDeleteSaInfo(req, res, body) {
  const result = await deleteSaInfoFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function handleUpdateSaInfo(req, res, body) {
  const result = await updateSaInfoFn(body);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function testDbConnectionFn(config) {
  if (!config.host) throw new Error('缺少数据库主机 (host)');
  if (!config.user) throw new Error('缺少数据库用户名 (user)');
  if (!config.database) throw new Error('缺少数据库名 (database)');

  const adminConn = await getAdminConnection(config);
  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await adminConn.end();
  }

  const pool = getPool(config);
  const tableName = config.table || 'sent_emails';
  await ensureSentEmailsTable(pool, tableName);

  return { success: true, message: `数据库连接成功！表 "${tableName}" 已就绪` };
}

async function writeToDatabaseFn(dbConfig, data) {
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }

  const pool = getPool(dbConfig);
  const tableName = dbConfig.table || 'sent_emails';
  await ensureSentEmailsTable(pool, tableName);

  const [result] = await pool.execute(
    `INSERT INTO \`${tableName}\`
      (req_id, req_name, proposer, propose_time, is_involved, involve_dev, background, description, clarification, system_name, sa_name, send_datetime)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.reqId || '',
      data.reqName || '',
      data.proposer || '',
      data.proposeTime || '',
      data.involveDev || '是',
      data.background || '',
      data.description || '',
      data.clarification || '',
      data.system || '',
      data.sa || '',
      data.sendDateTime || new Date().toLocaleString('zh-CN', { hour12: false })
    ]
  );

  return { success: true, affectedRows: result.affectedRows, insertId: result.insertId };
}

async function querySaInfoFn(body) {
  const dbConfig = body.dbConfig;
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }

  const pool = getPool(dbConfig);
  await ensureSaInfoTable(pool);

  const [rows] = await pool.query('SELECT sa_name, system_name, email, wechat_nickname FROM sa_info ORDER BY system_name, sa_name');
  const contacts = rows
    .filter(r => r.email && r.email.includes('@'))
    .map(r => ({
      name: r.sa_name || '',
      email: r.email.trim(),
      system: r.system_name || '',
      wechatNickname: r.wechat_nickname || ''
    }));
  return { success: true, contacts };
}

async function checkSaInfoDuplicateFn(body) {
  const { dbConfig, sa_name, system_name } = body;
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }
  const pool = getPool(dbConfig);
  await ensureSaInfoTable(pool);
  const [rows] = await pool.query(
    'SELECT id FROM sa_info WHERE sa_name = ? AND system_name = ? LIMIT 1',
    [sa_name, system_name]
  );
  return { success: true, exists: rows.length > 0 };
}

async function addSaInfoFn(body) {
  const { dbConfig, sa_name, system_name, email, wechat_nickname } = body;
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }
  if (!sa_name || !email) {
    return { success: false, error: '姓名和邮箱不能为空' };
  }
  const pool = getPool(dbConfig);
  await ensureSaInfoTable(pool);

  const [dup] = await pool.query(
    'SELECT id FROM sa_info WHERE (sa_name = ? AND system_name = ?) OR email = ? LIMIT 1',
    [sa_name, system_name, email]
  );
  if (dup.length > 0) {
    return { success: false, error: '同一系统下已存在该姓名，或该邮箱已被使用' };
  }
  const [result] = await pool.execute(
    'INSERT INTO sa_info (sa_name, system_name, email, wechat_nickname) VALUES (?, ?, ?, ?)',
    [sa_name, system_name, email, wechat_nickname || null]
  );
  return { success: true, insertId: result.insertId };
}

async function deleteSaInfoFn(body) {
  const { dbConfig, sa_name, system_name, email } = body;
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }
  const pool = getPool(dbConfig);
  await ensureSaInfoTable(pool);
  const [result] = await pool.execute(
    'DELETE FROM sa_info WHERE sa_name = ? AND system_name = ? AND email = ?',
    [sa_name, system_name, email]
  );
  return { success: true, affectedRows: result.affectedRows };
}

async function updateSaInfoFn(body) {
  const { dbConfig, old_name, old_system, old_email, sa_name, system_name, email, wechat_nickname } = body;
  if (!dbConfig || !dbConfig.host || !dbConfig.user || !dbConfig.database) {
    return { success: false, error: '数据库配置不完整' };
  }
  const pool = getPool(dbConfig);
  await ensureSaInfoTable(pool);

  if (old_name !== sa_name || old_system !== system_name) {
    const [dup] = await pool.query(
      'SELECT id FROM sa_info WHERE sa_name = ? AND system_name = ? AND NOT (sa_name = ? AND system_name = ? AND email = ?) LIMIT 1',
      [sa_name, system_name, old_name, old_system, old_email]
    );
    if (dup.length > 0) {
      return { success: false, error: '同一系统下已存在该姓名' };
    }
  }
  const [result] = await pool.execute(
    'UPDATE sa_info SET sa_name = ?, system_name = ?, email = ?, wechat_nickname = ? WHERE sa_name = ? AND system_name = ? AND email = ?',
    [sa_name, system_name, email, wechat_nickname || null, old_name, old_system, old_email]
  );
  return { success: true, affectedRows: result.affectedRows };
}

module.exports = {
  handleTestDb,
  handleWriteDb,
  handleQuerySaInfo,
  handleCheckDuplicate,
  handleAddSaInfo,
  handleDeleteSaInfo,
  handleUpdateSaInfo
};
