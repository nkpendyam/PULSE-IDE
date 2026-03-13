#!/usr/bin/env bash
set -euo pipefail

ITERATIONS="${1:-5}"
REPORT_PATH="${2:-stability-report.json}"
RUN_E2E="${RUN_E2E:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[stability] missing command: $1"
    return 1
  fi
  return 0
}

passed=0
failed=0
results_json=""

for ((i=1; i<=ITERATIONS; i++)); do
  iter_start=$(date +%s)
  status="pass"
  failed_steps=""

  set +e
  require_cmd npm
  rc0=$?
  npm run lint >/dev/null 2>&1
  rc1=$?
  npm run type-check >/dev/null 2>&1
  rc2=$?
  npm test >/dev/null 2>&1
  rc3=$?
  require_cmd cargo
  rc00=$?
  (cd src-tauri && cargo check >/dev/null 2>&1)
  rc4=$?
  (cd src-tauri && cargo test --workspace --lib --tests >/dev/null 2>&1)
  rc5=$?
  (cd src-tauri && cargo audit >/dev/null 2>&1)
  rc6=$?

  rc7=0
  if [[ "$RUN_E2E" == "1" ]]; then
    npx playwright test --project=chromium --workers=1 >/dev/null 2>&1
    rc7=$?
  fi
  set -e

  if [[ $rc0 -ne 0 ]]; then failed_steps="${failed_steps}missing:npm;"; fi
  if [[ $rc00 -ne 0 ]]; then failed_steps="${failed_steps}missing:cargo;"; fi
  if [[ $rc1 -ne 0 ]]; then failed_steps="${failed_steps}lint;"; fi
  if [[ $rc2 -ne 0 ]]; then failed_steps="${failed_steps}type-check;"; fi
  if [[ $rc3 -ne 0 ]]; then failed_steps="${failed_steps}unit-tests;"; fi
  if [[ $rc4 -ne 0 ]]; then failed_steps="${failed_steps}cargo-check;"; fi
  if [[ $rc5 -ne 0 ]]; then failed_steps="${failed_steps}cargo-test;"; fi
  if [[ $rc6 -ne 0 ]]; then failed_steps="${failed_steps}cargo-audit;"; fi
  if [[ $rc7 -ne 0 ]]; then failed_steps="${failed_steps}e2e;"; fi

  if [[ -n "$failed_steps" ]]; then
    status="fail"
    failed=$((failed + 1))
  else
    passed=$((passed + 1))
  fi

  iter_end=$(date +%s)
  duration=$((iter_end - iter_start))

  item="{\"iteration\":$i,\"status\":\"$status\",\"durationSec\":$duration,\"failedSteps\":\"$failed_steps\"}"
  if [[ -z "$results_json" ]]; then
    results_json="$item"
  else
    results_json="$results_json,$item"
  fi

  echo "[stability] iteration=$i status=$status duration=${duration}s failedSteps=${failed_steps}"
done

cat > "$REPORT_PATH" <<EOF
{
  "iterations": $ITERATIONS,
  "passed": $passed,
  "failed": $failed,
  "passRate": $(awk "BEGIN { if ($ITERATIONS == 0) print 0; else printf \"%.4f\", $passed/$ITERATIONS }"),
  "timestampUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "results": [ $results_json ]
}
EOF

echo "[stability] wrote report to $REPORT_PATH"
