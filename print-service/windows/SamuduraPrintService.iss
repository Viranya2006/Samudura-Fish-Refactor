; Inno Setup — build SamuduraPrintService-Setup.exe on a Windows dev PC.
; 1. Install Inno Setup 6: https://jrsoftware.org/isinfo.php
; 2. cd print-service && npm install
; 3. ISCC.exe windows\SamuduraPrintService.iss
; Output: print-service\windows\dist\SamuduraPrintService-Setup.exe

#define MyAppName "Samudura Print Service"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Samudura Fish Market"
#define SourceDir ".."

[Setup]
AppId={{B8E4F2A1-9C3D-4E5F-A1B2-3C4D5E6F7081}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\SamuduraPrintService
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=SamuduraPrintService-Setup
OutputDir=dist
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "windows\dist\*,windows\*.iss"
Source: "{#SourceDir}\start-tray-hidden.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "install.ps1"; DestDir: "{app}\windows"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}\windows"; Flags: ignoreversion

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\windows\install.ps1"" -InstallDir ""{app}"" -SkipCopy"; StatusMsg: "Configuring auto-start..."; Flags: waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\windows\uninstall.ps1"" -InstallDir ""{app}"""; Flags: waituntilterminated

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "wscript.exe"; Parameters: "//B //Nologo ""{app}\start-tray-hidden.vbs"""; WorkingDir: "{app}"; Comment: "Start Samudura Print Service tray"
