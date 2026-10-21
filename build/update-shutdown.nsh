; Wait for Windows loader/decoder handles to be released. Never overwrite a locked file.
!macro PulseWaitForRelease PREFIX
  StrCpy $R8 0
${PREFIX}_wait_release:
  StrCpy $R9 0
  !insertmacro PulseProbeFile "${PREFIX}_exe" "${EXE}"
  !insertmacro PulseProbeFile "${PREFIX}_asar" "resources\app.asar"
  !insertmacro PulseProbeFile "${PREFIX}_bridge" "resources\media-bridge\PulseMediaBridge.exe"
  ${If} $R9 == 1
    IntOp $R8 $R8 + 1
    ${If} $R8 < 40
      Sleep 250
      Goto ${PREFIX}_wait_release
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Windows is still releasing Pulse files. Close Pulse and its audio session, then retry. Your music library and settings will not be removed." IDRETRY ${PREFIX}_retry_release
    Abort
${PREFIX}_retry_release:
    StrCpy $R8 0
    Goto ${PREFIX}_wait_release
  ${EndIf}
!macroend
!macro PulseProbeFile LABEL RELATIVE
  IfFileExists "$INSTDIR\${RELATIVE}" 0 ${LABEL}_probe_done
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\${RELATIVE}", i 0x80000000, i 0, p 0, i 3, i 0, p 0) p .r7'
  ${If} $7 == -1
    StrCpy $R9 1
  ${Else}
    System::Call 'kernel32::CloseHandle(p r7)'
  ${EndIf}
${LABEL}_probe_done:
!macroend
