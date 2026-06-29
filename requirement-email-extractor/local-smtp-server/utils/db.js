/**
 * MySQL 连接池管理
 * 按 (host + database + user) 缓存连接池，避免每次请求新建连接。
 */

const mysql = require('mysql2/promise');

const pools = new Map();

/**
 * 根据 dbConfig 获取或创建连接池
 */
function getPool(dbConfig) {
  const key = `${dbConfig.host}:${dbConfig.port || 3306}:${dbConfig.database}:${dbConfig.user}`;
  if (!pools.has(key)) {
    pools.set(key, mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port || 3306,
      user: dbConfig.user,
      password: dbConfig.pass || '',
      database: dbConfig.database,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    }));
  }
  return pools.get(key);
}

/**
 * 获取一个用于管理数据库的临时连接（不带 database，用于 CREATE DATABASE）
 */
async function getAdminConnection(dbConfig) {
  return mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port || 3306,
    user: dbConfig.user,
    password: dbConfig.pass || '',
    connectTimeout: 5000
  });
}

/**
 * 关闭所有池（用于优雅退出）
 */
async function closeAllPools() {
  const promises = [];
  for (const [key, pool] of pools.entries()) {
    promises.push(pool.end().catch(err => console.warn(`[DB] 关闭池 ${key} 失败:`, err.message)));
  }
  await Promise.all(promises);
  pools.clear();
}

/**
 * 确保邮件记录表存在
 */
async function ensureSentEmailsTable(pool, tableName) {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      req_id VARCHAR(255) COMMENT '需求编号',
      req_name VARCHAR(500) COMMENT '需求名称',
      proposer VARCHAR(255) COMMENT '提出人',
      propose_time VARCHAR(255) COMMENT '提出时间',
      background TEXT COMMENT '需求背景及目标',
      description TEXT COMMENT '需求描述',
      clarification TEXT COMMENT '需求澄清',
      system_name VARCHAR(255) COMMENT '系统',
      sa_name VARCHAR(255) COMMENT 'SA',
      send_datetime VARCHAR(64) COMMENT '邮件发送日期',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '写入时间',
      INDEX idx_req_id (req_id),
      INDEX idx_send_datetime (send_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求邮件发送记录'`
  );

  // 确保新增列存在
  const columns = [
    ['propose_time', 'VARCHAR(255) COMMENT \'提出时间\''],
    ['involve_dev', 'VARCHAR(10) DEFAULT \'是\' COMMENT \'涉及开发\''],
    ['is_involved', 'TINYINT(1) DEFAULT 1 COMMENT \'是否涉及开发\''],
  ];
  for (const [col, def] of columns) {
    try {
      const [existing] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [col]);
      if (existing.length === 0) {
        await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` ${def}`);
      } else if (col === 'is_involved' && existing[0].Default === '0') {
        await pool.execute(`ALTER TABLE \`${tableName}\` ALTER COLUMN \`${col}\` SET DEFAULT 1`);
      }
    } catch (e) {
      console.warn('[DB] ALTER TABLE warning:', e.message);
    }
  }
}

/**
 * 确保 sa_info 表存在并包含 wechat_nickname 列
 */
async function ensureSaInfoTable(pool) {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS sa_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sa_name VARCHAR(255) NOT NULL COMMENT 'SA姓名',
      system_name VARCHAR(255) DEFAULT NULL COMMENT '系统名称',
      email VARCHAR(255) NOT NULL COMMENT '邮箱',
      wechat_nickname VARCHAR(255) DEFAULT NULL COMMENT '微信昵称',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_sa_system (sa_name, system_name),
      UNIQUE KEY uk_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SA信息表'`
  );

  const [cols] = await pool.query("SHOW COLUMNS FROM sa_info LIKE 'wechat_nickname'");
  if (cols.length === 0) {
    await pool.query('ALTER TABLE sa_info ADD COLUMN wechat_nickname VARCHAR(255) DEFAULT NULL');
  }
}

module.exports = {
  getPool,
  getAdminConnection,
  closeAllPools,
  ensureSentEmailsTable,
  ensureSaInfoTable
};
