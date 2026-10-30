' Samudura Print Service — hidden tray launcher (no console window).
' Finds node.exe automatically; works even if install.ps1 did not finish.

Option Explicit

Dim shell, fso, installDir, nodeExe, trayScript, logDir, logFile, logStream

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
trayScript = installDir & "\tray-launcher.js"
logDir = shell.ExpandEnvironmentStrings("%ProgramData%") & "\SamuduraPrintService\logs"
logFile = logDir & "\service.log"

Sub WriteLog(msg)
  On Error Resume Next
  If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
  Set logStream = fso.OpenTextFile(logFile, 8, True)
  logStream.WriteLine "[" & Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2) & " " & Time & "] [vbs] " & msg
  logStream.Close
  On Error GoTo 0
End Sub

Function FileExists(path)
  FileExists = (Len(path) > 0 And fso.FileExists(path))
End Function

Function FindNodeExe()
  Dim paths, i, p, wshExec, line, envPath, parts, j

  ' Hardcoded path from install.ps1 (if present) — most reliable when install succeeded
  Dim cfgPath, cfgText, re
  cfgPath = installDir & "\node-path.txt"
  If fso.FileExists(cfgPath) Then
    Set cfgText = fso.OpenTextFile(cfgPath, 1)
    p = Trim(cfgText.ReadAll())
    cfgText.Close
    If FileExists(p) Then
      FindNodeExe = p
      Exit Function
    End If
  End If

  paths = Array( _
    shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\nodejs\node.exe"), _
    shell.ExpandEnvironmentStrings("%LocalAppData%\Programs\node\node.exe"), _
    "C:\Program Files\nodejs\node.exe", _
    "C:\nodejs\node.exe" _
  )

  For i = 0 To UBound(paths)
    If FileExists(paths(i)) Then
      FindNodeExe = paths(i)
      Exit Function
    End If
  Next

  On Error Resume Next
  Set wshExec = shell.Exec("cmd /c where node 2>nul")
  Do While wshExec.Status = 0
    WScript.Sleep 50
  Loop
  line = Trim(wshExec.StdOut.ReadLine())
  If FileExists(line) Then
    FindNodeExe = line
    Exit Function
  End If
  On Error GoTo 0

  envPath = shell.ExpandEnvironmentStrings("%PATH%")
  parts = Split(envPath, ";")
  For j = 0 To UBound(parts)
    p = Trim(parts(j))
    If Len(p) > 0 Then
      If Right(p, 1) <> "\" Then p = p & "\"
      p = p & "node.exe"
      If FileExists(p) Then
        FindNodeExe = p
        Exit Function
      End If
    End If
  Next

  FindNodeExe = ""
End Function

If Not fso.FileExists(trayScript) Then
  WriteLog "ERROR: tray-launcher.js not found at " & trayScript
  MsgBox "Samudura Print Service: tray-launcher.js not found in:" & vbCrLf & installDir, vbCritical, "Samudura Print Service"
  WScript.Quit 1
End If

nodeExe = FindNodeExe()
If nodeExe = "" Then
  WriteLog "ERROR: Node.js not found. Install from https://nodejs.org/ then run install.ps1 or reinstall."
  MsgBox "Samudura Print Service needs Node.js." & vbCrLf & vbCrLf & "1. Install Node.js LTS from https://nodejs.org/" & vbCrLf & "2. Re-run SamuduraPrintService-Setup.exe" & vbCrLf & vbCrLf & "Log: " & logFile, vbCritical, "Samudura Print Service"
  WScript.Quit 1
End If

shell.CurrentDirectory = installDir
WriteLog "Starting tray via " & nodeExe
shell.Run """" & nodeExe & """ """ & trayScript & """", 0, False
