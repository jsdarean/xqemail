/**
 * 数据库连接池工具
 */
const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
    ...config.db,
    connectionLimit: 10,
    queueLimit: 0,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// 测试连接池
pool.getConnection()
    .then(conn => {
        console.log('✅ 数据库连接池初始化成功');
        conn.release();
    })
    .catch(err => {
        console.error('❌ 数据库连接池初始化失败:', err.message);
    });

module.exports = {
    pool
};
