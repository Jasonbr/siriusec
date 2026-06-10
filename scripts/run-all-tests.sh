#!/bin/bash
# scripts/run-all-tests.sh
# Q1-Q5 Production Hardening Test Runner

set -e

echo "========================================"
echo "Running Q1-Q5 Production Hardening Tests"
echo "========================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    exit 1
}

echo ""
echo "1. Running Q1 environment variable tests..."
go test -v ./lib/utils/... -run "TestGetEnv|TestEnsureEnv"
pass "Q1 environment variable tests"

echo ""
echo "2. Running Q2 LimitReader protection tests..."
go test -v ./lib/defaults/... -run "TestMaxGeneral|TestReadAll"
pass "Q2 LimitReader protection tests"

echo ""
echo "3. Running Q5 default bind address tests..."
go test -v ./lib/defaults/... -run "TestBindIP|TestAnyAddress|TestPortDefaults"
pass "Q5 default bind address tests"

echo ""
echo "4. Running Q3 ioutil replacement verification..."
./scripts/test-ioutil-replacement.sh
pass "Q3 ioutil replacement verification"

echo ""
echo "5. Running Q4 context.TODO() elimination verification..."
./scripts/test-context-todo.sh
pass "Q4 context.TODO() elimination verification"

echo ""
echo "6. Running integration tests..."
go test -v ./integration/... -run "TestQ[1-5]" -timeout 30s
pass "Integration tests"

echo ""
echo "========================================"
echo -e "${GREEN}All tests passed! ✅${NC}"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Q1: Environment variable dual compatibility ✅"
echo "  - Q2: io.ReadAll + LimitReader protection ✅"
echo "  - Q3: ioutil deprecated replacement ✅"
echo "  - Q4: context.TODO() elimination ✅"
echo "  - Q5: Default bind address hardening ✅"
echo ""
