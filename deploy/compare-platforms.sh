#!/bin/bash
# ==========================================
# 新旧平台业务数据对比脚本
# ==========================================
# 用途: 对比旧平台和新平台(Siriusec)的业务数据
# 使用方法:
#   bash compare-platforms.sh
# ==========================================

set -e

# 数据库配置
DB_HOST="123.57.11.100"
DB_PORT="3506"
DB_USER="sample"
DB_PASS="sample"

MYSQL_CMD="MYSQL_PWD=${DB_PASS} mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER}"

echo "=========================================="
echo "新旧平台业务数据对比"
echo "=========================================="
echo ""
echo "数据库: ${DB_HOST}:${DB_PORT}"
echo "账号: ${DB_USER}"
echo ""

# 检查 MySQL 连接
echo "[检查] 测试 MySQL 连接..."
if ! ${MYSQL_CMD} -e "SELECT 1" >/dev/null 2>&1; then
    echo "错误: 无法连接到 MySQL!"
    echo "请检查:"
    echo "  1. MySQL 服务是否运行"
    echo "  2. 网络连接"
    echo "  3. 账号密码是否正确"
    exit 1
fi
echo "MySQL 连接成功!"
echo ""

# 1. 列出所有数据库
echo "=========================================="
echo "1. 数据库列表"
echo "=========================================="
${MYSQL_CMD} -e "SHOW DATABASES;" 2>/dev/null | grep -v -E "(Database|information_schema|mysql|performance_schema|sys)"
echo ""

# 2. 检查旧平台数据库
echo "=========================================="
echo "2. 旧平台数据库检查"
echo "=========================================="
# 根据实际旧平台数据库名称修改
OLD_DB_NAMES=("teleport" "old_platform" "legacy" "platform_v1")

for db in "${OLD_DB_NAMES[@]}"; do
    if ${MYSQL_CMD} -e "USE ${db}" 2>/dev/null; then
        echo "找到旧平台数据库: ${db}"
        TABLE_COUNT=$(${MYSQL_CMD} -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}';" 2>/dev/null)
        echo "  表数量: ${TABLE_COUNT}"

        # 列出表
        ${MYSQL_CMD} -e "SHOW TABLES;" 2>/dev/null | head -20

        # 数据量统计
        echo "  数据量统计:"
        ${MYSQL_CMD} -e "
            SELECT
                TABLE_NAME,
                TABLE_ROWS,
                ROUND((data_length + index_length) / 1024 / 1024, 2) AS 'size_mb'
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = '${db}'
            ORDER BY TABLE_ROWS DESC;
        " 2>/dev/null
    fi
done
echo ""

# 3. 检查新平台数据库
echo "=========================================="
echo "3. 新平台数据库检查 (Siriusec)"
echo "=========================================="
NEW_DB_NAMES=("siriusec" "platform_v2" "new_platform")

for db in "${NEW_DB_NAMES[@]}"; do
    if ${MYSQL_CMD} -e "USE ${db}" 2>/dev/null; then
        echo "找到新平台数据库: ${db}"
        TABLE_COUNT=$(${MYSQL_CMD} -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${db}';" 2>/dev/null)
        echo "  表数量: ${TABLE_COUNT}"

        ${MYSQL_CMD} -e "SHOW TABLES;" 2>/dev/null | head -20
    fi
done
echo ""

# 4. 关键业务数据对比
echo "=========================================="
echo "4. 关键业务数据对比"
echo "=========================================="

# 用户对比
echo ""
echo "--- 用户数据对比 ---"
for db in "${OLD_DB_NAMES[@]}" "${NEW_DB_NAMES[@]}"; do
    if ${MYSQL_CMD} -e "USE ${db}" 2>/dev/null; then
        # 尝试查找用户表
        USER_TABLES=$(${MYSQL_CMD} -N -e "
            SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA='${db}'
            AND (TABLE_NAME LIKE '%user%' OR TABLE_NAME LIKE '%account%' OR TABLE_NAME LIKE '%member%');
        " 2>/dev/null)

        for table in ${USER_TABLES}; do
            COUNT=$(${MYSQL_CMD} -N -e "SELECT COUNT(*) FROM ${db}.${table};" 2>/dev/null || echo "0")
            echo "${db}.${table}: ${COUNT} 条记录"
        done
    fi
done

# 会话/访问记录对比
echo ""
echo "--- 会话/访问记录对比 ---"
for db in "${OLD_DB_NAMES[@]}" "${NEW_DB_NAMES[@]}"; do
    if ${MYSQL_CMD} -e "USE ${db}" 2>/dev/null; then
        SESSION_TABLES=$(${MYSQL_CMD} -N -e "
            SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA='${db}'
            AND (TABLE_NAME LIKE '%session%' OR TABLE_NAME LIKE '%audit%' OR TABLE_NAME LIKE '%log%' OR TABLE_NAME LIKE '%access%');
        " 2>/dev/null)

        for table in ${SESSION_TABLES}; do
            COUNT=$(${MYSQL_CMD} -N -e "SELECT COUNT(*) FROM ${db}.${table};" 2>/dev/null || echo "0")
            echo "${db}.${table}: ${COUNT} 条记录"

            # 最近7天的记录
            RECENT=$(${MYSQL_CMD} -N -e "
                SELECT COUNT(*) FROM ${db}.${table}
                WHERE (created_at > NOW() - INTERVAL 7 DAY
                   OR timestamp > NOW() - INTERVAL 7 DAY
                   OR created > NOW() - INTERVAL 7 DAY);
            " 2>/dev/null || echo "N/A")
            echo "  最近7天: ${RECENT}"
        done
    fi
done

# 5. 数据一致性检查
echo ""
echo "=========================================="
echo "5. 数据一致性检查"
echo "=========================================="

# 检查重复数据
echo ""
echo "--- 检查重复记录 ---"
for db in "${OLD_DB_NAMES[@]}" "${NEW_DB_NAMES[@]}"; do
    if ${MYSQL_CMD} -e "USE ${db}" 2>/dev/null; then
        echo "数据库: ${db}"
        ${MYSQL_CMD} -e "
            SELECT
                TABLE_NAME,
                'CHECK NEEDED' AS status
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = '${db}'
            AND TABLE_ROWS > 10000;
        " 2>/dev/null || echo "  无大表"
    fi
done

# 6. 生成对比报告
echo ""
echo "=========================================="
echo "6. 数据对比摘要"
echo "=========================================="
echo ""
echo "数据库概览:"
${MYSQL_CMD} -e "
    SELECT
        TABLE_SCHEMA AS '数据库',
        COUNT(TABLE_NAME) AS '表数',
        SUM(TABLE_ROWS) AS '总记录数',
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS '大小MB'
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
    GROUP BY TABLE_SCHEMA
    ORDER BY TABLE_SCHEMA;
" 2>/dev/null

echo ""
echo "=========================================="
echo "对比完成!"
echo "=========================================="
echo ""
echo "建议下一步:"
echo "1. 确认新旧平台关键数据是否一致"
echo "2. 检查缺失或重复的记录"
echo "3. 验证用户权限和角色迁移"
echo "4. 确认会话记录完整性"
echo "5. 测试新平台功能是否正常"
