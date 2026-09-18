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
; Ejecutable y DLLs WebView2 (generados por build.bat)
Source: "Ritmika.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.Core.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "Microsoft.Web.WebView2.WinForms.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "ritmika.ico"; DestDir: "{app}"; Flags: ignoreversion

; Runtime Node autocontenido (generado por scripts/download_node_runtime.ps1)
Source: "runtime\node\node.exe"; DestDir: "{app}\runtime\node"; Flags: ignoreversion
Source: "runtime\node\*"; DestDir: "{app}\runtime\node"; Flags: ignoreversion recursesubdirs createallsubdirs

; Dependencias de producción (copiadas por build.bat -> dist/node_modules filtrado)
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: ".bin\*,.cache\*,*.map"

; Servidor y frontend (sin secretos)
Source: "server\*"; DestDir: "{app}\server"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.log,*.db-shm,*.db-wal,.env,*.tmp"
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\ritmika.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\ritmika.ico"

[Run]
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
