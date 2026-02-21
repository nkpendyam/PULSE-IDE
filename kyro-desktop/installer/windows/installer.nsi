; PULSE Windows Installer Script
; NSIS Installer Configuration

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Application information
Name "PULSE"
OutFile "PULSE-Setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\PULSE"
InstallDirRegKey HKLM "Software\PULSE" "Install_Dir"
RequestExecutionLevel admin

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Installer sections
Section "PULSE Core (Required)" SecCore
    SectionIn RO
    
    SetOutPath $INSTDIR
    
    ; Copy main executable
    File "..\ui\src-tauri\target\release\pulse-ui.exe"
    
    ; Copy kernel
    File "..\runtime\target\release\pulse-kernel.exe"
    
    ; Copy model proxy
    File "..\model-proxy\target\release\pulse-model-proxy.exe"
    
    ; Copy configuration
    File "..\pulse.toml"
    
    ; Create directories
    CreateDirectory "$INSTDIR\models"
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\data"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Create registry keys
    WriteRegStr HKLM "Software\PULSE" "Install_Dir" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE" "DisplayName" "PULSE"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    
SectionEnd

Section "Start Menu Shortcuts" SecShortcuts
    CreateDirectory "$SMPROGRAMS\PULSE"
    CreateShortcut "$SMPROGRAMS\PULSE\PULSE.lnk" "$INSTDIR\pulse-ui.exe"
    CreateShortcut "$SMPROGRAMS\PULSE\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Desktop Shortcut" SecDesktop
    CreateShortcut "$DESKTOP\PULSE.lnk" "$INSTDIR\pulse-ui.exe"
SectionEnd

; Uninstaller
Section "Uninstall"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\PULSE"
    DeleteRegKey HKLM "Software\PULSE"
    Delete "$SMPROGRAMS\PULSE\*.*"
    RMDir "$SMPROGRAMS\PULSE"
    Delete "$DESKTOP\PULSE.lnk"
    Delete "$INSTDIR\*.*"
    RMDir "$INSTDIR"
SectionEnd
