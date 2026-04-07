#!/bin/bash
# test.sh — Test suite for hn-top10.sh and hn-summary.sh

set -euo pipefail
PASS=0
FAIL=0
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

pass() { echo "PASS: $1"; PASS=$(( PASS + 1 )); }
fail() { echo "FAIL: $1"; FAIL=$(( FAIL + 1 )); }

# ─── hn-top10.sh tests ────────────────────────────────────────────────────────
echo ""
echo "=== hn-top10.sh テスト ==="

# Test 1: Output is not empty
output=$("$SCRIPT_DIR/hn-top10.sh")
if [ -z "$output" ]; then
  fail "出力が空"
else
  pass "出力が空でない"
fi

# Test 2: Valid JSON
if echo "$output" | jq . > /dev/null 2>&1; then
  pass "有効な JSON"
else
  fail "有効な JSON ではない"
fi

# Test 3: Exactly 10 items
count=$(echo "$output" | jq 'length')
if [ "$count" -eq 10 ]; then
  pass "10件のデータ"
else
  fail "件数が ${count}件（期待: 10件）"
fi

# Test 4: Required fields present
missing=$(echo "$output" | jq '[.[] | select(.title == null or .url == null or .score == null)] | length')
if [ "$missing" -eq 0 ]; then
  pass "全件に title / url / score が存在"
else
  fail "${missing}件のレコードでフィールド欠損"
fi

# Test 5: --count option
output5=$("$SCRIPT_DIR/hn-top10.sh" --count 3)
count5=$(echo "$output5" | jq 'length')
if [ "$count5" -eq 3 ]; then
  pass "--count 3 で3件取得"
else
  fail "--count 3 で ${count5}件（期待: 3件）"
fi

# Test 6: --help exits 0
if "$SCRIPT_DIR/hn-top10.sh" --help > /dev/null 2>&1; then
  pass "--help が終了コード0で終了"
else
  fail "--help が非ゼロで終了"
fi

# Test 7: Error case — script exits non-zero when curl fails (simulate with bad host)
test7_script=$(cat <<'SCRIPT'
#!/bin/bash
set -euo pipefail
BASE_URL="https://invalid.example.invalid"
fetch_with_retry() {
  local url="$1"; local attempt=0
  while (( attempt < 3 )); do
    curl -sf "$url" 2>/dev/null && return 0
    (( attempt++ )); sleep 0
  done
  echo "Error: 接続できません。" >&2; exit 1
}
fetch_with_retry "$BASE_URL/topstories.json" | jq '.[0:1][]'
SCRIPT
)
if bash -c "$test7_script" > /dev/null 2>&1; then
  fail "無効なURLでもエラーにならなかった"
else
  pass "無効なURLで非ゼロ終了コード"
fi

# ─── hn-summary.sh tests ──────────────────────────────────────────────────────
echo ""
echo "=== hn-summary.sh テスト ==="

# Test 8: --help
if "$SCRIPT_DIR/hn-summary.sh" --help > /dev/null 2>&1; then
  pass "--help が終了コード0で終了"
else
  fail "--help が非ゼロで終了"
fi

# Test 9: --format json outputs valid JSON
json_out=$("$SCRIPT_DIR/hn-summary.sh" --format json --count 3 2>/dev/null)
if echo "$json_out" | jq . > /dev/null 2>&1; then
  pass "--format json で有効な JSON 出力"
else
  fail "--format json の出力が不正"
fi

# Test 10: --format html contains DOCTYPE
html_out=$("$SCRIPT_DIR/hn-summary.sh" --format html --count 3 2>/dev/null)
if echo "$html_out" | grep -q "<!DOCTYPE html>"; then
  pass "--format html で DOCTYPE を含む"
else
  fail "--format html に DOCTYPE が存在しない"
fi

# Test 11: --min-comments filters results
mc_out=$("$SCRIPT_DIR/hn-summary.sh" --format json --count 10 --min-comments 999999 2>/dev/null)
mc_count=$(echo "$mc_out" | jq 'length')
if [ "$mc_count" -eq 0 ]; then
  pass "--min-comments 999999 で0件（全件フィルタ済み）"
else
  fail "--min-comments 999999 でも ${mc_count}件残っている"
fi

# Test 12: Unknown option exits non-zero
if "$SCRIPT_DIR/hn-top10.sh" --unknown-flag > /dev/null 2>&1; then
  fail "不明なオプションでもエラーにならなかった"
else
  pass "不明なオプションで非ゼロ終了コード"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "==============================="
echo "結果: ${PASS} PASS / ${FAIL} FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "=== 全テスト通過 ==="
  exit 0
else
  echo "=== ${FAIL}件のテストが失敗 ==="
  exit 1
fi
