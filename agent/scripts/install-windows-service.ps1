# Installs the S.S.S agent as a Windows scheduled task that auto-starts
# at user logon. Once installed, you never need to `npm run dev` again -
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

# 1. Kill any process currently using port 3001 (typically a `npm run dev` tsx watch)
$busy = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  $busyPids = $busy.OwningProcess | Sort-Object -Unique
  Write-Host ("==> Port 3001 in use by PID(s) " + ($busyPids -join ', ') + " - stopping...")
  foreach ($busyPid in $busyPids) {
    try {
      Stop-Process -Id $busyPid -Force -ErrorAction Stop
    } catch {
      Write-Host ("    (could not stop PID " + $busyPid + ": " + $_ + ")")
    }
  }
  Start-Sleep -Milliseconds 800
}

# 2. Build the agent (compiles TS -> dist/)
Write-Host ""
Write-Host "==> Installing dependencies and building agent..."
Push-Location $agentDir
try {
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
} finally {
  Pop-Location
}

# 3. Compose the command the scheduled task will run
$node = (Get-Command node).Source
$entry = Join-Path $agentDir "dist\index.js"

if (-not (Test-Path $entry)) {
  throw "Build did not produce $entry. Aborting."
}

# 4. Build a wrapper .cmd that ensures the working dir is set so .env loads
$wrapper = Join-Path $agentDir "run-agent.cmd"
$logPath = Join-Path $agentDir "agent.log"
$lines = @(
  '@echo off',
  ('cd /d "' + $agentDir + '"'),
  ('"' + $node + '" "' + $entry + '" >> "' + $logPath + '" 2>&1')
)
Set-Content -Path $wrapper -Value $lines -Encoding ASCII

Write-Host "==> Created launcher: $wrapper"

# 5. Register the scheduled task (runs at user logon, restarts if it dies)
$taskName = "SSS Agent"

# Remove old task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "==> Removing existing task..."
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
}

# Use Register-ScheduledTask (handles paths with spaces correctly, unlike schtasks /TR)
$user = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument ('/c "' + $wrapper + '"') `
  -WorkingDirectory $agentDir

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user

# S4U = Service-for-User: runs the task without interactive desktop, no
# popup CMD window. RunLevel Highest still gives elevated rights so nmap
# can do ARP scans. Combined with -Hidden in settings the task is
# completely invisible -- behaves like a real Windows service.
$principal = New-ScheduledTaskPrincipal `
  -UserId $user `
  -LogonType S4U `
  -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -Hidden `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 0) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "S.S.S agent - runs the local network scanner backend on port 3001." `
  -Force | Out-Null

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

# 6. Start it right now
Write-Host "==> Starting agent now..."
schtasks /Run /TN $taskName | Out-Null
Start-Sleep -Seconds 3

# 7. Verify
$health = $null
try { $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5 } catch {}
if ($health -and $health.success) {
  Write-Host "==> SUCCESS. Agent is up at http://localhost:3001"
  Write-Host "    Database reachable: $($health.data.database.reachable)"
} else {
  Write-Host ("==> Task started but agent did not respond yet. Check " + (Join-Path $agentDir 'agent.log'))
}
