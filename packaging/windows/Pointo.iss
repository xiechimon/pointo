; Pointo's Windows installer (Inno Setup 6.1+). Built by .github/workflows/release-windows.yml:
;   ISCC /DAppVersion=0.1.2 /DSourceDir=dist\Pointo /DRepoDir=. /DOutputDir=dist packaging\windows\Pointo.iss
; Per-user install (no admin prompt), Simplified Chinese wizard, and an optional step that downloads
; the Qwen3-ASR speech model with a progress bar: Pointo's ModelScope mirror first (fast from
; mainland China), then hf-mirror.com and huggingface.co, checked against its SHA-256 and written where Pointo looks
; for it (%LOCALAPPDATA%\Pointo\models, with the .verified.json receipt src/local_asr.rs reads).
; Skipped or failed, Pointo downloads the model itself at first launch.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\dist\Pointo"
#endif
#ifndef RepoDir
  #define RepoDir "..\.."
#endif
#ifndef OutputDir
  #define OutputDir "..\..\dist"
#endif

#define ModelFile "Qwen3-ASR-0.6B-Q8_0.gguf"
#define ModelBytes "850423456"
#define ModelSha256 "f081b2d5e23bd669d92cc331d722a8a0681943b8e6f34b48996fd5c319b5acd8"
#define ModelScope "https://www.modelscope.cn/models/xiemom/Qwen3-ASR-0.6B-gguf/resolve/master/Qwen3-ASR-0.6B-Q8_0.gguf"
#define ModelMirror "https://hf-mirror.com/handy-computer/Qwen3-ASR-0.6B-gguf/resolve/e4e16599b900eb0cb36e524514756bb92eb092b7/Qwen3-ASR-0.6B-Q8_0.gguf"
#define ModelOrigin "https://huggingface.co/handy-computer/Qwen3-ASR-0.6B-gguf/resolve/e4e16599b900eb0cb36e524514756bb92eb092b7/Qwen3-ASR-0.6B-Q8_0.gguf"

