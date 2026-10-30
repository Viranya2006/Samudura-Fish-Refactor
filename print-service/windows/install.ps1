# Samudura Print Service — Windows installer / post-copy configure
# Manual install from repo:
#   .\install.ps1
# After Inno Setup copies files (SkipCopy):
#   .\install.ps1 -InstallDir "C:\Program Files\SamuduraPrintService" -SkipCopy

param(
  [string]$InstallDir = "${env:ProgramFiles}\SamuduraPrintService",
  [switch]$SkipCopy
)

$ErrorActionPreference = "Stop"
$TaskName = "SamuduraPrintService"
$SourceRoot = Split-Path $PSScriptRoot -Parent

function Write-Step($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Find-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd?.Source) { return $cmd.Source }

  $candidates = @(
    "${env:ProgramFiles}\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\node\node.exe",
    "C:\Program Files\nodejs\node.exe"
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

if (-not $SkipCopy) {
  if (-not (Test-Path (Join-Path $SourceRoot "index.js"))) {
    throw "Source print-service not found at $SourceRoot"
  }

  Write-Step "Installing to $InstallDir"
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

  $exclude = @("windows", ".git")
  Get-ChildItem -Path $SourceRoot -Force | Where-Object {
    $_.Name -notin $exclude
  } | ForEach-Object {
    $dest = Join-Path $InstallDir $_.Name
    if ($_.PSIsContainer) {
      if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
      Copy-Item $_.FullName $dest -Recurse -Force
    } else {
      Copy-Item $_.FullName $dest -Force
    }
  }
}

if (-not (Test-Path (Join-Path $InstallDir "index.js"))) {
  throw "Install directory missing index.js: $InstallDir"
}

if (-not (Test-Path (Join-Path $InstallDir "config.json"))) {
  $example = Join-Path $InstallDir "config.example.json"
  if (Test-Path $example) {
    Copy-Item $example (Join-Path $InstallDir "config.json")
  }
}

# Ensure start-tray-hidden.vbs exists (shipped with installer; copy if missing)
$vbsPath = Join-Path $InstallDir "start-tray-hidden.vbs"
$bundledVbs = Join-Path $SourceRoot "start-tray-hidden.vbs"
if (-not (Test-Path $vbsPath) -and (Test-Path $bundledVbs)) {
  Copy-Item $bundledVbs $vbsPath -Force
}

$node = Find-NodeExe
if ($node) {
  Set-Content -Path (Join-Path $InstallDir "node-path.txt") -Value $node -Encoding ASCII -NoNewline
  Write-Step "Found Node.js: $node"
} else {
  Write-Host "WARNING: Node.js not found on PATH." -ForegroundColor Yellow
  Write-Host "  Install Node.js LTS from https://nodejs.org/ then run this script again." -ForegroundColor Yellow
  Write-Host "  start-tray-hidden.vbs was still installed and will try to find Node at runtime." -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $InstallDir "node_modules"))) {
  if (-not $node) {
    throw "Node.js required to install dependencies. Install Node.js LTS, then re-run install.ps1"
  }
  Write-Step "Installing npm dependencies (may take a minute)"
  Push-Location $InstallDir
  npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm install failed" }
  Pop-Location
}

if (-not (Test-Path $vbsPath)) {
  throw "start-tray-hidden.vbs missing in $InstallDir"
}

Write-Step "Registering logon scheduled task: $TaskName"
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
  -Execute "wscript.exe" `
  -Argument "//B //Nologo `"$vbsPath`"" `
  -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME -Delay (New-TimeSpan -Seconds 15)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Samudura Fish Market print service (receipts + PLU file)" | Out-Null

if ($node) {
  Write-Step "Starting tray launcher now"
  Start-Process -FilePath "wscript.exe" -ArgumentList "//B //Nologo `"$vbsPath`"" -WorkingDirectory $InstallDir -WindowStyle Hidden
}

$startMenu = [Environment]::GetFolderPath("Programs")
$shortcutDir = Join-Path $startMenu "Samudura Print Service"
New-Item -ItemType Directory -Force -Path $shortcutDir | Out-Null
$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut((Join-Path $shortcutDir "Samudura Print Service.lnk"))
$lnk.TargetPath = "wscript.exe"
$lnk.Arguments = "//B //Nologo `"$vbsPath`""
$lnk.WorkingDirectory = $InstallDir
$lnk.Description = "Samudura Print Service (tray)"
$lnk.Save()

Write-Host ""
Write-Host "Installed successfully." -ForegroundColor Green
Write-Host "  Folder:  $InstallDir"
Write-Host "  Logs:    $env:ProgramData\SamuduraPrintService\logs"
Write-Host "  Health:  http://localhost:5555/health"
Write-Host "  Task:    $TaskName (runs at Windows logon)"
Write-Host ""
if (-not $node) {
  Write-Host "NEXT: Install Node.js LTS, then run:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File `"$InstallDir\windows\install.ps1`" -InstallDir `"$InstallDir`" -SkipCopy" -ForegroundColor Yellow
} else {
  Write-Host "Edit config.json in the install folder for printer IP (PRINTER_HOST)."
}
