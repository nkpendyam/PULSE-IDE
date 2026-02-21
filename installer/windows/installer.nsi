!include "MUI2.nsh"
!include "FileFunc.nsh"

; Application information
Name "Kyro IDE"
OutFile "Kyro-IDE-Setup.exe"
InstallDir "$PROGRAMFILES64\Kyro IDE"
InstallDirRegKey HKLM "Software\Kyro IDE" "Install_Dir"
RequestExecutionLevel admin

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "icons\wizard.bmp"

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

; Installer sections
Section "Kyro IDE" SecInstall
    SetOutPath "$INSTDIR"
    
    ; Copy all files from the bundle
    File /r "bundle\*.*"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\Kyro IDE"
    CreateShortcut "$SMPROGRAMS\Kyro IDE\Kyro IDE.lnk" "$INSTDIR\Kyro IDE.exe"
    CreateShortcut "$SMPROGRAMS\Kyro IDE\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\Kyro IDE.lnk" "$INSTDIR\Kyro IDE.exe"
    
    ; Register uninstaller
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE" "DisplayName" "Kyro IDE"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE" "DisplayIcon" "$INSTDIR\Kyro IDE.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE" "Publisher" "Kyro IDE Team"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE" "DisplayVersion" "1.1.0"
    
    ; File associations
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".ts" "TypeScript File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".tsx" "TypeScript React File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".js" "JavaScript File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".jsx" "JavaScript React File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".py" "Python File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".rs" "Rust File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".go" "Go File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".json" "JSON File"
    ${RegisterExtension} "$INSTDIR\Kyro IDE.exe" ".md" "Markdown File"
SectionEnd

; Uninstaller
Section "Uninstall"
    ; Remove files
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\Kyro IDE\*.*"
    RMDir "$SMPROGRAMS\Kyro IDE"
    Delete "$DESKTOP\Kyro IDE.lnk"
    
    ; Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Kyro IDE"
    DeleteRegKey HKLM "Software\Kyro IDE"
    
    ; Remove file associations
    ${UnRegisterExtension} ".ts" "TypeScript File"
    ${UnRegisterExtension} ".tsx" "TypeScript React File"
    ${UnRegisterExtension} ".js" "JavaScript File"
    ${UnRegisterExtension} ".jsx" "JavaScript React File"
    ${UnRegisterExtension} ".py" "Python File"
    ${UnRegisterExtension} ".rs" "Rust File"
    ${UnRegisterExtension} ".go" "Go File"
    ${UnRegisterExtension} ".json" "JSON File"
    ${UnRegisterExtension} ".md" "Markdown File"
SectionEnd
