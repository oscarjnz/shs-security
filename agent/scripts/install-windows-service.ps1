# Installs the S.S.S agent as a Windows scheduled task that auto-starts
# at user logon. Once installed, you never need to `npm run dev` again —
# the agent runs in the background whenever the PC is on.
#
# Run from PowerShell (as Administrator):
#   powershell -ExecutionPolicy Bypass -File .\agent\scripts\install-windows-service.ps1
#
# To uninstall:
#   schtasks /Delete /TN "SSS Agent" /F

$ErrorActionPreference = "Stop"

# Locate the agent directory (this script lives in agent/scripts/)
$agentDir = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $agentDir

Write-Host "==> Agent directory: $agentDir"
Write-Host "==> Repo root: $repoRoot"

# 1. Build the agent (compiles TS -> dist/)
Write-Host ""
Write-Host "==> Building the agent (npm run build)..."
Push-Location $agentDir
try {
  npm install --omit=dev *> $null
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
  Pop-Location
}

# 2. Compose the command the scheduled task will run
$node = (Get-Command node).Source
$entry = Join-Path $agentDir "dist\index.js"

if (-not (Test-Path $entry)) {
  throw "Build did not produce $entry. Aborting."
}

# 3. Build a wrapper .cmd that ensures the working dir is set so .env loads
$wrapper = Join-Path $agentDir "run-agent.cmd"
@"
@echo off
cd /d "$agentDir"
"$node" "$entry" >> "$agentDir\agent.log" 2>&1
"@ | Set-Content -Path $wrapper -Encoding ASCII

Write-Host "==> Created launcher: $wrapper"

# 4. Register the scheduled task (runs at user logon, restarts if it dies)
$taskName = "SSS Agent"

# Remove old task if present
schtasks /Query /TN $taskName *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "==> Removing existing task..."
  schtasks /Delete /TN $taskName /F | Out-Null
}

# Create the task: run at logon of current user, hidden, restart on failure
$user = "$env:USERDOMAIN\$env:USERNAME"
schtasks /Create `
  /TN $taskName `
  /TR "`"$wrapper`"" `
  /SC ONLOGON `
  /RU $user `
  /RL HIGHEST `
  /F | Out-Null

Write-Host ""
Write-Host "==> Scheduled task '$taskName' created."
Write-Host "==> It runs at logon as $user with admin privileges (needed for nmap ARP scans)."
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  Start now:    schtasks /Run /TN `"$taskName`""
Write-Host "  Check status: schtasks /Query /TN `"$taskName`" /V /FO LIST"
Write-Host "  Stop task:    schtasks /End /TN `"$taskName`""
Write-Host "  Uninstall:    schtasks /Delete /TN `"$taskName`" /F"
Write-Host ""
Write-Host "  Agent log:    $agentDir\agent.log"
Write-Host ""

# 5. Start it right now
Write-Host "==> Starting agent now..."
schtasks /Run /TN $taskName | Out-Null
Start-Sleep -Seconds 3

# 6. Verify
$health = $null
try { $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5 } catch {}
if ($health -and $health.success) {
  Write-Host "==> SUCCESS. Agent is up at http://localhost:3001"
  Write-Host "    Database reachable: $($health.data.database.reachable)"
} else {
  Write-Host "==> Task started but agent didn't respond yet. Check $agentDir\agent.log"
}
