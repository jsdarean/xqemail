/**
 * 需求邮件记录相关路由
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../utils/db');

// 获取所有邮件记录
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, req_id, req_name, proposer, system_name, sa_name,
                    COALESCE(workload, 0) AS workload, COALESCE(is_involved, 1) AS is_involved,
                    dev_ticket_no, background, description, clarification,
                    propose_time, DATE(propose_time) AS propose_date
             FROM sent_emails
             ORDER BY id DESC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('查询错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 批量更新
router.put('/batch-update', async (req, res) => {
    try {
        const updates = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ success: false, error: '无效的更新数据格式，需要数组' });
        }

        let successCount = 0;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const item of updates) {
                if (!item.id) continue;
                const { id, workload, is_involved, dev_ticket_no } = item;
                const updateFields = [];
                const params = [];

                if (workload !== undefined && workload !== '' && workload !== null) {
                    updateFields.push('workload = ?');
                    params.push(parseFloat(workload) || 0);
                }
                if (is_involved !== undefined && is_involved !== '') {
                    updateFields.push('is_involved = ?');
                    params.push(is_involved === true || is_involved === 1 || is_involved === 'true' ? 1 : 0);
                }
                if (dev_ticket_no !== undefined) {
                    updateFields.push('dev_ticket_no = ?');
                    params.push(dev_ticket_no || null);
                }

                if (updateFields.length > 0) {
                    const sql = `UPDATE sent_emails SET ${updateFields.join(', ')} WHERE id = ?`;
                    params.push(id);
                    await connection.execute(sql, params);
                    successCount++;
                }
            }

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        res.json({
            success: true,
            message: `成功更新 ${successCount} / ${updates.length} 条记录`,
            total: updates.length,
            updated: successCount
        });
    } catch (error) {
        console.error('[批量更新错误]:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
