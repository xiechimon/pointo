<p align="center">
  <img src="assets/app-icon.png" width="160" alt="Pointo 图标：蓝色圆角方块里一只白色的小幽灵">
</p>

<h1 align="center">Pointo</h1>

<p align="center"><b>指给 AI 看，而不是讲给它听。</b></p>

<p align="center">
  <a href="https://xiechimon.github.io/pointo/releases/Pointo-latest-arm64.dmg">下载 macOS 版</a> ·
  <a href="https://xiechimon.github.io/pointo/releases/Pointo-latest-windows-x64-setup.exe">下载 Windows 版</a> ·
  <a href="https://xiechimon.github.io/pointo/">项目主页</a> ·
  <a href="https://github.com/xiechimon/pointo/releases/latest">全部版本（含 Windows 预览版）</a>
</p>

---

写代码时遇到界面问题，打字描述往往说不清。按一下 `⌥⇧S`，Pointo 开始录屏：你边说边点，按住 `⇧` 在屏幕上画圈标重点，再按一次 `⌥⇧S` 结束。Pointo 把录屏、语音和你的标记压成一个 AI 一眼就能读懂的小目录，送到你正在开发的项目里，任何 AI 编程工具都能直接看。

Pointo 基于 [kitlangton/scrawl](https://github.com/kitlangton/scrawl)（MIT）修改，面向中文用户：

- **本地中文语音转写**：默认用阿里通义千问的 **Qwen3-ASR 0.6B** 模型，在你的电脑上运行，听得懂普通话、粤语和中英混说，录音不上传、不需要 API Key。
- **投递到任意项目**：不绑定任何特定 AI 工具。录制会写进项目里的 `.pointo/` 目录，Claude Code、Codex、Cursor、Gemini CLI、Qwen Code 等都能读。
- **中文界面**，模型下载优先走国内镜像。

## 安装

**macOS**（Apple 芯片，macOS 15 及以上；macOS 26 上有 Liquid Glass 图标和更多系统效果）

1. 下载 [Pointo-latest-arm64.dmg](https://xiechimon.github.io/pointo/releases/Pointo-latest-arm64.dmg)（国内网络也能下载；GitHub Releases 里有同样的文件），把 Pointo 拖进「应用程序」。
2. 这个版本没有经过 Apple 公证，第一次双击会被 macOS 拦下。打开 **系统设置 › 隐私与安全性**，在页面下方点 **仍要打开**，再确认一次（macOS 15 起右键「打开」已经不能放行）。也可以在终端运行一行命令直接放行：

   ```bash
   xattr -dr com.apple.quarantine /Applications/Pointo.app
   ```

3. 欢迎导览会引导你打开三项权限：**屏幕与系统录音**、**麦克风**、**辅助功能**。都打开后就能用了。
4. 第一次启动会在后台下载语音模型（约 850 MB，先从 hf-mirror.com 下载，失败再换 huggingface.co），下载好之前录的内容会在下载完成后自动补上转写。

之后的更新由 App 自己完成（设置 › 关于 › 检查更新）。

**Windows**（预览版，Windows 10 2004 及以上，x64）

1. 下载安装程序 [Pointo-latest-windows-x64-setup.exe](https://xiechimon.github.io/pointo/releases/Pointo-latest-windows-x64-setup.exe)（或到 [Releases](https://github.com/xiechimon/pointo/releases/latest)）并运行。安装程序没有签名，Windows 提示「已保护你的电脑」时点 **更多信息 → 仍要运行**。
2. 安装向导是中文的，不需要管理员权限，会装到你自己的用户目录，并创建开始菜单快捷方式（桌面快捷方式可选）。
3. 向导里有一步「语音模型」：勾选后会在安装时直接下载 Qwen3-ASR 模型（约 850 MB，带进度条，优先国内镜像，下载后校验完整性）。不勾也行，Pointo 第一次启动时会在后台自动下载。
4. 卸载：在「设置 › 应用」里找到 Pointo 卸载即可。

## 怎么用

| 操作 | 快捷键 |
|---|---|
| 开始 / 结束录制 | `⌥⇧S` |
| 在屏幕上画（红色笔迹） | 录制时按住 `⇧` 拖动 |
| 把最近一次录制粘贴到前台应用 | `⌥⇧V` |
| 撤销上一笔 / 取消录制 | `⌘Z` / `Esc` |

录制结束后，Pointo 会：

1. **复制到剪贴板**：总览图和文字说明，直接粘贴进任何 AI 对话框或终端。
2. **投递到项目**：如果识别到你正在开发的项目，就写进 `<项目>/.pointo/captures/`，浮条上会显示「已发送到 <项目名>」，3 秒内可以取消或改投到别的项目。

### 产物

每次录制生成一个 `.pointo` 目录：

```
pointo-1794650000000.pointo/
├── contact-sheet.png   总览图：带编号的关键帧拼在一张图里，红色笔迹和点击波纹都画在上面
├── frames/             每个关键帧的全分辨率图
├── summary.md          给 AI 读的说明：每个关键帧时你说了什么、做了什么
├── pointo.json         机器可读的完整清单
├── recording.mp4       录屏
└── audio.wav           录音
```

关键帧只在真正有动作、标记或画面变化时才切，不会因为你停顿说话就多出一堆静止画面。

## 投递到任意项目

Pointo 按这个顺序决定一段录制该去哪个项目，找到就停：

1. **固定项目**：设置 › 通用 › 项目文件夹里选了一个固定项目。
2. **网页登记**：浏览器里的页面通过 Pointo 的 `/sdk.js` 登记了自己的项目目录（`data-directory`）。
3. **本地端口**：浏览器停在 `localhost` 页面时，找到监听那个端口的进程，取它所在的 git 仓库。
4. **终端目录**：录的是终端时，取终端当前所在的目录。

都没找到时只复制到剪贴板，浮条上会列出最近用过的项目，点一下就发过去。

投递时 Pointo 在项目里写入：

```
<项目>/.pointo/
├── README.md                   告诉 AI 这个目录是什么
├── latest                      最新一条录制的路径
└── captures/<录制名>/          总览图、关键帧、summary.md、pointo.json
```

并在项目的 `.git/info/exclude` 里加一行 `.pointo/`，不会出现在 `git status` 里，也不会改你的 `.gitignore`。录屏和录音这类大文件留在原处（`~/Library/Application Support/pointo/captures/`），`summary.md` 里写着它们的位置。

## 语音转写

| 引擎 | 说明 |
|---|---|
| **Qwen3-ASR（本机，默认）** | 普通话、粤语、英文及中英混说，另支持 27 种语言。在设置 › 录制里可以指定语言或自动识别。 |
| Command | 在 `~/.config/pointo/config.json` 里配置 `transcribeCommand`，用你自己的程序转写。 |

Command 出错时，这段录制自动改用 Qwen3-ASR。如果你的电脑上 Hex 已经下载过 Qwen3-ASR 模型，Pointo 会直接用它，不再重复下载。

## 配置

设置窗口覆盖了常用选项。完整配置在 `~/.config/pointo/config.json`：

| 键 | 作用 |
|---|---|
| `project` | 固定投递的项目文件夹 |
| `recentProjects` | 最近用过的项目（自动维护） |
| `autoSend` | 是否自动投递到识别出的项目，默认开 |
| `transcriber` | `"qwen"`（默认）或 `"command"`；旧配置里的 `"apple"`、`"hex"` 按 `"qwen"` 处理 |
| `language` | 转写语言，例如 `"zh-CN"`、`"yue"`、`"en-US"`；不写就自动识别（旧配置里叫 `appleLocale`，仍然有效） |
| `capturesDir` | 录制保存位置 |

## 隐私

- 录屏、录音、转写都在本机完成，Pointo 不上传任何内容，没有账号，没有统计。
- 联网只有两处：第一次下载语音模型，以及检查更新（读取本项目主页上的 `appcast.xml`）。

## 从源码构建

需要 Apple 芯片的 Mac、Xcode 26（含 Metal 工具链：`xcodebuild -downloadComponent MetalToolchain`）、Rust、`cmake`。

```bash
git clone https://github.com/xiechimon/pointo.git && cd pointo
cargo build --release
./scripts/install-app.sh        # 打包、签名并安装到 ~/Applications/Pointo.app
cargo test
```

签名会自动使用本机的开发者证书（`scripts/sign-identity.sh`），没有证书时用临时签名。发布流程见 `scripts/release-app.sh`。给 AI 代理的开发说明在 [AGENTS.md](AGENTS.md)。开发者可以用 `target/release/pointo` 的子命令（`demo`、`inspect`、`reprocess` 等，`--help` 列出全部）调试。

## 致谢与许可

- 原项目 [Scrawl](https://github.com/kitlangton/scrawl) 由 Kit Langton 开发，MIT 许可。Pointo 在它的基础上改名、改为投递到项目文件夹、默认本地中文转写，并做了中文界面。
- 语音转写使用 [Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR)（Apache-2.0）和 [transcribe.cpp](https://crates.io/crates/transcribe-cpp)，模型文件与 [Hex](https://github.com/anomalyco/hex) 使用的是同一份。
- 本项目以 [MIT](LICENSE) 许可发布。