[Setup]
AppId={{6C1E4B2A-7F0D-4E8B-9C35-5A2D7B9E1F40}
AppName=Pointo
AppVersion={#AppVersion}
AppVerName=Pointo {#AppVersion}
AppPublisher=xiechimon
AppPublisherURL=https://xiechimon.github.io/pointo/
AppSupportURL=https://github.com/xiechimon/pointo
DefaultDirName={localappdata}\Programs\Pointo
DefaultGroupName=Pointo
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename=Pointo-{#AppVersion}-windows-x64-setup
SetupIconFile={#RepoDir}\assets\Pointo.ico
WizardImageFile={#RepoDir}\packaging\windows\wizard-large.bmp
WizardSmallImageFile={#RepoDir}\packaging\windows\wizard-small.bmp
UninstallDisplayIcon={app}\pointo.exe
UninstallDisplayName=Pointo
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "zh"; MessagesFile: "{#RepoDir}\packaging\windows\ChineseSimplified.isl"

[CustomMessages]
zh.ModelTitle=语音模型
zh.ModelSubtitle=Pointo 用本机的 Qwen3-ASR 模型把你说的话转成文字
zh.ModelBody=Qwen3-ASR 是阿里通义千问的语音识别小模型，听得懂普通话、粤语和中英混说。它完全在这台电脑上运行，录音不会上传。%n%n模型约 850 MB，只需下载一次：优先从阿里魔搭（ModelScope）下载，国内通常一分钟内完成；失败时改用 hf-mirror.com 和 huggingface.co，下载后会校验文件完整性。%n%n现在不下载也可以：Pointo 第一次启动时会在后台自动下载，下载完成前录的内容会在之后补上文字。
zh.ModelDownload=现在下载语音模型（约 850 MB，推荐）
zh.ModelPresent=这台电脑上已经有 Qwen3-ASR 模型，不需要再下载。
zh.ModelDownloading=正在下载语音模型
zh.ModelDownloadingSub=约 850 MB，取决于网速，可能需要几分钟
zh.ModelFailed=语音模型没有下载成功：%1%n%nPointo 会在第一次启动时自动重试，不影响安装。
zh.LaunchPointo=启动 Pointo
zh.DesktopIcon=在桌面创建快捷方式

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Pointo"; Filename: "{app}\pointo.exe"
Name: "{autodesktop}\Pointo"; Filename: "{app}\pointo.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\pointo.exe"; Description: "{cm:LaunchPointo}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/f /im pointo.exe"; Flags: runhidden; RunOnceId: "StopPointo"

[Code]
var
  ModelPage: TWizardPage;
  ModelCheck: TNewCheckBox;
  DownloadPage: TDownloadWizardPage;
  ModelReady: Boolean;

function ModelsDir(): String;
begin
  Result := ExpandConstant('{localappdata}\Pointo\models');
end;

function HasModel(): Boolean;
begin
  Result := FileExists(ModelsDir() + '\{#ModelFile}.verified.json')
    or FileExists(ExpandConstant('{userappdata}\hex\models\{#ModelFile}.verified.json'));
end;

procedure InitializeWizard();
var
  Body: TNewStaticText;
begin
  ModelPage := CreateCustomPage(wpSelectTasks, CustomMessage('ModelTitle'), CustomMessage('ModelSubtitle'));
  Body := TNewStaticText.Create(ModelPage);
  Body.Parent := ModelPage.Surface;
  Body.WordWrap := True;
  Body.Width := ModelPage.SurfaceWidth;
  Body.Caption := CustomMessage('ModelBody');
  Body.AdjustHeight();

  ModelCheck := TNewCheckBox.Create(ModelPage);
  ModelCheck.Parent := ModelPage.Surface;
  ModelCheck.Top := Body.Top + Body.Height + ScaleY(16);
  ModelCheck.Width := ModelPage.SurfaceWidth;
  ModelCheck.Height := ScaleY(22);
  if HasModel() then
  begin
    ModelCheck.Caption := CustomMessage('ModelPresent');
    ModelCheck.Checked := False;
    ModelCheck.Enabled := False;
  end else begin
    ModelCheck.Caption := CustomMessage('ModelDownload');
    ModelCheck.Checked := True;
  end;

  DownloadPage := CreateDownloadPage(CustomMessage('ModelDownloading'), CustomMessage('ModelDownloadingSub'), nil);
end;

function TryDownload(Url: String): Boolean;
begin
  Result := False;
  DownloadPage.Clear;
  DownloadPage.Add(Url, '{#ModelFile}', '{#ModelSha256}');
  try
    DownloadPage.Download;
    Result := True;
  except
    Log('model download from ' + Url + ' failed: ' + GetExceptionMessage);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Error: String;
begin
  Result := True;
  // Silent installs (CI, IT deployment) leave the model to Pointo's own first-launch download.
  if (CurPageID = wpReady) and not WizardSilent() and ModelCheck.Checked and not HasModel() then
  begin
    DownloadPage.Show;
    try
      ModelReady := TryDownload('{#ModelScope}');
      if not ModelReady then
        ModelReady := TryDownload('{#ModelMirror}');
      if not ModelReady then
        ModelReady := TryDownload('{#ModelOrigin}');
      if not ModelReady then
      begin
        Error := 'modelscope.cn / hf-mirror.com / huggingface.co';
        SuppressibleMsgBox(FmtMessage(CustomMessage('ModelFailed'), [Error]), mbInformation, MB_OK, IDOK);
      end;
    finally
      DownloadPage.Hide;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Receipt: String;
begin
  if (CurStep = ssPostInstall) and ModelReady then
  begin
    ForceDirectories(ModelsDir());
    if FileCopy(ExpandConstant('{tmp}\{#ModelFile}'), ModelsDir() + '\{#ModelFile}', False) then
    begin
      Receipt := '{"sha256":"{#ModelSha256}","bytes":{#ModelBytes},"urls":["{#ModelScope}","{#ModelMirror}","{#ModelOrigin}"]}';
      SaveStringToFile(ModelsDir() + '\{#ModelFile}.verified.json', Receipt, False);
    end;
  end;
end;
