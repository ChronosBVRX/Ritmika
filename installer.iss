; Rítmika — Inno Setup Installer (autocontenido)
; Requiere Inno Setup 6.x (iscc.exe). Genera Ritmika-Setup-x64.exe

#define MyAppName "Rítmika"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "Rítmika"
#define MyAppExeName "Ritmika.exe"

[Setup]
AppId={{8E7F9A3C-5B2D-4F1A-9E0C-3D2F1A7B8C9D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Ritmika
DefaultGroupName=Rítmika
OutputDir=installer\output
OutputBaseFilename=Ritmika-Setup-x64-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=ritmika.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Todo el staging limpio dist/desktop (autocontenido, sin relay/tests/docs/.env)
Source: "dist\desktop\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Bootstrapper WebView2 Evergreen (descargado por build.bat, opcional)
Source: "dist\desktop\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Permissions: users-modify

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ritmika.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\ritmika.ico"

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando WebView2 Runtime..."; Check: not IsWebView2Installed; Flags: waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\Ritmika\cache"
Type: filesandordirs; Name: "{localappdata}\Ritmika\logs"

[Code]
function IsWebView2Installed: Boolean;
var
  Key: string;
begin
  Key := 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := RegKeyExists(HKEY_LOCAL_MACHINE, Key);
  if not Result then
    Result := RegKeyExists(HKEY_LOCAL_MACHINE, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}');
end;

function InitializeSetup: Boolean;
var
  Res: Integer;
begin
  Result := True;
  if not IsWebView2Installed then
  begin
    Res := MsgBox('Microsoft Edge WebView2 Runtime no está instalado.' + #13#10 +
      'Rítmika lo necesita para mostrar la pantalla de juego.' + #13#10 + #13#10 +
      '¿Deseas abrir la página de descarga ahora? (se abrirá el navegador)', mbConfirmation, MB_YESNO);
    if Res = IDYES then
      ShellExec('open', 'https://go.microsoft.com/fwlink/p/?LinkId=2124703', '', '', SW_SHOWNORMAL, ewNoWait, Res);
    // No bloquear instalación; GameWindow mostrará error si falta
  end;
end;
