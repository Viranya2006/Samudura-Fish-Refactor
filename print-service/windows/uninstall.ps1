# Samudura Print Service — Windows uninstaller
# Run in PowerShell:
#   .\uninstall.ps1

param(
  [string]$InstallDir = "${env:ProgramFiles}\SamuduraPrintService"
)

$ErrorActionPreference = "Stop"
$TaskName = "SamuduraPrintService"

Write-Host "==> Stopping scheduled task and processes" -ForegroundColor Cyan

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object {
    $_.CommandLine -like "*tray-launcher.js*" -or $_.CommandLine -like "*SamuduraPrintService*index.js*"
  } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

if (Test-Path $InstallDir) {
  Write-Host "==> Removing $InstallDir" -ForegroundColor Cyan
  Remove-Item $InstallDir -Recurse -Force
}

$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "Samudura Print Service"
if (Test-Path $startMenu) {
  Remove-Item $startMenu -Recurse -Force
}

Write-Host "Uninstall complete." -ForegroundColor Green
Write-Host "Log files were left at $env:ProgramData\SamuduraPrintService\logs (delete manually if desired)."
