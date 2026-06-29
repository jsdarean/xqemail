Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)

nodeExe = ""

' Try common Node.js installation directories
commonPaths = Array(_
    WshShell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe",_
    WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe",_
    WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\nodejs\node.exe",_
    WshShell.ExpandEnvironmentStrings("%APPDATA%") & "\nodejs\node.exe",_
    "C:\nodejs\node.exe",_
    "C:\Program Files\nodejs\node.exe",_
    "C:\Program Files (x86)\nodejs\node.exe"_)

For Each path In commonPaths
    If FSO.FileExists(path) Then
        nodeExe = path
        Exit For
    End If
Next

If nodeExe = "" Then
    ' Fallback to PATH
    nodeExe = "node"
End If

WshShell.Run "cmd /c cd /d """ & scriptDir & """ && """ & nodeExe & """ server.js", 0, False
