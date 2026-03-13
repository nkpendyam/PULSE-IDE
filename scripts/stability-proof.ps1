param(
  [int]$Iterations = 5,
  [string]$ReportPath = "stability-report.json",
  [switch]$RunE2E
)

$passed = 0
$failed = 0
$results = @()

for ($i = 1; $i -le $Iterations; $i++) {
  $start = Get-Date
  $status = "pass"
  $failedSteps = @()

  npm run lint *> $null
  $rc1 = $LASTEXITCODE
  npm run type-check *> $null
  $rc2 = $LASTEXITCODE
  npm test *> $null
  $rc3 = $LASTEXITCODE

  Push-Location src-tauri
  cargo check *> $null
  $rc4 = $LASTEXITCODE
  cargo test --workspace --lib --tests *> $null
  $rc5 = $LASTEXITCODE
  cargo audit *> $null
  $rc6 = $LASTEXITCODE
  Pop-Location

  $rc7 = 0
  if ($RunE2E) {
    npx playwright test --project=chromium --workers=1 *> $null
    $rc7 = $LASTEXITCODE
  }

  if ($rc1 -ne 0 -or $rc2 -ne 0 -or $rc3 -ne 0 -or $rc4 -ne 0 -or $rc5 -ne 0 -or $rc6 -ne 0 -or $rc7 -ne 0) {
    $status = "fail"
    $failed++
    if ($rc1 -ne 0) { $failedSteps += "lint" }
    if ($rc2 -ne 0) { $failedSteps += "type-check" }
    if ($rc3 -ne 0) { $failedSteps += "unit-tests" }
    if ($rc4 -ne 0) { $failedSteps += "cargo-check" }
    if ($rc5 -ne 0) { $failedSteps += "cargo-test" }
    if ($rc6 -ne 0) { $failedSteps += "cargo-audit" }
    if ($rc7 -ne 0) { $failedSteps += "e2e" }
  } else {
    $passed++
  }

  $durationSec = [int]((Get-Date) - $start).TotalSeconds
  $results += [pscustomobject]@{
    iteration = $i
    status = $status
    durationSec = $durationSec
    failedSteps = $failedSteps
  }

  Write-Host "[stability] iteration=$i status=$status duration=${durationSec}s failedSteps=$($failedSteps -join ',')"
}

$report = [pscustomobject]@{
  iterations = $Iterations
  passed = $passed
  failed = $failed
  passRate = if ($Iterations -eq 0) { 0 } else { [math]::Round($passed / $Iterations, 4) }
  timestampUtc = (Get-Date).ToUniversalTime().ToString("o")
  results = $results
}

$report | ConvertTo-Json -Depth 6 | Set-Content -Path $ReportPath -Encoding UTF8
Write-Host "[stability] wrote report to $ReportPath"
