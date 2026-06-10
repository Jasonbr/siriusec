#!/bin/bash
# scripts/test-ioutil-replacement.sh
# Verifies that all ioutil usage has been replaced with io/os equivalents

set -e

echo "========================================"
echo "Q3: ioutil Deprecated Replacement Check"
echo "========================================"
echo ""

# Check for ioutil usage in non-test, non-vendor files
echo "Checking for ioutil usage in non-test, non-vendor files..."

ioutil_count=$(grep -r "ioutil\." --include="*.go" --exclude-dir=vendor --exclude-dir=.git \
	| grep -v "_test.go" \
	| wc -l | tr -d ' ')

if [ "$ioutil_count" -eq 0 ]; then
	echo "✅ PASS: No ioutil usage found in non-test files"
	echo ""
	echo "Summary:"
echo "  - Scanned all .go files (excluding vendor, .git, _test.go)"
echo "  - Found 0 ioutil references"
echo "  - All ioutil calls have been replaced with:"
echo "    * ioutil.ReadAll → io.ReadAll"
echo "    * ioutil.ReadFile → os.ReadFile"
echo "    * ioutil.WriteFile → os.WriteFile"
echo "    * ioutil.TempDir → os.MkdirTemp"
echo "    * ioutil.TempFile → os.CreateTemp"
echo "    * ioutil.NopCloser → io.NopCloser"
echo "    * ioutil.Discard → io.Discard"
echo "    * ioutil.ReadDir → os.ReadDir"
	exit 0
else
	echo "❌ FAIL: Found $ioutil_count ioutil usages:"
	echo ""
	grep -r "ioutil\." --include="*.go" --exclude-dir=vendor --exclude-dir=.git \
		| grep -v "_test.go"
	echo ""
	echo "Please replace these with their io/os equivalents"
	exit 1
fi
