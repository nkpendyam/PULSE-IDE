!macro NSIS_HOOK_POSTINSTALL
  ; Ensure a desktop shortcut is available after install.
  Call CreateOrUpdateDesktopShortcut

  ; Create a terminal launcher command: `kyro`
  CreateDirectory "$LOCALAPPDATA\Microsoft\WindowsApps"
  FileOpen $0 "$LOCALAPPDATA\Microsoft\WindowsApps\kyro.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" %*$\r$\n"
  FileClose $0

  ; File context menu: Open with Kyro IDE
  WriteRegStr SHCTX "Software\Classes\*\shell\Open with ${PRODUCTNAME}" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\*\shell\Open with ${PRODUCTNAME}\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  ; Folder context menu: Open with Kyro IDE
  WriteRegStr SHCTX "Software\Classes\Directory\shell\Open with ${PRODUCTNAME}" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\Open with ${PRODUCTNAME}\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  ; Folder background context menu: Open folder in Kyro IDE
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\Open with ${PRODUCTNAME}" "" "Open with ${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\Directory\Background\shell\Open with ${PRODUCTNAME}\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%V$\""
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove terminal launcher and shell integrations.
  Delete "$LOCALAPPDATA\Microsoft\WindowsApps\kyro.cmd"
  DeleteRegKey SHCTX "Software\Classes\*\shell\Open with ${PRODUCTNAME}"
  DeleteRegKey SHCTX "Software\Classes\Directory\shell\Open with ${PRODUCTNAME}"
  DeleteRegKey SHCTX "Software\Classes\Directory\Background\shell\Open with ${PRODUCTNAME}"
!macroend
