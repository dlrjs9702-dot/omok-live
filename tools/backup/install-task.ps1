# 1.10.349 DB backup: registers the Windows scheduled task "IslandDbBackup" -- every day at 05:30 (after the 05:00 deploy),
# a run missed while the PC was off starts as soon as it is on (StartWhenAvailable), retried 3 times 10 minutes apart.
# Runs as the current user, only when logged on (no password stored). Run once:  powershell -ExecutionPolicy Bypass -File tools\backup\install-task.ps1
# Remove:  Unregister-ScheduledTask -TaskName IslandDbBackup -Confirm:$false
$ErrorActionPreference = 'Stop'
$node = (Get-Command node).Source
$fetch = Join-Path $PSScriptRoot 'fetch.js'
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $fetch + '"') -WorkingDirectory (Split-Path $PSScriptRoot -Parent | Split-Path -Parent)
$trigger = New-ScheduledTaskTrigger -Daily -At '05:30'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'IslandDbBackup' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Island DB backup (tools/backup/fetch.js)' -Force | Out-Null
Get-ScheduledTask -TaskName 'IslandDbBackup' | Select-Object TaskName, State
