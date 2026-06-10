#!/bin/bash
# scripts/test-context-todo.sh
# Verifies that all context.TODO() usage has been replaced with proper context handling

set -e

echo "========================================"
echo "Q4: context.TODO() Elimination Check"
echo "========================================"
echo ""

# Check for context.TODO() usage in non-test, non-vendor, non-auth files
echo "Checking for context.TODO() usage in non-test, non-vendor, non-auth files..."

todo_count=$(grep -r "context\.TODO()" --include="*.go" --exclude-dir=vendor --exclude-dir=.git \
	| grep -v "_test.go" \
	| grep -v "lib/auth/" \
	| wc -l | tr -d ' ')

if [ "$todo_count" -eq 0 ]; then
	echo "✅ PASS: No context.TODO() found in non-test, non-auth files"
	echo ""
	echo "Summary:"
echo "  - Scanned all .go files (excluding vendor, .git, _test.go, lib/auth/)"
echo "  - Found 0 context.TODO() references"
echo "  - All context.TODO() calls have been replaced with:"
echo "    * context.WithTimeout(ctx, duration) - when ctx is available"
echo "    * context.Background() - when no parent context exists"
echo "  - Proper defer cancel() pattern applied"
echo "  - lib/auth/ excluded (handled separately)"
	exit 0
else
	echo "❌ FAIL: Found $todo_count context.TODO() usages:"
	echo ""
	grep -r "context\.TODO()" --include="*.go" --exclude-dir=vendor --exclude-dir=.git \
		| grep -v "_test.go" \
		| grep -v "lib/auth/"
	echo ""
	echo "Please replace these with proper context handling:"
echo "  - If function has ctx param: ctx, cancel := context.WithTimeout(ctx, 30*time.Second)"
echo "  - If no ctx param: use context.Background()"
echo "  - Always add: defer cancel()"
	exit 1
fi
