-- ==========================================
-- 数据库验证和对比脚本
-- ==========================================
-- 使用方法:
-- MYSQL_PWD='sample' mysql -h 123.57.11.100 -P 3506 -u sample < validate-databases.sql
-- ==========================================

-- 1. 显示所有数据库
SELECT '=== 所有数据库列表 ===' AS info;
SHOW DATABASES;

-- 2. 检查 Siriusec 相关数据库
SELECT '=== Siriusec 相关数据库 ===' AS info;
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME LIKE '%siriusec%'
   OR SCHEMA_NAME LIKE '%siriusec%'
   OR SCHEMA_NAME LIKE '%access%'
   OR SCHEMA_NAME LIKE '%proxy%';

-- 3. 查看各数据库的表数量
SELECT '=== 各数据库表数量 ===' AS info;
SELECT
    TABLE_SCHEMA AS '数据库',
    COUNT(TABLE_NAME) AS '表数量'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
GROUP BY TABLE_SCHEMA
ORDER BY TABLE_SCHEMA;

-- 4. 查看具体的表结构 (如果有 siriusec 或 siriusec 数据库)
-- 请根据实际数据库名称修改
-- USE siriusec;  -- 或您的实际数据库名
-- SHOW TABLES;
-- DESCRIBE your_table_name;

-- 5. 查看用户和权限
SELECT '=== 数据库用户列表 ===' AS info;
SELECT User, Host, authentication_string
FROM mysql.user
WHERE User = 'sample' OR User LIKE '%siriusec%' OR User LIKE '%siriusec%';

-- 6. 检查连接数和状态
SELECT '=== 连接状态 ===' AS info;
SHOW STATUS LIKE 'Threads_connected';
SHOW PROCESSLIST;

-- 7. 查看数据库大小
SELECT '=== 数据库大小 ===' AS info;
SELECT
    TABLE_SCHEMA AS '数据库',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS '大小(MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
GROUP BY TABLE_SCHEMA
ORDER BY SUM(data_length + index_length) DESC;

-- 8. 如果是旧平台对比,导出关键数据用于对比
-- 示例: 导出用户列表、会话记录等
-- SELECT * FROM your_users_table ORDER BY created_at DESC LIMIT 100;
-- SELECT COUNT(*) as total_sessions FROM your_sessions_table WHERE created_at > NOW() - INTERVAL 7 DAY;

-- 9. 检查最近的活动记录 (根据实际表结构调整)
-- SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50;
-- SELECT * FROM sessions WHERE ended_at IS NULL;

-- 10. 验证数据完整性
SELECT '=== 数据完整性检查 ===' AS info;
SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    TABLE_ROWS,
    AVG_ROW_LENGTH,
    ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'total_size_mb'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
  AND TABLE_ROWS > 0
ORDER BY TABLE_ROWS DESC
LIMIT 50;
