; Pulse 1.0.0: Include in installer and native test harness. Empty result = valid.
Function ValidateInstallPath
  StrCpy $InstallPathPart ""
  ; Trim trailing separators/spaces without allowing a drive root to slip through.
  ${Do}
    StrCpy $InstallPathPart $InstallPath 1 -1
    ${If} $InstallPathPart == "\"
    ${OrIf} $InstallPathPart == " "
      StrCpy $InstallPath $InstallPath -1
    ${Else}
      ${ExitDo}
    ${EndIf}
  ${Loop}
  StrCpy $InstallPathPart $InstallPath 2 1
  ${If} $InstallPath == ""
  ${OrIf} $InstallPathPart != ":\"
    StrCpy $InstallPathPart "Enter a full folder path, such as D:\Apps\Pulse or $LOCALAPPDATA\Programs\Pulse."
    Return
  ${EndIf}
  ClearErrors
  ; Legacy NSIS opcode rejects some not-yet-existing folders. The Windows API does not.
  System::Call 'kernel32::GetFullPathNameW(w "$InstallPath", i ${NSIS_MAX_STRLEN}, w .r0, p 0) i.r1'
  ${If} $1 == 0
  ${OrIf} $1 >= ${NSIS_MAX_STRLEN}
    Goto invalid_install_path
  ${EndIf}
  StrCpy $InstallPath $0
  StrLen $InstallPathLength $InstallPath
  ${If} $InstallPathLength <= 3
  ${OrIf} $InstallPath == "$WINDIR"
  ${OrIf} $InstallPath == "$SYSDIR"
  ${OrIf} $InstallPath == "$PROFILE"
  ${OrIf} $InstallPath == "$DESKTOP"
  ${OrIf} $InstallPath == "$DOCUMENTS"
  ${OrIf} $InstallPath == "$PROFILE\Downloads"
  ${OrIf} $InstallPath == "$PROGRAMFILES"
  ${OrIf} $InstallPath == "$PROGRAMFILES64"
  ${OrIf} $InstallPath == "$LOCALAPPDATA"
  ${OrIf} $InstallPath == "$APPDATA"
    StrCpy $InstallPathPart "Choose a dedicated folder for Pulse, not a drive root, system folder or personal files folder."
    Return
  ${EndIf}
  StrCpy $InstallPathPart ""
  Return
invalid_install_path:
  StrCpy $InstallPathPart "The folder path is not valid. Check the drive and folder name."
FunctionEnd
