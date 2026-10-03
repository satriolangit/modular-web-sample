#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENTRYPOINT="$SCRIPT_DIR/entrypoint.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  echo "ok: $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
}

expect_contains() {
  if grep -q "$2" "$1"; then pass "$3"; else fail "$3 (missing: $2)"; fi
}

expect_file() {
  printf '%s\n' "$2" > "$TMP_DIR/expected"
  if cmp -s "$TMP_DIR/expected" "$1"; then pass "$3"; else fail "$3 (content differs)"; fi
}

# 1. defaults
OUT="$TMP_DIR/default.json"
CONFIG_FILE="$OUT" sh "$ENTRYPOINT" >/dev/null
expect_contains "$OUT" '"client": "base"' "defaults: client=base"
expect_contains "$OUT" '"modules": \["user-management"\]' "defaults: modules"
expect_contains "$OUT" '"apiBase": "https://dummyjson.com"' "defaults: apiBase"
expect_contains "$OUT" '"enableAuditLive": true' "defaults: flag"

# 2. individual vars (CSV with spaces)
OUT="$TMP_DIR/individual.json"
CONFIG_FILE="$OUT" VITE_CLIENT=client-a VITE_MODULES="user-management, product-management , module-sample" \
  VITE_API_BASE=https://api.example.com VITE_ENABLE_AUDIT_LIVE=false sh "$ENTRYPOINT" >/dev/null
expect_contains "$OUT" '"client": "client-a"' "individual: client"
expect_contains "$OUT" '"modules": \["user-management","product-management","module-sample"\]' "individual: modules trimmed"
expect_contains "$OUT" '"apiBase": "https://api.example.com"' "individual: apiBase"
expect_contains "$OUT" '"enableAuditLive": false' "individual: flag"

# 3. full JSON override wins over individual vars
OUT="$TMP_DIR/override.json"
JSON='{"client":"bca","modules":["user-management"],"apiBase":"https://api.bca.example","featureFlags":{"enableAuditLive":false}}'
CONFIG_FILE="$OUT" VITE_CONFIG_JSON="$JSON" VITE_CLIENT=ignored VITE_MODULES=ignored sh "$ENTRYPOINT" >/dev/null
expect_file "$OUT" "$JSON" "override: JSON written verbatim (compact)"

# 4. multiline JSON is accepted and compacted to one line
OUT="$TMP_DIR/multiline.json"
MULTILINE='{
  "client": "bni",
  "modules": ["user-management", "product-management"],
  "apiBase": "https://api.bni.example",
  "featureFlags": { "enableAuditLive": true }
}'
CONFIG_FILE="$OUT" VITE_CONFIG_JSON="$MULTILINE" sh "$ENTRYPOINT" >/dev/null
expect_contains "$OUT" '"client": "bni"' "override: multiline JSON accepted"
LINES=$(wc -l < "$OUT" | tr -d ' ')
if [ "$LINES" = "1" ]; then pass "override: multiline compacted to one line"; else fail "override: multiline compacted to one line (got $LINES lines)"; fi

# 5. whitespace-only JSON falls back to individual vars
OUT="$TMP_DIR/whitespace.json"
CONFIG_FILE="$OUT" VITE_CONFIG_JSON="   " VITE_CLIENT=fallback sh "$ENTRYPOINT" >/dev/null
expect_contains "$OUT" '"client": "fallback"' "whitespace JSON: falls back to individual vars"

# 6. invalid JSON fails fast and writes nothing
OUT="$TMP_DIR/invalid.json"
if CONFIG_FILE="$OUT" VITE_CONFIG_JSON='not-json' sh "$ENTRYPOINT" >"$TMP_DIR/invalid.log" 2>&1; then
  fail "invalid JSON: exits non-zero"
else
  pass "invalid JSON: exits non-zero"
fi
if [ -e "$OUT" ]; then fail "invalid JSON: no file written"; else pass "invalid JSON: no file written"; fi
expect_contains "$TMP_DIR/invalid.log" 'must be a JSON object' "invalid JSON: clear message"

echo ""
echo "[entrypoint.test] ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
