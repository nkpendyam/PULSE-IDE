; PULSE IDE Windows Installer Script (NSIS)
; Requires NSIS 3.0+

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Application information
Name "PULSE IDE"
OutFile "PULSE-IDE-Setup-1.0.0.exe"
InstallDir "$LOCALAPPDATA\PULSE IDE"
InstallDirRegKey HKCU "Software\PULSE IDE" "Install_Dir"
RequestExecutionLevel user

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer-sidebar.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "installer-header.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

Section "PULSE IDE" SecInstall
  SectionIn RO
  
  ; Set output path
  SetOutPath $INSTDIR
  
  ; Copy files
  File /r "..\src-tauri\target\release\*.*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\PULSE IDE"
  CreateShortcut "$SMPROGRAMS\PULSE IDE\PULSE IDE.lnk" "$INSTDIR\PULSE IDE.exe"
  CreateShortcut "$SMPROGRAMS\PULSE IDE\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\PULSE IDE.lnk" "$INSTDIR\PULSE IDE.exe"
  
  ; Register application
  WriteRegStr HKCU "Software\PULSE IDE" "Install_Dir" $INSTDIR
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "DisplayName" "PULSE IDE"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "DisplayIcon" "$INSTDIR\PULSE IDE.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "Publisher" "PULSE Team"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "DisplayVersion" "1.0.0"
  
  ; Register file associations
  WriteRegStr HKCR ".pulse-project" "" "PULSEIDE.Project"
  WriteRegStr HKCR "PULSEIDE.Project" "" "PULSE IDE Project"
  WriteRegStr HKCR "PULSEIDE.Project\DefaultIcon" "" "$INSTDIR\PULSE IDE.exe,0"
  WriteRegStr HKCR "PULSEIDE.Project\shell\open\command" "" '"$INSTDIR\PULSE IDE.exe" "%1"'
  
  ; Calculate installed size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\PULSE IDE\*.*"
  RMDir "$SMPROGRAMS\PULSE IDE"
  Delete "$DESKTOP\PULSE IDE.lnk"
  
  ; Remove registry keys
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE"
  DeleteRegKey HKCU "Software\PULSE IDE"
  DeleteRegKey HKCR ".pulse-project"
  DeleteRegKey HKCR "PULSEIDE.Project"
SectionEnd

Function .onInit
  ; Check if already installed
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE IDE" "UninstallString"
  ${If} $0 != ""
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "PULSE IDE is already installed.$\n$\nClick OK to remove the previous version or Cancel to cancel this upgrade." IDOK uninst
    Abort
    
    uninst:
      ExecWait '$0 _?=$INSTDIR'
  ${EndIf}
FunctionEnd
