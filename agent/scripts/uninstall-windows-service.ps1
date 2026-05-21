# Uninstalls the S.S.S agent Windows scheduled task.
# Run from PowerShell (as Administrator):
#   powershell -ExecutionPolicy Bypass -File .\agent\scripts\uninstall-windows-service.ps1

$ErrorActionPreference = "Stop"

$taskName = "SSS Agent"
$agentDir = Split-Path -Parent $PSScriptRoot

# 1. Stop the task if it is running
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  $info = $task | Get-ScheduledTaskInfo
  if ($info.State -eq "Running") {
    Write-Host "==> Stopping task..."
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  Write-Host "==> Removing task '$taskName'..."
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
} else {
  Write-Host "==> Task '$taskName' not installed."
}

# 2. Kill any leftover node process holding port 3001
$busy = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  $busyPids = $busy.OwningProcess | Sort-Object -Unique
  Write-Host ("==> Killing leftover processes on port 3001: PID(s) " + ($busyPids -join ', '))
  foreach ($busyPid in $busyPids) {
    try { Stop-Process -Id $busyPid -Force -ErrorAction Stop } catch {}
  }
}

# 3. Clean up generated artifacts
$wrapper = Join-Path $agentDir "run-agent.cmd"
if (Test-Path $wrapper) { Remove-Item $wrapper -Force; Write-Host "==> Removed $wrapper" }

Write-Host ""
Write-Host "==> Done. Agent is no longer auto-starting."
Write-Host "    The log file (agent\agent.log) was kept for your reference."
