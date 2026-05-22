#!/bin/bash
# verify_rebrand.sh - 验证 Siriusec 重命名完成情况

echo "======================================"
echo "Siriusec 项目重命名验证"
echo "======================================"
echo ""

# 1. 检查 Go Module
echo "1. 检查 Go Module..."
if grep -q "github.com/siriusec/siriusec" go.mod; then
    echo "   ✅ go.mod 已更新"
else
    echo "   ❌ go.mod 未更新"
fi

if grep -q "github.com/siriusec/siriusec/api" api/go.mod; then
    echo "   ✅ api/go.mod 已更新"
else
    echo "   ❌ api/go.mod 未更新"
fi

echo ""

# 2. 检查二进制文件名称
echo "2. 检查工具目录..."
if [ -d "tool/siriusec" ]; then
    echo "   ✅ tool/siriusec 存在"
else
    echo "   ❌ tool/siriusec 不存在"
fi

if [ -d "tool/sctl" ]; then
    echo "   ✅ tool/sctl 存在"
else
    echo "   ❌ tool/sctl 不存在"
fi

echo ""

# 3. 检查版本号
echo "3. 检查版本号..."
VERSION=$(grep "^VERSION=" Makefile | cut -d'=' -f2)
if [ "$VERSION" = "1.0.0" ]; then
    echo "   ✅ 版本: $VERSION"
else
    echo "   ⚠️  版本: $VERSION (期望 1.0.0)"
fi

echo ""

# 4. 检查 Docker 镜像
echo "4. 检查 Docker 配置..."
if grep -q "registry.siriusec.com/siriusec" Makefile; then
    echo "   ✅ Docker 镜像已更新"
else
    echo "   ❌ Docker 镜像未更新"
fi

echo ""

# 5. 检查国际化文件
echo "5. 检查国际化基础设施..."
if [ -f "web/packages/shared/src/i18n/i18n.js" ]; then
    echo "   ✅ i18n.js 存在"
else
    echo "   ❌ i18n.js 不存在"
fi

if [ -f "web/packages/shared/src/i18n/zh/common.json" ]; then
    echo "   ✅ 中文翻译存在"
else
    echo "   ❌ 中文翻译不存在"
fi

if [ -f "web/packages/shared/src/i18n/en/common.json" ]; then
    echo "   ✅ 英文翻译存在"
else
    echo "   ❌ 英文翻译不存在"
fi

echo ""

# 6. 检查残留的厂商标识
echo "6. 检查残留厂商标识 (排除 vendor)..."
COUNT=$(grep -r "goteleport\.com" --include="*.go" --include="*.md" --exclude-dir=vendor . 2>/dev/null | wc -l)
if [ $COUNT -eq 0 ]; then
    echo "   ✅ 无 goteleport.com 残留"
else
    echo "   ⚠️  发现 $COUNT 处 goteleport.com 引用"
fi

COUNT=$(grep -r "Gravitational, Inc" --include="*.go" --exclude-dir=vendor . 2>/dev/null | wc -l)
if [ $COUNT -eq 0 ]; then
    echo "   ✅ 无 Gravitational, Inc 版权残留"
else
    echo "   ⚠️  发现 $COUNT 处 Gravitational, Inc 引用"
fi

echo ""

# 7. 检查关键文档
echo "7. 检查文档..."
if [ -f "README.md" ]; then
    echo "   ✅ README.md 存在"
fi

if [ -f "REFACTOR_SUMMARY.md" ]; then
    echo "   ✅ REFACTOR_SUMMARY.md 存在"
fi

if [ -f "NOTICE" ]; then
    echo "   ✅ NOTICE 存在"
fi

echo ""

# 8. 统计翻译词条
echo "8. 翻译词条统计..."
if [ -f "web/packages/shared/src/i18n/zh/common.json" ]; then
    ZH_COUNT=$(grep -o '"[^"]*":' web/packages/shared/src/i18n/zh/common.json | wc -l)
    echo "   📝 中文翻译: $ZH_COUNT 条"
fi

if [ -f "web/packages/shared/src/i18n/en/common.json" ]; then
    EN_COUNT=$(grep -o '"[^"]*":' web/packages/shared/src/i18n/en/common.json | wc -l)
    echo "   📝 英文翻译: $EN_COUNT 条"
fi

echo ""
echo "======================================"
echo "验证完成!"
echo "======================================"
echo ""
echo "下一步:"
echo "1. 编译测试: make clean && make full"
echo "2. 运行测试: make test"
echo "3. 查看总结: cat REFACTOR_SUMMARY.md"
echo ""
