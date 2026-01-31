param(
  [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..\").Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
$commit = ""
try { $commit = (git rev-parse --short HEAD).Trim() } catch { $commit = "(no-git)" }

Write-Host "[Vaultfire Check] $ts  commit=$commit" -ForegroundColor Cyan

# Run tests
$npx = "npx"
$testCmd = "$npx hardhat test"
Write-Host "Running: $testCmd" -ForegroundColor Gray

$log = & $npx hardhat test 2>&1
$exit = $LASTEXITCODE

# Write run log
$runlogPath = Join-Path $RepoRoot "..\memory\vaultfire-runlog.md"
$runlogPath = (Resolve-Path $runlogPath).Path

$summary = if ($exit -eq 0) { "PASS" } else { "FAIL" }

$entry = @()
$entry += "## $ts - $summary (commit $commit)"
$entry += ""
$entry += "Command: npx hardhat test"
$entry += ""
$entry += '```'
$entry += ($log | Out-String)
$entry += '```'
$entry += ""

Add-Content -Path $runlogPath -Value ($entry -join "`n") -Encoding UTF8

if ($exit -ne 0) {
  Write-Host "Tests failed. See: $runlogPath" -ForegroundColor Red
  exit $exit
}

Write-Host "Tests passed. Logged to: $runlogPath" -ForegroundColor Green
exit 0
